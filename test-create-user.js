// Quick test script to create a user in Supabase
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Service key exists:', !!serviceRoleKey);

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testUserCreation() {
  try {
    console.log('\nTesting user creation...');
    
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    console.log('Creating user with email:', testEmail);
    
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Test User',
        role: 'employee',
      },
    });

    if (error) {
      console.error('ERROR:', error);
      console.error('Error code:', error.code);
      console.error('Error status:', error.status);
      console.error('Error message:', error.message);
      return;
    }

    if (data && data.user) {
      console.log('SUCCESS! User created:');
      console.log('- ID:', data.user.id);
      console.log('- Email:', data.user.email);
      
      // Try to insert into users table
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
          id: data.user.id,
          email: testEmail,
          full_name: 'Test User',
          role: 'employee',
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
      } else {
        console.log('Profile created successfully');
      }
    } else {
      console.error('No user data returned');
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

testUserCreation();

