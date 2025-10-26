/**
 * Admin User Creation Script (Non-Interactive)
 * 
 * Uses environment variables to create an admin user in Supabase.
 * Required env vars:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - ADMIN_EMAIL
 * - ADMIN_PASSWORD (optional; auto-generated if missing)
 * - ADMIN_FIRST_NAME
 * - ADMIN_LAST_NAME
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Load environment variables from .env if available
try {
  require('dotenv').config();
} catch (_) {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL;
let adminPassword = process.env.ADMIN_PASSWORD;
const adminFirstName = process.env.ADMIN_FIRST_NAME || 'Admin';
const adminLastName = process.env.ADMIN_LAST_NAME || 'User';

if (!supabaseUrl || !serviceRoleKey || !adminEmail) {
  console.error('Missing required environment variables.');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL');
  process.exit(1);
}

function generateSecurePassword(length = 20) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+{}[]<>?';
  return Array.from(crypto.randomBytes(length)).map(b => chars[b % chars.length]).join('');
}

if (!adminPassword || adminPassword.length < 8) {
  adminPassword = generateSecurePassword();
  console.log('No ADMIN_PASSWORD provided or too short. Generated secure password.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createAdminUser() {
  try {
    // Create user in Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (authError) throw authError;

    console.log('Auth user created:', authUser.user.id);

    // Insert into users table with admin role
    const { error: profileError } = await supabase
      .from('users')
      .insert([
        {
          id: authUser.user.id,
          email: adminEmail,
          first_name: adminFirstName,
          last_name: adminLastName,
          role: 'admin',
          created_at: new Date().toISOString(),
        },
      ]);

    if (profileError) throw profileError;

    console.log('Admin profile created in users table.');
    console.log('----------------------------------------');
    console.log('ADMIN CREATED SUCCESSFULLY');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('----------------------------------------');
    console.log('Store these credentials securely.');
  } catch (error) {
    console.error('Failed to create admin user:', error.message || error);
    process.exitCode = 1;
  }
}

createAdminUser();