# Apple Interior Manager - Codebase Index

**Last Updated:** November 10, 2025  
**Project Version:** 0.1.0  
**Framework:** Next.js 16.0.0 with React 19.2.0

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Core Architecture](#core-architecture)
5. [Authentication System](#authentication-system)
6. [API Routes](#api-routes)
7. [Database Schema](#database-schema)
8. [Key Components](#key-components)
9. [Contexts & State Management](#contexts--state-management)
10. [Utilities & Helpers](#utilities--helpers)
11. [Configuration Files](#configuration-files)
12. [Environment Variables](#environment-variables)
13. [Development Workflow](#development-workflow)

---

## 🎯 Project Overview

**Apple Interior Manager** is a comprehensive interior design project management system that enables teams to manage projects, clients, users, tasks, and design workflows with role-based access control.

### Key Features
- **Authentication System**: Secure login with role-based access (Admin/Employee)
- **User Management**: Admin can create, edit, and manage users
- **Project Management**: Create and manage interior design projects
- **Client Management**: Maintain client information and relationships
- **File Management**: Upload and manage project files
- **Team Collaboration**: Assign team members to projects with specific permissions
- **Notifications**: Real-time push notifications for project updates
- **PWA Support**: Progressive Web App capabilities for mobile devices

---

## 🛠 Technology Stack

### Frontend
- **Framework**: Next.js 16.0.0 (App Router)
- **UI Library**: React 19.2.0
- **Styling**: Tailwind CSS 4.x with custom configuration
- **Icons**: React Icons 5.5.0
- **Form Handling**: React Hook Form 7.65.0
- **Validation**: Zod 4.1.12
- **TypeScript**: 5.9.3

### Backend & Database
- **Backend**: Supabase (PostgreSQL, Authentication, Storage)
- **Auth**: Supabase Auth with SSR support (@supabase/ssr 0.7.0)
- **Database Client**: @supabase/supabase-js 2.76.1
- **JWT**: jsonwebtoken 9.0.2

### Development Tools
- **Linting**: ESLint 9 with Next.js config
- **Compiler**: React Compiler (babel-plugin-react-compiler 1.0.0)
- **Build Tool**: Next.js with standalone output
- **Environment**: cross-env for cross-platform compatibility

---

## 📁 Project Structure

```
d:\site_manager\
├── public/                      # Static assets
│   ├── New-logo.png            # Company logo
│   ├── icon-192x192.png        # PWA icon (192x192)
│   ├── icon-512x512.png        # PWA icon (512x512)
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service worker
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── admin/              # Admin-only pages
│   │   │   ├── dashboard/      # Admin dashboard
│   │   │   ├── login/          # Admin login page
│   │   │   └── users/          # Admin user management
│   │   │
│   │   ├── api/                # API routes
│   │   │   ├── admin/          # Admin API endpoints
│   │   │   │   ├── project-members/  # Project member management
│   │   │   │   ├── projects/   # Admin project operations
│   │   │   │   └── users/      # User CRUD operations
│   │   │   │
│   │   │   ├── auth/           # Authentication endpoints
│   │   │   │   ├── login/      # Login endpoint
│   │   │   │   ├── logout/     # Logout endpoint
│   │   │   │   └── session/    # Session validation
│   │   │   │
│   │   │   ├── design-comments/     # Design comment operations
│   │   │   ├── design-files/        # Design file management
│   │   │   ├── inventory-items/     # Inventory management
│   │   │   ├── notifications/       # Notification system
│   │   │   ├── project-steps/       # Project step tracking
│   │   │   ├── project-updates/     # Project update logs
│   │   │   ├── projects/            # Project CRUD operations
│   │   │   ├── push-subscription/   # Push notification subscriptions
│   │   │   ├── tasks/               # Task management
│   │   │   └── test-auth/           # Auth testing endpoint
│   │   │
│   │   ├── dashboard/          # Main dashboard (authenticated users)
│   │   │   ├── clients/        # Client management pages
│   │   │   ├── my-projects/    # User's assigned projects
│   │   │   ├── my-tasks/       # User's assigned tasks
│   │   │   ├── projects/       # Project management pages
│   │   │   ├── settings/       # User settings
│   │   │   ├── users/          # User directory
│   │   │   └── layout.tsx      # Dashboard layout with sidebar
│   │   │
│   │   ├── login/              # Public login page
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page (redirects to login/dashboard)
│   │   ├── globals.css         # Global styles
│   │   └── ClientLayout.tsx    # Client-side layout wrapper
│   │
│   ├── components/             # React components
│   │   ├── projects/           # Project-specific components
│   │   ├── ui/                 # Reusable UI components
│   │   ├── AppErrorBoundary.tsx     # App-level error boundary
│   │   ├── BackButton.tsx           # Navigation back button
│   │   ├── ErrorBoundary.tsx        # Generic error boundary
│   │   ├── HydrationSafe.tsx        # Hydration-safe wrapper
│   │   ├── NotificationBell.tsx     # Notification bell component
│   │   └── PWAInstallPrompt.tsx     # PWA installation prompt
│   │
│   ├── contexts/               # React contexts
│   │   ├── AuthContext.tsx     # Main authentication context
│   │   └── AdminAuthContext.tsx     # Admin-specific auth context
│   │
│   └── lib/                    # Utility libraries
│       ├── supabase/           # Supabase configurations
│       │   └── server.ts       # Server-side Supabase client
│       ├── apiHelpers.ts       # API utility functions
│       ├── authHelpers.ts      # Authentication helpers
│       ├── dateUtils.ts        # Date formatting utilities
│       ├── errorHandler.ts     # Error handling utilities
│       ├── notificationService.ts   # Notification service
│       ├── pushNotifications.ts     # Push notification handlers
│       ├── supabase.ts         # Client-side Supabase client
│       ├── supabase-client-helper.ts # Enhanced Supabase client
│       └── supabaseAdmin.ts    # Admin Supabase client
│
├── middleware.ts               # Next.js middleware (authentication)
├── next.config.ts              # Next.js configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies and scripts
├── .env.local                  # Environment variables (not in git)
└── README.md                   # Project documentation
```

---

## 🏗 Core Architecture

### App Router Pattern (Next.js 16)
- Uses Next.js App Router with React Server Components
- Server-side rendering (SSR) for authenticated pages
- Client components for interactive features
- Middleware for authentication and authorization

### Authentication Flow
1. **Middleware** (`middleware.ts`) intercepts all requests
2. Validates session using Supabase SSR
3. Redirects unauthenticated users to `/login`
4. Checks user roles from auth metadata (not database)
5. Allows/denies access based on role and route

### Data Flow
```
Client Request
    ↓
Middleware (Auth Check)
    ↓
Page Component (Server/Client)
    ↓
API Route (if needed)
    ↓
Supabase Database
    ↓
Response to Client
```

---

## 🔐 Authentication System

### Implementation Details

#### 1. **Middleware Authentication** (`middleware.ts`)
- **Purpose**: Protects routes before they render
- **Technology**: Supabase SSR with cookie-based sessions
- **Key Features**:
  - Validates session on every request
  - Handles cookie management (set/get/remove)
  - Graceful error handling for corrupted cookies
  - Role-based access control using auth metadata
  - Redirects based on authentication state

#### 2. **AuthContext** (`src/contexts/AuthContext.tsx`)
- **Purpose**: Client-side authentication state management
- **Features**:
  - Session persistence
  - User role management (admin/employee)
  - Sign in/sign out methods
  - Auto-refresh tokens
  - Rate limiting (5 attempts per 5 minutes)
  - Error recovery and cleanup
  - Server-side session fallback

#### 3. **AdminAuthContext** (`src/contexts/AdminAuthContext.tsx`)
- **Purpose**: Admin-specific authentication
- **Features**:
  - Admin role verification
  - Separate admin login flow
  - Admin-only route protection
  - Automatic redirection for non-admin users

### Authentication Helpers (`src/lib/authHelpers.ts`)
- Session validation
- Role checking
- Token management
- User metadata extraction

### Known Issues & Solutions
- **Cookie Parsing Errors**: Handled with custom storage implementation
- **Redirect Loops**: Fixed by using auth metadata instead of database queries
- **Hydration Mismatches**: Resolved with `HydrationSafe` component
- **Session Persistence**: Uses localStorage with fallback mechanisms

---

## 🌐 API Routes

### Authentication APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User login |
| `/api/auth/logout` | POST | User logout |
| `/api/auth/session` | GET | Get current session |
| `/api/test-auth` | GET | Test authentication |

### Admin APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | POST | Create new user |
| `/api/admin/users` | GET | List all users |
| `/api/admin/projects` | GET/POST | Admin project operations |
| `/api/admin/project-members` | POST/DELETE | Manage project members |

### Project APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET/POST | List/create projects |
| `/api/projects/[id]` | GET/PUT/DELETE | Project operations |
| `/api/projects/[id]/requirements` | GET/POST | Project requirements |
| `/api/projects/[id]/approve-design` | POST | Approve design |
| `/api/projects/[id]/reject-design` | POST | Reject design |

### Task & Update APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tasks` | GET/POST/PUT/DELETE | Task management |
| `/api/project-steps` | GET/POST/PUT/DELETE | Project step tracking |
| `/api/project-updates` | GET/POST/PUT/DELETE | Project update logs |

### Design & Inventory APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/design-files` | GET/POST/PUT/DELETE | Design file management |
| `/api/design-comments` | POST | Add design comments |
| `/api/inventory-items` | GET/POST/PUT/DELETE | Inventory management |
| `/api/inventory-items/[id]/approve-bill` | POST | Approve inventory bill |
| `/api/inventory-items/[id]/reject-bill` | POST | Reject inventory bill |

### Notification APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications` | GET/POST/PUT/DELETE | Notification CRUD |
| `/api/push-subscription` | POST/DELETE | Push notification subscriptions |

### API Configuration
- **Dynamic Rendering**: `export const dynamic = 'force-dynamic'`
- **No Caching**: `export const revalidate = 0`
- **CORS**: Handled by Next.js
- **Error Handling**: Consistent error responses with status codes

---

## 🗄 Database Schema

### Supabase Configuration
- **URL**: `https://uswdtcmemgfqlkzmfkxs.supabase.co`
- **Authentication**: Supabase Auth with JWT
- **Storage**: Supabase Storage for file uploads
- **Realtime**: Supabase Realtime for live updates

### Key Tables (Inferred)
- `users` - User profiles with roles
- `projects` - Project information
- `clients` - Client data
- `tasks` - Task assignments
- `project_steps` - Project workflow steps
- `project_updates` - Project activity logs
- `design_files` - Design file metadata
- `design_comments` - Design feedback
- `inventory_items` - Inventory tracking
- `notifications` - User notifications
- `project_members` - Project team assignments

### Row Level Security (RLS)
- Enabled on all tables
- Role-based access policies
- Admin bypass using service role key

---

## 🧩 Key Components

### Layout Components
- **`src/app/layout.tsx`**: Root layout with metadata
- **`src/app/ClientLayout.tsx`**: Client-side wrapper
- **`src/app/dashboard/layout.tsx`**: Dashboard layout with sidebar

### UI Components
- **`NotificationBell.tsx`**: Real-time notification bell (26KB - complex component)
- **`PWAInstallPrompt.tsx`**: PWA installation prompt
- **`BackButton.tsx`**: Navigation helper
- **`HydrationSafe.tsx`**: Prevents hydration mismatches

### Error Handling
- **`AppErrorBoundary.tsx`**: App-level error boundary
- **`ErrorBoundary.tsx`**: Generic error boundary
- **`src/lib/errorHandler.ts`**: Error handling utilities

---

## 🔄 Contexts & State Management

### AuthContext (`src/contexts/AuthContext.tsx`)
**State:**
- `user`: Current user with role
- `session`: Supabase session
- `isLoading`: Loading state
- `isAdmin`: Admin role flag

**Methods:**
- `signIn(email, password)`: Authenticate user
- `signOut()`: Logout user
- `updateUserEmail(email)`: Update user email

**Features:**
- Auto-refresh tokens
- Session persistence
- Error recovery
- Rate limiting
- Debug logging (toggleable)

### AdminAuthContext (`src/contexts/AdminAuthContext.tsx`)
**State:**
- `user`: Admin user
- `session`: Admin session
- `isLoading`: Loading state
- `isAdmin`: Admin verification

**Methods:**
- `signIn(email, password)`: Admin login
- `signOut()`: Admin logout

**Features:**
- Admin role verification
- Auto-redirect for non-admins
- Memoized context value

---

## 🛠 Utilities & Helpers

### Supabase Clients

#### 1. **Client-side** (`src/lib/supabase.ts`)
```typescript
import { supabase } from '@/lib/supabase';
// For client components
```

#### 2. **Server-side** (`src/lib/supabase/server.ts`)
```typescript
import { createClient } from '@/lib/supabase/server';
// For server components and API routes
```

#### 3. **Admin Client** (`src/lib/supabaseAdmin.ts`)
```typescript
import { supabaseAdmin } from '@/lib/supabaseAdmin';
// For admin operations (bypasses RLS)
```

### Helper Libraries

#### `authHelpers.ts`
- Session validation
- Role extraction
- Token verification
- User metadata parsing

#### `dateUtils.ts`
- Date formatting
- Relative time calculations
- Timezone handling

#### `apiHelpers.ts`
- No-cache response headers
- Consistent error responses
- Request validation

#### `notificationService.ts`
- Create notifications
- Send push notifications
- Notification templates

#### `pushNotifications.ts`
- Service worker registration
- Push subscription management
- Notification display

#### `errorHandler.ts`
- Centralized error handling
- Error logging
- User-friendly error messages

---

## ⚙️ Configuration Files

### `next.config.ts`
```typescript
{
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['react-icons'],
    serverComponentsExternalPackages: ['@supabase/supabase-js']
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  }
}
```

### `tailwind.config.js`
- Mobile-first breakpoints
- Custom color palette (primary: yellow)
- Enhanced spacing for touch targets
- Custom animations (fade-in, slide-up, slide-down, scale-in)
- Mobile-optimized typography
- Custom shadows for depth

### `tsconfig.json`
- Target: ES2017
- Module: ESNext
- Path aliases: `@/*` → `./src/*`
- Strict mode enabled
- JSX: react-jsx

### `package.json` Scripts
```json
{
  "dev": "next dev",
  "build": "cross-env NODE_ENV=production next build",
  "start": "next start",
  "lint": "eslint",
  "test": "node --test"
}
```

---

## 🔑 Environment Variables

### Required Variables (`.env.local`)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://uswdtcmemgfqlkzmfkxs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Environment Usage
- **`NEXT_PUBLIC_*`**: Exposed to browser
- **`SUPABASE_SERVICE_ROLE_KEY`**: Server-only (admin operations)

---

## 🚀 Development Workflow

### Getting Started
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### Development Server
- **URL**: http://localhost:3000
- **Hot Reload**: Enabled
- **React Strict Mode**: Enabled (catches hydration issues)

### Build Process
1. TypeScript compilation
2. React component optimization
3. Tailwind CSS processing
4. Next.js bundling
5. Standalone output generation

### Deployment
- **Platform**: Vercel (recommended)
- **Output**: Standalone mode
- **Environment**: Production variables required
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

---

## 📝 Important Notes

### Known Issues & Workarounds

1. **Middleware Deprecation (Next.js 16)**
   - ⚠️ Middleware renamed to proxy in Next.js 16
   - Current implementation uses both named and default exports
   - Memory: Updated to proxy convention

2. **Cookie Parsing Errors**
   - ✅ Fixed with custom storage implementation
   - Handles corrupted cookies gracefully
   - Auto-cleanup on errors

3. **Redirect Loops**
   - ✅ Fixed by using auth metadata instead of database queries
   - Middleware and contexts now consistent

4. **Hydration Mismatches**
   - ✅ Use `HydrationSafe` component for client-only content
   - `suppressHydrationWarning` on root elements

### Best Practices

1. **Authentication**
   - Always use middleware for route protection
   - Check roles from auth metadata, not database
   - Handle session errors gracefully

2. **API Routes**
   - Use `force-dynamic` for real-time data
   - Implement proper error handling
   - Return consistent response formats

3. **Components**
   - Use client components sparingly
   - Prefer server components for static content
   - Wrap client-only code in `HydrationSafe`

4. **Styling**
   - Follow mobile-first approach
   - Use Tailwind utility classes
   - Maintain consistent spacing (touch targets)

---

## 🔗 Related Documentation

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [React 19 Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

**Generated by:** Cascade AI  
**Date:** November 10, 2025  
**Purpose:** Comprehensive codebase reference for development and onboarding
