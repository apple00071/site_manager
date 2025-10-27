#!/usr/bin/env node

/**
 * Authentication Cleanup Script
 *
 * This script clears corrupted Supabase authentication data from local storage
 * and resets the authentication state. Useful when encountering cookie parsing errors.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🧹 Authentication Cleanup Script');
console.log('================================');

// Clear Next.js cache
const nextCacheDir = path.join(process.cwd(), '.next');
if (fs.existsSync(nextCacheDir)) {
  console.log('📁 Clearing Next.js cache...');
  try {
    fs.rmSync(nextCacheDir, { recursive: true, force: true });
    console.log('✅ Next.js cache cleared');
  } catch (error) {
    console.log('⚠️ Could not clear Next.js cache:', error.message);
  }
} else {
  console.log('ℹ️ Next.js cache not found');
}

// Clear node_modules/.cache if it exists
const nodeCacheDir = path.join(process.cwd(), 'node_modules', '.cache');
if (fs.existsSync(nodeCacheDir)) {
  console.log('📁 Clearing node_modules cache...');
  try {
    fs.rmSync(nodeCacheDir, { recursive: true, force: true });
    console.log('✅ node_modules cache cleared');
  } catch (error) {
    console.log('⚠️ Could not clear node_modules cache:', error.message);
  }
}

// Create a script to clear browser storage
const clearBrowserScript = `
// Browser Storage Cleanup Script
// Run this in the browser console to clear corrupted auth data

console.log('🧹 Clearing browser authentication data...');

// Clear all Supabase-related localStorage
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('sb:') || key.includes('supabase')) {
    console.log('Removing localStorage key:', key);
    localStorage.removeItem(key);
  }
});

// Clear sessionStorage
console.log('Clearing sessionStorage...');
sessionStorage.clear();

// Clear cookies related to authentication
document.cookie.split(';').forEach(cookie => {
  const [name] = cookie.trim().split('=');
  if (name.includes('sb-') || name.includes('supabase')) {
    console.log('Removing cookie:', name);
    document.cookie = \`\${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;\`;
  }
});

console.log('✅ Browser cleanup completed');
console.log('🔄 Please refresh the page to reinitialize authentication');
`;

// Write the browser cleanup script to a file
const browserScriptPath = path.join(process.cwd(), 'clear-auth-browser.js');
fs.writeFileSync(browserScriptPath, clearBrowserScript);

console.log('📄 Browser cleanup script created: clear-auth-browser.js');
console.log('📋 Copy and paste the contents of this file into your browser console');
console.log('   to clear any remaining corrupted data from browser storage.');

// Create environment validation
console.log('\\n🔍 Checking environment configuration...');
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasUrl = envContent.includes('NEXT_PUBLIC_SUPABASE_URL');
  const hasKey = envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (hasUrl && hasKey) {
    console.log('✅ Environment variables found');
  } else {
    console.log('❌ Missing required environment variables');
  }
} else {
  console.log('⚠️ .env file not found');
}

console.log('\\n🚀 Next steps:');
console.log('1. Run: npm run dev');
console.log('2. Open browser and run the script in clear-auth-browser.js');
console.log('3. Refresh the page');
console.log('4. Try logging in again');

console.log('\\n✨ Cleanup completed!');
