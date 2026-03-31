'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UserPermissions {
    permissions: Record<string, boolean>;
    isAdmin: boolean;
    isLoading: boolean;
    error: string | null;
}

interface UseUserPermissionsReturn extends UserPermissions {
    hasPermission: (code: string) => boolean;
    hasAnyPermission: (codes: string[]) => boolean;
    hasAllPermissions: (codes: string[]) => boolean;
    refetch: () => Promise<void>;
}

// Cache constants
const CACHE_KEY = 'user_permissions_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Concurrency control: single promise for all in-flight permission requests
let pendingPermissionsRequest: Promise<any> | null = null;

/**
 * Get permissions from sessionStorage
 */
function getCachedPermissions() {
    if (typeof window === 'undefined') return null;
    try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > CACHE_DURATION) {
            sessionStorage.removeItem(CACHE_KEY);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

/**
 * Save permissions to sessionStorage
 */
function setCachedPermissions(data: any) {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch { }
}

/**
 * Hook to fetch and check user permissions in the frontend.
 * Provides utility functions to check if user has specific permissions.
 */
export function useUserPermissions(): UseUserPermissionsReturn {
    const { user, isAdmin: authIsAdmin } = useAuth();
    
    // Initialize state from cache if available for immediate UI response
    const initialCache = getCachedPermissions();
    
    const [state, setState] = useState<UserPermissions>({
        permissions: initialCache?.permissions || {},
        isAdmin: initialCache?.isAdmin || authIsAdmin || false,
        isLoading: !initialCache && !!user,
        error: null,
    });

    const fetchPermissions = useCallback(async (forceRefresh = false) => {
        if (!user) {
            setState(prev => ({
                ...prev,
                permissions: {},
                isAdmin: false,
                isLoading: false,
            }));
            return;
        }

        // 1. Check cache first (unless forced)
        if (!forceRefresh) {
            const cached = getCachedPermissions();
            if (cached) {
                setState({
                    permissions: cached.permissions,
                    isAdmin: cached.isAdmin,
                    isLoading: false,
                    error: null
                });
                return;
            }
        }

        // 2. Handle concurrent requests (batching)
        if (pendingPermissionsRequest) {
            try {
                const data = await pendingPermissionsRequest;
                setState({
                    permissions: data.permissions || {},
                    isAdmin: data.isAdmin || false,
                    isLoading: false,
                    error: null
                });
                return;
            } catch (err) {
                // If the shared request fails, we'll fall through to our own retry below
            }
        }

        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            // Create the shared promise
            const fetchPromise = fetch('/api/rbac/user-permissions').then(async res => {
                if (!res.ok) throw new Error('Failed to fetch permissions');
                return res.json();
            });
            pendingPermissionsRequest = fetchPromise;

            const data = await fetchPromise;

            // 3. Update cache
            setCachedPermissions({
                permissions: data.permissions || {},
                isAdmin: data.isAdmin || false
            });

            setState({
                permissions: data.permissions || {},
                isAdmin: data.isAdmin || false,
                isLoading: false,
                error: null,
            });
        } catch (error: any) {
            console.error('Error fetching user permissions:', error);
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error.message || 'Failed to fetch permissions',
            }));
        } finally {
            pendingPermissionsRequest = null;
        }
    }, [user]);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    /**
     * Check if user has a specific permission.
     * Admin users always return true.
     */
    const hasPermission = useCallback((code: string): boolean => {
        if (state.isAdmin || state.permissions['*']) return true;
        if (state.permissions[code]) return true;

        // Check for wildcard permissions (e.g. 'snags.*' matches 'snags.edit')
        const parts = code.split('.');
        if (parts.length > 1) {
            const wildcardCode = `${parts[0]}.*`;
            if (state.permissions[wildcardCode]) return true;
        }

        return false;
    }, [state.isAdmin, state.permissions]);

    /**
     * Check if user has ANY of the specified permissions.
     */
    const hasAnyPermission = useCallback((codes: string[]): boolean => {
        if (state.isAdmin || state.permissions['*']) return true;
        return codes.some(code => hasPermission(code));
    }, [state.isAdmin, state.permissions, hasPermission]);

    /**
     * Check if user has ALL of the specified permissions.
     */
    const hasAllPermissions = useCallback((codes: string[]): boolean => {
        if (state.isAdmin || state.permissions['*']) return true;
        return codes.every(code => hasPermission(code));
    }, [state.isAdmin, state.permissions, hasPermission]);

    return {
        ...state,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        refetch: fetchPermissions,
    };
}

/**
 * Clear the permissions cache.
 * Call this when user logs out or role changes.
 */
export function clearPermissionsCache() {
    if (typeof window !== 'undefined') {
        try {
            sessionStorage.removeItem(CACHE_KEY);
        } catch { }
    }
}
