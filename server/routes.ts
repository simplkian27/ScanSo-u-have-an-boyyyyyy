import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.head("/api/health", (req, res) => {
    res.status(200).end();
  });

  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
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
      const { userId, containerId, action, startDate, endDate } = req.query;
      const filters: { userId?: string; containerId?: string; action?: string; startDate?: Date; endDate?: Date } = {};
      
      if (userId) filters.userId = userId as string;
      if (containerId) filters.containerId = containerId as string;
      if (action) filters.action = action as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const logs = await storage.getActivityLogs(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  app.get("/api/activity-logs/export/csv", async (req, res) => {
    try {
      const { userId, containerId, action, startDate, endDate } = req.query;
      const filters: { userId?: string; containerId?: string; action?: string; startDate?: Date; endDate?: Date } = {};
      
      if (userId) filters.userId = userId as string;
      if (containerId) filters.containerId = containerId as string;
      if (action) filters.action = action as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const logs = await storage.getActivityLogs(Object.keys(filters).length > 0 ? filters : undefined);
      const users = await storage.getUsers();
      
      const getUserName = (id: string) => {
        const user = users.find(u => u.id === id);
        return user?.name || "Unknown";
      };

      const csvHeader = "ID,Date,Time,Driver,Action,Container ID,Task ID,Details\n";
      const csvRows = logs.map(log => {
        const date = new Date(log.createdAt);
        const dateStr = date.toLocaleDateString("en-US");
        const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        const driverName = getUserName(log.userId).replace(/,/g, ";");
        const action = log.action.replace(/,/g, ";");
        const containerId = log.containerId?.replace(/,/g, ";") || "";
        const taskId = log.taskId?.replace(/,/g, ";") || "";
        const details = log.details?.replace(/,/g, ";").replace(/\n/g, " ") || "";
        return `${log.id},${dateStr},${timeStr},${driverName},${action},${containerId},${taskId},${details}`;
      }).join("\n");

      const csv = csvHeader + csvRows;
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=activity-log-${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ error: "Failed to export activity logs" });
    }
  });

  app.get("/api/analytics/driver-performance", async (req, res) => {
    try {
      const allTasks = await storage.getTasks();
      const users = await storage.getUsers();
      const drivers = users.filter(u => u.role === "driver");
      
      const now = new Date();
      const today = now.toDateString();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);

      const driverStats = drivers.map(driver => {
        const driverTasks = allTasks.filter(t => t.assignedTo === driver.id);
        const completedTasks = driverTasks.filter(t => t.status === "completed");
        const completedToday = completedTasks.filter(t => {
          if (!t.deliveryTimestamp) return false;
          return new Date(t.deliveryTimestamp).toDateString() === today;
        });
        const completedThisWeek = completedTasks.filter(t => {
          if (!t.deliveryTimestamp) return false;
          const deliveryDate = new Date(t.deliveryTimestamp);
          return deliveryDate >= startOfWeek;
        });

        const avgDeliveryTime = completedTasks.length > 0 
          ? completedTasks.reduce((sum, t) => {
              if (t.pickupTimestamp && t.deliveryTimestamp) {
                return sum + (new Date(t.deliveryTimestamp).getTime() - new Date(t.pickupTimestamp).getTime());
              }
              return sum;
            }, 0) / completedTasks.length / (1000 * 60)
          : 0;

        const completionRate = driverTasks.length > 0 
          ? Math.round((completedTasks.length / driverTasks.length) * 100)
          : 0;

        return {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          totalAssigned: driverTasks.length,
          totalCompleted: completedTasks.length,
          completedToday: completedToday.length,
          completedThisWeek: completedThisWeek.length,
          inProgress: driverTasks.filter(t => t.status === "in_progress").length,
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
        const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        
        const dayTasks = allTasks.filter(t => {
          if (!t.deliveryTimestamp) return false;
          const taskDate = new Date(t.deliveryTimestamp);
          return taskDate.toDateString() === date.toDateString();
        });

        const totalDelivered = dayTasks.reduce((sum, t) => {
          const container = warehouseContainers.find(c => c.id === t.deliveryContainerID);
          return sum + (container ? 50 : 0); // Estimate per delivery
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
