# Apple Interior Manager - Directory Tree

**Generated:** November 11, 2025

---

## 📁 Complete Project Structure

```
d:\site_manager\
│
├── 📄 Configuration Files
│   ├── .env.example                      # Environment variables template
│   ├── .env.local                        # Local environment variables (gitignored)
│   ├── .gitignore                        # Git ignore rules
│   ├── eslint.config.mjs                 # ESLint configuration
│   ├── middleware.ts                     # Next.js middleware (auth)
│   ├── next.config.ts                    # Next.js configuration
│   ├── next-env.d.ts                     # Next.js TypeScript declarations
│   ├── package.json                      # Dependencies and scripts
│   ├── package-lock.json                 # Dependency lock file
│   ├── postcss.config.mjs                # PostCSS configuration
│   ├── tailwind.config.js                # Tailwind CSS configuration
│   ├── tsconfig.json                     # TypeScript configuration
│   ├── netlify.toml                      # Netlify deployment config
│   └── vercel.json                       # Vercel deployment config
│
├── 📚 Documentation
│   ├── README.md                         # Project overview
│   ├── CODEBASE_INDEX.md                 # Comprehensive codebase reference
│   ├── INDEXING_SUMMARY.md               # Indexing process summary
│   ├── QUICK_REFERENCE.md                # Quick reference guide
│   ├── DIRECTORY_TREE.md                 # This file
│   ├── IMPLEMENTATION_SUMMARY.md         # Implementation details
│   └── WORKFLOW_DOCUMENTATION.md         # Workflow documentation
│
├── 🗄️ Database Files
│   ├── supabase-schema.sql               # Core database schema
│   ├── BULLETPROOF_REALTIME_FIX.sql      # Realtime fixes
│   ├── COMPLETE_REALTIME_FIX.sql         # Realtime fixes
│   ├── FINAL_STORAGE_FIX.sql             # Storage fixes
│   ├── FIX_REALTIME_SCHEMA_MISMATCH.sql  # Schema fixes
│   ├── FIX_STORAGE_POLICIES.sql          # Storage policy fixes
│   ├── NOTIFICATIONS_SCHEMA.sql          # Notifications schema
│   ├── RUN_THIS_IN_SUPABASE.sql          # Main setup script
│   ├── SIMPLE_REALTIME_FIX.sql           # Simple realtime fix
│   └── VERIFY_NOTIFICATIONS_TABLE.sql    # Verification script
│
├── 🔧 Scripts
│   └── scripts/
│       ├── create-admin.js               # Interactive admin creation
│       ├── create-admin-noninteractive.js # Non-interactive admin creation
│       ├── delete-admins.js              # Delete admin users
│       └── setup-database.js             # Database setup
│
├── 🌐 Public Assets
│   └── public/
│       ├── New-logo.png                  # Company logo
│       ├── icon-192x192.png              # PWA icon (192x192)
│       ├── icon-512x512.png              # PWA icon (512x512)
│       ├── manifest.json                 # PWA manifest
│       ├── sw.js                         # Service worker
│       ├── file.svg                      # File icon
│       ├── globe.svg                     # Globe icon
│       ├── next.svg                      # Next.js logo
│       ├── vercel.svg                    # Vercel logo
│       └── window.svg                    # Window icon
│
├── 🗃️ Supabase
│   └── supabase/
│       └── migrations/
│           ├── 20240115_push_subscriptions.sql
│           ├── 20240116_project_workflow_update.sql
│           ├── 20250101000003_create_project_features_tables.sql
│           └── 20250101000004_create_storage_buckets.sql
│
└── 💻 Source Code (src/)
    │
    ├── 📱 App (Next.js App Router)
    │   └── src/app/
    │       │
    │       ├── 🏠 Root Pages
    │       │   ├── layout.tsx                    # Root layout
    │       │   ├── page.tsx                      # Home page
    │       │   ├── globals.css                   # Global styles
    │       │   ├── ClientLayout.tsx              # Client wrapper
    │       │   ├── error.tsx                     # Error page
    │       │   ├── global-error.tsx              # Global error page
    │       │   ├── not-found.tsx                 # 404 page
    │       │   └── favicon.ico                   # Favicon
    │       │
    │       ├── 🔐 Authentication
    │       │   └── login/
    │       │       └── page.tsx                  # Login page
    │       │
    │       ├── 👤 Dashboard (Authenticated)
    │       │   └── dashboard/
    │       │       ├── layout.tsx                # Dashboard layout
    │       │       ├── page.tsx                  # Dashboard home
    │       │       │
    │       │       ├── 📊 Projects
    │       │       │   └── projects/
    │       │       │       ├── page.tsx          # Projects list
    │       │       │       ├── new/
    │       │       │       │   └── page.tsx      # New project
    │       │       │       └── [id]/
    │       │       │           ├── page.tsx      # Project details
    │       │       │           ├── edit/
    │       │       │           │   └── page.tsx  # Edit project
    │       │       │           └── members/
    │       │       │               └── page.tsx  # Project members
    │       │       │
    │       │       ├── 👥 Clients
    │       │       │   └── clients/
    │       │       │       ├── page.tsx          # Clients list
    │       │       │       ├── new/
    │       │       │       │   └── page.tsx      # New client
    │       │       │       └── [id]/
    │       │       │           └── edit/
    │       │       │               └── page.tsx  # Edit client
    │       │       │
    │       │       ├── 👤 Users
    │       │       │   └── users/
    │       │       │       ├── page.tsx          # Users list
    │       │       │       ├── new/
    │       │       │       │   └── page.tsx      # New user
    │       │       │       └── [id]/
    │       │       │           └── edit/
    │       │       │               └── page.tsx  # Edit user
    │       │       │
    │       │       ├── 📋 My Work
    │       │       │   ├── my-projects/
    │       │       │   │   └── page.tsx          # My projects
    │       │       │   └── my-tasks/
    │       │       │       └── page.tsx          # My tasks
    │       │       │
    │       │       └── ⚙️ Settings
    │       │           └── settings/
    │       │               └── page.tsx          # Settings page
    │       │
    │       ├── 🔑 Admin Section
    │       │   └── admin/
    │       │       ├── layout.tsx                # Admin layout
    │       │       ├── login/
    │       │       │   └── page.tsx              # Admin login
    │       │       ├── dashboard/
    │       │       │   └── page.tsx              # Admin dashboard
    │       │       └── users/
    │       │           └── new/
    │       │               └── page.tsx          # Admin new user
    │       │
    │       └── 🔌 API Routes
    │           └── api/
    │               │
    │               ├── 🔐 Authentication
    │               │   └── auth/
    │               │       ├── login/
    │               │       │   └── route.ts      # Login endpoint
    │               │       ├── logout/
    │               │       │   └── route.ts      # Logout endpoint
    │               │       └── session/
    │               │           └── route.ts      # Session endpoint
    │               │
    │               ├── 👑 Admin Operations
    │               │   └── admin/
    │               │       ├── users/
    │               │       │   └── route.ts      # User management
    │               │       ├── projects/
    │               │       │   └── route.ts      # Project management
    │               │       └── project-members/
    │               │           └── route.ts      # Member management
    │               │
    │               ├── 📊 Projects
    │               │   └── projects/
    │               │       └── [id]/
    │               │           ├── requirements/
    │               │           │   └── route.ts  # Requirements
    │               │           ├── approve-design/
    │               │           │   └── route.ts  # Approve design
    │               │           └── reject-design/
    │               │               └── route.ts  # Reject design
    │               │
    │               ├── ✅ Tasks & Updates
    │               │   ├── tasks/
    │               │   │   └── route.ts          # Task management
    │               │   ├── project-steps/
    │               │   │   └── route.ts          # Project steps
    │               │   └── project-updates/
    │               │       └── route.ts          # Project updates
    │               │
    │               ├── 🎨 Design & Inventory
    │               │   ├── design-files/
    │               │   │   └── route.ts          # Design files
    │               │   ├── design-comments/
    │               │   │   └── route.ts          # Design comments
    │               │   └── inventory-items/
    │               │       ├── route.ts          # Inventory CRUD
    │               │       └── [id]/
    │               │           ├── approve-bill/
    │               │           │   └── route.ts  # Approve bill
    │               │           └── reject-bill/
    │               │               └── route.ts  # Reject bill
    │               │
    │               ├── 🔔 Notifications
    │               │   ├── notifications/
    │               │   │   └── route.ts          # Notifications
    │               │   └── push-subscription/
    │               │       └── route.ts          # Push subscriptions
    │               │
    │               └── 🧪 Testing
    │                   └── test-auth/
    │                       └── route.ts          # Auth testing
    │
    ├── 🧩 Components
    │   └── src/components/
    │       │
    │       ├── 📦 Core Components
    │       │   ├── NotificationBell.tsx          # Notification bell (26KB)
    │       │   ├── PWAInstallPrompt.tsx          # PWA install prompt
    │       │   ├── BackButton.tsx                # Back button
    │       │   ├── HydrationSafe.tsx             # Hydration wrapper
    │       │   ├── AppErrorBoundary.tsx          # App error boundary
    │       │   └── ErrorBoundary.tsx             # Generic error boundary
    │       │
    │       ├── 📊 Project Components
    │       │   └── projects/
    │       │       ├── DesignsTab.tsx            # Design management (17KB)
    │       │       ├── InventoryTab.tsx          # Inventory tracking (25KB)
    │       │       ├── WorkflowTab.tsx           # Workflow steps (13KB)
    │       │       ├── UpdatesTab.tsx            # Project updates (12KB)
    │       │       ├── KanbanBoard.tsx           # Task board (13KB)
    │       │       └── GanttView.tsx             # Timeline view (3KB)
    │       │
    │       └── 🎨 UI Components
    │           └── ui/
    │               └── ImageModal.tsx            # Image viewer (5KB)
    │
    ├── 🔄 Contexts
    │   └── src/contexts/
    │       ├── AuthContext.tsx                   # Main auth context
    │       └── AdminAuthContext.tsx              # Admin auth context
    │
    └── 🛠️ Libraries & Utilities
        └── src/lib/
            │
            ├── 🗄️ Supabase Clients
            │   ├── supabase.ts                   # Client-side Supabase
            │   ├── supabase-client-helper.ts     # Enhanced client
            │   ├── supabaseAdmin.ts              # Admin client
            │   └── supabase/
            │       └── server.ts                 # Server-side client
            │
            ├── 🔐 Authentication
            │   └── authHelpers.ts                # Auth utilities
            │
            ├── 🔔 Notifications
            │   ├── notificationService.ts        # Notification service
            │   └── pushNotifications.ts          # Push notifications
            │
            ├── 🛠️ Utilities
            │   ├── apiHelpers.ts                 # API utilities
            │   ├── dateUtils.ts                  # Date formatting
            │   └── errorHandler.ts               # Error handling
            │
            └── 📁 Build Output
                └── .next/                        # Next.js build output (gitignored)
```

---

## 📊 Directory Statistics

### Source Code Distribution
- **App Router Pages**: 25+ pages
- **API Routes**: 15 endpoints
- **Components**: 13+ reusable components
- **Contexts**: 2 providers
- **Utilities**: 10+ helper files
- **Migrations**: 4 SQL files
- **Scripts**: 4 utility scripts

### File Size Highlights
- **Largest Component**: NotificationBell.tsx (26KB)
- **Largest Project Component**: InventoryTab.tsx (25KB)
- **Largest Design Component**: DesignsTab.tsx (17KB)
- **Largest Workflow Component**: WorkflowTab.tsx (13KB)

### Configuration Files
- **TypeScript**: tsconfig.json
- **Next.js**: next.config.ts
- **Tailwind**: tailwind.config.js
- **ESLint**: eslint.config.mjs
- **PostCSS**: postcss.config.mjs

---

## 🎯 Key Directories Explained

### `/src/app/`
Next.js 16 App Router structure with file-based routing. Each folder represents a route, and `page.tsx` files define the page content.

### `/src/components/`
Reusable React components organized by feature. Project-specific components are in `projects/` subdirectory.

### `/src/contexts/`
React Context providers for global state management, primarily authentication.

### `/src/lib/`
Utility functions, helper libraries, and Supabase client configurations.

### `/public/`
Static assets served directly by Next.js. Includes PWA icons, manifest, and service worker.

### `/scripts/`
Node.js utility scripts for database setup and admin user management.

### `/supabase/migrations/`
Database migration files for version control of schema changes.

---

## 🔍 Finding Files

### By Feature
- **Authentication**: `src/app/api/auth/`, `src/contexts/`, `middleware.ts`
- **Projects**: `src/app/dashboard/projects/`, `src/components/projects/`
- **Users**: `src/app/dashboard/users/`, `src/app/api/admin/users/`
- **Notifications**: `src/components/NotificationBell.tsx`, `src/app/api/notifications/`
- **Design Management**: `src/components/projects/DesignsTab.tsx`
- **Inventory**: `src/components/projects/InventoryTab.tsx`

### By Type
- **Pages**: `src/app/**/page.tsx`
- **Layouts**: `src/app/**/layout.tsx`
- **API Routes**: `src/app/api/**/route.ts`
- **Components**: `src/components/**/*.tsx`
- **Utilities**: `src/lib/**/*.ts`

---

## 📝 Notes

- **Gitignored**: `.next/`, `node_modules/`, `.env.local`, build outputs
- **PWA Files**: `public/manifest.json`, `public/sw.js`, icons
- **Database**: Schema in `supabase-schema.sql`, migrations in `supabase/migrations/`
- **Documentation**: All `.md` files in root directory

---

**Tree Generated:** November 11, 2025  
**Total Files Indexed**: 100+  
**Last Updated By**: Cascade AI

---

*For detailed information about each file, see CODEBASE_INDEX.md*
