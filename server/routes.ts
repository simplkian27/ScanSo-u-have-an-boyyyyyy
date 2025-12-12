import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { createHash } from "crypto";
import { checkDatabaseHealth, db } from "./db";
import { 
  materials, halls, stations, stands, boxes, taskEvents, tasks, warehouseContainers,
  assertAutomotiveTransition, getAutomotiveTimestampFieldForStatus,
  type Material, type Hall, type Station, type Stand, type Box, type TaskEvent
} from "@shared/schema";
import { eq, and, desc, notInArray, isNull } from "drizzle-orm";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Middleware to check if the request has a valid user ID
 * Note: In production, this should verify a session token
 * For now, we check x-user-id header or userId in body
 */
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.headers["x-user-id"] as string || req.body?.userId;
  
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ error: "Invalid user" });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: "Account is deactivated" });
  }

  // Attach user to request for downstream handlers
  (req as any).authUser = user;
  next();
}

/**
 * Middleware to check if the authenticated user has admin role
 * Must be used after requireAuth
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).authUser;
  
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const role = user.role?.toUpperCase();
  if (role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}

// Normalize user role to lowercase for frontend consistency
function normalizeUserRole<T extends { role?: string }>(user: T): T {
  return {
    ...user,
    role: user.role?.toLowerCase() || "driver",
  };
}

// Helper to prepare user for API response (without password, with normalized role)
function prepareUserResponse<T extends { password?: string; role?: string }>(user: T): Omit<T, "password"> {
  const { password, ...userWithoutPassword } = user;
  return normalizeUserRole(userWithoutPassword);
}

// ============================================================================
// BERLIN TIMEZONE HELPERS (Europe/Berlin)
// ============================================================================

function getTodayBerlin(): Date {
  const berlinDateStr = new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' });
  const berlinDate = new Date(berlinDateStr);
  berlinDate.setHours(0, 0, 0, 0);
  return berlinDate;
}

function formatDateBerlin(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
}

// ============================================================================
// DAILY TASK SCHEDULER
// ============================================================================

async function generateDailyTasksScheduled() {
  try {
    console.log("[DailyTaskScheduler] Running scheduled task generation...");
    const today = getTodayBerlin();
    const todayStr = formatDateBerlin(new Date());
    
    // Cancel previous OPEN daily tasks from earlier dates
    const openDailyTasks = await db.select().from(tasks).where(
      and(eq(tasks.taskType, "DAILY_FULL"), eq(tasks.status, "OPEN"))
    );
    let cancelledCount = 0;
    for (const task of openDailyTasks) {
      if (task.dedupKey && !task.dedupKey.endsWith(`:${todayStr}`)) {
        await db.update(tasks).set({
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "Auto-cancelled: New daily task generated",
          updatedAt: new Date()
        }).where(eq(tasks.id, task.id));
        cancelledCount++;
      }
    }
    if (cancelledCount > 0) {
      console.log(`[DailyTaskScheduler] Auto-cancelled ${cancelledCount} previous OPEN daily tasks.`);
    }
    
    // Get dailyFull stands
    const dailyFullStands = await db.select().from(stands).where(
      and(eq(stands.dailyFull, true), eq(stands.isActive, true))
    );
    
    let createdCount = 0;
    let skippedCount = 0;
    for (const stand of dailyFullStands) {
      const dedupKey = `DAILY:${stand.id}:${todayStr}`;
      try {
        await db.insert(tasks).values({
          title: `Tägliche Abholung - Stand ${stand.identifier}`,
          description: `Automatisch generierte tägliche Abholung`,
          containerID: stand.id,
          boxId: null,
          standId: stand.id,
          materialType: stand.materialId || null,
          taskType: "DAILY_FULL",
          status: "OPEN",
          priority: "normal",
          scheduledFor: today,
          dedupKey,
        });
        await db.update(stands).set({
          lastDailyTaskGeneratedAt: new Date(),
          updatedAt: new Date()
        }).where(eq(stands.id, stand.id));
        createdCount++;
      } catch (e: any) {
        if (e?.code === '23505') {
          skippedCount++;
          continue;
        }
        console.error(`[DailyTaskScheduler] Failed to create task for stand ${stand.id}:`, e);
      }
    }
    console.log(`[DailyTaskScheduler] Completed. Created: ${createdCount}, Skipped (duplicates): ${skippedCount}`);
  } catch (error) {
    console.error("[DailyTaskScheduler] Error:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Request logging middleware
  app.use("/api", (req, res, next) => {
    const start = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Add requestId to response header for debugging
    res.setHeader("X-Request-Id", requestId);
    
    // Log response when finished
    res.on("finish", () => {
      const duration = Date.now() - start;
      const logMessage = `${req.method} ${req.path} ${res.statusCode} in ${duration}ms`;
      
      // Truncate response body for logging
      const responseBody = (res as any)._logBody;
      const bodySnippet = responseBody 
        ? JSON.stringify(responseBody).substring(0, 100) + (JSON.stringify(responseBody).length > 100 ? "…" : "")
        : "";
      
      console.log(`${logMessage} :: ${bodySnippet}`);
    });
    
    next();
  });

  // Quick ping endpoint - no database, instant response for connectivity testing
  app.get("/api/debug/ping", (req, res) => {
    res.json({ 
      pong: true, 
      timestamp: new Date().toISOString(),
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasDbUrl: !!process.env.DATABASE_URL,
      }
    });
  });

  // Health check endpoint - verifies backend is running and database is connected
  // Used for monitoring and validating Supabase/PostgreSQL connectivity
  app.head("/api/health", (req, res) => {
    res.status(200).end();
  });

  app.get("/api/health", async (req, res) => {
    try {
      const dbHealth = await checkDatabaseHealth();
      
      if (dbHealth.connected) {
        res.status(200).json({ 
          status: "ok", 
          database: "connected",
          timestamp: new Date().toISOString() 
        });
      } else {
        res.status(503).json({ 
          status: "degraded", 
          database: "disconnected",
          error: dbHealth.error,
          timestamp: new Date().toISOString() 
        });
      }
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        database: "unknown",
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString() 
      });
    }
  });

  app.get("/api/auth/replit", (req, res) => {
    const userId = req.headers["x-replit-user-id"];
    const userName = req.headers["x-replit-user-name"];
    const userRoles = req.headers["x-replit-user-roles"];

    if (!userId || !userName) {
      return res.status(401).json({ 
        error: "Not authenticated with Replit",
        authenticated: false 
      });
    }

    res.json({
      authenticated: true,
      replitUser: {
        id: userId as string,
        name: userName as string,
        roles: userRoles ? (userRoles as string).split(",") : [],
      }
    });
  });

  app.post("/api/auth/replit/login", async (req, res) => {
    try {
      const userId = req.headers["x-replit-user-id"];
      const userName = req.headers["x-replit-user-name"];

      if (!userId || !userName) {
        return res.status(401).json({ error: "Not authenticated with Replit" });
      }

      const replitId = `replit-${userId}`;
      const replitEmail = `${userName}@replit.user`;

      let user = await storage.getUserByEmail(replitEmail);

      if (!user) {
        const existingUsers = await storage.getUsers();
        const isFirstUser = existingUsers.length === 0;

        user = await storage.createUser({
          email: replitEmail,
          password: hashPassword(`replit-${userId}-${Date.now()}`),
          name: userName as string,
          role: isFirstUser ? "admin" : "driver",
        });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "Account is deactivated" });
      }

      res.json({ user: prepareUserResponse(user) });
    } catch (error) {
      console.error("Replit auth error:", error);
      res.status(500).json({ error: "Replit login failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const hashedPassword = hashPassword(password);
      if (user.password !== hashedPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "Account is deactivated" });
      }

      res.json({ user: prepareUserResponse(user) });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      const usersWithoutPasswords = users.map((user) => prepareUserResponse(user));
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(prepareUserResponse(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Admin-only: Create new user
  app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { email, password, name, role } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and name are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "Email already exists" });
      }

      const hashedPassword = hashPassword(password);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        role: role || "driver",
      });

      res.status(201).json(prepareUserResponse(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(prepareUserResponse(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // ============================================================================
  // DEPARTMENTS
  // ============================================================================

  app.get("/api/departments", async (req, res) => {
    try {
      const departmentList = await storage.getDepartments();
      res.json(departmentList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  app.get("/api/departments/:id", async (req, res) => {
    try {
      const department = await storage.getDepartment(req.params.id);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json(department);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch department" });
    }
  });

  app.post("/api/departments", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, code, description } = req.body;
      
      if (!name || !code) {
        return res.status(400).json({ error: "Name and code are required" });
      }

      const department = await storage.createDepartment({
        name,
        code,
        description: description || null,
      });

      res.status(201).json(department);
    } catch (error) {
      if (error instanceof Error && error.message.includes("unique")) {
        return res.status(409).json({ error: "Department code already exists" });
      }
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  app.patch("/api/departments/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const department = await storage.updateDepartment(req.params.id, req.body);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json(department);
    } catch (error) {
      if (error instanceof Error && error.message.includes("unique")) {
        return res.status(409).json({ error: "Department code already exists" });
      }
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteDepartment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json({ success: true, message: "Department deactivated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  // ============================================================================
  // CUSTOMERS (LEGACY - Original waste container management)
  // These routes support the original customer-based container workflow.
  // The app now primarily uses the Automotive Factory workflow.
  // Kept for backwards compatibility with existing data.
  // ============================================================================

  app.get("/api/customers", async (req, res) => {
    try {
      const customerList = await storage.getCustomers();
      res.json(customerList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  // Admin-only: Create new customer
  app.post("/api/customers", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, address, contactName, contactPhone, contactEmail, notes } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Customer name is required" });
      }

      const customer = await storage.createCustomer({
        name,
        address: address || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
        notes: notes || null,
        isActive: true,
      });

      res.status(201).json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // ============================================================================
  // CUSTOMER CONTAINERS (LEGACY - Original waste container management)
  // These routes support customer-site containers from the original workflow.
  // The app now primarily uses Boxes/Stands in the Automotive Factory workflow.
  // Kept for backwards compatibility with existing data.
  // ============================================================================

  app.get("/api/containers/customer", async (req, res) => {
    try {
      const containers = await storage.getCustomerContainers();
      res.json(containers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer containers" });
    }
  });

  app.get("/api/containers/customer/:id", async (req, res) => {
    try {
      const container = await storage.getCustomerContainer(req.params.id);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch container" });
    }
  });

  app.get("/api/containers/customer/qr/:qrCode", async (req, res) => {
    try {
      // First try by QR code, then by container ID
      let container = await storage.getCustomerContainerByQR(req.params.qrCode);
      if (!container) {
        container = await storage.getCustomerContainer(req.params.qrCode);
      }
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch container" });
    }
  });

  // Admin-only: Create customer container
  app.post("/api/containers/customer", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id, ...rest } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: "Container ID is required" });
      }
      
      // Generate stable QR code based on container type and ID (never changes)
      const stableQrCode = `customer-${id}`;
      
      const container = await storage.createCustomerContainer({
        id,
        ...rest,
        qrCode: stableQrCode, // Always use stable QR code
      });
      res.status(201).json(container);
    } catch (error) {
      console.error("Error creating customer container:", error);
      res.status(500).json({ error: "Failed to create container" });
    }
  });

  app.patch("/api/containers/customer/:id", async (req, res) => {
    try {
      // IMPORTANT: Never allow qrCode to be changed via regular update
      // QR codes must remain stable - use regenerate endpoint for explicit changes
      const { qrCode, ...updateData } = req.body;
      
      const container = await storage.updateCustomerContainer(req.params.id, updateData);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to update container" });
    }
  });

  // Admin-only: Regenerate QR code for customer container
  app.post("/api/containers/customer/:id/regenerate-qr", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      
      const existingContainer = await storage.getCustomerContainer(req.params.id);
      if (!existingContainer) {
        return res.status(404).json({ error: "Container not found" });
      }

      const oldQrCode = existingContainer.qrCode;
      // Generate new stable QR code with timestamp suffix for uniqueness
      const newQrCode = `customer-${req.params.id}-${Date.now()}`;
      
      const container = await storage.updateCustomerContainer(req.params.id, {
        qrCode: newQrCode,
      });

      if (!container) {
        return res.status(500).json({ error: "Failed to regenerate QR code" });
      }

      // Log this significant action
      await storage.createActivityLog({
        type: "SYSTEM_EVENT",
        action: "SYSTEM_EVENT",
        message: `QR-Code für Container ${req.params.id} wurde neu generiert. Bitte neuen Code ausdrucken und am Container anbringen.`,
        userId: userId || null,
        taskId: null,
        containerId: req.params.id,
        scanEventId: null,
        location: null,
        timestamp: new Date(),
        details: `Alter QR-Code: ${oldQrCode}`,
        metadata: { oldQrCode, newQrCode, action: "QR_CODE_REGENERATED" },
      });

      res.json(container);
    } catch (error) {
      console.error("Error regenerating QR code:", error);
      res.status(500).json({ error: "Failed to regenerate QR code" });
    }
  });

  // ============================================================================
  // WAREHOUSE CONTAINERS
  // ============================================================================

  app.get("/api/containers/warehouse", async (req, res) => {
    try {
      const containers = await storage.getWarehouseContainers();
      res.json(containers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch warehouse containers" });
    }
  });

  app.get("/api/containers/warehouse/:id", async (req, res) => {
    try {
      const container = await storage.getWarehouseContainer(req.params.id);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch container" });
    }
  });

  app.get("/api/containers/warehouse/qr/:qrCode", async (req, res) => {
    try {
      // First try by QR code, then by container ID
      let container = await storage.getWarehouseContainerByQR(req.params.qrCode);
      if (!container) {
        container = await storage.getWarehouseContainer(req.params.qrCode);
      }
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch container" });
    }
  });

  // Admin-only: Create warehouse container
  app.post("/api/containers/warehouse", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id, ...rest } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: "Container ID is required" });
      }
      
      // Generate stable QR code based on container type and ID (never changes)
      const stableQrCode = `warehouse-${id}`;
      
      const container = await storage.createWarehouseContainer({
        id,
        ...rest,
        qrCode: stableQrCode, // Always use stable QR code
      });
      res.status(201).json(container);
    } catch (error) {
      console.error("Error creating warehouse container:", error);
      res.status(500).json({ error: "Failed to create container" });
    }
  });

  app.patch("/api/containers/warehouse/:id", async (req, res) => {
    try {
      // IMPORTANT: Never allow qrCode to be changed via regular update
      // QR codes must remain stable - use regenerate endpoint for explicit changes
      const { qrCode, ...updateData } = req.body;
      
      const container = await storage.updateWarehouseContainer(req.params.id, updateData);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      console.error("Error updating warehouse container:", error);
      res.status(500).json({ error: "Failed to update container", details: String(error) });
    }
  });

  // Admin-only: Regenerate QR code for warehouse container
  app.post("/api/containers/warehouse/:id/regenerate-qr", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      
      const existingContainer = await storage.getWarehouseContainer(req.params.id);
      if (!existingContainer) {
        return res.status(404).json({ error: "Container not found" });
      }

      const oldQrCode = existingContainer.qrCode;
      // Generate new stable QR code with timestamp suffix for uniqueness
      const newQrCode = `warehouse-${req.params.id}-${Date.now()}`;
      
      const container = await storage.updateWarehouseContainer(req.params.id, {
        qrCode: newQrCode,
      });

      if (!container) {
        return res.status(500).json({ error: "Failed to regenerate QR code" });
      }

      // Log this significant action
      await storage.createActivityLog({
        type: "SYSTEM_EVENT",
        action: "SYSTEM_EVENT",
        message: `QR-Code für Container ${req.params.id} wurde neu generiert. Bitte neuen Code ausdrucken und am Container anbringen.`,
        userId: userId || null,
        taskId: null,
        containerId: req.params.id,
        scanEventId: null,
        location: null,
        timestamp: new Date(),
        details: `Alter QR-Code: ${oldQrCode}`,
        metadata: { oldQrCode, newQrCode, action: "QR_CODE_REGENERATED" },
      });

      res.json(container);
    } catch (error) {
      console.error("Error regenerating QR code:", error);
      res.status(500).json({ error: "Failed to regenerate QR code" });
    }
  });

  // Reset/Empty warehouse container - sets current amount to 0 (Admin and Driver)
  app.post("/api/containers/warehouse/:id/reset", requireAuth, async (req, res) => {
    try {
      const { reason } = req.body;
      const authUser = (req as any).authUser;
      
      // Both admin and driver roles are allowed (normalize to lowercase for comparison)
      const userRole = authUser?.role?.toLowerCase();
      if (!authUser || (userRole !== "admin" && userRole !== "driver")) {
        return res.status(403).json({ error: "Only admin or driver roles can empty containers" });
      }
      
      const existingContainer = await storage.getWarehouseContainer(req.params.id);
      
      if (!existingContainer) {
        return res.status(404).json({ error: "Container not found" });
      }

      // Check if container is already empty
      if (existingContainer.currentAmount === 0) {
        return res.json({ 
          message: "Container is already empty",
          container: existingContainer
        });
      }

      const previousAmount = existingContainer.currentAmount;
      const container = await storage.updateWarehouseContainer(req.params.id, {
        currentAmount: 0,
        lastEmptied: new Date(),
      });

      if (!container) {
        return res.status(500).json({ error: "Failed to reset container" });
      }

      // Record in fill history that container was emptied
      await storage.createFillHistory({
        warehouseContainerId: req.params.id,
        amountAdded: -previousAmount,
        quantityUnit: existingContainer.quantityUnit,
        taskId: null,
        recordedByUserId: authUser?.id || null,
      });

      const roleLabel = userRole === "admin" ? "Admin" : "Fahrer";
      await storage.createActivityLog({
        type: "CONTAINER_STATUS_CHANGED",
        action: "CONTAINER_STATUS_CHANGED",
        message: `Lagercontainer ${req.params.id} wurde von ${roleLabel} ${authUser?.name || 'Unbekannt'} geleert (${previousAmount} ${existingContainer.quantityUnit} entfernt)`,
        userId: authUser?.id || null,
        taskId: null,
        containerId: req.params.id,
        scanEventId: null,
        location: null,
        timestamp: new Date(),
        details: reason || null,
        metadata: { previousAmount, reason, action: "CONTAINER_EMPTIED", role: authUser.role },
      });

      res.json({ 
        message: "Container successfully emptied",
        container 
      });
    } catch (error) {
      console.error("Error resetting warehouse container:", error);
      res.status(500).json({ error: "Failed to reset container" });
    }
  });

  app.get("/api/containers/warehouse/:id/history", async (req, res) => {
    try {
      const history = await storage.getFillHistory(req.params.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fill history" });
    }
  });

  // ============================================================================
  // TASKS
  // ============================================================================

  // Get tasks with role-based filtering:
  // - ADMIN: sees all tasks (default: open tasks, can filter by status)
  // - DRIVER: sees only their own tasks
  app.get("/api/tasks", async (req, res) => {
    try {
      const { assignedTo, status, date, showAll } = req.query;
      const userId = req.headers["x-user-id"] as string || req.query.userId as string;
      
      // Get user to determine role
      let userRole = "DRIVER"; // Default to driver if no user
      if (userId) {
        const user = await storage.getUser(userId);
        if (user) {
          userRole = user.role?.toUpperCase() || "DRIVER";
        }
      }

      const filters: { assignedTo?: string; status?: string; date?: Date } = {};
      
      // Role-based filtering
      if (userRole === "ADMIN") {
        // Admin sees all tasks, can optionally filter
        if (assignedTo) filters.assignedTo = assignedTo as string;
        // By default, show open tasks (non-completed, non-cancelled) unless showAll is true
        if (status) {
          filters.status = status as string;
        }
      } else {
        // Driver only sees their own tasks
        if (userId) {
          filters.assignedTo = userId;
        } else if (assignedTo) {
          filters.assignedTo = assignedTo as string;
        }
        if (status) filters.status = status as string;
      }
      
      if (date) filters.date = new Date(date as string);

      let taskList = await storage.getTasks(Object.keys(filters).length > 0 ? filters : undefined);
      
      // For admin without specific status filter and not showAll, filter out completed/cancelled
      if (userRole === "ADMIN" && !status && showAll !== "true") {
        const FINAL_STATUSES = ["COMPLETED", "CANCELLED"];
        taskList = taskList.filter(t => !FINAL_STATUSES.includes(t.status));
      }
      
      res.json(taskList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  // Admin-only: Create new task
  // IMPORTANT: All new tasks start with status = OFFEN (open)
  // The client status value is ignored to ensure consistency
  // Pull-based model: assignedTo is null by default (drivers claim tasks)
  app.post("/api/tasks", requireAuth, requireAdmin, async (req, res) => {
    try {
      // Get container to derive materialType if not provided
      let materialType = req.body.materialType;
      if (!materialType && req.body.containerID) {
        const container = await storage.getCustomerContainer(req.body.containerID);
        if (container) {
          materialType = container.materialType || "";
        }
      }
      // Ensure materialType is never null (database constraint)
      materialType = materialType || "";

      // Convert date strings to Date objects for timestamp columns
      // Force status = OFFEN for all new tasks (ignore client value)
      // Force assignedTo = null for pull-based task claiming
      const taskData: Record<string, any> = {
        ...req.body,
        materialType, // Use derived or provided materialType
        status: "OFFEN", // Always start with OFFEN - never trust client status
        assignedTo: null, // Pull-based: no pre-assignment, drivers claim tasks
        claimedByUserId: null, // Not claimed yet
        claimedAt: null, // Not claimed yet
      };

      // Handle scheduledTime conversion
      if (taskData.scheduledTime) {
        const parsedDate = new Date(taskData.scheduledTime);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: "Invalid scheduledTime format" });
        }
        taskData.scheduledTime = parsedDate;
      }

      // Handle other timestamp fields that might be passed as strings
      const timestampFields = ['assignedAt', 'acceptedAt', 'pickedUpAt', 'inTransitAt', 
                               'deliveredAt', 'completedAt', 'cancelledAt', 'pickupTimestamp', 'deliveryTimestamp'];
      for (const field of timestampFields) {
        if (taskData[field]) {
          const parsedDate = new Date(taskData[field]);
          if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: `Invalid ${field} format` });
          }
          taskData[field] = parsedDate;
        }
      }

      // Capacity validation: if deliveryContainerID is specified, check remaining capacity
      if (taskData.deliveryContainerID && taskData.plannedQuantity) {
        const targetContainer = await storage.getWarehouseContainer(taskData.deliveryContainerID);
        if (!targetContainer) {
          return res.status(400).json({ error: "Zielcontainer nicht gefunden" });
        }

        const remainingCapacity = targetContainer.maxCapacity - targetContainer.currentAmount;
        if (taskData.plannedQuantity > remainingCapacity) {
          return res.status(400).json({ 
            error: "Zielcontainer hat nicht genug übriges Volumen für diese Menge.",
            remainingCapacity,
            requestedAmount: taskData.plannedQuantity,
            unit: targetContainer.quantityUnit
          });
        }
      }

      const task = await storage.createTask(taskData as any);
      
      await storage.createActivityLog({
        type: "TASK_CREATED",
        action: "TASK_CREATED",
        message: `Auftrag erstellt für Container ${task.containerID}`,
        userId: req.body.createdBy || null,
        taskId: task.id,
        containerId: task.containerID,
        timestamp: new Date(),
        details: null,
        metadata: null,
        location: null,
        scanEventId: null,
      });

      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create task:", error);
      res.status(500).json({ error: "Failed to create task", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.updateTask(req.params.id, req.body);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Admin-only: Delete a task
  // Removes the task and unlinks related scan events, activity logs, and fill history
  app.delete("/api/tasks/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const taskId = req.params.id;
      
      // Get task info before deletion for logging
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Auftrag nicht gefunden" });
      }

      // Delete the task (storage layer handles related data)
      const deleted = await storage.deleteTask(taskId);
      
      if (!deleted) {
        return res.status(500).json({ error: "Fehler beim Löschen des Auftrags" });
      }

      // Create activity log for the deletion (with null taskId since task is deleted)
      await storage.createActivityLog({
        type: "TASK_DELETED",
        action: "TASK_DELETED",
        message: `Auftrag ${taskId} wurde von Admin ${authUser?.name || 'Unbekannt'} gelöscht`,
        userId: authUser?.id || null,
        taskId: null, // Task no longer exists
        containerId: task.containerID,
        scanEventId: null,
        location: null,
        timestamp: new Date(),
        details: `Status vor Löschung: ${task.status}`,
        metadata: { 
          deletedTaskId: taskId,
          taskStatus: task.status,
          containerId: task.containerID,
          assignedTo: task.assignedTo
        },
      });

      res.json({ message: "Auftrag erfolgreich gelöscht" });
    } catch (error) {
      console.error("Failed to delete task:", error);
      res.status(500).json({ error: "Fehler beim Löschen des Auftrags" });
    }
  });

  app.post("/api/tasks/:id/assign", async (req, res) => {
    try {
      const { userId, assignedBy } = req.body;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const updatedTask = await storage.updateTaskStatus(req.params.id, "ASSIGNED", userId);
      if (!updatedTask) {
        return res.status(400).json({ error: "Invalid status transition" });
      }

      const driver = await storage.getUser(userId);
      const driverName = driver?.name || "Unbekannt";

      await storage.createActivityLog({
        type: "TASK_ASSIGNED",
        action: "TASK_ASSIGNED",
        message: `Auftrag ${task.id} wurde Fahrer ${driverName} zugewiesen`,
        userId: assignedBy || null,
        taskId: task.id,
        containerId: task.containerID,
        timestamp: new Date(),
        details: null,
        metadata: null,
        location: null,
        scanEventId: null,
      });

      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign task" });
    }
  });

  // ============================================================================
  // LEGACY TASK WORKFLOW ROUTES (Original waste container management)
  // These accept/pickup/delivery routes support the original 8-state workflow
  // for customer container pickup and warehouse delivery.
  // The app now primarily uses the Automotive Factory workflow with its own
  // 7-state lifecycle (OPEN -> PICKED_UP -> IN_TRANSIT -> DROPPED_OFF -> 
  // TAKEN_OVER -> WEIGHED -> DISPOSED).
  // Kept for backwards compatibility with existing data.
  // ============================================================================

  // Accept task - driver/admin scans customer container and starts the task
  // Transitions: PLANNED/ASSIGNED -> ACCEPTED (auto-assigns if needed)
  // Role logic: ADMIN can accept any task, DRIVER can only accept their own
  // Idempotent: If already in ACCEPTED or later state, return current state
  app.post("/api/tasks/:id/accept", async (req, res) => {
    try {
      const { userId, location, geoLocation } = req.body;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Role-based authorization
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Benutzer nicht gefunden" });
      }
      
      const userRole = user.role?.toUpperCase() || "DRIVER";
      const isAdmin = userRole === "ADMIN";
      const isAssignedDriver = task.assignedTo === userId;
      
      // ADMIN can accept any task, DRIVER can only accept their own
      if (!isAdmin && !isAssignedDriver && task.assignedTo) {
        return res.status(403).json({ 
          error: "Nur der zugewiesene Fahrer oder ein Admin kann diesen Auftrag annehmen.",
          assignedTo: task.assignedTo
        });
      }

      // Idempotent: If already accepted or in later state, return current state
      const LATER_STATES = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED"];
      if (LATER_STATES.includes(task.status)) {
        // Already in progress, return current task state with container info
        const sourceContainer = await storage.getCustomerContainer(task.containerID);
        let targetContainer = null;
        if (task.deliveryContainerID) {
          targetContainer = await storage.getWarehouseContainer(task.deliveryContainerID);
        }
        
        const response: any = {
          task: task,
          alreadyAccepted: true,
          sourceContainer: sourceContainer ? {
            id: sourceContainer.id,
            label: sourceContainer.id,
            location: sourceContainer.location,
            content: sourceContainer.materialType,
            materialType: sourceContainer.materialType,
            customerName: sourceContainer.customerName,
            unit: task.plannedQuantityUnit || "kg",
            currentQuantity: task.estimatedAmount || 0,
            plannedPickupQuantity: task.plannedQuantity || task.estimatedAmount || 0,
          } : null,
        };
        
        if (targetContainer) {
          response.targetContainer = {
            id: targetContainer.id,
            label: targetContainer.id,
            location: targetContainer.location,
            content: targetContainer.materialType,
            materialType: targetContainer.materialType,
            capacity: targetContainer.maxCapacity,
            currentFill: targetContainer.currentAmount,
            remainingCapacity: targetContainer.maxCapacity - targetContainer.currentAmount,
            unit: targetContainer.quantityUnit,
          };
        }
        
        return res.json(response);
      }

      // Get source container (customer container)
      const sourceContainer = await storage.getCustomerContainer(task.containerID);
      if (!sourceContainer) {
        return res.status(404).json({ error: "Kundencontainer nicht gefunden" });
      }

      // Get target container (warehouse container) if specified
      let targetContainer = null;
      if (task.deliveryContainerID) {
        targetContainer = await storage.getWarehouseContainer(task.deliveryContainerID);
        
        if (targetContainer) {
          // Material match validation
          if (sourceContainer.materialType !== targetContainer.materialType) {
            return res.status(400).json({ 
              error: "Der Zielcontainer enthält ein anderes Material. Bitte wähle einen passenden Lagercontainer.",
              sourceMaterial: sourceContainer.materialType,
              targetMaterial: targetContainer.materialType
            });
          }

          // Capacity validation
          const remainingCapacity = targetContainer.maxCapacity - targetContainer.currentAmount;
          if (task.plannedQuantity && task.plannedQuantity > remainingCapacity) {
            return res.status(400).json({ 
              error: "Zielcontainer hat nicht genug übriges Volumen für diese Menge.",
              remainingCapacity,
              requestedAmount: task.plannedQuantity,
              unit: targetContainer.quantityUnit
            });
          }
        }
      }

      const updatedTask = await storage.updateTaskStatus(req.params.id, "ACCEPTED", userId);
      if (!updatedTask) {
        return res.status(400).json({ error: "Ungültiger Status-Übergang. Aktueller Status: " + task.status });
      }

      await storage.updateTask(req.params.id, {
        pickupLocation: location,
      });

      const scanEvent = await storage.createScanEvent({
        containerId: task.containerID,
        containerType: "customer",
        taskId: task.id,
        scannedByUserId: userId,
        scannedAt: new Date(),
        scanContext: "TASK_ACCEPT_AT_CUSTOMER",
        locationType: "CUSTOMER",
        locationDetails: location,
        geoLocation: geoLocation || null,
        scanResult: "SUCCESS",
        resultMessage: null,
        extraData: null,
      });

      const driver = await storage.getUser(userId);
      const driverName = driver?.name || "Unbekannt";

      await storage.createActivityLog({
        type: "TASK_ACCEPTED",
        action: "TASK_ACCEPTED",
        message: `Fahrer ${driverName} hat Auftrag ${task.id} beim Kunden angenommen`,
        userId,
        taskId: task.id,
        containerId: task.containerID,
        scanEventId: scanEvent.id,
        location: geoLocation || null,
        timestamp: new Date(),
        details: null,
        metadata: { autoAssigned: task.status === "PLANNED" },
      });

      // Build response with source and target container details
      const response: any = {
        task: updatedTask,
        sourceContainer: {
          id: sourceContainer.id,
          label: sourceContainer.id,
          location: sourceContainer.location,
          content: sourceContainer.materialType, // content field maps to materialType
          materialType: sourceContainer.materialType,
          customerName: sourceContainer.customerName,
          unit: updatedTask.plannedQuantityUnit || "kg",
          currentQuantity: updatedTask.estimatedAmount || 0,
          plannedPickupQuantity: updatedTask.plannedQuantity || updatedTask.estimatedAmount || 0,
        },
      };

      if (targetContainer) {
        response.targetContainer = {
          id: targetContainer.id,
          label: targetContainer.id,
          location: targetContainer.location,
          content: targetContainer.materialType, // content field maps to materialType
          materialType: targetContainer.materialType,
          capacity: targetContainer.maxCapacity,
          currentFill: targetContainer.currentAmount,
          remainingCapacity: targetContainer.maxCapacity - targetContainer.currentAmount,
          unit: targetContainer.quantityUnit,
        };
      }

      res.json(response);
    } catch (error) {
      console.error("Failed to accept task:", error);
      res.status(500).json({ error: "Fehler beim Annehmen des Auftrags" });
    }
  });

  // Pickup task - driver/admin confirms physical pickup of container
  // Transitions: ACCEPTED -> PICKED_UP
  // Role logic: ADMIN can pickup any task, DRIVER can only pickup their own
  // Idempotent: If already picked up or in later state, return current state
  app.post("/api/tasks/:id/pickup", async (req, res) => {
    try {
      const { userId, location, geoLocation } = req.body;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Role-based authorization
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Benutzer nicht gefunden" });
      }
      
      const userRole = user.role?.toUpperCase() || "DRIVER";
      const isAdmin = userRole === "ADMIN";
      const isAssignedDriver = task.assignedTo === userId;
      
      // ADMIN can pickup any task, DRIVER can only pickup their own
      if (!isAdmin && !isAssignedDriver) {
        return res.status(403).json({ 
          error: "Nur der zugewiesene Fahrer oder ein Admin kann diesen Auftrag abholen.",
          assignedTo: task.assignedTo
        });
      }

      // Idempotent: If already picked up or in later state, return current state
      const LATER_STATES = ["PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED"];
      if (LATER_STATES.includes(task.status)) {
        return res.json({ ...task, alreadyPickedUp: true });
      }

      if (task.status !== "ACCEPTED") {
        return res.status(400).json({ 
          error: "Auftrag muss zuerst angenommen werden bevor er abgeholt werden kann",
          currentStatus: task.status
        });
      }

      const updatedTask = await storage.updateTaskStatus(req.params.id, "PICKED_UP", userId);
      if (!updatedTask) {
        return res.status(400).json({ error: "Ungültiger Status-Übergang" });
      }

      const scanEvent = await storage.createScanEvent({
        containerId: task.containerID,
        containerType: "customer",
        taskId: task.id,
        scannedByUserId: userId,
        scannedAt: new Date(),
        scanContext: "TASK_PICKUP",
        locationType: "CUSTOMER",
        locationDetails: location,
        geoLocation: geoLocation || null,
        scanResult: "SUCCESS",
        resultMessage: null,
        extraData: null,
      });

      const driver = await storage.getUser(userId);
      const driverName = driver?.name || "Unbekannt";

      await storage.createActivityLog({
        type: "TASK_PICKED_UP",
        action: "TASK_PICKED_UP",
        message: `Fahrer ${driverName} hat Container ${task.containerID} abgeholt`,
        userId,
        taskId: task.id,
        containerId: task.containerID,
        scanEventId: scanEvent.id,
        location: geoLocation || null,
        timestamp: new Date(),
        details: null,
        metadata: null,
      });

      res.json(updatedTask);
    } catch (error) {
      console.error("Failed to pickup task:", error);
      res.status(500).json({ error: "Fehler beim Abholen des Containers" });
    }
  });

  // Delivery endpoint - driver/admin scans warehouse container to complete delivery
  // Adds quantity to warehouse container and completes the task
  // Role logic: ADMIN can deliver any task, DRIVER can only deliver their own
  app.post("/api/tasks/:id/delivery", async (req, res) => {
    try {
      const { userId, warehouseContainerId, amount, location, geoLocation } = req.body;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Role-based authorization
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Benutzer nicht gefunden" });
      }
      
      const userRole = user.role?.toUpperCase() || "DRIVER";
      const isAdmin = userRole === "ADMIN";
      const isAssignedDriver = task.assignedTo === userId;
      
      // ADMIN can deliver any task, DRIVER can only deliver their own
      if (!isAdmin && !isAssignedDriver) {
        return res.status(403).json({ 
          error: "Nur der zugewiesene Fahrer oder ein Admin kann diesen Auftrag abliefern.",
          assignedTo: task.assignedTo
        });
      }

      // Idempotent: If already completed, return current state
      if (task.status === "COMPLETED") {
        return res.json({ ...task, alreadyCompleted: true });
      }

      const warehouseContainer = await storage.getWarehouseContainer(warehouseContainerId);
      if (!warehouseContainer) {
        return res.status(404).json({ error: "Lagercontainer nicht gefunden" });
      }

      if (warehouseContainer.materialType !== task.materialType) {
        return res.status(400).json({ 
          error: "Der Zielcontainer enthält ein anderes Material. Bitte wähle einen passenden Lagercontainer.",
          sourceMaterial: task.materialType,
          targetMaterial: warehouseContainer.materialType
        });
      }

      // Determine quantity to add: prefer actual/measured, then planned, then estimated
      const deliveredAmount = amount || task.plannedQuantity || task.estimatedAmount || 0;

      const availableSpace = warehouseContainer.maxCapacity - warehouseContainer.currentAmount;
      if (deliveredAmount > availableSpace) {
        return res.status(400).json({ 
          error: "Zielcontainer hat nicht genug übriges Volumen für diese Menge.",
          remainingCapacity: availableSpace,
          requestedAmount: deliveredAmount,
          unit: warehouseContainer.quantityUnit
        });
      }

      let updatedTask = await storage.updateTaskStatus(req.params.id, "DELIVERED");
      if (!updatedTask) {
        return res.status(400).json({ error: "Ungültiger Status-Übergang" });
      }

      await storage.updateTask(req.params.id, {
        deliveryContainerID: warehouseContainerId,
      });

      const scanEvent = await storage.createScanEvent({
        containerId: warehouseContainerId,
        containerType: "warehouse",
        taskId: task.id,
        scannedByUserId: userId,
        scannedAt: new Date(),
        scanContext: "TASK_COMPLETE_AT_WAREHOUSE",
        locationType: "WAREHOUSE",
        locationDetails: warehouseContainer.warehouseZone || location,
        geoLocation: geoLocation || null,
        scanResult: "SUCCESS",
        resultMessage: null,
        extraData: null,
      });

      await storage.createActivityLog({
        type: "TASK_DELIVERED",
        action: "TASK_DELIVERED",
        message: `Container ${task.containerID} wurde im Lager abgeliefert`,
        userId,
        taskId: task.id,
        containerId: warehouseContainerId,
        scanEventId: scanEvent.id,
        location: geoLocation || null,
        timestamp: new Date(),
        details: null,
        metadata: null,
      });

      // Update warehouse container with additive quantity
      const newAmount = warehouseContainer.currentAmount + deliveredAmount;
      await storage.updateWarehouseContainer(warehouseContainerId, {
        currentAmount: newAmount,
      });

      await storage.createFillHistory({
        warehouseContainerId,
        amountAdded: deliveredAmount,
        quantityUnit: warehouseContainer.quantityUnit,
        taskId: task.id,
        recordedByUserId: userId,
      });

      await storage.updateCustomerContainer(task.containerID, {
        lastEmptied: new Date(),
        status: "AT_CUSTOMER",
      });

      // Update task with actual quantity
      await storage.updateTask(req.params.id, {
        actualQuantity: deliveredAmount,
      });

      updatedTask = await storage.updateTaskStatus(req.params.id, "COMPLETED");
      if (!updatedTask) {
        return res.status(400).json({ error: "Fehler beim Abschließen des Auftrags" });
      }

      await storage.createActivityLog({
        type: "TASK_COMPLETED",
        action: "TASK_COMPLETED",
        message: `Auftrag ${task.id} abgeschlossen, ${deliveredAmount} ${warehouseContainer.quantityUnit} erfasst`,
        userId,
        taskId: task.id,
        containerId: warehouseContainerId,
        timestamp: new Date(),
        metadata: { amountAdded: deliveredAmount, unit: warehouseContainer.quantityUnit },
        details: null,
        location: null,
        scanEventId: null,
      });

      // Return both task and updated container info
      res.json({
        task: updatedTask,
        targetContainer: {
          id: warehouseContainerId,
          label: warehouseContainerId,
          location: warehouseContainer.location,
          content: warehouseContainer.materialType,
          materialType: warehouseContainer.materialType,
          capacity: warehouseContainer.maxCapacity,
          currentFill: newAmount,
          remainingCapacity: warehouseContainer.maxCapacity - newAmount,
          unit: warehouseContainer.quantityUnit,
          amountAdded: deliveredAmount,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to record delivery" });
    }
  });

  app.post("/api/tasks/:id/cancel", async (req, res) => {
    try {
      const { userId, reason } = req.body;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const updatedTask = await storage.updateTaskStatus(req.params.id, "CANCELLED");
      if (!updatedTask) {
        return res.status(400).json({ error: "Invalid status transition - task may already be completed" });
      }

      await storage.updateTask(req.params.id, {
        cancellationReason: reason,
      });

      await storage.createActivityLog({
        type: "TASK_CANCELLED",
        action: "TASK_CANCELLED",
        message: `Auftrag ${task.id} wurde storniert: ${reason || 'Kein Grund angegeben'}`,
        userId,
        taskId: task.id,
        containerId: task.containerID,
        timestamp: new Date(),
        metadata: { reason },
        details: null,
        location: null,
        scanEventId: null,
      });

      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel task" });
    }
  });

  // Claim task - Pull-based task claiming
  // Driver or Admin can claim open tasks (OFFEN or PLANNED status)
  // Sets claimedByUserId, claimedAt, assignedTo and transitions to ACCEPTED
  app.post("/api/tasks/:id/claim", requireAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Auftrag nicht gefunden" });
      }

      // Check if task is open and claimable
      const CLAIMABLE_STATUSES = ["OFFEN", "PLANNED"];
      if (!CLAIMABLE_STATUSES.includes(task.status)) {
        return res.status(400).json({ 
          error: "Auftrag kann nicht angenommen werden - falscher Status",
          currentStatus: task.status,
          allowedStatuses: CLAIMABLE_STATUSES
        });
      }

      // Check if already claimed
      if (task.claimedByUserId) {
        const claimingUser = await storage.getUser(task.claimedByUserId);
        return res.status(409).json({ 
          error: "Auftrag wurde bereits von einem anderen Benutzer angenommen",
          claimedBy: claimingUser?.name || "Unbekannt",
          claimedAt: task.claimedAt
        });
      }

      const now = new Date();
      
      // Update task with claim info and transition to ACCEPTED
      await storage.updateTask(req.params.id, {
        claimedByUserId: authUser.id,
        claimedAt: now,
        assignedTo: authUser.id,
        assignedAt: now,
        acceptedAt: now,
        status: "ACCEPTED",
      });

      // Fetch updated task
      const updatedTask = await storage.getTask(req.params.id);

      // Create activity log
      await storage.createActivityLog({
        type: "TASK_ACCEPTED",
        action: "TASK_ACCEPTED",
        message: `Auftrag angenommen von ${authUser.name}`,
        userId: authUser.id,
        taskId: task.id,
        containerId: task.containerID,
        timestamp: now,
        metadata: { claimedBy: authUser.id, claimedAt: now.toISOString() },
        details: null,
        location: null,
        scanEventId: null,
      });

      // Get source container info
      const sourceContainer = await storage.getCustomerContainer(task.containerID);
      let targetContainer = null;
      if (task.deliveryContainerID) {
        targetContainer = await storage.getWarehouseContainer(task.deliveryContainerID);
      }

      const response: any = {
        task: updatedTask,
        sourceContainer: sourceContainer ? {
          id: sourceContainer.id,
          label: sourceContainer.id,
          location: sourceContainer.location,
          content: sourceContainer.materialType,
          materialType: sourceContainer.materialType,
          customerName: sourceContainer.customerName,
          unit: updatedTask?.plannedQuantityUnit || "kg",
          plannedPickupQuantity: updatedTask?.plannedQuantity || updatedTask?.estimatedAmount || 0,
        } : null,
      };

      if (targetContainer) {
        response.targetContainer = {
          id: targetContainer.id,
          label: targetContainer.id,
          location: targetContainer.location,
          content: targetContainer.materialType,
          materialType: targetContainer.materialType,
          capacity: targetContainer.maxCapacity,
          currentFill: targetContainer.currentAmount,
          remainingCapacity: targetContainer.maxCapacity - targetContainer.currentAmount,
          unit: targetContainer.quantityUnit,
        };
      }

      res.json(response);
    } catch (error) {
      console.error("Failed to claim task:", error);
      res.status(500).json({ error: "Fehler beim Annehmen des Auftrags" });
    }
  });

  // Handover task - Transfer task to another user
  // Admin or current owner can transfer the task
  // Updates claimedByUserId, assignedTo and sets handoverAt
  app.post("/api/tasks/:id/handover", requireAuth, async (req, res) => {
    try {
      const { newUserId } = req.body;
      const authUser = (req as any).authUser;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Auftrag nicht gefunden" });
      }

      if (!newUserId) {
        return res.status(400).json({ error: "newUserId ist erforderlich" });
      }

      // Check if new user exists
      const newUser = await storage.getUser(newUserId);
      if (!newUser) {
        return res.status(404).json({ error: "Neuer Benutzer nicht gefunden" });
      }

      // Authorization: Admin or current owner can transfer
      const userRole = authUser.role?.toUpperCase() || "DRIVER";
      const isAdmin = userRole === "ADMIN";
      const isCurrentOwner = task.claimedByUserId === authUser.id || task.assignedTo === authUser.id;

      if (!isAdmin && !isCurrentOwner) {
        return res.status(403).json({ 
          error: "Nur der aktuelle Besitzer oder ein Admin kann diesen Auftrag übergeben"
        });
      }

      // Check if task is in a transferable state (not completed or cancelled)
      const NON_TRANSFERABLE_STATUSES = ["COMPLETED", "CANCELLED"];
      if (NON_TRANSFERABLE_STATUSES.includes(task.status)) {
        return res.status(400).json({ 
          error: "Abgeschlossene oder stornierte Aufträge können nicht übergeben werden",
          currentStatus: task.status
        });
      }

      const oldUser = task.claimedByUserId ? await storage.getUser(task.claimedByUserId) : authUser;
      const oldUserName = oldUser?.name || "Unbekannt";
      const now = new Date();

      // Update task with handover info
      await storage.updateTask(req.params.id, {
        claimedByUserId: newUserId,
        assignedTo: newUserId,
        handoverAt: now,
      });

      // Fetch updated task
      const updatedTask = await storage.getTask(req.params.id);

      // Create activity log
      await storage.createActivityLog({
        type: "TASK_ASSIGNED",
        action: "TASK_ASSIGNED",
        message: `Auftrag übergeben von ${oldUserName} an ${newUser.name}`,
        userId: authUser.id,
        taskId: task.id,
        containerId: task.containerID,
        timestamp: now,
        metadata: { 
          fromUserId: oldUser?.id,
          toUserId: newUserId,
          handoverAt: now.toISOString()
        },
        details: null,
        location: null,
        scanEventId: null,
      });

      res.json({ 
        task: updatedTask,
        handover: {
          from: { id: oldUser?.id, name: oldUserName },
          to: { id: newUser.id, name: newUser.name },
          at: now.toISOString()
        }
      });
    } catch (error) {
      console.error("Failed to handover task:", error);
      res.status(500).json({ error: "Fehler bei der Auftragsübergabe" });
    }
  });

  // ============================================================================
  // SCAN EVENTS
  // ============================================================================

  app.get("/api/scan-events", async (req, res) => {
    try {
      const { containerId, taskId, userId } = req.query;
      const filters: { containerId?: string; taskId?: string; userId?: string } = {};
      
      if (containerId) filters.containerId = containerId as string;
      if (taskId) filters.taskId = taskId as string;
      if (userId) filters.userId = userId as string;

      const events = await storage.getScanEvents(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch scan events" });
    }
  });

  app.get("/api/scan-events/:id", async (req, res) => {
    try {
      const event = await storage.getScanEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Scan event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch scan event" });
    }
  });

  app.post("/api/scan-events", async (req, res) => {
    try {
      const { containerId, containerType, userId, scanContext, locationType, locationDetails, geoLocation, taskId, measuredWeight } = req.body;
      
      if (!containerId || !containerType || !userId || !scanContext || !locationType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Special handling for TASK_COMPLETE_AT_WAREHOUSE - requires measuredWeight
      if (scanContext === "TASK_COMPLETE_AT_WAREHOUSE") {
        if (!taskId) {
          return res.status(400).json({ error: "taskId ist erforderlich für Lager-Abschluss-Scan" });
        }
        
        if (measuredWeight === undefined || measuredWeight === null) {
          return res.status(400).json({ error: "measuredWeight ist erforderlich für Lager-Abschluss-Scan" });
        }
        
        const weight = parseFloat(measuredWeight);
        if (isNaN(weight) || weight <= 0) {
          return res.status(400).json({ error: "measuredWeight muss größer als 0 sein" });
        }

        // Get task and validate
        const task = await storage.getTask(taskId);
        if (!task) {
          return res.status(404).json({ error: "Auftrag nicht gefunden" });
        }

        // Get warehouse container
        const warehouseContainer = await storage.getWarehouseContainer(containerId);
        if (!warehouseContainer) {
          return res.status(404).json({ error: "Lagercontainer nicht gefunden" });
        }

        // Check capacity
        const availableSpace = warehouseContainer.maxCapacity - warehouseContainer.currentAmount;
        if (weight > availableSpace) {
          return res.status(400).json({ 
            error: "Zielcontainer hat nicht genug übriges Volumen für diese Menge.",
            remainingCapacity: availableSpace,
            requestedAmount: weight,
            unit: warehouseContainer.quantityUnit
          });
        }

        // Create scan event
        const scanEvent = await storage.createScanEvent({
          containerId,
          containerType,
          taskId,
          scannedByUserId: userId,
          scannedAt: new Date(),
          scanContext,
          locationType,
          locationDetails: locationDetails || warehouseContainer.warehouseZone || null,
          geoLocation: geoLocation || null,
          scanResult: "SUCCESS",
          resultMessage: null,
          extraData: { measuredWeight: weight },
        });

        // Update task with measured weight
        await storage.updateTask(taskId, {
          measuredWeight: weight,
          actualQuantity: weight,
          deliveryContainerID: containerId,
        });

        // Add weight to warehouse container
        const newAmount = warehouseContainer.currentAmount + weight;
        await storage.updateWarehouseContainer(containerId, {
          currentAmount: newAmount,
        });

        // Create fill history entry
        await storage.createFillHistory({
          warehouseContainerId: containerId,
          amountAdded: weight,
          quantityUnit: warehouseContainer.quantityUnit,
          taskId,
          recordedByUserId: userId,
        });

        // Update customer container
        if (task.containerID) {
          await storage.updateCustomerContainer(task.containerID, {
            lastEmptied: new Date(),
            status: "AT_CUSTOMER",
          });
        }

        // Set task status to COMPLETED
        await storage.updateTaskStatus(taskId, "COMPLETED");

        const user = await storage.getUser(userId);
        const userName = user?.name || "Unbekannt";

        // Create activity log for weight recorded
        await storage.createActivityLog({
          type: "WEIGHT_RECORDED",
          action: "WEIGHT_RECORDED",
          message: `Gewicht erfasst: ${weight} ${warehouseContainer.quantityUnit} von ${userName}`,
          userId,
          taskId,
          containerId,
          scanEventId: scanEvent.id,
          location: geoLocation || null,
          timestamp: new Date(),
          details: null,
          metadata: { measuredWeight: weight, unit: warehouseContainer.quantityUnit },
        });

        // Create activity log for task completed
        await storage.createActivityLog({
          type: "TASK_COMPLETED",
          action: "TASK_COMPLETED",
          message: `Auftrag ${taskId} abgeschlossen, ${weight} ${warehouseContainer.quantityUnit} erfasst`,
          userId,
          taskId,
          containerId,
          scanEventId: scanEvent.id,
          location: geoLocation || null,
          timestamp: new Date(),
          details: null,
          metadata: { measuredWeight: weight, unit: warehouseContainer.quantityUnit },
        });

        // Fetch updated task
        const updatedTask = await storage.getTask(taskId);

        return res.status(201).json({
          scanEvent,
          task: updatedTask,
          targetContainer: {
            id: warehouseContainer.id,
            label: warehouseContainer.id,
            location: warehouseContainer.location,
            materialType: warehouseContainer.materialType,
            capacity: warehouseContainer.maxCapacity,
            currentFill: newAmount,
            remainingCapacity: warehouseContainer.maxCapacity - newAmount,
            unit: warehouseContainer.quantityUnit,
            amountAdded: weight,
          },
        });
      }

      // Default scan event handling (non-TASK_COMPLETE_AT_WAREHOUSE)
      const scanEvent = await storage.createScanEvent({
        containerId,
        containerType,
        taskId: taskId || null,
        scannedByUserId: userId,
        scannedAt: new Date(),
        scanContext,
        locationType,
        locationDetails: locationDetails || null,
        geoLocation: geoLocation || null,
        scanResult: "SUCCESS",
        resultMessage: null,
        extraData: null,
      });

      const logType = locationType === "WAREHOUSE" ? "CONTAINER_SCANNED_AT_WAREHOUSE" : "CONTAINER_SCANNED_AT_CUSTOMER";
      await storage.createActivityLog({
        type: logType,
        action: logType,
        message: `Container ${containerId} wurde gescannt (${scanContext})`,
        userId,
        taskId: taskId || null,
        containerId,
        scanEventId: scanEvent.id,
        location: geoLocation || null,
        timestamp: new Date(),
        details: null,
        metadata: null,
      });

      res.status(201).json(scanEvent);
    } catch (error) {
      console.error("Failed to create scan event:", error);
      res.status(500).json({ error: "Failed to create scan event" });
    }
  });

  // ============================================================================
  // ACTIVITY LOGS
  // ============================================================================

  app.get("/api/activity-logs", async (req, res) => {
    try {
      const { userId, containerId, type, taskId, startDate, endDate } = req.query;
      const filters: { userId?: string; containerId?: string; type?: string; taskId?: string } = {};
      
      if (userId) filters.userId = userId as string;
      if (containerId) filters.containerId = containerId as string;
      if (type) filters.type = type as string;
      if (taskId) filters.taskId = taskId as string;

      const logs = await storage.getActivityLogs(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  app.get("/api/activity-logs/export/csv", async (req, res) => {
    try {
      const { userId, containerId, type, taskId, startDate, endDate } = req.query;
      const filters: { userId?: string; containerId?: string; type?: string; taskId?: string } = {};
      
      if (userId) filters.userId = userId as string;
      if (containerId) filters.containerId = containerId as string;
      if (type) filters.type = type as string;
      if (taskId) filters.taskId = taskId as string;

      const logs = await storage.getActivityLogs(Object.keys(filters).length > 0 ? filters : undefined);
      const users = await storage.getUsers();
      
      const getUserName = (id: string | null) => {
        if (!id) return "System";
        const user = users.find(u => u.id === id);
        return user?.name || "Unknown";
      };

      const csvHeader = "ID,Datum,Uhrzeit,Benutzer,Typ,Nachricht,Container ID,Auftrag ID\n";
      const csvRows = logs.map(log => {
        const date = new Date(log.timestamp);
        const dateStr = date.toLocaleDateString("de-DE");
        const timeStr = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        const userName = getUserName(log.userId).replace(/,/g, ";");
        const logType = (log.type || "").replace(/,/g, ";");
        const message = (log.message || "").replace(/,/g, ";").replace(/\n/g, " ");
        const containerId = (log.containerId || "").replace(/,/g, ";");
        const taskIdVal = (log.taskId || "").replace(/,/g, ";");
        return `${log.id},${dateStr},${timeStr},${userName},${logType},${message},${containerId},${taskIdVal}`;
      }).join("\n");

      const csv = csvHeader + csvRows;
      
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=aktivitaetslog-${new Date().toISOString().split("T")[0]}.csv`);
      res.send("\uFEFF" + csv);
    } catch (error) {
      res.status(500).json({ error: "Failed to export activity logs" });
    }
  });

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  app.get("/api/analytics/driver-performance", async (req, res) => {
    try {
      const allTasks = await storage.getTasks();
      const users = await storage.getUsers();
      const drivers = users.filter(u => u.role === "driver" || u.role === "DRIVER");
      
      const now = new Date();
      const today = now.toDateString();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);

      const driverStats = drivers.map(driver => {
        const driverTasks = allTasks.filter(t => t.assignedTo === driver.id);
        const completedTasks = driverTasks.filter(t => t.status === "COMPLETED" || t.status === "completed");
        const completedToday = completedTasks.filter(t => {
          if (!t.completedAt) return false;
          return new Date(t.completedAt).toDateString() === today;
        });
        const completedThisWeek = completedTasks.filter(t => {
          if (!t.completedAt) return false;
          const completedDate = new Date(t.completedAt);
          return completedDate >= startOfWeek;
        });

        const avgDeliveryTime = completedTasks.length > 0 
          ? completedTasks.reduce((sum, t) => {
              if (t.acceptedAt && t.completedAt) {
                return sum + (new Date(t.completedAt).getTime() - new Date(t.acceptedAt).getTime());
              }
              return sum;
            }, 0) / completedTasks.length / (1000 * 60)
          : 0;

        const completionRate = driverTasks.length > 0 
          ? Math.round((completedTasks.length / driverTasks.length) * 100)
          : 0;

        const inProgressStatuses = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "in_progress"];
        return {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          totalAssigned: driverTasks.length,
          totalCompleted: completedTasks.length,
          completedToday: completedToday.length,
          completedThisWeek: completedThisWeek.length,
          inProgress: driverTasks.filter(t => inProgressStatuses.includes(t.status)).length,
          completionRate,
          avgDeliveryTimeMinutes: Math.round(avgDeliveryTime),
        };
      });

      const overallStats = {
        totalDrivers: drivers.length,
        activeDrivers: driverStats.filter(d => d.inProgress > 0 || d.completedToday > 0).length,
        totalCompletedToday: driverStats.reduce((sum, d) => sum + d.completedToday, 0),
        totalCompletedThisWeek: driverStats.reduce((sum, d) => sum + d.completedThisWeek, 0),
        avgCompletionRate: driverStats.length > 0
          ? Math.round(driverStats.reduce((sum, d) => sum + d.completionRate, 0) / driverStats.length)
          : 0,
      };

      res.json({
        drivers: driverStats,
        overall: overallStats,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch driver performance" });
    }
  });

  app.get("/api/analytics/fill-trends", async (req, res) => {
    try {
      const warehouseContainers = await storage.getWarehouseContainers();
      const allTasks = await storage.getTasks();
      
      const now = new Date();
      const daysAgo = (days: number) => {
        const date = new Date(now);
        date.setDate(date.getDate() - days);
        return date;
      };

      const dailyData = [];
      for (let i = 6; i >= 0; i--) {
        const date = daysAgo(i);
        const dateStr = date.toLocaleDateString("de-DE", { month: "short", day: "numeric" });
        
        const dayTasks = allTasks.filter(t => {
          if (!t.completedAt) return false;
          const taskDate = new Date(t.completedAt);
          return taskDate.toDateString() === date.toDateString();
        });

        const totalDelivered = dayTasks.reduce((sum, t) => {
          const container = warehouseContainers.find(c => c.id === t.deliveryContainerID);
          return sum + (container ? 50 : 0);
        }, 0);

        dailyData.push({
          date: dateStr,
          deliveries: dayTasks.length,
          volumeKg: totalDelivered,
        });
      }

      const currentFillLevels = warehouseContainers.map(c => ({
        id: c.id,
        location: c.location,
        materialType: c.materialType,
        currentAmount: c.currentAmount,
        maxCapacity: c.maxCapacity,
        fillPercentage: Math.round((c.currentAmount / c.maxCapacity) * 100),
      }));

      const materialBreakdown = warehouseContainers.reduce((acc, c) => {
        const existing = acc.find(m => m.material === c.materialType);
        if (existing) {
          existing.currentAmount += c.currentAmount;
          existing.maxCapacity += c.maxCapacity;
        } else {
          acc.push({
            material: c.materialType,
            currentAmount: c.currentAmount,
            maxCapacity: c.maxCapacity,
          });
        }
        return acc;
      }, [] as { material: string; currentAmount: number; maxCapacity: number }[]);

      res.json({
        dailyTrends: dailyData,
        containerLevels: currentFillLevels,
        materialBreakdown,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Dashboard stats with optional driverId filter
  // GET /api/dashboard/stats?driverId=driver-001
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const { driverId } = req.query;
      const allTasks = await storage.getTasks();
      const warehouseContainers = await storage.getWarehouseContainers();
      const users = await storage.getUsers();

      // Filter tasks by driver if driverId provided
      const tasksToCount = driverId 
        ? allTasks.filter(t => t.assignedTo === driverId)
        : allTasks;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayTasks = tasksToCount.filter(t => {
        const created = new Date(t.createdAt);
        return created >= today && created <= todayEnd;
      });

      // Updated status categories to include OFFEN
      const openStatuses = ["OFFEN", "PLANNED", "ASSIGNED"];
      const inProgressStatuses = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
      const completedStatuses = ["COMPLETED"];
      const cancelledStatuses = ["CANCELLED"];

      const openTasks = tasksToCount.filter(t => openStatuses.includes(t.status)).length;
      const inProgressTasks = tasksToCount.filter(t => inProgressStatuses.includes(t.status)).length;
      const completedTasks = tasksToCount.filter(t => completedStatuses.includes(t.status)).length;
      const completedToday = todayTasks.filter(t => completedStatuses.includes(t.status)).length;
      const cancelledTasks = tasksToCount.filter(t => cancelledStatuses.includes(t.status)).length;
      const activeDrivers = users.filter(u => (u.role === "driver" || u.role === "DRIVER") && u.isActive).length;

      const criticalContainers = warehouseContainers.filter(c => {
        const fillPercentage = (c.currentAmount / c.maxCapacity) * 100;
        return fillPercentage >= 80;
      }).length;

      const totalCapacity = warehouseContainers.reduce((acc, c) => acc + c.maxCapacity, 0);
      const usedCapacity = warehouseContainers.reduce((acc, c) => acc + c.currentAmount, 0);
      const availableCapacity = totalCapacity - usedCapacity;

      res.json({
        openTasks,
        inProgressTasks,
        completedTasks,
        completedToday,
        cancelledTasks,
        activeDrivers,
        criticalContainers,
        totalCapacity,
        availableCapacity,
        totalTasks: tasksToCount.length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Driver-specific stats endpoint
  // GET /api/drivers/:id/stats
  app.get("/api/drivers/:id/stats", async (req, res) => {
    try {
      const driverId = req.params.id;
      const driver = await storage.getUser(driverId);
      
      if (!driver) {
        return res.status(404).json({ error: "Fahrer nicht gefunden" });
      }

      const allTasks = await storage.getTasks({ assignedTo: driverId });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayTasks = allTasks.filter(t => {
        const created = new Date(t.createdAt);
        return created >= today && created <= todayEnd;
      });

      const openStatuses = ["OFFEN", "PLANNED", "ASSIGNED"];
      const inProgressStatuses = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
      const completedStatuses = ["COMPLETED"];
      const cancelledStatuses = ["CANCELLED"];

      const openTasks = allTasks.filter(t => openStatuses.includes(t.status)).length;
      const inProgressTasks = allTasks.filter(t => inProgressStatuses.includes(t.status)).length;
      const completedTasks = allTasks.filter(t => completedStatuses.includes(t.status)).length;
      const completedToday = todayTasks.filter(t => completedStatuses.includes(t.status)).length;
      const cancelledTasks = allTasks.filter(t => cancelledStatuses.includes(t.status)).length;

      // Find last activity
      const activityLogs = await storage.getActivityLogs({ userId: driverId });
      const lastActivity = activityLogs.length > 0 ? activityLogs[0].timestamp : null;

      res.json({
        driverId,
        driverName: driver.name,
        driverEmail: driver.email,
        openTasks,
        inProgressTasks,
        completedTasks,
        completedToday,
        cancelledTasks,
        totalTasks: allTasks.length,
        lastActivity,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch driver stats" });
    }
  });

  // Driver overview with task counts per driver
  // GET /api/drivers/overview
  app.get("/api/drivers/overview", requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      const allTasks = await storage.getTasks();
      
      const drivers = users.filter(u => u.role === "DRIVER" || u.role === "driver");
      
      const openStatuses = ["OFFEN", "PLANNED", "ASSIGNED"];
      const inProgressStatuses = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
      const completedStatuses = ["COMPLETED"];
      const cancelledStatuses = ["CANCELLED"];
      
      const driverOverview = await Promise.all(drivers.map(async (driver) => {
        const driverTasks = allTasks.filter(t => t.assignedTo === driver.id);
        
        // Get last activity
        const activityLogs = await storage.getActivityLogs({ userId: driver.id });
        const lastActivity = activityLogs.length > 0 ? activityLogs[0].timestamp : null;
        
        return {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
          isActive: driver.isActive,
          openTasks: driverTasks.filter(t => openStatuses.includes(t.status)).length,
          inProgressTasks: driverTasks.filter(t => inProgressStatuses.includes(t.status)).length,
          completedTasks: driverTasks.filter(t => completedStatuses.includes(t.status)).length,
          cancelledTasks: driverTasks.filter(t => cancelledStatuses.includes(t.status)).length,
          totalTasks: driverTasks.length,
          lastActivity,
        };
      }));

      res.json(driverOverview);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch driver overview" });
    }
  });

  // ============================================================================
  // AUTOMOTIVE FACTORY API ENDPOINTS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // MATERIALS CRUD
  // ----------------------------------------------------------------------------

  // GET /api/materials - List all materials
  app.get("/api/materials", async (req, res) => {
    try {
      const result = await db.select().from(materials).where(eq(materials.isActive, true));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch materials:", error);
      res.status(500).json({ error: "Failed to fetch materials" });
    }
  });

  // GET /api/materials/:id - Get material by ID
  app.get("/api/materials/:id", async (req, res) => {
    try {
      const [material] = await db.select().from(materials).where(eq(materials.id, req.params.id));
      if (!material) {
        return res.status(404).json({ error: "Material not found" });
      }
      res.json(material);
    } catch (error) {
      console.error("Failed to fetch material:", error);
      res.status(500).json({ error: "Failed to fetch material" });
    }
  });

  // POST /api/materials - Create material (admin only)
  app.post("/api/materials", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, code, description, hazardClass, disposalStream, densityHint, defaultUnit, qrCode } = req.body;
      
      if (!name || !code) {
        return res.status(400).json({ error: "Name and code are required" });
      }

      const [material] = await db.insert(materials).values({
        name,
        code,
        description: description || null,
        hazardClass: hazardClass || null,
        disposalStream: disposalStream || null,
        densityHint: densityHint || null,
        defaultUnit: defaultUnit || "kg",
        qrCode: qrCode || null,
      }).returning();

      res.status(201).json(material);
    } catch (error) {
      console.error("Failed to create material:", error);
      res.status(500).json({ error: "Failed to create material" });
    }
  });

  // PUT /api/materials/:id - Update material (admin only)
  app.put("/api/materials/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.select().from(materials).where(eq(materials.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Material not found" });
      }

      const { name, code, description, hazardClass, disposalStream, densityHint, defaultUnit, qrCode, isActive } = req.body;
      
      const [material] = await db.update(materials)
        .set({
          ...(name !== undefined && { name }),
          ...(code !== undefined && { code }),
          ...(description !== undefined && { description }),
          ...(hazardClass !== undefined && { hazardClass }),
          ...(disposalStream !== undefined && { disposalStream }),
          ...(densityHint !== undefined && { densityHint }),
          ...(defaultUnit !== undefined && { defaultUnit }),
          ...(qrCode !== undefined && { qrCode }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        })
        .where(eq(materials.id, req.params.id))
        .returning();

      res.json(material);
    } catch (error) {
      console.error("Failed to update material:", error);
      res.status(500).json({ error: "Failed to update material" });
    }
  });

  // ----------------------------------------------------------------------------
  // HALLS CRUD
  // ----------------------------------------------------------------------------

  // GET /api/halls - List all halls
  app.get("/api/halls", async (req, res) => {
    try {
      const result = await db.select().from(halls).where(eq(halls.isActive, true));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch halls:", error);
      res.status(500).json({ error: "Failed to fetch halls" });
    }
  });

  // GET /api/halls/:id - Get hall by ID with stations
  app.get("/api/halls/:id", async (req, res) => {
    try {
      const [hall] = await db.select().from(halls).where(eq(halls.id, req.params.id));
      if (!hall) {
        return res.status(404).json({ error: "Hall not found" });
      }

      const hallStations = await db.select().from(stations).where(
        and(eq(stations.hallId, req.params.id), eq(stations.isActive, true))
      );

      res.json({ ...hall, stations: hallStations });
    } catch (error) {
      console.error("Failed to fetch hall:", error);
      res.status(500).json({ error: "Failed to fetch hall" });
    }
  });

  // POST /api/halls - Create hall (admin only)
  app.post("/api/halls", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, code, description, locationMeta } = req.body;
      
      if (!name || !code) {
        return res.status(400).json({ error: "Name and code are required" });
      }

      const [hall] = await db.insert(halls).values({
        name,
        code,
        description: description || null,
        locationMeta: locationMeta || null,
      }).returning();

      res.status(201).json(hall);
    } catch (error) {
      console.error("Failed to create hall:", error);
      res.status(500).json({ error: "Failed to create hall" });
    }
  });

  // ----------------------------------------------------------------------------
  // STATIONS CRUD
  // ----------------------------------------------------------------------------

  // GET /api/stations - List all stations (optionally filter by hallId)
  app.get("/api/stations", async (req, res) => {
    try {
      const { hallId } = req.query;
      
      let conditions = [eq(stations.isActive, true)];
      if (hallId && typeof hallId === 'string') {
        conditions.push(eq(stations.hallId, hallId));
      }

      const result = await db.select().from(stations).where(and(...conditions));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch stations:", error);
      res.status(500).json({ error: "Failed to fetch stations" });
    }
  });

  // GET /api/stations/:id - Get station by ID with stands
  app.get("/api/stations/:id", async (req, res) => {
    try {
      const [station] = await db.select().from(stations).where(eq(stations.id, req.params.id));
      if (!station) {
        return res.status(404).json({ error: "Station not found" });
      }

      const stationStands = await db.select().from(stands).where(
        and(eq(stands.stationId, req.params.id), eq(stands.isActive, true))
      );

      res.json({ ...station, stands: stationStands });
    } catch (error) {
      console.error("Failed to fetch station:", error);
      res.status(500).json({ error: "Failed to fetch station" });
    }
  });

  // POST /api/stations - Create station (admin only)
  app.post("/api/stations", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { hallId, name, code, sequence, locationMeta } = req.body;
      
      if (!hallId || !name || !code) {
        return res.status(400).json({ error: "hallId, name, and code are required" });
      }

      const [hall] = await db.select().from(halls).where(eq(halls.id, hallId));
      if (!hall) {
        return res.status(404).json({ error: "Hall not found" });
      }

      const [station] = await db.insert(stations).values({
        hallId,
        name,
        code,
        sequence: sequence || null,
        locationMeta: locationMeta || null,
      }).returning();

      res.status(201).json(station);
    } catch (error) {
      console.error("Failed to create station:", error);
      res.status(500).json({ error: "Failed to create station" });
    }
  });

  // ----------------------------------------------------------------------------
  // STANDS CRUD
  // ----------------------------------------------------------------------------

  // GET /api/stands - List all stands (optionally filter by stationId, materialId)
  app.get("/api/stands", async (req, res) => {
    try {
      const { stationId, materialId } = req.query;
      
      let conditions = [eq(stands.isActive, true)];
      if (stationId && typeof stationId === 'string') {
        conditions.push(eq(stands.stationId, stationId));
      }
      if (materialId && typeof materialId === 'string') {
        conditions.push(eq(stands.materialId, materialId));
      }

      const result = await db.select().from(stands).where(and(...conditions));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch stands:", error);
      res.status(500).json({ error: "Failed to fetch stands" });
    }
  });

  // GET /api/stands/qr/:qrCode - Look up stand by QR code (must be before :id route)
  app.get("/api/stands/qr/:qrCode", async (req, res) => {
    try {
      const [stand] = await db.select().from(stands).where(eq(stands.qrCode, req.params.qrCode));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }
      // Get station and hall info
      const [station] = await db.select().from(stations).where(eq(stations.id, stand.stationId));
      const [hall] = station ? await db.select().from(halls).where(eq(halls.id, station.hallId)) : [null];
      // Get material info
      const [material] = stand.materialId ? await db.select().from(materials).where(eq(materials.id, stand.materialId)) : [null];
      // Get boxes at this stand
      const standBoxes = await db.select().from(boxes).where(eq(boxes.standId, stand.id));
      res.json({ stand, station, hall, material, boxes: standBoxes });
    } catch (error) {
      console.error("Failed to fetch stand by QR:", error);
      res.status(500).json({ error: "Failed to fetch stand" });
    }
  });

  // GET /api/stands/:id - Get stand by ID
  app.get("/api/stands/:id", async (req, res) => {
    try {
      const [stand] = await db.select().from(stands).where(eq(stands.id, req.params.id));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }
      res.json(stand);
    } catch (error) {
      console.error("Failed to fetch stand:", error);
      res.status(500).json({ error: "Failed to fetch stand" });
    }
  });

  // POST /api/stands - Create stand (admin only)
  app.post("/api/stands", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { stationId, identifier, materialId, qrCode, sequence, positionMeta, dailyFull } = req.body;
      
      if (!stationId || !identifier || !qrCode) {
        return res.status(400).json({ error: "stationId, identifier, and qrCode are required" });
      }

      const [station] = await db.select().from(stations).where(eq(stations.id, stationId));
      if (!station) {
        return res.status(404).json({ error: "Station not found" });
      }

      const [stand] = await db.insert(stands).values({
        stationId,
        identifier,
        materialId: materialId || null,
        qrCode,
        sequence: sequence || null,
        positionMeta: positionMeta || null,
        dailyFull: dailyFull || false,
      }).returning();

      res.status(201).json(stand);
    } catch (error) {
      console.error("Failed to create stand:", error);
      res.status(500).json({ error: "Failed to create stand" });
    }
  });

  // PUT /api/stands/:id - Update stand (admin only, including dailyFull flag)
  app.put("/api/stands/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.select().from(stands).where(eq(stands.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Stand not found" });
      }

      const { identifier, materialId, qrCode, sequence, positionMeta, dailyFull, isActive } = req.body;
      
      const [stand] = await db.update(stands)
        .set({
          ...(identifier !== undefined && { identifier }),
          ...(materialId !== undefined && { materialId }),
          ...(qrCode !== undefined && { qrCode }),
          ...(sequence !== undefined && { sequence }),
          ...(positionMeta !== undefined && { positionMeta }),
          ...(dailyFull !== undefined && { dailyFull }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        })
        .where(eq(stands.id, req.params.id))
        .returning();

      res.json(stand);
    } catch (error) {
      console.error("Failed to update stand:", error);
      res.status(500).json({ error: "Failed to update stand" });
    }
  });

  // PATCH /api/automotive/stands/:id - Update stand (supports dailyFull and dailyTaskTimeLocal)
  app.patch("/api/automotive/stands/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.select().from(stands).where(eq(stands.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Stand not found" });
      }

      const { dailyFull, dailyTaskTimeLocal, identifier, materialId, qrCode, sequence, positionMeta, isActive } = req.body;
      
      const [stand] = await db.update(stands)
        .set({
          ...(dailyFull !== undefined && { dailyFull }),
          ...(dailyTaskTimeLocal !== undefined && { dailyTaskTimeLocal }),
          ...(identifier !== undefined && { identifier }),
          ...(materialId !== undefined && { materialId }),
          ...(qrCode !== undefined && { qrCode }),
          ...(sequence !== undefined && { sequence }),
          ...(positionMeta !== undefined && { positionMeta }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        })
        .where(eq(stands.id, req.params.id))
        .returning();

      res.json(stand);
    } catch (error) {
      console.error("Failed to patch stand:", error);
      res.status(500).json({ error: "Failed to update stand" });
    }
  });

  // ----------------------------------------------------------------------------
  // BOXES CRUD
  // ----------------------------------------------------------------------------

  // GET /api/boxes - List all boxes
  app.get("/api/boxes", async (req, res) => {
    try {
      const result = await db.select().from(boxes).where(eq(boxes.isActive, true));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch boxes:", error);
      res.status(500).json({ error: "Failed to fetch boxes" });
    }
  });

  // GET /api/boxes/qr/:qrCode - Look up box by QR code (must be before :id route)
  app.get("/api/boxes/qr/:qrCode", async (req, res) => {
    try {
      const [box] = await db.select().from(boxes).where(eq(boxes.qrCode, req.params.qrCode));
      if (!box) {
        return res.status(404).json({ error: "Box not found" });
      }
      res.json(box);
    } catch (error) {
      console.error("Failed to fetch box by QR:", error);
      res.status(500).json({ error: "Failed to fetch box" });
    }
  });

  // GET /api/boxes/:id - Get box by ID
  app.get("/api/boxes/:id", async (req, res) => {
    try {
      const [box] = await db.select().from(boxes).where(eq(boxes.id, req.params.id));
      if (!box) {
        return res.status(404).json({ error: "Box not found" });
      }
      res.json(box);
    } catch (error) {
      console.error("Failed to fetch box:", error);
      res.status(500).json({ error: "Failed to fetch box" });
    }
  });

  // POST /api/boxes - Create box (admin only)
  app.post("/api/boxes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { qrCode, serial, standId, status, notes } = req.body;
      
      if (!qrCode || !serial) {
        return res.status(400).json({ error: "qrCode and serial are required" });
      }

      const [box] = await db.insert(boxes).values({
        qrCode,
        serial,
        standId: standId || null,
        status: status || "AT_STAND",
        notes: notes || null,
      }).returning();

      res.status(201).json(box);
    } catch (error) {
      console.error("Failed to create box:", error);
      res.status(500).json({ error: "Failed to create box" });
    }
  });

  // PUT /api/boxes/:id - Update box (admin only)
  app.put("/api/boxes/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.select().from(boxes).where(eq(boxes.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Box not found" });
      }

      const { qrCode, serial, standId, status, notes, isActive } = req.body;
      
      const [box] = await db.update(boxes)
        .set({
          ...(qrCode !== undefined && { qrCode }),
          ...(serial !== undefined && { serial }),
          ...(standId !== undefined && { standId }),
          ...(status !== undefined && { status }),
          ...(notes !== undefined && { notes }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        })
        .where(eq(boxes.id, req.params.id))
        .returning();

      res.json(box);
    } catch (error) {
      console.error("Failed to update box:", error);
      res.status(500).json({ error: "Failed to update box" });
    }
  });

  // POST /api/boxes/:id/position - Position box at a stand
  app.post("/api/boxes/:id/position", requireAuth, async (req, res) => {
    try {
      const { stationId, standId } = req.body;
      const authUser = (req as any).authUser;
      
      if (!standId) {
        return res.status(400).json({ error: "standId is required" });
      }

      const [box] = await db.select().from(boxes).where(eq(boxes.id, req.params.id));
      if (!box) {
        return res.status(404).json({ error: "Box not found" });
      }

      const [stand] = await db.select().from(stands).where(eq(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }

      const [station] = await db.select().from(stations).where(eq(stations.id, stand.stationId));
      if (!station) {
        return res.status(404).json({ error: "Station not found" });
      }

      const [hall] = await db.select().from(halls).where(eq(halls.id, station.hallId));
      
      let material = null;
      if (stand.materialId) {
        const [mat] = await db.select().from(materials).where(eq(materials.id, stand.materialId));
        material = mat;
      }

      const beforeData = { standId: box.standId, status: box.status };
      
      const [updatedBox] = await db.update(boxes)
        .set({
          standId,
          status: "AT_STAND",
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(boxes.id, req.params.id))
        .returning();

      await db.insert(taskEvents).values({
        taskId: box.currentTaskId || req.params.id,
        actorUserId: authUser.id,
        action: "BOX_POSITIONED",
        entityType: "box",
        entityId: box.id,
        beforeData,
        afterData: { standId, status: "AT_STAND" },
      });

      res.json({
        box: updatedBox,
        stand,
        material,
        station,
        hall,
      });
    } catch (error) {
      console.error("Failed to position box:", error);
      res.status(500).json({ error: "Failed to position box" });
    }
  });

  // ----------------------------------------------------------------------------
  // AUTOMOTIVE TASK ENDPOINTS
  // ----------------------------------------------------------------------------

  // POST /api/automotive/tasks - Create automotive task
  app.post("/api/automotive/tasks", requireAuth, async (req, res) => {
    try {
      const { boxId, standId, taskType } = req.body;
      const authUser = (req as any).authUser;
      
      if (!boxId || !standId) {
        return res.status(400).json({ error: "boxId and standId are required" });
      }

      const validTaskTypes = ["MANUAL", "DAILY_FULL"];
      if (taskType && !validTaskTypes.includes(taskType)) {
        return res.status(400).json({ error: "taskType must be MANUAL or DAILY_FULL" });
      }

      const [box] = await db.select().from(boxes).where(eq(boxes.id, boxId));
      if (!box) {
        return res.status(404).json({ error: "Box not found" });
      }

      const [stand] = await db.select().from(stands).where(eq(stands.id, standId));
      if (!stand) {
        return res.status(404).json({ error: "Stand not found" });
      }

      const activeTaskStatuses = ["OPEN", "PICKED_UP", "IN_TRANSIT", "DROPPED_OFF", "TAKEN_OVER", "WEIGHED"];
      const existingActiveTasks = await db.select().from(tasks).where(
        and(
          eq(tasks.boxId, boxId),
          notInArray(tasks.status, ["DISPOSED", "CANCELLED"])
        )
      );

      if (existingActiveTasks.length > 0) {
        return res.status(409).json({ 
          error: "Box already has an active task",
          activeTask: existingActiveTasks[0]
        });
      }

      const [station] = await db.select().from(stations).where(eq(stations.id, stand.stationId));
      
      const [task] = await db.insert(tasks).values({
        title: `Automotive Task - Box ${box.serial}`,
        description: `Pick up box from stand ${stand.identifier}`,
        containerID: boxId,
        boxId,
        standId,
        materialType: stand.materialId ? stand.materialId : null,
        taskType: taskType || "MANUAL",
        status: "OPEN",
        createdBy: authUser.id,
        priority: "normal",
      }).returning();

      await db.update(boxes)
        .set({ currentTaskId: task.id, updatedAt: new Date() })
        .where(eq(boxes.id, boxId));

      await db.insert(taskEvents).values({
        taskId: task.id,
        actorUserId: authUser.id,
        action: "TASK_CREATED",
        entityType: "task",
        entityId: task.id,
        beforeData: null,
        afterData: { status: "OPEN", boxId, standId, taskType: taskType || "MANUAL" },
      });

      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create automotive task:", error);
      res.status(500).json({ error: "Failed to create automotive task" });
    }
  });

  // PUT /api/automotive/tasks/:id/status - Update task status with transition guard
  app.put("/api/automotive/tasks/:id/status", requireAuth, async (req, res) => {
    try {
      const { status, weightKg, targetWarehouseContainerId, reason } = req.body;
      const authUser = (req as any).authUser;
      
      if (!status) {
        return res.status(400).json({ error: "status is required" });
      }

      const [task] = await db.select().from(tasks).where(eq(tasks.id, req.params.id));
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      try {
        assertAutomotiveTransition(task.status, status);
      } catch (error: any) {
        return res.status(409).json({ 
          error: error.message,
          currentStatus: task.status,
          requestedStatus: status
        });
      }

      if (task.status === "TAKEN_OVER" && status === "WEIGHED") {
        if (weightKg === undefined || weightKg === null) {
          return res.status(400).json({ error: "weightKg is required for WEIGHED status" });
        }
      }

      const beforeData = { 
        status: task.status, 
        weightKg: task.weightKg,
        targetWarehouseContainerId: task.targetWarehouseContainerId
      };

      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      const timestampField = getAutomotiveTimestampFieldForStatus(status);
      if (timestampField) {
        updateData[timestampField] = new Date();
      }

      if (weightKg !== undefined) {
        updateData.weightKg = weightKg;
        updateData.weighedByUserId = authUser.id;
      }

      if (targetWarehouseContainerId !== undefined) {
        updateData.targetWarehouseContainerId = targetWarehouseContainerId;
      }

      if (reason !== undefined) {
        updateData.cancellationReason = reason;
      }

      const [updatedTask] = await db.update(tasks)
        .set(updateData)
        .where(eq(tasks.id, req.params.id))
        .returning();

      if (status === "DISPOSED" || status === "CANCELLED") {
        if (task.boxId) {
          await db.update(boxes)
            .set({ 
              currentTaskId: null, 
              status: status === "DISPOSED" ? "AT_WAREHOUSE" : "AT_STAND",
              updatedAt: new Date() 
            })
            .where(eq(boxes.id, task.boxId));
        }
      }

      await db.insert(taskEvents).values({
        taskId: task.id,
        actorUserId: authUser.id,
        action: `STATUS_${status}`,
        entityType: "task",
        entityId: task.id,
        beforeData,
        afterData: { 
          status, 
          weightKg: updateData.weightKg,
          targetWarehouseContainerId: updateData.targetWarehouseContainerId,
          reason
        },
      });

      res.json(updatedTask);
    } catch (error) {
      console.error("Failed to update task status:", error);
      res.status(500).json({ error: "Failed to update task status" });
    }
  });

  // GET /api/automotive/tasks/:id/suggest-container - Suggest warehouse container
  app.get("/api/automotive/tasks/:id/suggest-container", async (req, res) => {
    try {
      const [task] = await db.select().from(tasks).where(eq(tasks.id, req.params.id));
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      let materialId = task.materialType;
      
      if (task.standId) {
        const [stand] = await db.select().from(stands).where(eq(stands.id, task.standId));
        if (stand && stand.materialId) {
          materialId = stand.materialId;
        }
      }

      const containers = await db.select().from(warehouseContainers).where(
        and(
          eq(warehouseContainers.isActive, true),
          eq(warehouseContainers.isFull, false),
          eq(warehouseContainers.isBlocked, false),
          materialId ? eq(warehouseContainers.materialId, materialId) : isNull(warehouseContainers.materialId)
        )
      );

      const sortedContainers = containers
        .map(c => ({
          ...c,
          availableCapacity: c.maxCapacity - c.currentAmount
        }))
        .sort((a, b) => b.availableCapacity - a.availableCapacity);

      res.json(sortedContainers);
    } catch (error) {
      console.error("Failed to suggest container:", error);
      res.status(500).json({ error: "Failed to suggest container" });
    }
  });

  // POST /api/automotive/daily-tasks/generate - Generate daily tasks for dailyFull stands
  // Can be called by cron job or manually triggered by admin
  // Uses dedupKey to prevent duplicates and auto-cancels previous OPEN tasks
  app.post("/api/automotive/daily-tasks/generate", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const now = new Date();
      const today = getTodayBerlin();
      const todayStr = formatDateBerlin(new Date());
      
      // AUTO_CANCEL_PREVIOUS: Cancel previous OPEN daily tasks from earlier dates
      const openDailyTasks = await db.select().from(tasks).where(
        and(eq(tasks.taskType, "DAILY_FULL"), eq(tasks.status, "OPEN"))
      );
      let cancelledCount = 0;
      for (const task of openDailyTasks) {
        if (task.dedupKey && !task.dedupKey.endsWith(`:${todayStr}`)) {
          await db.update(tasks).set({
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: "Auto-cancelled: New daily task generated",
            updatedAt: new Date()
          }).where(eq(tasks.id, task.id));
          cancelledCount++;
        }
      }
      
      // Find all stands with dailyFull=true
      const dailyFullStands = await db.select().from(stands).where(
        and(
          eq(stands.dailyFull, true),
          eq(stands.isActive, true)
        )
      );
      
      const createdTasks: any[] = [];
      const skipped: { standId: string; reason: string }[] = [];
      
      for (const stand of dailyFullStands) {
        const dedupKey = `DAILY:${stand.id}:${todayStr}`;
        
        try {
          // Create the daily task with boxId: null (assigned on pickup)
          const [task] = await db.insert(tasks).values({
            title: `Tägliche Abholung - Stand ${stand.identifier}`,
            description: `Automatisch generierte tägliche Abholung für Stand ${stand.identifier}`,
            containerID: stand.id,
            boxId: null,
            standId: stand.id,
            materialType: stand.materialId || null,
            taskType: "DAILY_FULL",
            status: "OPEN",
            createdBy: authUser.id,
            priority: "normal",
            scheduledFor: today,
            dedupKey,
          }).returning();
          
          // Update stand's lastDailyTaskGeneratedAt
          await db.update(stands)
            .set({ lastDailyTaskGeneratedAt: now, updatedAt: new Date() })
            .where(eq(stands.id, stand.id));
          
          // Create task event
          await db.insert(taskEvents).values({
            taskId: task.id,
            actorUserId: authUser.id,
            action: "TASK_CREATED",
            entityType: "task",
            entityId: task.id,
            beforeData: null,
            afterData: { status: "OPEN", boxId: null, standId: stand.id, taskType: "DAILY_FULL", dedupKey },
          });
          
          createdTasks.push({
            task,
            stand: { id: stand.id, identifier: stand.identifier },
          });
        } catch (e: any) {
          if (e?.code === '23505') {
            skipped.push({ standId: stand.id, reason: "Task already exists for today (dedupKey)" });
            continue;
          }
          throw e;
        }
      }
      
      res.json({
        success: true,
        createdCount: createdTasks.length,
        skippedCount: skipped.length,
        cancelledPreviousCount: cancelledCount,
        created: createdTasks,
        skipped: skipped,
        generatedAt: now.toISOString(),
      });
    } catch (error) {
      console.error("Failed to generate daily tasks:", error);
      res.status(500).json({ error: "Failed to generate daily tasks" });
    }
  });

  // GET /api/automotive/daily-tasks/status - Check status of daily task generation
  app.get("/api/automotive/daily-tasks/status", async (req, res) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Get all dailyFull stands
      const dailyFullStands = await db.select().from(stands).where(
        and(
          eq(stands.dailyFull, true),
          eq(stands.isActive, true)
        )
      );
      
      const status = dailyFullStands.map(stand => ({
        standId: stand.id,
        identifier: stand.identifier,
        lastGeneratedAt: stand.lastDailyTaskGeneratedAt?.toISOString() || null,
        generatedToday: stand.lastDailyTaskGeneratedAt ? stand.lastDailyTaskGeneratedAt >= todayStart : false,
      }));
      
      const totalStands = status.length;
      const generatedToday = status.filter(s => s.generatedToday).length;
      const pendingToday = totalStands - generatedToday;
      
      res.json({
        totalDailyFullStands: totalStands,
        generatedToday,
        pendingToday,
        stands: status,
        checkedAt: now.toISOString(),
      });
    } catch (error) {
      console.error("Failed to get daily tasks status:", error);
      res.status(500).json({ error: "Failed to get daily tasks status" });
    }
  });

  // GET /api/daily-tasks/today - Returns today's OPEN daily tasks (Europe/Berlin timezone)
  app.get("/api/daily-tasks/today", async (req, res) => {
    try {
      const todayStr = formatDateBerlin(new Date());
      const todayTasks = await db.select().from(tasks).where(
        and(
          eq(tasks.taskType, "DAILY_FULL"),
          eq(tasks.status, "OPEN")
        )
      );
      const filteredTasks = todayTasks.filter(t => 
        t.dedupKey?.startsWith(`DAILY:`) && t.dedupKey?.endsWith(`:${todayStr}`)
      );
      res.json(filteredTasks);
    } catch (error) {
      console.error("Failed to fetch today's daily tasks:", error);
      res.status(500).json({ error: "Failed to fetch today's daily tasks" });
    }
  });

  // POST /api/admin/daily-tasks/run - Admin-only, manually triggers daily task generation
  app.post("/api/admin/daily-tasks/run", requireAuth, requireAdmin, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const now = new Date();
      const today = getTodayBerlin();
      const todayStr = formatDateBerlin(new Date());
      
      // AUTO_CANCEL_PREVIOUS: Cancel previous OPEN daily tasks from earlier dates
      const openDailyTasks = await db.select().from(tasks).where(
        and(eq(tasks.taskType, "DAILY_FULL"), eq(tasks.status, "OPEN"))
      );
      let cancelledCount = 0;
      for (const task of openDailyTasks) {
        if (task.dedupKey && !task.dedupKey.endsWith(`:${todayStr}`)) {
          await db.update(tasks).set({
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: "Auto-cancelled: New daily task generated",
            updatedAt: new Date()
          }).where(eq(tasks.id, task.id));
          cancelledCount++;
        }
      }
      
      // Find all stands with dailyFull=true
      const dailyFullStands = await db.select().from(stands).where(
        and(
          eq(stands.dailyFull, true),
          eq(stands.isActive, true)
        )
      );
      
      const createdTasks: any[] = [];
      const skipped: { standId: string; reason: string }[] = [];
      
      for (const stand of dailyFullStands) {
        const dedupKey = `DAILY:${stand.id}:${todayStr}`;
        
        try {
          const [task] = await db.insert(tasks).values({
            title: `Tägliche Abholung - Stand ${stand.identifier}`,
            description: `Automatisch generierte tägliche Abholung für Stand ${stand.identifier}`,
            containerID: stand.id,
            boxId: null,
            standId: stand.id,
            materialType: stand.materialId || null,
            taskType: "DAILY_FULL",
            status: "OPEN",
            createdBy: authUser.id,
            priority: "normal",
            scheduledFor: today,
            dedupKey,
          }).returning();
          
          await db.update(stands)
            .set({ lastDailyTaskGeneratedAt: now, updatedAt: new Date() })
            .where(eq(stands.id, stand.id));
          
          await db.insert(taskEvents).values({
            taskId: task.id,
            actorUserId: authUser.id,
            action: "TASK_CREATED",
            entityType: "task",
            entityId: task.id,
            beforeData: null,
            afterData: { status: "OPEN", boxId: null, standId: stand.id, taskType: "DAILY_FULL", dedupKey },
          });
          
          createdTasks.push({
            task,
            stand: { id: stand.id, identifier: stand.identifier },
          });
        } catch (e: any) {
          if (e?.code === '23505') {
            skipped.push({ standId: stand.id, reason: "Task already exists for today (dedupKey)" });
            continue;
          }
          throw e;
        }
      }
      
      res.json({
        success: true,
        createdCount: createdTasks.length,
        skippedCount: skipped.length,
        cancelledPreviousCount: cancelledCount,
        created: createdTasks,
        skipped: skipped,
        generatedAt: now.toISOString(),
      });
    } catch (error) {
      console.error("Failed to run daily tasks:", error);
      res.status(500).json({ error: "Failed to run daily tasks" });
    }
  });

  // ----------------------------------------------------------------------------
  // TASK EVENTS ENDPOINTS
  // ----------------------------------------------------------------------------

  // GET /api/task-events - Get all events for a task
  app.get("/api/task-events", async (req, res) => {
    try {
      const { taskId } = req.query;
      
      if (!taskId || typeof taskId !== 'string') {
        return res.status(400).json({ error: "taskId query parameter is required" });
      }

      const events = await db.select().from(taskEvents)
        .where(eq(taskEvents.taskId, taskId))
        .orderBy(desc(taskEvents.timestamp));

      res.json(events);
    } catch (error) {
      console.error("Failed to fetch task events:", error);
      res.status(500).json({ error: "Failed to fetch task events" });
    }
  });

  // ----------------------------------------------------------------------------
  // DAILY TASK SCHEDULER
  // Runs at startup (5 second delay) and every hour to generate daily tasks
  // ----------------------------------------------------------------------------
  setTimeout(() => {
    console.log("[DailyTaskScheduler] Initial run starting in 5 seconds...");
    generateDailyTasksScheduled();
  }, 5000);
  
  setInterval(() => {
    generateDailyTasksScheduled();
  }, 60 * 60 * 1000); // Every hour

  const httpServer = createServer(app);
  return httpServer;
}
