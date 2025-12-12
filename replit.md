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
- **Authentication**: Custom email/password auth with SHA-256 password hashing
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
- **Task Status Lifecycle**: OFFEN → ASSIGNED → ACCEPTED → PICKED_UP → IN_TRANSIT → DELIVERED → COMPLETED (or CANCELLED)
- **German Labels**: All enums export German label maps for UI consistency
- **Validation**: Zod schemas generated from Drizzle schemas via `drizzle-zod`

### Authentication & Authorization
- **Authentication**: Email/password login only
- **Session Management**: Stored in AsyncStorage, validated against server on app load
- **Roles**: `driver` (field operations) and `admin` (full access + management)
- **User Registration**: Admin-only (drivers cannot self-register)
- Auth context at `client/contexts/AuthContext.tsx` manages login state
- **Role Enforcement (Server-side)**:
  - Admin-only routes are protected by `requireAuth` and `requireAdmin` middleware
  - Authentication via `x-user-id` header or `userId` in request body
  - Returns 401 for missing auth, 403 for insufficient permissions

### Mobile-Specific Features
- QR/barcode scanning via `expo-camera` for container identification
- GPS location access via `expo-location` for tracking pickups/deliveries
- Maps navigation integration (Google Maps, Apple Maps) via deep linking
- Haptic feedback and blur effects for native feel
- Keyboard-aware scroll views for form inputs

### QR Code System
- **Stable QR codes**: QR codes are generated ONLY server-side and remain permanent
- **Format**: `{type}-{containerId}` (e.g., `warehouse-WH-001`, `customer-C-001`)
- **Generation**: Backend generates stable QR code when container is created
- **Lookup endpoints**: `/api/containers/warehouse/qr/:qrCode` and `/api/containers/customer/qr/:qrCode`
- **Admin regeneration**: POST `/api/containers/{type}/{id}/regenerate-qr` for explicit regeneration

## Deployment Guide

### Environment Variables

**Required for Backend:**
- `DATABASE_URL` - PostgreSQL connection string (required)
- `PORT` - Server port (defaults to 5000)
- `NODE_ENV` - Set to `production` for production builds
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (e.g., `https://yourapp.com,https://api.yourapp.com`)

**Required for Frontend (Expo):**
- `EXPO_PUBLIC_API_URL` - Full URL to your backend API (optional - defaults to `https://containerflow-api.onrender.com`)

**Required for Static Build:**
- `DEPLOYMENT_URL` - Your production domain URL (e.g., `https://yourapp.com`)

### Database Setup

1. Create a PostgreSQL database (Supabase, Railway, Neon, or self-hosted)
2. Set `DATABASE_URL` to your connection string
3. Run `npm run db:push` to create tables

### Build Commands

```bash
# Development
npm run expo:dev          # Start Expo development server
npm run server:dev        # Start Express development server
npm run all:dev           # Start both servers

# Production Build
npm run server:build      # Build Express server to server_dist/
npm run expo:static:build # Build static Expo bundles (requires DEPLOYMENT_URL)

# Production Run
npm run server:start      # Run production server
npm run server:prod       # Alias for server:start
```

### Deployment Platforms

**Express Backend (Render, Railway, Fly.io, etc.):**
1. Set `DATABASE_URL` and `ALLOWED_ORIGINS` environment variables
2. Build command: `npm run server:build`
3. Start command: `npm run server:start`
4. Port: 5000 (or set via `PORT` env var)

**Expo Mobile App:**
1. Set `EXPO_PUBLIC_API_URL` to your backend URL
2. Build with `eas build` or export with `expo export`

### API Endpoints Reference
- `GET /api/health` - Health check with database status
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/drivers/:id/stats` - Individual driver statistics
- `GET /api/drivers/overview` - Admin-only: All drivers overview
- `POST /api/auth/login` - Email/password authentication

### Test Credentials
- Admin: `admin@containerflow.com` / `admin`
- Driver: `fahrer@containerflow.com` / `123`
