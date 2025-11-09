/**
 * Authentication Helper Functions
 * Provides utilities for token refresh, session validation, and error handling
 */

import { supabase } from './supabase-client-helper';

const DEBUG_ENABLED = process.env.NEXT_PUBLIC_DEBUG === 'true';

function debugLog(...args: any[]) {
  if (DEBUG_ENABLED) {
    console.log('[AuthHelpers]', ...args);
  }
}

/**
 * Ensures we have a valid auth session by refreshing if needed
 * @returns {Promise<boolean>} True if session is valid, false otherwise
 */
export async function ensureValidSession(): Promise<boolean> {
  try {
    debugLog('🔄 Checking session validity...');
    
    // First, try to get the current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      debugLog('❌ Session error:', error.message);
      
      // If we get a refresh token error, try to refresh
      if (error.message.includes('refresh') || error.message.includes('token')) {
        debugLog('🔄 Attempting to refresh session...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          debugLog('❌ Refresh failed:', refreshError.message);
          return false;
        }
        
        if (refreshData.session) {
          debugLog('✅ Session refreshed successfully');
          return true;
        }
      }
      
      return false;
    }
    
    if (!session) {
      debugLog('⚠️ No session found');
      return false;
    }
    
    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const expiresInSeconds = expiresAt - Math.floor(Date.now() / 1000);
      debugLog(`⏰ Token expires in ${expiresInSeconds} seconds`);
      
      // Refresh if expiring within 5 minutes (300 seconds)
      if (expiresInSeconds < 300) {
        debugLog('🔄 Token expiring soon, refreshing...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          debugLog('❌ Proactive refresh failed:', refreshError.message);
          // Session might still be valid, so don't return false
        } else if (refreshData.session) {
          debugLog('✅ Session proactively refreshed');
        }
      }
    }
    
    debugLog('✅ Session is valid');
    return true;
  } catch (error) {
    debugLog('💥 Error in ensureValidSession:', error);
    return false;
  }
}

/**
 * Makes an authenticated API call with automatic token refresh
 * @param url - The API endpoint to call
 * @param options - Fetch options
 * @returns {Promise<Response>} The fetch response
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    debugLog(`📡 Making authenticated request to: ${url}`);
    
    // Ensure we have a valid session before making the request
    const isValid = await ensureValidSession();
    
    if (!isValid) {
      debugLog('❌ No valid session, request will likely fail');
      // Still attempt the request - the API will return 401 if needed
    }
    
    // Make the request
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    
    // If we get a 401, try refreshing and retrying once
    if (response.status === 401) {
      debugLog('⚠️ Got 401, attempting to refresh and retry...');
      
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        debugLog('❌ Refresh failed, returning 401 response');
        return response;
      }
      
      debugLog('✅ Session refreshed, retrying request...');
      
      // Retry the request with the new session
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      
      return retryResponse;
    }
    
    return response;
  } catch (error) {
    debugLog('💥 Error in authenticatedFetch:', error);
    throw error;
  }
}

/**
 * Sets up automatic token refresh interval
 * Refreshes the token every 50 minutes (tokens typically expire after 60 minutes)
 * @returns {() => void} Cleanup function to stop the interval
 */
export function setupTokenRefreshInterval(): () => void {
  debugLog('⏰ Setting up automatic token refresh interval');
  
  // Refresh every 50 minutes (3000000 ms)
  const intervalId = setInterval(async () => {
    debugLog('⏰ Automatic token refresh triggered');
    
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        debugLog('❌ Automatic refresh failed:', error.message);
      } else if (data.session) {
        debugLog('✅ Token automatically refreshed');
      }
    } catch (error) {
      debugLog('💥 Error in automatic refresh:', error);
    }
  }, 50 * 60 * 1000); // 50 minutes
  
  // Return cleanup function
  return () => {
    debugLog('🛑 Stopping automatic token refresh');
    clearInterval(intervalId);
  };
}

/**
 * Handles auth errors and provides user-friendly messages
 * @param error - The error object
 * @returns {string} User-friendly error message
 */
export function getAuthErrorMessage(error: any): string {
  if (!error) return 'An unknown error occurred';
  
  const message = error.message || error.toString();
  
  if (message.includes('refresh') || message.includes('token')) {
    return 'Your session has expired. Please log in again.';
  }
  
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  if (message.includes('unauthorized') || message.includes('401')) {
    return 'You are not authorized. Please log in again.';
  }
  
  return 'An error occurred. Please try again.';
}

/**
 * Clears all auth-related storage
 * Useful for logout or when recovering from auth errors
 */
export function clearAuthStorage(): void {
  try {
    debugLog('🧹 Clearing auth storage...');
    
    if (typeof window !== 'undefined') {
      // Clear localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-') || key.includes('auth'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      debugLog('✅ Auth storage cleared');
    }
  } catch (error) {
    debugLog('⚠️ Error clearing auth storage:', error);
  }
}

