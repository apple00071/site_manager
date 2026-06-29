# Codebase Index — Apple Interior Manager

A comprehensive reference for the directory structure, routing, APIs, database, and RBAC design of the **Apple Interior Manager** repository.

---

## 1. Project Overview & Tech Stack

**Apple Interior Manager** is a full-stack interior design project management system configured for teams, clients, and administrators. It supports web clients (Next.js), Progressive Web Apps (PWA), and native Android containers (via Capacitor).

### Core Stack
*   **Frontend Framework:** [Next.js 16](https://nextjs.org/) (App Router, React Server Components)
*   **UI Library:** [React 19](https://react.dev/) (utilizing the React Compiler for hook optimization)
*   **Styling:** [Tailwind CSS 4](https://tailwindcss.com/) with Vanilla CSS variables
*   **Backend & DB:** [Supabase](https://supabase.com/) (PostgreSQL + Auth + Storage)
*   **Mobile Wrapper:** [Capacitor 8](https://capacitorjs.com/) for native Android deployment
*   **Notifications:** [OneSignal](https://onesignal.com/) (Push notifications) & WhatsApp via `wasenderapi`
*   **Email Deliverability:** [Resend](https://resend.com/) & [Nodemailer](https://nodemailer.com/)

---

## 2. Directory Layout

The workspace is organized into standard folders for database migrations, source code, and configuration assets:

*   📂 [`supabase/`](file:///d:/site_manager/supabase) — Database schemas and incremental migrations.
    *   📂 [`migrations/`](file:///d:/site_manager/supabase/migrations) — SQL files for database table definitions, triggers, and RLS policies.
    *   📄 [`schema_reference.sql`](file:///d:/site_manager/supabase/schema_reference.sql) — Consolidated master database reference.
*   📂 [`src/`](file:///d:/site_manager/src) — The main source directory for the Next.js application.
    *   📂 [`app/`](file:///d:/site_manager/src/app) — Next.js routing pages, layouts, and REST API routes.
    *   📂 [`components/`](file:///d:/site_manager/src/components) — Custom reusable React components.
        *   📂 [`ui/`](file:///d:/site_manager/src/components/ui) — Base UI elements (Modals, Panels, Tables, Bottom Sheets).
        *   📂 [`attendance/`](file:///d:/site_manager/src/components/attendance), [`boq/`](file:///d:/site_manager/src/components/boq), [`chatbot/`](file:///d:/site_manager/src/components/chatbot), [`leaves/`](file:///d:/site_manager/src/components/leaves), [`notepad/`](file:///d:/site_manager/src/components/notepad), [`office-expenses/`](file:///d:/site_manager/src/components/office-expenses), [`payroll/`](file:///d:/site_manager/src/components/payroll), [`projects/`](file:///d:/site_manager/src/components/projects), [`tasks/`](file:///d:/site_manager/src/components/tasks) — Feature-specific component libraries.
    *   📂 [`contexts/`](file:///d:/site_manager/src/contexts) — React state providers for auth and title controls.
    *   📂 [`hooks/`](file:///d:/site_manager/src/hooks) — Custom React hooks (e.g., authorization checks).
    *   📂 [`lib/`](file:///d:/site_manager/src/lib) — Core service wrappers, helpers, and authorization constants.
    *   📂 [`types/`](file:///d:/site_manager/src/types) — Custom type files and overrides.
*   📂 [`public/`](file:///d:/site_manager/public) — Static visual and application assets.

---

## 3. Application Routing Structure

Client routes are partitioned by permissions using Next.js route groups and directories.

### Public-facing Routes
*   ` / ` — Root route.
*   ` /login ` — Login screen for team members.
*   ` /signup ` — Registration screen.
*   ` /forgot-password ` — Password reset workflow.
*   ` /privacy-policy ` — Application privacy terms.
*   ` /account-deletion ` — Account deletion requests.
*   ` /public/project/[id] ` — Shared read-only pages for clients to view project milestones.

### Admin-Only Area (`/admin`)
*   ` /admin/login ` — Admin authentication gateway.
*   ` /admin/dashboard ` — Global telemetry, system audits, and company dashboard.
*   ` /admin/users/new ` — User onboarding screen.

### Employee Dashboard (`/dashboard`)
*   ` /dashboard ` — Home landing screen with current assignments.
*   ` /dashboard/projects ` — Project management list.
*   ` /dashboard/projects/[id] ` — Detailed project screen containing milestones, logs, files, BOQs.
*   ` /dashboard/projects/[id]/edit ` — Edit project specifications.
*   ` /dashboard/projects/[id]/members` — Control access permissions of assigned team members.
*   ` /dashboard/attendance ` — Personal and team daily attendance check-ins.
*   ` /dashboard/payroll ` — Monthly payslip calculations, allowances, and tracking.
*   ` /dashboard/tasks ` — Interactive task calendars and scheduling tools.
*   ` /dashboard/office-expenses ` — Office billing and expense reports.
*   ` /dashboard/organization ` — Team listings, structures, and documents.
*   ` /dashboard/settings ` — User settings.
*   ` /dashboard/snags ` — Issue tracking list.
*   ` /dashboard/telemetry` — Analytics interface.

### Client Portal (`/portal`)
*   ` /portal/login ` — Direct login interface for design clients.
*   ` /portal ` — Client workspace home showing deliverables, invoice totals, and project files.
*   ` /portal/project ` — Interactive project details view.

---

## 4. API Endpoints Map (`/src/app/api`)

API handlers are grouped logically by functionality. Standard response/request validation is backed by Zod schemas, with route dynamics forced to dynamic to skip static caching rules.

| API Prefix | Purpose | Key Actions |
| :--- | :--- | :--- |
| `/api/auth` | User sessions & security | Logs in, logs out, handles password overrides. |
| `/api/admin` | System level admin operations | User provisioning, auditing logs, managing app global state. |
| `/api/projects` | Project workspaces | Creating/editing projects, managing BOQ details, snag items. |
| `/api/tasks` | Workspace assignments | Standardizing and creating milestone checklist tasks. |
| `/api/attendance` | Attendance operations | Punch in/out actions, tracking geolocation, handling appeals. |
| `/api/leaves` | Leave workflows | Custom request processing, administrative approvals/denials. |
| `/api/payroll` | Financial payroll structures | Salary slips compilation, tracking deduction history. |
| `/api/design-files` | Digital file versioning | Freezing files, client commenting flow, version validation. |
| `/api/boq` | Bills of Quantities | Managing materials budgets and items procurement states. |
| `/api/snags` | Defect tracking system | Issue logs, resolving states, client/admin signatures. |
| `/api/office-expenses`| Petty cash records | Documenting and uploading expense receipts. |
| `/api/cron` | Vercel Cron-driven workflows | Running routine reminders and data cleanup loops. |
| `/api/whatsapp` | Direct messenger hooks | Notification routing to employees/clients via wasenderapi. |
| `/api/onesignal` | System push messages | Subscriptions updates, sending broad mobile notifications. |
| `/api/rbac` | Security policies | Reading/syncing dynamic permissions on roles. |

---

## 5. Database Schema & Tables Overview

The data schema is stored in PostgreSQL (via Supabase), using Row-Level Security (RLS) policies for tenant and role-based data isolation.

### Primary Data Entities

1.  **`users`** — Custom metadata linking directly to Supabase authentication (`auth.users`). Tracks roles (`admin`, `employee`), password resets, and active status.
2.  **`clients`** — Details names, phone lines, emails, and billing addresses for clients.
3.  **`projects`** — Project details, deadline timelines, statuses, and linked client associations.
4.  **`project_members`** — Assignment mapping table. Specifies permissions (`view`, `edit`, `upload`, `mark_done`) for a user inside a project.
5.  **`files`** — File directory records pointing to design assets in Supabase Storage.
6.  **`attendance`** — Records timestamps, coordinates, checking types, and correction logs.
7.  **`leaves`** — Tracks requested vacations, sick leaves, balances, and sign-offs.
8.  **`design_files`** — Manages design files, approvals, comments, and design lock flags.
9.  **`boq` / `boq_items`** — Stores cost analysis items, specifications, material names, quantities, and prices.
10. **`snags`** — Houses deficiency details, locations, assignee codes, resolved statuses, and visual attachments.
11. **`payroll`** — Compiles gross pay records, taxes, deductions, and payment states.
12. **`office_expenses`** — Records small business expenditures, bills, types, and approval states.
13. **`audit_logs`** — Tracks administrative dashboard actions.

---

## 6. Role-Based Access Control (RBAC) System

The application combines route middleware with database policies and client-side permissions verification.

### Authentication Guards
1.  **`middleware.ts`**: Evaluates session cookies on every request. Public routes are bypassed, while authenticated routes filter roles. Any admin-only route matches roles before permitting loads.
2.  **Supabase RLS Policies**: Enforce data security at the database engine level (e.g. ensuring employees can only view records of projects they are members of).

### Granular Permission Nodes (`rbac-constants.ts`)

Granular nodes are evaluated using the custom hook `useUserPermissions` or inside APIs to check user access rights:

*   **Projects:** `projects.view`, `projects.view_all`, `projects.create`, `projects.edit`, `projects.delete`, `projects.assign`, `projects.view_budget`
*   **Designs:** `designs.view`, `designs.upload`, `designs.delete`, `designs.approve`, `designs.freeze`, `designs.comment`
*   **BOQ:** `boq.view`, `boq.create`, `boq.edit`, `boq.delete`, `boq.import`
*   **Proposals:** `proposals.view`, `proposals.create`, `proposals.send`, `proposals.approve`, `proposals.reject`, `proposals.delete`
*   **Purchase Orders:** `orders.view`, `orders.create`, `orders.edit`, `orders.delete`
*   **Invoices:** `invoices.view`, `invoices.create`, `invoices.edit`, `invoices.approve`, `invoices.delete`
*   **Payments:** `payments.view`, `payments.create`, `payments.edit`, `payments.delete`
*   **Suppliers:** `suppliers.view`, `suppliers.create`
*   **Inventory:** `inventory.view`, `inventory.add`, `inventory.edit`, `inventory.delete`, `inventory.approve`, `inventory.approve_bill`, `inventory.reject_bill`, `inventory.resubmit_bill`
*   **Work Progress Updates:** `updates.view`, `updates.create`
*   **Site Logs:** `site_logs.view`, `site_logs.create`, `site_logs.edit`, `site_logs.delete`
*   **Snags (Defect Tracking):** `snags.view`, `snags.view_all`, `snags.create`, `snags.update`, `snags.resolve`, `snags.verify`
*   **Holidays:** `holidays.view`, `holidays.manage`
*   **Payroll:** `payroll.view`, `payroll.manage`, `payroll.config`
*   **Finance:** `finance.view`
*   **User Management:** `users.view`, `users.create`, `users.edit`, `users.delete`, `users.manage_roles`, `users.manage_documents`
*   **Settings:** `settings.view`, `settings.edit`, `settings.workflows`
*   **Tasks:** `tasks.view`, `tasks.create`, `tasks.edit`, `tasks.bulk`
*   **Office Expenses:** `office_expenses.view`, `office_expenses.create`, `office_expenses.approve`, `office_expenses.delete`
*   **Attendance & Leave:** `attendance.view`, `attendance.view_all`, `attendance.view_appeals`, `attendance.log`, `attendance.approve`, `leaves.view`, `leaves.apply`, `leaves.approve`

---

## 7. Reusable Components & UI Patterns

### Reusable UI Shell Elements (`src/components/ui/`)

These core components establish the application's mobile-friendly layout and interaction paradigm:

*   📄 [`BottomSheet.tsx`](file:///d:/site_manager/src/components/ui/BottomSheet.tsx) — Slide-up panel optimized for native gestures on mobile screens.
*   📄 [`CustomControls.tsx`](file:///d:/site_manager/src/components/ui/CustomControls.tsx) — Layout form items, custom selectors, input toggles, and state inputs.
*   📄 [`DataTable.tsx`](file:///d:/site_manager/src/components/ui/DataTable.tsx) — A robust table grid rendering support for columns filtering, sorting, and pagination.
*   📄 [`ImageModal.tsx`](file:///d:/site_manager/src/components/ui/ImageModal.tsx) — Overlay dialog showcasing full-screen images and snag proof screenshots.
*   📄 [`MentionTextarea.tsx`](file:///d:/site_manager/src/components/ui/MentionTextarea.tsx) — Enhanced textbox component enabling user tag triggers (`@username`).
*   📄 [`Modal.tsx`](file:///d:/site_manager/src/components/ui/Modal.tsx) — Standard popup wrapper.
*   📄 [`PullToRefresh.tsx`](file:///d:/site_manager/src/components/ui/PullToRefresh.tsx) — Container enabling pull-down-to-reload on touch devices.
*   📄 [`SidePanel.tsx`](file:///d:/site_manager/src/components/ui/SidePanel.tsx) — Desktop/tablet sidebar component.
*   📄 [`Toast.tsx`](file:///d:/site_manager/src/components/ui/Toast.tsx) — In-app micro-notifications for task updates and actions.

---

## 8. State Contexts & Custom Hooks

*   📄 [`AuthContext.tsx`](file:///d:/site_manager/src/contexts/AuthContext.tsx) — Checks user sessions for standard employee/team portals. Provides session data, user profiles, metadata status, and sign-out logic.
*   📄 [`AdminAuthContext.tsx`](file:///d:/site_manager/src/contexts/AdminAuthContext.tsx) — Context dedicated to authentication workflows of administrators.
*   📄 [`HeaderTitleContext.tsx`](file:///d:/site_manager/src/contexts/HeaderTitleContext.tsx) — Dynamic header title updater to change navbar labels on page transition.
*   📄 [`useUserPermissions.ts`](file:///d:/site_manager/src/hooks/useUserPermissions.ts) — Analyzes user permissions based on logged-in RBAC credentials. Enables/disables component actions.
