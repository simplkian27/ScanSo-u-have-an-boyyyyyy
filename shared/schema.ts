import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("driver"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
  activityLogs: many(activityLogs),
}));

export const customerContainers = pgTable("customer_containers", {
  id: varchar("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  location: text("location").notNull(),
  materialType: text("material_type").notNull(),
  lastEmptied: timestamp("last_emptied"),
  qrCode: text("qr_code").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customerContainersRelations = relations(customerContainers, ({ many }) => ({
  tasks: many(tasks),
}));

export const warehouseContainers = pgTable("warehouse_containers", {
  id: varchar("id").primaryKey(),
  location: text("location").notNull(),
  materialType: text("material_type").notNull(),
  currentAmount: real("current_amount").notNull().default(0),
  maxCapacity: real("max_capacity").notNull(),
  lastEmptied: timestamp("last_emptied"),
  qrCode: text("qr_code").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const warehouseContainersRelations = relations(warehouseContainers, ({ many }) => ({
  tasks: many(tasks),
  fillHistory: many(fillHistory),
}));

export const fillHistory = pgTable("fill_history", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  warehouseContainerId: varchar("warehouse_container_id").notNull().references(() => warehouseContainers.id),
  amountAdded: real("amount_added").notNull(),
  taskId: varchar("task_id").references(() => tasks.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fillHistoryRelations = relations(fillHistory, ({ one }) => ({
  warehouseContainer: one(warehouseContainers, {
    fields: [fillHistory.warehouseContainerId],
    references: [warehouseContainers.id],
  }),
  task: one(tasks, {
    fields: [fillHistory.taskId],
    references: [tasks.id],
  }),
}));

export const tasks = pgTable("tasks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  containerID: varchar("container_id").notNull().references(() => customerContainers.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  status: text("status").notNull().default("open"),
  scheduledTime: timestamp("scheduled_time"),
  priority: text("priority").notNull().default("normal"),
  notes: text("notes"),
  materialType: text("material_type").notNull(),
  estimatedAmount: real("estimated_amount"),
  pickupTimestamp: timestamp("pickup_timestamp"),
  pickupLocation: jsonb("pickup_location"),
  deliveryTimestamp: timestamp("delivery_timestamp"),
  deliveryContainerID: varchar("delivery_container_id").references(() => warehouseContainers.id),
  cancellationReason: text("cancellation_reason"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tasksRelations = relations(tasks, ({ one }) => ({
  container: one(customerContainers, {
    fields: [tasks.containerID],
    references: [customerContainers.id],
  }),
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
  }),
  deliveryContainer: one(warehouseContainers, {
    fields: [tasks.deliveryContainerID],
    references: [warehouseContainers.id],
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
  }),
}));

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  taskId: varchar("task_id").references(() => tasks.id),
  containerId: varchar("container_id"),
  location: jsonb("location"),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [activityLogs.taskId],
    references: [tasks.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  role: true,
});

export const insertCustomerContainerSchema = createInsertSchema(customerContainers);
export const insertWarehouseContainerSchema = createInsertSchema(warehouseContainers);
export const insertTaskSchema = createInsertSchema(tasks);
export const insertActivityLogSchema = createInsertSchema(activityLogs);
export const insertFillHistorySchema = createInsertSchema(fillHistory);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type CustomerContainer = typeof customerContainers.$inferSelect;
export type WarehouseContainer = typeof warehouseContainers.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type FillHistory = typeof fillHistory.$inferSelect;
