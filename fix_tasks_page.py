import sys
import os

file_path = r'd:\site_manager\src\app\dashboard\tasks\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_logic = """      // If we have a task with assignees but some users aren't in our list,
      // try to fetch those specific users
      const taskAssignees = viewTask?.assigned_to || [];
      for (const assigneeId of taskAssignees) {
        if (!allUsers.some(u => u.id === assigneeId)) {
          console.log(`User ${assigneeId} not found in initial fetch, trying direct fetch...`);
          const { data: missingUser, error: missingUserError } = await supabase
            .from('users')
            .select('id, full_name, email')
            .eq('id', assigneeId)
            .single();

          if (!missingUserError && missingUser) {
            console.log('Found missing user via direct fetch:', missingUser);
            allUsers.push(missingUser);
          } else if (missingUserError) {
            console.warn(`Could not find assigned user ${assigneeId}:`, missingUserError);
          }
        }
      }
"""

# Replace lines 785 to 809 (0-indexed: 784 to 808)
# Note: Line numbers from view_file are 1-indexed.
# Lines 785 to 809 are indices 784 up to 809 (exclusive)
lines[784:809] = [new_logic]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Successfully patched TasksPage.tsx")
