# Apple Interior Manager - Quick Reference Guide

**Last Updated:** November 11, 2025

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

**Development URL:** http://localhost:3000

---

## 📂 Key File Locations

### Configuration
- `middleware.ts` - Authentication & authorization
- `next.config.ts` - Next.js configuration
- `tailwind.config.js` - Styling configuration
- `.env.local` - Environment variables (create from `.env.example`)

### Authentication
- `src/contexts/AuthContext.tsx` - Main auth context
- `src/contexts/AdminAuthContext.tsx` - Admin auth context
- `src/lib/authHelpers.ts` - Auth utility functions
- `src/lib/supabase/server.ts` - Server-side Supabase client

### Layouts
- `src/app/layout.tsx` - Root layout
- `src/app/dashboard/layout.tsx` - Dashboard layout with sidebar

### API Routes
- `src/app/api/auth/` - Authentication endpoints
- `src/app/api/admin/` - Admin operations
- `src/app/api/projects/` - Project management
- `src/app/api/tasks/` - Task management
- `src/app/api/notifications/` - Notifications

---

## 🔑 Environment Variables

```bash
# Required in .env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 🗄️ Database Quick Reference

### Core Tables
- **users** - User profiles (admin/employee)
- **clients** - Client information
- **projects** - Project data
- **project_members** - Team assignments
- **files** - File uploads
- **tasks** - Task tracking
- **notifications** - User notifications

### Key Relationships
```
users ←→ project_members ←→ projects ←→ clients
projects ←→ files
projects ←→ tasks
users ←→ notifications
```

---

## 🎨 Component Locations

### Major Components
```
src/components/
├── NotificationBell.tsx          # Real-time notifications
├── PWAInstallPrompt.tsx          # PWA install prompt
├── BackButton.tsx                # Navigation helper
├── HydrationSafe.tsx             # Hydration safety
├── projects/
│   ├── DesignsTab.tsx           # Design management
│   ├── InventoryTab.tsx         # Inventory tracking
│   ├── WorkflowTab.tsx          # Workflow steps
│   ├── UpdatesTab.tsx           # Project updates
│   ├── KanbanBoard.tsx          # Task board
│   └── GanttView.tsx            # Timeline view
└── ui/
    └── ImageModal.tsx           # Image viewer
```

---

## 🔐 Authentication Flow

### User Login
1. User enters credentials at `/login`
2. POST to `/api/auth/login`
3. Supabase validates credentials
4. Session stored in cookies
5. Middleware validates on each request
6. Redirect to `/dashboard`

### Role Checking
```typescript
// In middleware.ts
const userRole = session.user?.user_metadata?.role || 'employee';

// In components (via AuthContext)
const { isAdmin } = useAuth();
```

---

## 🛠️ Common Tasks

### Creating a New Page
1. Create file in `src/app/[route]/page.tsx`
2. Add to middleware config if needed
3. Update dashboard layout navigation if needed

### Adding an API Route
1. Create `route.ts` in `src/app/api/[endpoint]/`
2. Export handler functions (GET, POST, etc.)
3. Add authentication check
4. Return JSON response

### Creating a Component
1. Create file in `src/components/`
2. Use TypeScript for props
3. Add 'use client' if using hooks/state
4. Export default function

### Database Query (Client)
```typescript
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value);
```

### Database Query (Server/Admin)
```typescript
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
const { data, error } = await supabase
  .from('table_name')
  .select('*');
```

---

## 🎯 User Roles & Permissions

### Admin
- Full access to all features
- User management
- Project creation and deletion
- Client management
- Settings access

### Employee
- View assigned projects
- Complete assigned tasks
- Upload files (if permitted)
- View notifications
- Update profile

### Permission Levels (project_members)
```json
{
  "view": true,
  "edit": false,
  "upload": false,
  "mark_done": false
}
```

---

## 📱 PWA Features

### Manifest Location
`public/manifest.json`

### Service Worker
`public/sw.js`

### Icons
- `public/icon-192x192.png`
- `public/icon-512x512.png`

### Installation
- Automatic prompt on mobile devices
- Manual install via browser menu
- Install prompt component in dashboard

---

## 🐛 Debugging Tips

### Enable Debug Logging
```bash
# Add to .env.local
NEXT_PUBLIC_DEBUG=true
```

### Common Issues

**Cookie Parsing Errors**
- Check browser cookies
- Clear localStorage
- Sign out and sign in again

**Redirect Loops**
- Check middleware.ts
- Verify user role in auth metadata
- Clear browser cache

**Hydration Mismatches**
- Wrap client-only code in `<HydrationSafe>`
- Add `suppressHydrationWarning` to elements
- Check for localStorage usage in SSR

**API 401 Errors**
- Check session validity
- Verify environment variables
- Check Supabase RLS policies

---

## 📊 Performance Tips

### Optimization
- Use Server Components by default
- Add 'use client' only when needed
- Implement proper loading states
- Use Next.js Image component
- Enable React Compiler (already configured)

### Caching
- API routes use `force-dynamic`
- No automatic caching for real-time data
- Browser caching for static assets

---

## 🔗 Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run lint             # Run ESLint
npm run test             # Run tests

# Production
npm run build            # Build for production
npm start                # Start production server

# Database
# Run SQL in Supabase SQL Editor
# Migrations in supabase/migrations/

# Scripts
node scripts/create-admin.js              # Create admin user
node scripts/create-admin-noninteractive.js  # Non-interactive admin
node scripts/delete-admins.js             # Delete admin users
node scripts/setup-database.js            # Setup database
```

---

## 📚 Documentation Links

- **Full Index**: `CODEBASE_INDEX.md`
- **Indexing Summary**: `INDEXING_SUMMARY.md`
- **Project README**: `README.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`
- **Workflow Documentation**: `WORKFLOW_DOCUMENTATION.md`

### External Resources
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

---

## 🆘 Getting Help

### Check These First
1. `CODEBASE_INDEX.md` - Comprehensive reference
2. Error logs in browser console
3. Network tab for API errors
4. Supabase dashboard for database issues

### Common Solutions
- Clear browser cache and cookies
- Restart development server
- Check environment variables
- Verify Supabase connection
- Review middleware logs

---

**Quick Reference Version:** 1.0  
**Last Updated:** November 11, 2025  
**Maintained By:** Development Team

---

*For detailed information, see CODEBASE_INDEX.md*
