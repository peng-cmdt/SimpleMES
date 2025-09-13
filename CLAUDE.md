# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SimpleMES is a Manufacturing Execution System (MES) with a dual-architecture design:

1. **Frontend**: Next.js-based web application (`simple-mes/`) serving both admin and client interfaces
2. **Backend**: .NET Core device communication service (`DeviceCommunicationService/`) for real-time device control

## Development Commands

### Frontend (simple-mes/)
```bash
cd simple-mes

# Development server (runs on port 3009)
npm run dev -- --port 3009

# Database operations
npx prisma migrate dev --name <migration_name>
npx prisma generate
npx prisma db seed
npx prisma migrate reset --force

# Build and lint
npm run build
npm run lint
```

### Backend (.NET Service)
```bash
cd DeviceCommunicationService/DeviceCommunicationService

# Run development server
dotnet run

# Build
dotnet build
```

## Database Architecture

- **ORM**: Prisma with SQLite database (`simple-mes/prisma/dev.db`)
- **Key Models**: Users, Workstations, Devices, Products, Processes, Steps, Actions, Orders
- **Seed Data**: Default users created via `prisma/seed.ts`
  - admin/admin, supervisor/supervisor, engineer/engineer, operator/operator, client/client

## Code Architecture

### Frontend Structure
- **Multi-Layout Design**: 
  - `/admin/*` routes use `AdminLayout` with sidebar navigation
  - `/client/*` routes use custom layouts for workstation operations
  - Root route provides portal selection

- **Internationalization**: 
  - Centralized in `src/contexts/LanguageContext.tsx`
  - Supports Chinese (zh) and English (en)
  - Use `t('key')` function for translations

- **Authentication Flow**:
  - Role-based access (ADMIN, SUPERVISOR, ENGINEER, OPERATOR, CLIENT)
  - Client login includes workstation selection
  - Session management via localStorage and Prisma

### API Design Patterns
- RESTful endpoints under `/api/*`
- Consistent response format: `{ success: boolean, data?: any, error?: string }`
- Resource-specific operations: `/api/[resource]/[id]/[action]`

### Device Communication Architecture
- **Real-time Communication**: WebSocket-based between frontend and .NET service
- **Device Drivers**: Pluggable architecture (`PlcDriver`, `ScannerDriver`)
- **Workstation Management**: Maps workstations to devices with connection status
- **Action Execution**: Template-based action system for device operations

### MES Core Features
- **Process Management**: Template-based workflows with steps and actions
- **Step Templates**: Reusable step definitions with conditional display
- **BOM Management**: Product bill of materials with multi-level hierarchy
- **Order Tracking**: Production order execution with real-time status
- **Workstation Control**: Device assignment and operation execution

## Key Integration Points

1. **Frontend ↔ Device Service**: 
   - WebSocket connection for real-time device status
   - HTTP APIs for device configuration and control

2. **Process Execution Flow**:
   - Orders → Processes → Steps → Actions → Device Commands
   - Real-time status updates throughout execution chain

3. **User Role Hierarchy**:
   - Admin: Full system access
   - Supervisor: User and production management
   - Engineer: Technical configuration
   - Operator: Production execution
   - Client: Workstation-specific operations

## Critical Development Notes

- **Port Configuration**: Frontend dev server uses port 3000
- **Database Reset**: After schema changes, run `npx prisma migrate reset --force` then `npx prisma generate`
- **Turbopack**: Next.js uses Turbopack for faster development builds
- **Device Service**: Must be running on port 5000 for device communication features
- **File Uploads**: Handled via `/api/upload/*` with storage in `public/uploads/`

## Manufacturing Domain Logic

- **Workstation Types**: VISUAL_CLIENT (interactive) vs SERVICE_TYPE (automated)
- **Action Types**: DEVICE_READ, DEVICE_WRITE, MANUAL_CONFIRM, BARCODE_SCAN, etc.
- **Process Versioning**: Each process has version control for manufacturing changes
- **Step Sequencing**: Ordered execution with dependency management
- **Device Addressing**: PLC register addressing (e.g., "D100") for industrial devices

## Common Troubleshooting

- **Login Issues**: Ensure database is seeded with default users
- **Device Connection**: Verify DeviceCommunicationService is running and accessible
- **Prisma Errors**: Clear `.prisma/client` cache and regenerate client
- **Port Conflicts**: Frontend uses 3000, backend uses 5000