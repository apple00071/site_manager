const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteAdminUsers() {
  try {
    // Get all admin users
    const { data: admins, error: fetchError } = await supabase
      .from('users')
      .select('id, email')
      .eq('role', 'admin');

    if (fetchError) throw fetchError;

    console.log(`Found ${admins.length} admin users to delete`);
    
    // Delete each admin user
    for (const admin of admins) {
      // Delete from auth.users
      const { error: authError } = await supabase.auth.admin.deleteUser(admin.id);
      if (authError) console.error(`Error deleting auth user ${admin.email}:`, authError);
      
      // Delete from public.users
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', admin.id);
      
      if (userError) {
        console.error(`Error deleting user ${admin.email} from users table:`, userError);
      } else {
        console.log(`Successfully deleted admin: ${admin.email}`);
      }
    }
    
    console.log('Admin cleanup completed');
  } catch (error) {
    console.error('Error in deleteAdminUsers:', error);
  }
}

deleteAdminUsers();
