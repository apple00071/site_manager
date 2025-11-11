# Project Creation & Management Workflow

## Complete Workflow Summary

### 1. **Create New Project** (Admin)
**Location:** `/dashboard/projects/new`

**Required Fields:**
- ✅ Project Title
- ✅ Customer Name
- ✅ Phone Number (10+ digits)
- ✅ Address (5+ characters)
- ✅ Start Date
- ✅ Estimated Completion Date
- ✅ **Select Designer** (from employee list)

**Optional Fields:**
- Property Details (Type, Apartment, Block, Flat, Floor, Area)
- Worker Details (Carpenter, Electrician, Plumber, Painter, Granite, Glass)
- Project Budget
- Project Notes

**What Happens:**
- Project is created with status: `pending`
- Workflow stage: `requirements_upload`
- Designer is notified of assignment
- Project appears in projects list

---

### 2. **Upload Requirements PDF** (Admin)
**Location:** Project Details → **Workflow Tab**

**Steps:**
1. Go to the created project
2. Click **"Workflow"** tab (Stage Board)
3. In the "Requirements Upload" section:
   - Click "Choose File" to select PDF
   - PDF is uploaded to Supabase Storage
   - Click "Assign Designer & Upload Requirements"

**What Happens:**
- PDF is stored in `project-files/requirements/` bucket
- `requirements_pdf_url` is set
- `requirements_uploaded_at` timestamp is recorded
- Workflow moves to: `design_pending`

---

### 3. **Designer Uploads Design** (Designer)
**Location:** Project Details → **Designs Tab**

**Steps:**
1. Designer logs in
2. Opens assigned project
3. Goes to **"Designs"** tab
4. Uploads design files (images, PDFs, etc.)
5. Adds design notes/description

**What Happens:**
- Design files stored in `project-files/designs/` bucket
- Design entry created in `design_files` table
- Admin is notified of design upload
- Workflow stage: `design_uploaded`

---

### 4. **Admin Approves Design** (Admin)
**Location:** Project Details → **Designs Tab**

**Steps:**
1. Admin reviews uploaded designs
2. Clicks "Approve Design" button
3. Optionally adds approval notes

**What Happens:**
- `design_approved_at` timestamp is set
- `design_approved_by` is set to admin user ID
- Workflow moves to: `supervisor_assignment`
- Designer is notified of approval

---

### 5. **Assign Site Supervisor & Workers** (Admin)
**Location:** Project Details → **Workflow Tab**

**Steps:**
1. After design approval, assign Site Supervisor
2. Assign workers (Carpenter, Electrician, etc.)
3. Set work start date

**What Happens:**
- `site_supervisor_id` is set
- `site_supervisor_assigned_at` timestamp
- Worker details are updated
- Workflow moves to: `in_progress`
- All assigned workers are notified

---

### 6. **Project Execution** (Site Supervisor & Workers)
**Location:** Project Details → **Updates Tab**

**Steps:**
1. Site supervisor and workers update progress
2. Upload photos/documents
3. Add status updates
4. Track inventory usage

**What Happens:**
- Progress updates logged
- Photos/documents stored
- Timeline updated
- Admin can monitor progress

---

### 7. **Project Completion** (Admin)
**Location:** Project Details → **Project Information**

**Steps:**
1. Admin reviews final work
2. Marks project as completed
3. Adds completion notes

**What Happens:**
- Status changed to: `completed`
- Workflow stage: `completed`
- Completion date recorded
- Final notifications sent

---

## Workflow Stages

| Stage | Description | Who Can Update |
|-------|-------------|----------------|
| `requirements_upload` | Waiting for requirements PDF | Admin |
| `design_pending` | Designer working on design | Designer |
| `design_uploaded` | Design uploaded, awaiting approval | Admin |
| `supervisor_assignment` | Assign site supervisor | Admin |
| `in_progress` | Work in progress | Site Supervisor |
| `completed` | Project completed | Admin |

---

## Key Features

### ✅ **Completed**
- Create project with all details
- Select designer from employee list
- Property details (type, apartment, area, etc.)
- Worker details (all trades including Granite & Glass)
- Upload requirements PDF in Workflow tab
- Designer assignment and notifications
- Project details page shows all information
- Supabase rate limiting fixed

### 📋 **Available in Workflow Tab**
- Requirements PDF upload
- Designer assignment
- Site supervisor assignment
- Design approval
- Progress tracking

### 🎨 **Available in Designs Tab**
- Upload design files
- View design history
- Approve/reject designs
- Design notes

### 📊 **Available in Updates Tab**
- Progress updates
- Photo uploads
- Status changes
- Timeline view

---

## Important Notes

1. **PDF Upload**: Requirements PDF must be uploaded in the Workflow tab, not during project creation
2. **Designer Selection**: Designer is selected from employees with "designer" designation
3. **Worker Assignment**: Workers can be assigned during creation or later
4. **Notifications**: All assignments trigger email/in-app notifications
5. **File Storage**: All files stored in Supabase Storage with public URLs

---

## Database Schema Updates Applied

```sql
-- Added columns to projects table:
- granite_worker_name
- granite_worker_phone
- glass_worker_name
- glass_worker_phone
- property_type
- apartment_name
- block_number
- flat_number
- floor_number
- area_sqft
- requirements_pdf_url
```

---

## Next Steps for Users

1. **Create Project** → Fill form with all details
2. **Go to Workflow Tab** → Upload requirements PDF
3. **Designer Works** → Uploads design in Designs tab
4. **Admin Approves** → Reviews and approves design
5. **Assign Workers** → Assign site supervisor and workers
6. **Track Progress** → Monitor updates and completion
