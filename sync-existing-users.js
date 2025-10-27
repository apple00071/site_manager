// Sync existing auth users to users table
// Run with: node sync-existing-users.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function syncExistingUsers() {
  try {
    console.log('🔄 Syncing existing auth users to users table...');
    
    // Get all auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return;
    }
    
    console.log(`Found ${authUsers.users.length} auth users`);
    
    // Get existing users in our table
    const { data: existingUsers, error: usersError } = await supabase
      .from('users')
      .select('id');
    
    if (usersError) {
      console.error('Error fetching existing users:', usersError);
      return;
    }
    
    const existingUserIds = new Set(existingUsers?.map(u => u.id) || []);
    console.log(`Found ${existingUserIds.size} existing users in users table`);
    
    // Find users that exist in auth but not in users table
    const usersToSync = authUsers.users.filter(authUser => 
      !existingUserIds.has(authUser.id)
    );
    
    console.log(`Found ${usersToSync.length} users to sync`);
    
    if (usersToSync.length === 0) {
      console.log('✅ All users are already synced');
      return;
    }
    
    // Insert missing users
    const usersToInsert = usersToSync.map(authUser => ({
      id: authUser.id,
      email: authUser.email,
      full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
      role: authUser.user_metadata?.role || 'employee'
    }));
    
    const { data: insertedUsers, error: insertError } = await supabase
      .from('users')
      .upsert(usersToInsert, { onConflict: 'id' });
    
    if (insertError) {
      console.error('Error inserting users:', insertError);
      return;
    }
    
    console.log(`✅ Successfully synced ${usersToSync.length} users`);
    
    // List all users now
    const { data: allUsers, error: listError } = await supabase
      .from('users')
      .select('id, email, full_name, role, created_at')
      .order('created_at', { ascending: false });
    
    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }
    
    console.log('\n📋 Current users in table:');
    allUsers?.forEach(user => {
      console.log(`- ${user.full_name} (${user.email}) - ${user.role}`);
    });
    
  } catch (error) {
    console.error('Error syncing users:', error);
  }
}

syncExistingUsers();
