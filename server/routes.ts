import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function registerRoutes(app: Express): Promise<Server> {
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

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
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
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
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

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
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
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

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
      const container = await storage.getCustomerContainerByQR(req.params.qrCode);
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
      const container = await storage.getWarehouseContainerByQR(req.params.qrCode);
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
      res.status(500).json({ error: "Failed to update container" });
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
      const task = await storage.createTask(req.body);
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

  app.post("/api/tasks/:id/pickup", async (req, res) => {
    try {
      const { userId, location } = req.body;
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const updatedTask = await storage.updateTask(req.params.id, {
        status: "in_progress",
        pickupTimestamp: new Date(),
        pickupLocation: location,
      });

      await storage.createActivityLog({
        userId,
        action: "pickup",
        taskId: task.id,
        containerId: task.containerID,
        location,
        details: `Picked up container ${task.containerID}`,
      });

      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: "Failed to record pickup" });
    }
  });

  app.post("/api/tasks/:id/delivery", async (req, res) => {
    try {
      const { userId, warehouseContainerId, amount, location } = req.body;
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

      const updatedTask = await storage.updateTask(req.params.id, {
        status: "completed",
        deliveryTimestamp: new Date(),
        deliveryContainerID: warehouseContainerId,
      });

      await storage.updateWarehouseContainer(warehouseContainerId, {
        currentAmount: warehouseContainer.currentAmount + amount,
      });

      await storage.createFillHistory({
        warehouseContainerId,
        amountAdded: amount,
        taskId: task.id,
      });

      await storage.updateCustomerContainer(task.containerID, {
        lastEmptied: new Date(),
      });

      await storage.createActivityLog({
        userId,
        action: "delivery",
        taskId: task.id,
        containerId: warehouseContainerId,
        location,
        details: `Delivered ${amount}kg to container ${warehouseContainerId}`,
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

      const updatedTask = await storage.updateTask(req.params.id, {
        status: "cancelled",
        cancellationReason: reason,
      });

      await storage.createActivityLog({
        userId,
        action: "cancelled",
        taskId: task.id,
        containerId: task.containerID,
        details: `Task cancelled: ${reason}`,
      });

      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel task" });
    }
  });

  app.get("/api/activity-logs", async (req, res) => {
    try {
      const { userId, containerId, action } = req.query;
      const filters: { userId?: string; containerId?: string; action?: string } = {};
      
      if (userId) filters.userId = userId as string;
      if (containerId) filters.containerId = containerId as string;
      if (action) filters.action = action as string;

      const logs = await storage.getActivityLogs(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity logs" });
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

      const openTasks = allTasks.filter(t => t.status === "open").length;
      const inProgressTasks = allTasks.filter(t => t.status === "in_progress").length;
      const completedToday = todayTasks.filter(t => t.status === "completed").length;
      const activeDrivers = users.filter(u => u.role === "driver" && u.isActive).length;

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
