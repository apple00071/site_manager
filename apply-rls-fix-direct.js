// Apply RLS policy fix using direct SQL execution
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyRLSFix() {
  try {
    console.log('Applying RLS policy fix...');
    
    // First, let's check current policies
    console.log('Checking current policies...');
    const { data: policies, error: policyError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'users');
    
    if (policyError) {
      console.log('Could not fetch policies (this is normal):', policyError.message);
    } else {
      console.log('Current policies:', policies?.length || 0);
    }
    
    // Try to disable RLS temporarily to test
    console.log('Testing with RLS disabled...');
    
    // First, let's see if we can query users with service role
    const { data: serviceUsers, error: serviceError } = await supabase
      .from('users')
      .select('*');
    
    if (serviceError) {
      console.error('Service role query error:', serviceError);
    } else {
      console.log('Service role found users:', serviceUsers?.length || 0);
    }
    
    // Now test with anon key
    const anonSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    const { data: anonUsers, error: anonError } = await anonSupabase
      .from('users')
      .select('*');
    
    if (anonError) {
      console.error('Anon key query error:', anonError);
    } else {
      console.log('Anon key found users:', anonUsers?.length || 0);
    }
    
    // The issue is likely that we need to run the SQL directly in Supabase dashboard
    console.log('\n⚠️  Manual step required:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the SQL from fix_user_sync.sql file');
    console.log('4. This will update the RLS policies to allow user access');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

applyRLSFix();
