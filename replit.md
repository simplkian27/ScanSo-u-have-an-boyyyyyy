# ContainerFlow

## Overview

ContainerFlow is a professional mobile waste container management application built for iOS, Android, and web platforms. The app enables waste management companies to track customer containers, manage warehouse inventory, assign pickup/delivery tasks to drivers, and monitor operations through QR code scanning. It features role-based access control with driver and admin roles, real-time task management, and comprehensive container tracking with fill-level monitoring.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54 (new architecture enabled)
- **Navigation**: React Navigation with bottom tabs and native stack navigators
- **State Management**: TanStack React Query for server state, React Context for auth state
- **UI Components**: Custom themed components following a design system defined in `client/constants/theme.ts`
- **Animations**: React Native Reanimated for smooth transitions and interactions
- **Path Aliases**: `@/` maps to `client/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **API Design**: RESTful JSON API under `/api` prefix
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: Custom email/password auth with SHA-256 password hashing (no external auth provider)
- **Entry Point**: `server/index.ts` with routes in `server/routes.ts`

### Data Layer
- **Database Schema**: Defined in `shared/schema.ts` using Drizzle's PostgreSQL table definitions
- **Core Entities**:
  - `users` - Drivers and admins with role-based access (UserRole enum: ADMIN, DRIVER)
  - `customers` - Customer records with contact information
  - `customerContainers` - Containers at customer locations (linked to customers)
  - `warehouseContainers` - Inventory containers with capacity tracking
  - `tasks` - Pickup/delivery assignments with 8-state lifecycle
  - `scanEvents` - Comprehensive QR scan tracking with context and location
  - `activityLogs` - Audit trail with type enum and message field
  - `fillHistory` - Historical fill-level data for warehouse containers
- **Task Status Lifecycle**: PLANNED → ASSIGNED → ACCEPTED → PICKED_UP → IN_TRANSIT → DELIVERED → COMPLETED (or CANCELLED)
  - Individual timestamps for each lifecycle state (assignedAt, acceptedAt, pickedUpAt, inTransitAt, deliveredAt, completedAt, cancelledAt)
  - Status transition validation in service layer
- **Enums**:
  - `TaskStatus`: PLANNED, ASSIGNED, ACCEPTED, PICKED_UP, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED
  - `ScanContext`: INFO, TASK_ACCEPT_AT_CUSTOMER, TASK_DELIVERY, WAREHOUSE_INVENTORY, MANUAL_SCAN
  - `ActivityLogType`: TASK_CREATED, TASK_ASSIGNED, TASK_ACCEPTED, TASK_PICKED_UP, TASK_IN_TRANSIT, TASK_DELIVERED, TASK_COMPLETED, TASK_CANCELLED, CONTAINER_SCAN, USER_LOGIN, USER_LOGOUT, SYSTEM_EVENT
  - `UserRole`: ADMIN, DRIVER
- **German Labels**: All enums export German label maps (TASK_STATUS_LABELS, SCAN_CONTEXT_LABELS, ACTIVITY_LOG_TYPE_LABELS) for UI consistency
- **Validation**: Zod schemas generated from Drizzle schemas via `drizzle-zod`

### Authentication & Authorization
- **Dual Authentication**: Email/password login AND Replit Auth integration
- **Replit Auth Flow**: 
  - Web: Direct API call to `/api/auth/replit/login` using Replit's `x-replit-user-id` and `x-replit-user-name` headers
  - Native: Opens `/__replauthLoginPage` via `expo-web-browser` with `containerflow://auth` callback scheme
  - First Replit user becomes admin, subsequent users default to driver role
  - Auto-creates user account on first login with email format `{username}@replit.user`
- **Session Management**: Stored in AsyncStorage, validated against server on app load
- **Roles**: `driver` (field operations) and `admin` (full access + management)
- **User Registration**: Admin-only (drivers cannot self-register)
- Auth context at `client/contexts/AuthContext.tsx` manages login state

### Mobile-Specific Features
- QR/barcode scanning via `expo-camera` for container identification
- GPS location access via `expo-location` for tracking pickups/deliveries
- Maps navigation integration (Google Maps, Apple Maps) via deep linking
- Haptic feedback and blur effects for native feel
- Keyboard-aware scroll views for form inputs

### QR Code System (IMPORTANT)
- **Stable QR codes**: QR codes are generated ONLY server-side and remain permanent
- **Format**: `{type}-{containerId}` (e.g., `warehouse-WH-001`, `customer-C-001`)
- **Generation**: Backend generates stable QR code when container is created
- **NO frontend generation**: Frontend never generates QR codes - they come from the database
- **Lookup endpoints**: `/api/containers/warehouse/qr/:qrCode` and `/api/containers/customer/qr/:qrCode`
- **Admin regeneration**: POST `/api/containers/{type}/{id}/regenerate-qr` for explicit regeneration (creates new unique code with timestamp)
- **Activity logging**: QR regeneration is logged in activity_logs for audit trail
- **Physical labels**: Once a QR code is printed and attached to a container, it remains valid until explicitly regenerated by an admin

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **Drizzle Kit**: Database migrations stored in `migrations/` directory

### Mobile Platform Services
- **Expo**: Build and development toolchain for React Native
- **expo-camera**: QR code scanning for container identification
- **expo-location**: GPS coordinates for delivery tracking
- **expo-file-system** + **expo-sharing**: Activity log CSV export functionality

### Runtime Environment
- **Environment Variables Required**:
  - `DATABASE_URL` - PostgreSQL connection string
  - `EXPO_PUBLIC_DOMAIN` - Public API domain for mobile app to connect to backend
  - `REPLIT_DEV_DOMAIN` / `REPLIT_INTERNAL_APP_DOMAIN` - Replit-specific domain configuration

### Development Tools
- TypeScript with strict mode
- ESLint with Expo config + Prettier integration
- esbuild for server production builds