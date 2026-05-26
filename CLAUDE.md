# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Apple Interior Manager** — A full-stack interior design project management system for teams, clients, and admins. Supports web (Next.js), PWA, and native Android (via Capacitor).

## Commands

```bash
npm run dev        # Start development server
npm run build      # Production build
npm start          # Start production server
```

No test suite is configured. ESLint 9 is available but has no dedicated npm script; run via `npx eslint`.

## Architecture

### Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend/DB:** Supabase (PostgreSQL + Auth + Storage). No ORM — uses the Supabase JS client directly (PostgREST-style queries).
- **Auth:** Supabase Auth, cookie-based sessions. Admin operations use the service role key via `lib/supabaseAdmin.ts`.
- **Mobile:** Capacitor 8 wraps the Next.js app for Android. PWA also supported.
- **Notifications:** OneSignal (push) + WhatsApp via wasenderapi.
- **Deployment:** Vercel (`vercel.json`), standalone Docker output configured.

### Routing & Middleware

`middleware.ts` is the auth/routing gatekeeper:
- Public routes: `/`, `/login`, `/signup`, `/forgot-password`, `/auth/*`, `/privacy-policy`, `/account-deletion`
- Authenticated users are role-redirected: admins → `/admin`, employees → `/dashboard`, clients → `/portal`
- Admin-only enforcement happens in middleware before any page renders

### Authorization (RBAC)

Two-layer authorization:
1. **Middleware** — coarse role checks (admin/employee/client)
2. **`lib/rbac.ts` + `lib/rbac-constants.ts`** — granular permission nodes (e.g., `attendance.view_all`, `payroll.manage`) verified in API routes and components
3. **Supabase RLS** — row-level security policies on every table for data isolation

### API Structure

All REST API routes live under `src/app/api/`. Every route exports `dynamic = 'force-dynamic'` to disable Next.js caching. Key domains:

| Prefix | Domain |
|--------|--------|
| `/api/admin/*` | Admin: users, payroll, broadcasts |
| `/api/auth/*` | Auth: login, logout, password change |
| `/api/projects/*` | Projects + sub-resources (designs, snags, portals, BOQ) |
| `/api/tasks/*` | Calendar task management |
| `/api/attendance/*` | Attendance logging + appeal workflow |
| `/api/leaves/*` | Leave requests + approvals |
| `/api/payroll/*` | Payroll calculations |
| `/api/design-files/*` | Design versioning + freeze/approval states |
| `/api/boq/*` | Bill of Quantities |
| `/api/snags/*` | Defect/snag tracking |
| `/api/cron/*` | Scheduled jobs (called by Vercel cron) |
| `/api/portal/*`, `/api/public/*` | Client-facing and token-based public access |
| `/api/whatsapp/*`, `/api/onesignal/*` | External notification services |
| `/api/rbac/*` | Role and permission management |

### Supabase Client Usage

Three clients exist — use the right one:
- `lib/supabase.ts` — browser client (anon key, RLS-enforced)
- `lib/supabase-server.ts` — server-side client with user session context
- `lib/supabaseAdmin.ts` — service role client (bypasses RLS); only for admin API routes

### Key Database Tables

`users`, `projects`, `project_members`, `tasks`, `attendance`, `leaves`, `design_files`, `boq`, `snags`, `payroll`, `invoices`, `proposals`, `purchase_orders`, `site_logs`, `project_updates`, `handover_checklists`, `office_expenses`, `notifications`, `audit_logs`, `roles`, `permissions`, `role_permissions`, `user_role_mappings`, `push_subscriptions`.

Full schema documented in `supabase/schema_reference.sql`. Migrations are in `supabase/migrations/`.

### Important Conventions

- `@/*` path alias maps to `./src/*`
- React Compiler (Babel plugin) is enabled — manual `useMemo`/`useCallback` are often unnecessary
- Auth state is managed via `src/contexts/` (AuthContext for employees, AdminAuthContext for admins)
- Cron jobs are HTTP endpoints under `/api/cron/` triggered by Vercel's cron scheduler (see `vercel.json`)
- First-time login forces a password change — tracked via `users.password_changed` column

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
WHATSAPP_API_KEY
WHATSAPP_INSTANCE_ID
ONESIGNAL_APP_ID
ONESIGNAL_REST_API_KEY
```
