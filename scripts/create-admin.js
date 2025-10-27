/**
 * Admin User Creation Script
 * 
 * This script creates an admin user in Supabase with the appropriate role.
 * Run this script with Node.js to create the initial admin user.
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
const crypto = require('crypto');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Load environment variables from .env file if available
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not found, using environment variables directly');
}

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  console.error('Error: Required environment variables are missing.');
  console.error('Please ensure the following variables are set:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Generate a secure password
function generateSecurePassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes[i] % chars.length;
    password += chars.charAt(randomIndex);
  }
  
  return password;
}

// Create admin user
async function createAdminUser(email, password, firstName, lastName) {
  try {
    // 1. Create user in Auth with admin role in metadata
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        role: 'admin',
        full_name: `${firstName} ${lastName}`
      }
    });

    if (authError) throw authError;
    
    console.log('User created successfully in Auth');
    
    // 2. Add user to users table with admin role
    const { error: profileError } = await supabase
      .from('users')
      .insert([
        { 
          id: authUser.user.id,
          email: email,
          first_name: firstName,
          last_name: lastName,
          role: 'admin',
          created_at: new Date().toISOString()
        }
      ]);
    
    if (profileError) throw profileError;
    
    console.log('Admin profile created successfully');
    console.log('----------------------------------------');
    console.log('Admin user created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('----------------------------------------');
    console.log('Please store these credentials securely.');
    
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  }
}

// Main function to prompt for user details
function promptUserDetails() {
  rl.question('Enter admin email: ', (email) => {
    const generatedPassword = generateSecurePassword();
    
    rl.question('Enter admin first name: ', (firstName) => {
      rl.question('Enter admin last name: ', (lastName) => {
        rl.question(`Use generated password "${generatedPassword}"? (y/n): `, async (useGenerated) => {
          let finalPassword = generatedPassword;
          
          if (useGenerated.toLowerCase() !== 'y') {
            await new Promise(resolve => {
              rl.question('Enter custom password (min 8 chars): ', (customPassword) => {
                if (customPassword.length < 8) {
                  console.log('Password must be at least 8 characters. Using generated password instead.');
                } else {
                  finalPassword = customPassword;
                }
                resolve();
              });
            });
          }
          
          await createAdminUser(email, finalPassword, firstName, lastName);
          rl.close();
        });
      });
    });
  });
}

// Start the script
console.log('=== Admin User Creation Tool ===');
promptUserDetails();