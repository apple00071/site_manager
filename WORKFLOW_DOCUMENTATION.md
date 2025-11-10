# Complete Project Workflow Documentation

This document provides a comprehensive, step-by-step workflow that accurately reflects the **current state** of the codebase, including what exists and what still needs to be created.

---

## Overview of Workflow Stages

The project workflow consists of the following stages:

1. **requirements_upload** - Admin creates project and uploads requirements PDF
2. **design_pending** - Designer works on designs
3. **design_review** - Admin reviews submitted designs
4. **design_approved** - Design approved, ready for site supervisor
5. **design_rejected** - Design needs changes
6. **in_progress** - Site supervisor assigned, work in progress
7. **completed** - Project completed

---

## Step 1: Project Creation (Admin)

### Current Implementation: ✅ COMPLETE

**What Happens:**
- Admin creates a new project
- Admin assigns a designer using radio buttons
- Project is created with `workflow_stage = 'requirements_upload'`

**Files Involved:**
- **UI Component:** `src/app/dashboard/projects/new/page.tsx` (lines 248-284)
  - Radio buttons for designer selection ✅
  - Form validation with Zod schema ✅
  
- **API Route:** `src/app/api/admin/projects/route.ts` (POST method)
  - Creates project in database ✅
  - Adds project members ✅

**Database Fields Set:**
- `title`, `description`, `customer_name`, `phone_number`, `address`, etc.
- `assigned_employee_id` → Designer ID
- `status` → 'pending'
- `workflow_stage` → 'requirements_upload' (if migration is run)

### Missing UI: ❌ REQUIREMENTS PDF UPLOAD

**What's Missing:**
- UI for uploading requirements PDF when creating a project
- The API route exists (`POST /api/projects/[id]/requirements`) but there's no UI to call it

**Where It Should Be:**
- Option 1: Add to new project form (`src/app/dashboard/projects/new/page.tsx`)
- Option 2: Add to project detail page after creation
- Option 3: Add to edit project page (`src/app/dashboard/projects/[id]/edit/page.tsx`)

**API Route Available:** ✅
- `POST /api/projects/[id]/requirements` - Upload PDF and assign designer
- Located in: `src/app/api/projects/[id]/requirements/route.ts`

---

## Step 2: Requirements PDF Upload (Admin → Designer)

### Current Implementation: ⚠️ PARTIAL (API only, no UI)

**What Should Happen:**
- Admin uploads a requirements PDF file
- System updates `requirements_pdf_url` in database
- System sets `workflow_stage = 'design_pending'`
- Designer receives notification

**API Route:** ✅ EXISTS
- **Endpoint:** `POST /api/projects/[id]/requirements`
- **File:** `src/app/api/projects/[id]/requirements/route.ts`
- **What it does:**
  - Accepts `requirements_pdf_url` and `designer_id`
  - Updates project with requirements and designer assignment
  - Sets `workflow_stage = 'design_pending'`
  - Logs workflow change
  - Creates notification for designer

**Missing UI:** ❌ NO UI COMPONENT

**What Needs to Be Created:**
1. File upload component for requirements PDF
2. Integration with Supabase Storage to upload PDF
3. Call to `POST /api/projects/[id]/requirements` after upload
4. Display of uploaded requirements PDF in project details

**Suggested Location:**
- Add to project detail page (`src/app/dashboard/projects/[id]/page.tsx`)
- Show upload button for admins when `workflow_stage = 'requirements_upload'`

---

## Step 3: Design File Upload (Designer → Admin)

### Current Implementation: ✅ COMPLETE

**What Happens:**
- Designer uploads design files (images, PDFs, etc.)
- Files are stored in Supabase Storage
- Design files are linked to the project

**Files Involved:**
- **UI Component:** `src/components/projects/DesignsTab.tsx`
  - File upload functionality ✅
  - Display of uploaded designs ✅
  - Version management ✅

- **API Route:** `src/app/api/design-files/route.ts`
  - POST: Create new design file ✅
  - GET: Fetch design files for project ✅
  - DELETE: Delete design file ✅

**Database Table:** `design_files`
- Fields: `id`, `project_id`, `file_name`, `file_url`, `file_type`, `version_number`
- Approval fields: `approval_status`, `approved_by`, `approved_at`, `admin_comments`
- Rejection fields: `rejection_reason`, `resubmitted_from`, `is_resubmission`

---

## Step 4: Design Review & Approval (Admin)

### Current Implementation: ⚠️ PARTIAL (API only, no UI)

**What Should Happen:**
- Admin reviews submitted design files
- Admin can either:
  - **Approve** design → Move to next stage
  - **Reject** design → Designer must resubmit

**API Routes:** ✅ EXIST

### 4A. Approve Design
- **Endpoint:** `POST /api/projects/[id]/approve-design`
- **File:** `src/app/api/projects/[id]/approve-design/route.ts`
- **Parameters:**
  - `design_file_id` (required)
  - `site_supervisor_id` (optional)
  - `admin_comments` (optional)
- **What it does:**
  - Updates design file: `approval_status = 'approved'`
  - Updates project: `workflow_stage = 'design_approved'`
  - If `site_supervisor_id` provided: assigns supervisor and sets `workflow_stage = 'in_progress'`
  - Creates notifications for designer and site supervisor
  - Logs workflow change

### 4B. Reject Design
- **Endpoint:** `POST /api/projects/[id]/reject-design`
- **File:** `src/app/api/projects/[id]/reject-design/route.ts`
- **Parameters:**
  - `design_file_id` (required)
  - `rejection_reason` (required)
  - `admin_comments` (optional)
- **What it does:**
  - Updates design file: `approval_status = 'rejected'`, `rejection_reason`
  - Updates project: `workflow_stage = 'design_rejected'`
  - Creates notification for designer with rejection reason
  - Logs workflow change

**Missing UI:** ❌ NO UI COMPONENT

**What Needs to Be Created:**
1. Design approval interface in project detail page
2. Buttons to approve/reject each design file
3. Modal/form for rejection reason input
4. Modal/form for site supervisor assignment on approval
5. Display of approval status for each design

**Suggested Location:**
- Add to `src/components/projects/DesignsTab.tsx`
- Show approve/reject buttons for admins
- Show approval status badges for all users

---

## Step 5: Site Supervisor Assignment (Admin)

### Current Implementation: ✅ COMPLETE (via approve-design API)

**What Happens:**
- Admin assigns site supervisor when approving design
- OR admin can assign later via edit project form

**Methods:**

### Method 1: During Design Approval
- Use `POST /api/projects/[id]/approve-design` with `site_supervisor_id` parameter
- Sets `workflow_stage = 'in_progress'` automatically

### Method 2: Via Edit Project Form
- **UI Component:** `src/app/dashboard/projects/[id]/edit/page.tsx` (lines 278-316)
  - Radio buttons for employee selection ✅
  - Currently labeled "Assign Designer" but can be used for site supervisor too

**Database Fields:**
- `site_supervisor_id` - UUID of assigned site supervisor
- `site_supervisor_assigned_at` - Timestamp of assignment

**Note:** The edit form currently only shows "Assign Designer". We may need to add a separate field for site supervisor assignment or clarify the workflow.

---

## Step 6: Inventory Management (Site Supervisor)

### Current Implementation: ✅ COMPLETE

**What Happens:**
- Site supervisor adds inventory items to the project
- Site supervisor uploads bills/invoices
- All fields are optional except `item_name`
- Bills default to `bill_approval_status = 'pending'`

**Files Involved:**
- **UI Component:** `src/components/projects/InventoryTab.tsx`
  - Add inventory form ✅
  - File upload for bills ✅
  - Display inventory items ✅
  - Edit/delete functionality ✅

- **API Route:** `src/app/api/inventory-items/route.ts`
  - POST: Create inventory item ✅
  - GET: Fetch inventory items ✅
  - PATCH: Update inventory item ✅
  - DELETE: Delete inventory item ✅

**Form Fields:**
- `item_name` (required)
- `quantity` (optional)
- `total_cost` (optional)
- `supplier_name` (optional)
- `date_purchased` (optional)
- `bill_url` (optional - file upload)

**Removed Fields:** ✅
- ~~`unit`~~ - Removed from UI and validation
- ~~`price_per_unit`~~ - Removed from UI and validation

**Database Fields:**
- All fields nullable except `project_id` and `item_name`
- `bill_approval_status` - 'pending', 'approved', or 'rejected'
- `bill_approved_by` - Admin who approved/rejected
- `bill_approved_at` - Timestamp
- `bill_rejection_reason` - Reason if rejected

---

## Step 7: Bill Approval (Admin)

### Current Implementation: ⚠️ PARTIAL (API only, no UI)

**What Should Happen:**
- Admin reviews inventory bills uploaded by site supervisor
- Admin can either:
  - **Approve** bill → Mark as approved
  - **Reject** bill → Site supervisor must re-upload

**API Routes:** ✅ EXIST

### 7A. Approve Bill
- **Endpoint:** `POST /api/inventory-items/[id]/approve-bill`
- **File:** `src/app/api/inventory-items/[id]/approve-bill/route.ts`
- **What it does:**
  - Updates inventory item: `bill_approval_status = 'approved'`
  - Sets `bill_approved_by` and `bill_approved_at`
  - Creates notification for site supervisor

### 7B. Reject Bill
- **Endpoint:** `POST /api/inventory-items/[id]/reject-bill`
- **File:** `src/app/api/inventory-items/[id]/reject-bill/route.ts`
- **Parameters:**
  - `rejection_reason` (required)
- **What it does:**
  - Updates inventory item: `bill_approval_status = 'rejected'`
  - Sets `bill_rejection_reason`
  - Creates notification for site supervisor with rejection reason

**Missing UI:** ❌ NO UI COMPONENT

**What Needs to Be Created:**
1. Bill approval interface in inventory tab
2. Approve/reject buttons for each inventory item (admin only)
3. Modal/form for rejection reason input
4. Display of approval status (already exists - shows status badge)
5. Filter to show pending bills for admin review

**Suggested Location:**
- Add to `src/components/projects/InventoryTab.tsx`
- Show approve/reject buttons next to each item for admins
- Show status badge (already implemented ✅)

---

## Summary: What Exists vs. What's Missing

### ✅ Complete Features

1. **Project Creation** - UI and API complete
2. **Designer Assignment** - Radio buttons implemented
3. **Design File Upload** - UI and API complete
4. **Inventory Management** - UI updated (fields removed), API complete
5. **Database Schema** - All migrations created
6. **API Routes** - All workflow API routes created

### ❌ Missing UI Components

1. **Requirements PDF Upload UI**
   - API exists: `POST /api/projects/[id]/requirements`
   - Need: File upload component in project form or detail page

2. **Design Approval/Rejection UI**
   - API exists: `POST /api/projects/[id]/approve-design` and `reject-design`
   - Need: Approve/reject buttons in DesignsTab component

3. **Bill Approval/Rejection UI**
   - API exists: `POST /api/inventory-items/[id]/approve-bill` and `reject-bill`
   - Need: Approve/reject buttons in InventoryTab component

4. **Workflow Status Display**
   - Need: Visual indicator of current workflow stage in project detail page
   - Need: Workflow progress bar or timeline

---

## Next Steps to Complete the Workflow

### Priority 1: Requirements PDF Upload UI
Create file upload component for requirements PDF in project creation/edit forms.

### Priority 2: Design Approval UI
Add approve/reject buttons to DesignsTab for admins to review designs.

### Priority 3: Bill Approval UI
Add approve/reject buttons to InventoryTab for admins to review bills.

### Priority 4: Workflow Visualization
Add workflow stage indicator to project detail page showing current stage and progress.

---

## Database Migration Status

**Migration Files Created:**
1. `supabase/migrations/20240115_push_subscriptions.sql` - Push notifications
2. `supabase/migrations/20240116_project_workflow_update.sql` - Workflow fields

**Status:** ⚠️ NOT YET RUN

**To Apply Migrations:**
Run these SQL files in Supabase SQL Editor in order.

---

## File Reference

### UI Components
- `src/app/dashboard/projects/new/page.tsx` - New project form
- `src/app/dashboard/projects/[id]/edit/page.tsx` - Edit project form
- `src/app/dashboard/projects/[id]/page.tsx` - Project detail page
- `src/components/projects/DesignsTab.tsx` - Design files management
- `src/components/projects/InventoryTab.tsx` - Inventory management

### API Routes
- `src/app/api/admin/projects/route.ts` - Project CRUD
- `src/app/api/projects/[id]/requirements/route.ts` - Requirements upload
- `src/app/api/projects/[id]/approve-design/route.ts` - Approve design
- `src/app/api/projects/[id]/reject-design/route.ts` - Reject design
- `src/app/api/design-files/route.ts` - Design file CRUD
- `src/app/api/inventory-items/route.ts` - Inventory CRUD
- `src/app/api/inventory-items/[id]/approve-bill/route.ts` - Approve bill
- `src/app/api/inventory-items/[id]/reject-bill/route.ts` - Reject bill

### Database Migrations
- `supabase/migrations/20240115_push_subscriptions.sql`
- `supabase/migrations/20240116_project_workflow_update.sql`

