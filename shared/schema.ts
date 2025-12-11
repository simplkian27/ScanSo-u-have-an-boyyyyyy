import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// ENUMS - Status and Type Definitions
// ============================================================================

/**
 * User Role Enum
 * - ADMIN: Full access to create tasks, manage users, view all data
 * - DRIVER: Field operations, scan containers, complete tasks
 */
export const userRoleEnum = pgEnum("user_role", ["ADMIN", "DRIVER"]);

/**
 * Container Status Enum
 * Tracks the current location/state of a container
 */
export const containerStatusEnum = pgEnum("container_status", [
  "AT_WAREHOUSE",    // Container is at the warehouse
  "AT_CUSTOMER",     // Container is at customer location
  "IN_TRANSIT",      // Container is being transported
  "OUT_OF_SERVICE",  // Container is not available (maintenance, etc.)
]);

/**
 * Task Status Enum - Lifecycle States
 * Defines the complete lifecycle of a task/job
 * 
 * Valid transitions:
 * PLANNED -> ASSIGNED -> ACCEPTED -> PICKED_UP -> IN_TRANSIT -> DELIVERED -> COMPLETED
 * Any state except COMPLETED can transition to CANCELLED
 */
export const taskStatusEnum = pgEnum("task_status", [
  "PLANNED",      // Task created by admin, not yet assigned
  "ASSIGNED",     // Task assigned to a driver
  "ACCEPTED",     // Driver has accepted the task (scanned at customer)
  "PICKED_UP",    // Container picked up from customer
  "IN_TRANSIT",   // Container being transported to warehouse
  "DELIVERED",    // Container delivered to warehouse (scanned)
  "COMPLETED",    // Task fully completed (weight recorded, etc.)
  "CANCELLED",    // Task was cancelled
]);

/**
 * Scan Context Enum
 * Defines the context in which a scan occurred
 */
export const scanContextEnum = pgEnum("scan_context", [
  "WAREHOUSE_INFO",           // General info scan in warehouse (no task)
  "CUSTOMER_INFO",            // General info scan at customer (no task)
  "TASK_ACCEPT_AT_CUSTOMER",  // Driver scans to accept task at customer
  "TASK_PICKUP",              // Driver scans to confirm pickup
  "TASK_COMPLETE_AT_WAREHOUSE", // Driver scans at warehouse to complete delivery
  "INVENTORY_CHECK",          // Inventory/audit scan
  "MAINTENANCE",              // Maintenance-related scan
]);

/**
 * Location Type Enum
 * Where the scan took place
 */
export const locationTypeEnum = pgEnum("location_type", [
  "WAREHOUSE",
  "CUSTOMER",
  "OTHER",
]);

/**
 * Activity Log Type Enum
 * Categorizes activity log entries for filtering and display
 */
export const activityLogTypeEnum = pgEnum("activity_log_type", [
  "TASK_CREATED",
  "TASK_ASSIGNED",
  "TASK_ACCEPTED",
  "TASK_PICKED_UP",
  "TASK_IN_TRANSIT",
  "TASK_DELIVERED",
  "TASK_COMPLETED",
  "TASK_CANCELLED",
  "CONTAINER_SCANNED_AT_CUSTOMER",
  "CONTAINER_SCANNED_AT_WAREHOUSE",
  "CONTAINER_STATUS_CHANGED",
  "WEIGHT_RECORDED",
  "MANUAL_EDIT",
  "SYSTEM_EVENT",
]);

/**
 * Priority Enum
 */
export const priorityEnum = pgEnum("priority", ["normal", "high", "urgent"]);

/**
 * Quantity Unit Enum
 */
export const quantityUnitEnum = pgEnum("quantity_unit", ["kg", "t", "m3", "pcs"]);

// ============================================================================
// TABLES
// ============================================================================

/**
 * Users Table
 * Stores admin and driver accounts
 */
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("DRIVER"), // ADMIN or DRIVER
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  createdTasks: many(tasks, { relationName: "taskCreator" }),
  assignedTasks: many(tasks, { relationName: "taskAssignee" }),
  scanEvents: many(scanEvents),
  activityLogs: many(activityLogs),
}));

/**
 * Customers Table
 * Stores customer information
 */
export const customers = pgTable("customers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const customersRelations = relations(customers, ({ many }) => ({
  containers: many(customerContainers),
}));

/**
 * Customer Containers Table
 * Containers placed at customer locations
 */
export const customerContainers = pgTable("customer_containers", {
  id: varchar("id").primaryKey(),
  customerId: varchar("customer_id").references(() => customers.id),
  customerName: text("customer_name").notNull(), // Denormalized for convenience
  location: text("location").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  qrCode: text("qr_code").notNull().unique(),
  materialType: text("material_type").notNull(),
  contentDescription: text("content_description"),
  status: text("status").notNull().default("AT_CUSTOMER"), // AT_CUSTOMER, IN_TRANSIT, etc.
  lastEmptied: timestamp("last_emptied"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const customerContainersRelations = relations(customerContainers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [customerContainers.customerId],
    references: [customers.id],
  }),
  tasks: many(tasks),
  scanEvents: many(scanEvents),
}));

/**
 * Warehouse Containers Table
 * Containers in the warehouse for collecting materials
 */
export const warehouseContainers = pgTable("warehouse_containers", {
  id: varchar("id").primaryKey(),
  location: text("location").notNull(),
  warehouseZone: text("warehouse_zone"), // e.g., "A-17", "Tor 3"
  qrCode: text("qr_code").notNull().unique(),
  materialType: text("material_type").notNull(),
  contentDescription: text("content_description"),
  currentAmount: real("current_amount").notNull().default(0),
  maxCapacity: real("max_capacity").notNull(),
  quantityUnit: text("quantity_unit").notNull().default("kg"), // kg, t, m3
  status: text("status").notNull().default("AT_WAREHOUSE"), // AT_WAREHOUSE, OUT_OF_SERVICE
  lastEmptied: timestamp("last_emptied"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const warehouseContainersRelations = relations(warehouseContainers, ({ many }) => ({
  tasks: many(tasks),
  fillHistory: many(fillHistory),
  scanEvents: many(scanEvents),
}));

/**
 * Fill History Table
 * Tracks additions to warehouse containers
 */
export const fillHistory = pgTable("fill_history", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  warehouseContainerId: varchar("warehouse_container_id").notNull().references(() => warehouseContainers.id),
  amountAdded: real("amount_added").notNull(),
  quantityUnit: text("quantity_unit").notNull().default("kg"),
  taskId: varchar("task_id").references(() => tasks.id),
  recordedByUserId: varchar("recorded_by_user_id").references(() => users.id),
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
  recordedBy: one(users, {
    fields: [fillHistory.recordedByUserId],
    references: [users.id],
  }),
}));

/**
 * Tasks Table (Jobs/Aufträge)
 * Represents pickup/delivery jobs with full lifecycle tracking
 * 
 * Status Transitions:
 * PLANNED -> ASSIGNED (when driver assigned)
 * ASSIGNED -> ACCEPTED (when driver scans at customer)
 * ACCEPTED -> PICKED_UP (when container loaded)
 * PICKED_UP -> IN_TRANSIT (when leaving customer)
 * IN_TRANSIT -> DELIVERED (when scanned at warehouse)
 * DELIVERED -> COMPLETED (when weight recorded and finalized)
 * Any -> CANCELLED (except COMPLETED)
 */
export const tasks = pgTable("tasks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Task Details
  title: text("title"), // Short description, e.g., "Abholung bei ABC GmbH"
  description: text("description"), // Detailed description
  
  // Container References
  containerID: varchar("container_id").notNull().references(() => customerContainers.id),
  deliveryContainerID: varchar("delivery_container_id").references(() => warehouseContainers.id),
  
  // User References
  createdBy: varchar("created_by").references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  
  // Planning
  scheduledTime: timestamp("scheduled_time"), // Planned execution time
  plannedQuantity: real("planned_quantity"), // Expected amount
  plannedQuantityUnit: text("planned_quantity_unit").default("kg"),
  priority: text("priority").notNull().default("normal"), // normal, high, urgent
  materialType: text("material_type").notNull(),
  
  // Status and Lifecycle
  status: text("status").notNull().default("PLANNED"),
  
  // Lifecycle Timestamps - Set when status changes
  createdAt: timestamp("created_at").notNull().defaultNow(),
  assignedAt: timestamp("assigned_at"),
  acceptedAt: timestamp("accepted_at"),
  pickedUpAt: timestamp("picked_up_at"),
  inTransitAt: timestamp("in_transit_at"),
  deliveredAt: timestamp("delivered_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  
  // Legacy fields for backward compatibility
  pickupTimestamp: timestamp("pickup_timestamp"),
  pickupLocation: jsonb("pickup_location"),
  deliveryTimestamp: timestamp("delivery_timestamp"),
  
  // Actual recorded values
  actualQuantity: real("actual_quantity"), // Actually measured amount
  actualQuantityUnit: text("actual_quantity_unit").default("kg"),
  
  // Additional info
  notes: text("notes"),
  cancellationReason: text("cancellation_reason"),
  estimatedAmount: real("estimated_amount"), // Legacy, use plannedQuantity
  
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  container: one(customerContainers, {
    fields: [tasks.containerID],
    references: [customerContainers.id],
  }),
  deliveryContainer: one(warehouseContainers, {
    fields: [tasks.deliveryContainerID],
    references: [warehouseContainers.id],
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "taskCreator",
  }),
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
    relationName: "taskAssignee",
  }),
  scanEvents: many(scanEvents),
  activityLogs: many(activityLogs),
  fillHistory: many(fillHistory),
}));

/**
 * Scan Events Table
 * Records every QR code scan with context and location
 * 
 * This is the source of truth for scan history and is used to:
 * - Track container movements
 * - Validate task state transitions
 * - Build activity timeline
 */
export const scanEvents = pgTable("scan_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // What was scanned
  containerId: varchar("container_id").notNull(), // Can be customer or warehouse container
  containerType: text("container_type").notNull(), // "customer" or "warehouse"
  
  // Task context (optional - null for info-only scans)
  taskId: varchar("task_id").references(() => tasks.id),
  
  // Who scanned
  scannedByUserId: varchar("scanned_by_user_id").notNull().references(() => users.id),
  
  // When and where
  scannedAt: timestamp("scanned_at").notNull().defaultNow(),
  
  // Scan context - what was the purpose of this scan
  scanContext: text("scan_context").notNull(), // WAREHOUSE_INFO, TASK_ACCEPT_AT_CUSTOMER, etc.
  
  // Location information
  locationType: text("location_type").notNull(), // WAREHOUSE, CUSTOMER, OTHER
  locationDetails: text("location_details"), // Free text, e.g., "Tor 3", "Regal A-17"
  geoLocation: jsonb("geo_location"), // { latitude, longitude, accuracy }
  
  // Scan result
  scanResult: text("scan_result").notNull().default("SUCCESS"), // SUCCESS, INVALID_CONTAINER, ERROR
  resultMessage: text("result_message"), // Human-readable result description
  
  // Additional data for debugging/audit
  extraData: jsonb("extra_data"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scanEventsRelations = relations(scanEvents, ({ one }) => ({
  scannedBy: one(users, {
    fields: [scanEvents.scannedByUserId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [scanEvents.taskId],
    references: [tasks.id],
  }),
}));

/**
 * Activity Logs Table
 * Human-readable activity timeline for admins
 * 
 * Each entry represents a significant event that should be displayed
 * in the activity history. Generated from task state changes and scan events.
 */
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Event classification
  type: text("type").notNull(), // TASK_CREATED, TASK_ACCEPTED, CONTAINER_SCANNED_AT_WAREHOUSE, etc.
  
  // Human-readable message for UI display
  message: text("message").notNull(), // e.g., "Fahrer Müller hat Container XYZ beim Kunden gescannt"
  
  // References
  userId: varchar("user_id").references(() => users.id), // Who triggered this event
  taskId: varchar("task_id").references(() => tasks.id),
  containerId: varchar("container_id"), // Can be customer or warehouse container ID
  scanEventId: varchar("scan_event_id").references(() => scanEvents.id), // Link to scan if applicable
  
  // Location at time of event
  location: jsonb("location"),
  
  // Additional structured details
  details: text("details"), // Legacy field
  metadata: jsonb("metadata"), // Additional structured data
  
  // Timestamp
  timestamp: timestamp("timestamp").notNull().defaultNow(),
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
  scanEvent: one(scanEvents, {
    fields: [activityLogs.scanEventId],
    references: [scanEvents.id],
  }),
}));

// ============================================================================
// SCHEMAS AND TYPES
// ============================================================================

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  phone: true,
  role: true,
});

export const insertCustomerSchema = createInsertSchema(customers);
export const insertCustomerContainerSchema = createInsertSchema(customerContainers);
export const insertWarehouseContainerSchema = createInsertSchema(warehouseContainers);
export const insertTaskSchema = createInsertSchema(tasks);
export const insertScanEventSchema = createInsertSchema(scanEvents);
export const insertActivityLogSchema = createInsertSchema(activityLogs);
export const insertFillHistorySchema = createInsertSchema(fillHistory);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type CustomerContainer = typeof customerContainers.$inferSelect;
export type WarehouseContainer = typeof warehouseContainers.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ScanEvent = typeof scanEvents.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type FillHistory = typeof fillHistory.$inferSelect;

// ============================================================================
// STATUS TRANSITION VALIDATION
// ============================================================================

/**
 * Valid task status transitions
 * Maps current status to array of valid next statuses
 */
export const VALID_TASK_TRANSITIONS: Record<string, string[]> = {
  PLANNED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["ACCEPTED", "PLANNED", "CANCELLED"],
  ACCEPTED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidTaskTransition(currentStatus: string, newStatus: string): boolean {
  const validTransitions = VALID_TASK_TRANSITIONS[currentStatus];
  if (!validTransitions) return false;
  return validTransitions.includes(newStatus);
}

/**
 * Get the timestamp field name for a given status
 */
export function getTimestampFieldForStatus(status: string): string | null {
  const mapping: Record<string, string> = {
    ASSIGNED: "assignedAt",
    ACCEPTED: "acceptedAt",
    PICKED_UP: "pickedUpAt",
    IN_TRANSIT: "inTransitAt",
    DELIVERED: "deliveredAt",
    COMPLETED: "completedAt",
    CANCELLED: "cancelledAt",
  };
  return mapping[status] || null;
}

// ============================================================================
// GERMAN TRANSLATIONS FOR UI
// ============================================================================

export const TASK_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Geplant",
  ASSIGNED: "Zugewiesen",
  ACCEPTED: "Angenommen",
  PICKED_UP: "Abgeholt",
  IN_TRANSIT: "Unterwegs",
  DELIVERED: "Geliefert",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Storniert",
};

export const SCAN_CONTEXT_LABELS: Record<string, string> = {
  WAREHOUSE_INFO: "Info-Scan im Lager",
  CUSTOMER_INFO: "Info-Scan beim Kunden",
  TASK_ACCEPT_AT_CUSTOMER: "Auftragsannahme beim Kunden",
  TASK_PICKUP: "Abholung bestätigt",
  TASK_COMPLETE_AT_WAREHOUSE: "Lieferung im Lager",
  INVENTORY_CHECK: "Inventurprüfung",
  MAINTENANCE: "Wartungsscan",
};

export const ACTIVITY_LOG_TYPE_LABELS: Record<string, string> = {
  TASK_CREATED: "Auftrag erstellt",
  TASK_ASSIGNED: "Auftrag zugewiesen",
  TASK_ACCEPTED: "Auftrag angenommen",
  TASK_PICKED_UP: "Container abgeholt",
  TASK_IN_TRANSIT: "Transport gestartet",
  TASK_DELIVERED: "Container geliefert",
  TASK_COMPLETED: "Auftrag abgeschlossen",
  TASK_CANCELLED: "Auftrag storniert",
  CONTAINER_SCANNED_AT_CUSTOMER: "Container beim Kunden gescannt",
  CONTAINER_SCANNED_AT_WAREHOUSE: "Container im Lager gescannt",
  CONTAINER_STATUS_CHANGED: "Container-Status geändert",
  WEIGHT_RECORDED: "Gewicht erfasst",
  MANUAL_EDIT: "Manuelle Bearbeitung",
  SYSTEM_EVENT: "Systemereignis",
};
