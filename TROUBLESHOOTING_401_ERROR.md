# Troubleshooting 401 Unauthorized Error

## Current Situation

You're getting a **401 Unauthorized** error when trying to add tasks to the Kanban board. The verification script shows:

- ❌ `project_steps`: **5 policies** (should be 4)
- ✅ `project_step_tasks`: **4 policies** (correct)
- ❌ `projects`: **5 policies** (should be 2)

This means **old policies weren't properly dropped** and are conflicting with the new ones.

---

## Solution: Force Drop and Recreate All Policies

### Step 1: Run the Force Drop Script

1. Open Supabase Dashboard → SQL Editor
2. Copy the **ENTIRE** contents of `FORCE_DROP_AND_RECREATE_POLICIES.sql`
3. Paste into SQL Editor
4. Click **RUN**
5. Wait for "Success" message

This script will:
- ✅ Aggressively drop ALL old policies (even if they don't exist)
- ✅ Recreate policies with correct logic
- ✅ Add support for `assigned_employee_id` field
- ✅ Verify policy counts at the end

### Step 2: Verify the Fix

After running the script, you should see these results at the bottom:

```
projects_policy_count: 2
project_steps_policy_count: 4
project_step_tasks_policy_count: 4
```

If you see these numbers, the fix was successful! ✅

### Step 3: Diagnose If Still Not Working

If you still get 401 errors after Step 1, run the diagnostic script:

1. Open `DIAGNOSE_RLS_ISSUE.sql`
2. **IMPORTANT:** Replace `'dcbdcf72f-18f3-460f-9043-dfb88e47b0c5'` with your actual project ID
   - You can find this in the URL when viewing the project
   - Example: `localhost:3000/dashboard/projects/YOUR-PROJECT-ID-HERE`
3. Run the script in Supabase SQL Editor
4. Share the results to get help

The diagnostic script will tell you:
- ✅ Are you logged in?
- ✅ What's your role (admin or employee)?
- ✅ Can you see the project?
- ✅ Are you assigned to the project?
- ✅ Are the policies correct?
- ✅ What's the actual error when trying to insert?

### Step 4: Restart Your Dev Server

**CRITICAL:** After running the SQL fix, you MUST restart your dev server:

```bash
# Stop the server (Ctrl+C in terminal)
# Then restart:
npm run dev
# or
yarn dev
```

Then:
1. Clear browser cache: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. Log out of the application
3. Log back in
4. Try adding a task again

---

## Common Issues and Solutions

### Issue 1: "I ran the script but still see 5 policies"

**Solution:** The old policies might be owned by a different user. Try this:

1. In Supabase SQL Editor, run:
   ```sql
   -- Drop ALL policies manually
   DROP POLICY IF EXISTS "project_steps_modify" ON project_steps CASCADE;
   DROP POLICY IF EXISTS "step_tasks_modify" ON project_step_tasks CASCADE;
   ```
2. Then run `FORCE_DROP_AND_RECREATE_POLICIES.sql` again

### Issue 2: "I'm an admin but still get 401 errors"

**Possible causes:**
1. Your session is stale - Log out and log back in
2. Your user role isn't set correctly in the database
3. RLS is blocking even admins

**Solution:** Run the diagnostic script and check PART 1 and PART 6:
- PART 1 should show your role as 'admin'
- PART 6 should show `am_i_admin = true`

If not, your user role needs to be fixed in the database.

### Issue 3: "I'm an employee and can't see the project"

**Possible causes:**
1. You're not assigned to the project
2. The project assignment isn't in the database

**Solution:** Run the diagnostic script and check PART 2:
- Should show at least one project
- If empty, ask an admin to assign you to the project

### Issue 4: "The diagnostic script shows I'm not logged in (auth.uid() is NULL)"

**Solution:**
1. Log out of the application
2. Close all browser tabs
3. Clear browser cache
4. Log back in
5. Try again

### Issue 5: "I can see the project but can't add tasks"

**Possible causes:**
1. You have view permission but not edit permission
2. The INSERT policy is too restrictive

**Solution:** Run the diagnostic script and check PART 6:
- At least ONE of these should be TRUE:
  - `am_i_admin = true`
  - `am_i_member_via_project_members = true`
  - `am_i_assigned_via_employee_id = true`

If all are FALSE, you're not properly assigned to the project.

---

## Understanding the Policy Counts

### Projects Table (Should have 2 policies)

1. **"Admins can manage all projects"** - FOR ALL
   - Allows admins to do everything
2. **"Employees can view assigned projects"** - FOR SELECT
   - Allows employees to view projects they're assigned to

### Project Steps Table (Should have 4 policies)

1. **"project_steps_select"** - FOR SELECT
   - Who can view steps
2. **"project_steps_insert"** - FOR INSERT
   - Who can create new steps
3. **"project_steps_update"** - FOR UPDATE
   - Who can modify existing steps
4. **"project_steps_delete"** - FOR DELETE
   - Who can delete steps

### Project Step Tasks Table (Should have 4 policies)

1. **"step_tasks_select"** - FOR SELECT
   - Who can view tasks
2. **"step_tasks_insert"** - FOR INSERT
   - Who can create new tasks
3. **"step_tasks_update"** - FOR UPDATE
   - Who can modify existing tasks
4. **"step_tasks_delete"** - FOR DELETE
   - Who can delete tasks

---

## Why Did This Happen?

The original `COMPLETE_RLS_FIX.sql` script used `DROP POLICY IF EXISTS` which should work, but sometimes:

1. **Policies have different names** than expected
2. **Policies are owned by different users** (service role vs authenticated role)
3. **Supabase caches policies** and doesn't immediately reflect changes

The `FORCE_DROP_AND_RECREATE_POLICIES.sql` script is more aggressive and tries to drop ALL possible policy names, ensuring a clean slate.

---

## Next Steps

1. ✅ Run `FORCE_DROP_AND_RECREATE_POLICIES.sql`
2. ✅ Verify policy counts are correct (2, 4, 4)
3. ✅ Restart dev server
4. ✅ Clear browser cache
5. ✅ Log out and log back in
6. ✅ Try adding a task

If still not working:
1. ✅ Run `DIAGNOSE_RLS_ISSUE.sql` (remember to replace project ID)
2. ✅ Share the results
3. ✅ We'll identify the exact issue

---

## Quick Reference

| File | Purpose |
|------|---------|
| `FORCE_DROP_AND_RECREATE_POLICIES.sql` | **RUN THIS FIRST** - Aggressively fixes all policies |
| `DIAGNOSE_RLS_ISSUE.sql` | **RUN IF STILL BROKEN** - Diagnoses the exact problem |
| `VERIFY_RLS_POLICIES.sql` | Quick verification of policy counts |
| `COMPLETE_RLS_FIX.sql` | Original fix (use FORCE_DROP instead) |

---

## Expected Results After Fix

✅ Admin users can:
- View all projects
- Add/edit/delete steps and tasks on any project
- Manage all data

✅ Employee users can:
- View projects they're assigned to (via `project_members` OR `assigned_employee_id`)
- Add/edit/delete steps and tasks on their assigned projects
- Cannot see projects they're not assigned to

✅ No more 401 errors when:
- Adding tasks to Kanban board
- Viewing project details
- Editing project steps

