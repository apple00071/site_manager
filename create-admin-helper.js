const { execSync } = require('child_process');
const readline = require('readline');
const crypto = require('crypto');

// Set admin credentials
const email = 'admin@appleinteriors.in';
const password = `Apple@${Math.random().toString(36).slice(-8)}!`;

console.log('Creating admin with:');
console.log('Email:', email);
console.log('Password:', password);

// Run the admin creation script with the generated credentials
const input = `${email}\nAdmin\nUser\n${password}\n${password}\n`;

try {
  const result = execSync('node scripts/create-admin.js', { 
    input: input,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf-8'
  });
  console.log('Admin creation output:');
  console.log(result);
  console.log('\nAdmin created successfully!');
  console.log('Login at: /admin/login');
  console.log('Email:', email);
  console.log('Password:', password);
} catch (error) {
  console.error('Error creating admin:');
  console.error(error.message);
  console.error('\nPlease try running the script manually:');
  console.log('node scripts/create-admin.js');
}
