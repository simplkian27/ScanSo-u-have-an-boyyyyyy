import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
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

export async function registerRoutes(app: Express): Promise<Server> {
  app.head("/api/health", (req, res) => {
    res.status(200).end();
  });

  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
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

  app.post("/api/users", async (req, res) => {
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
  // CUSTOMERS
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

  app.post("/api/customers", async (req, res) => {
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
  // CUSTOMER CONTAINERS
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

  app.post("/api/containers/customer", async (req, res) => {
    try {
      const container = await storage.createCustomerContainer(req.body);
      res.status(201).json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to create container" });
    }
  });

  app.patch("/api/containers/customer/:id", async (req, res) => {
    try {
      const container = await storage.updateCustomerContainer(req.params.id, req.body);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to update container" });
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

  app.post("/api/containers/warehouse", async (req, res) => {
    try {
      const container = await storage.createWarehouseContainer(req.body);
      res.status(201).json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to create container" });
    }
  });

  app.patch("/api/containers/warehouse/:id", async (req, res) => {
    try {
      const container = await storage.updateWarehouseContainer(req.params.id, req.body);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      console.error("Error updating warehouse container:", error);
      res.status(500).json({ error: "Failed to update container", details: String(error) });
    }
  });

  // Reset warehouse container - sets current amount to 0
  app.post("/api/containers/warehouse/:id/reset", async (req, res) => {
    try {
      const { userId, reason } = req.body;
      const existingContainer = await storage.getWarehouseContainer(req.params.id);
      if (!existingContainer) {
        return res.status(404).json({ error: "Container not found" });
      }

      const previousAmount = existingContainer.currentAmount;
      const container = await storage.updateWarehouseContainer(req.params.id, {
        currentAmount: 0,
      });

      if (!container) {
        return res.status(500).json({ error: "Failed to reset container" });
      }

      await storage.createActivityLog({
        type: "CONTAINER_STATUS_CHANGED",
        message: `Container ${req.params.id} wurde geleert (${previousAmount} ${existingContainer.quantityUnit} entfernt)`,
        userId: userId || null,
        taskId: null,
        containerId: req.params.id,
        scanEventId: null,
        location: null,
        timestamp: new Date(),
        details: reason || null,
        metadata: { previousAmount, reason },
      });

      res.json(container);
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

  app.get("/api/tasks", async (req, res) => {
    try {
      const { assignedTo, status, date } = req.query;
      const filters: { assignedTo?: string; status?: string; date?: Date } = {};
      
      if (assignedTo) filters.assignedTo = assignedTo as string;
      if (status) filters.status = status as string;
      if (date) filters.date = new Date(date as string);

      const taskList = await storage.getTasks(Object.keys(filters).length > 0 ? filters : undefined);
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

  app.post("/api/tasks", async (req, res) => {
    try {
      const taskData = {
        ...req.body,
        status: req.body.status || "PLANNED",
      };
      const task = await storage.createTask(taskData);
      
      await storage.createActivityLog({
        type: "TASK_CREATED",
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
      res.status(500).json({ error: "Failed to create task" });
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

  app.post("/api/tasks/:id/pickup", async (req, res) => {
    try {
      const { userId, location, geoLocation } = req.body;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const updatedTask = await storage.updateTaskStatus(req.params.id, "ACCEPTED");
      if (!updatedTask) {
        return res.status(400).json({ error: "Invalid status transition" });
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
        message: `Fahrer ${driverName} hat Auftrag ${task.id} beim Kunden angenommen`,
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
      res.status(500).json({ error: "Failed to record pickup" });
    }
  });

  app.post("/api/tasks/:id/delivery", async (req, res) => {
    try {
      const { userId, warehouseContainerId, amount, location, geoLocation } = req.body;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const warehouseContainer = await storage.getWarehouseContainer(warehouseContainerId);
      if (!warehouseContainer) {
        return res.status(404).json({ error: "Warehouse container not found" });
      }

      if (warehouseContainer.materialType !== task.materialType) {
        return res.status(400).json({ error: "Material type mismatch" });
      }

      const availableSpace = warehouseContainer.maxCapacity - warehouseContainer.currentAmount;
      if (amount > availableSpace) {
        return res.status(400).json({ error: "Insufficient capacity", availableSpace });
      }

      let updatedTask = await storage.updateTaskStatus(req.params.id, "DELIVERED");
      if (!updatedTask) {
        return res.status(400).json({ error: "Invalid status transition" });
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

      await storage.updateWarehouseContainer(warehouseContainerId, {
        currentAmount: warehouseContainer.currentAmount + amount,
      });

      await storage.createFillHistory({
        warehouseContainerId,
        amountAdded: amount,
        quantityUnit: warehouseContainer.quantityUnit,
        taskId: task.id,
        recordedByUserId: userId,
      });

      await storage.updateCustomerContainer(task.containerID, {
        lastEmptied: new Date(),
        status: "AT_CUSTOMER",
      });

      updatedTask = await storage.updateTaskStatus(req.params.id, "COMPLETED");
      if (!updatedTask) {
        return res.status(400).json({ error: "Failed to complete task" });
      }

      await storage.createActivityLog({
        type: "TASK_COMPLETED",
        message: `Auftrag ${task.id} abgeschlossen, ${amount} kg erfasst`,
        userId,
        taskId: task.id,
        containerId: warehouseContainerId,
        timestamp: new Date(),
        metadata: { amountAdded: amount, unit: warehouseContainer.quantityUnit },
        details: null,
        location: null,
        scanEventId: null,
      });

      res.json(updatedTask);
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
      const { containerId, containerType, userId, scanContext, locationType, locationDetails, geoLocation, taskId } = req.body;
      
      if (!containerId || !containerType || !userId || !scanContext || !locationType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

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

  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const allTasks = await storage.getTasks();
      const warehouseContainers = await storage.getWarehouseContainers();
      const users = await storage.getUsers();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayTasks = allTasks.filter(t => {
        const created = new Date(t.createdAt);
        return created >= today && created <= todayEnd;
      });

      const openStatuses = ["PLANNED", "open"];
      const inProgressStatuses = ["ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "in_progress"];
      const completedStatuses = ["COMPLETED", "completed"];

      const openTasks = allTasks.filter(t => openStatuses.includes(t.status)).length;
      const inProgressTasks = allTasks.filter(t => inProgressStatuses.includes(t.status)).length;
      const completedToday = todayTasks.filter(t => completedStatuses.includes(t.status)).length;
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
        completedToday,
        activeDrivers,
        criticalContainers,
        totalCapacity,
        availableCapacity,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
