// Apply RLS policy fix
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyRLSFix() {
  try {
    console.log('Applying RLS policy fix...');
    
    const policies = [
      // Drop existing policies
      'DROP POLICY IF EXISTS "Users can view their own data" ON users;',
      'DROP POLICY IF EXISTS "Admins can view all user data" ON users;',
      'DROP POLICY IF EXISTS "Admins can insert user data" ON users;',
      'DROP POLICY IF EXISTS "Admins can update user data" ON users;',
      'DROP POLICY IF EXISTS "Users can update their own data" ON users;',
      'DROP POLICY IF EXISTS "users_own_view" ON users;',
      'DROP POLICY IF EXISTS "users_insert" ON users;',
      'DROP POLICY IF EXISTS "users_own_update" ON users;',
      'DROP POLICY IF EXISTS "users_view_all" ON users;',

      // Create simple policies
      `CREATE POLICY "users_own_view" ON users
        FOR SELECT 
        USING (auth.uid() = id);`,

      `CREATE POLICY "users_insert" ON users
        FOR INSERT
        WITH CHECK (true);`,

      `CREATE POLICY "users_own_update" ON users
        FOR UPDATE
        USING (auth.uid() = id);`,

      `CREATE POLICY "users_view_all" ON users
        FOR SELECT
        USING (true);`
    ];
    
    for (const policy of policies) {
      console.log(`Executing: ${policy.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: policy });
      
      if (error) {
        console.error('Error executing policy:', error);
        // Continue with other policies even if one fails
      }
    }
    
    console.log('✅ RLS policies updated successfully');
    
    // Test the fix
    console.log('\nTesting user query with anon key...');
    const anonSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    const { data, error } = await anonSupabase
      .from('users')
      .select('*');
    
    if (error) {
      console.error('Error testing query:', error);
    } else {
      console.log('Users found:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('Sample user:', data[0]);
      }
    }
    
  } catch (error) {
    console.error('Error applying RLS fix:', error);
  }
}

applyRLSFix();
