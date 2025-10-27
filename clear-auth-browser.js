
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
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
});

console.log('✅ Browser cleanup completed');
console.log('🔄 Please refresh the page to reinitialize authentication');
