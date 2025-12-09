import { 
  users, customerContainers, warehouseContainers, tasks, activityLogs, fillHistory,
  type User, type InsertUser, 
  type CustomerContainer, type WarehouseContainer, 
  type Task, type ActivityLog, type FillHistory
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  getCustomerContainers(): Promise<CustomerContainer[]>;
  getCustomerContainer(id: string): Promise<CustomerContainer | undefined>;
  getCustomerContainerByQR(qrCode: string): Promise<CustomerContainer | undefined>;
  createCustomerContainer(data: Omit<CustomerContainer, 'createdAt'>): Promise<CustomerContainer>;
  updateCustomerContainer(id: string, data: Partial<CustomerContainer>): Promise<CustomerContainer | undefined>;

  getWarehouseContainers(): Promise<WarehouseContainer[]>;
  getWarehouseContainer(id: string): Promise<WarehouseContainer | undefined>;
  getWarehouseContainerByQR(qrCode: string): Promise<WarehouseContainer | undefined>;
  createWarehouseContainer(data: Omit<WarehouseContainer, 'createdAt'>): Promise<WarehouseContainer>;
  updateWarehouseContainer(id: string, data: Partial<WarehouseContainer>): Promise<WarehouseContainer | undefined>;

  getTasks(filters?: { assignedTo?: string; status?: string; date?: Date }): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(data: Omit<Task, 'id' | 'createdAt'>): Promise<Task>;
  updateTask(id: string, data: Partial<Task>): Promise<Task | undefined>;

  getActivityLogs(filters?: { userId?: string; containerId?: string; action?: string }): Promise<ActivityLog[]>;
  createActivityLog(data: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog>;

  getFillHistory(warehouseContainerId: string): Promise<FillHistory[]>;
  createFillHistory(data: Omit<FillHistory, 'id' | 'createdAt'>): Promise<FillHistory>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.isActive, true));
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getCustomerContainers(): Promise<CustomerContainer[]> {
    return db.select().from(customerContainers).where(eq(customerContainers.isActive, true));
  }

  async getCustomerContainer(id: string): Promise<CustomerContainer | undefined> {
    const [container] = await db.select().from(customerContainers).where(eq(customerContainers.id, id));
    return container || undefined;
  }

  async getCustomerContainerByQR(qrCode: string): Promise<CustomerContainer | undefined> {
    const [container] = await db.select().from(customerContainers).where(eq(customerContainers.qrCode, qrCode));
    return container || undefined;
  }

  async createCustomerContainer(data: Omit<CustomerContainer, 'createdAt'>): Promise<CustomerContainer> {
    const [container] = await db.insert(customerContainers).values(data).returning();
    return container;
  }

  async updateCustomerContainer(id: string, data: Partial<CustomerContainer>): Promise<CustomerContainer | undefined> {
    const [container] = await db.update(customerContainers).set(data).where(eq(customerContainers.id, id)).returning();
    return container || undefined;
  }

  async getWarehouseContainers(): Promise<WarehouseContainer[]> {
    return db.select().from(warehouseContainers).where(eq(warehouseContainers.isActive, true));
  }

  async getWarehouseContainer(id: string): Promise<WarehouseContainer | undefined> {
    const [container] = await db.select().from(warehouseContainers).where(eq(warehouseContainers.id, id));
    return container || undefined;
  }

  async getWarehouseContainerByQR(qrCode: string): Promise<WarehouseContainer | undefined> {
    const [container] = await db.select().from(warehouseContainers).where(eq(warehouseContainers.qrCode, qrCode));
    return container || undefined;
  }

  async createWarehouseContainer(data: Omit<WarehouseContainer, 'createdAt'>): Promise<WarehouseContainer> {
    const [container] = await db.insert(warehouseContainers).values(data).returning();
    return container;
  }

  async updateWarehouseContainer(id: string, data: Partial<WarehouseContainer>): Promise<WarehouseContainer | undefined> {
    const [container] = await db.update(warehouseContainers).set(data).where(eq(warehouseContainers.id, id)).returning();
    return container || undefined;
  }

  async getTasks(filters?: { assignedTo?: string; status?: string; date?: Date }): Promise<Task[]> {
    let query = db.select().from(tasks);
    const conditions = [];
    
    if (filters?.assignedTo) {
      conditions.push(eq(tasks.assignedTo, filters.assignedTo));
    }
    if (filters?.status) {
      conditions.push(eq(tasks.status, filters.status));
    }
    if (filters?.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(gte(tasks.scheduledTime, startOfDay));
      conditions.push(lte(tasks.scheduledTime, endOfDay));
    }

    if (conditions.length > 0) {
      return db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.createdAt));
    }
    return db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async createTask(data: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
    const [task] = await db.insert(tasks).values(data).returning();
    return task;
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task | undefined> {
    const [task] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return task || undefined;
  }

  async getActivityLogs(filters?: { userId?: string; containerId?: string; action?: string }): Promise<ActivityLog[]> {
    const conditions = [];
    
    if (filters?.userId) {
      conditions.push(eq(activityLogs.userId, filters.userId));
    }
    if (filters?.containerId) {
      conditions.push(eq(activityLogs.containerId, filters.containerId));
    }
    if (filters?.action) {
      conditions.push(eq(activityLogs.action, filters.action));
    }

    if (conditions.length > 0) {
      return db.select().from(activityLogs).where(and(...conditions)).orderBy(desc(activityLogs.createdAt));
    }
    return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt));
  }

  async createActivityLog(data: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog> {
    const [log] = await db.insert(activityLogs).values(data).returning();
    return log;
  }

  async getFillHistory(warehouseContainerId: string): Promise<FillHistory[]> {
    return db.select().from(fillHistory)
      .where(eq(fillHistory.warehouseContainerId, warehouseContainerId))
      .orderBy(desc(fillHistory.createdAt));
  }

  async createFillHistory(data: Omit<FillHistory, 'id' | 'createdAt'>): Promise<FillHistory> {
    const [history] = await db.insert(fillHistory).values(data).returning();
    return history;
  }
}

export const storage = new DatabaseStorage();
