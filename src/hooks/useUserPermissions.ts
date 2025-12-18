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

// Cache for permissions to avoid refetching on every component mount
let permissionsCache: { permissions: Record<string, boolean>; isAdmin: boolean } | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to fetch and check user permissions in the frontend.
 * Provides utility functions to check if user has specific permissions.
 */
export function useUserPermissions(): UseUserPermissionsReturn {
    const { user, isAdmin: authIsAdmin } = useAuth();
    const [state, setState] = useState<UserPermissions>({
        permissions: permissionsCache?.permissions || {},
        isAdmin: permissionsCache?.isAdmin || authIsAdmin || false,
        isLoading: !permissionsCache,
        error: null,
    });

    const fetchPermissions = useCallback(async () => {
        if (!user) {
            setState(prev => ({
                ...prev,
                permissions: {},
                isAdmin: false,
                isLoading: false,
            }));
            return;
        }

        // Check cache validity
        const now = Date.now();
        if (permissionsCache && (now - cacheTimestamp) < CACHE_DURATION) {
            setState(prev => ({
                ...prev,
                permissions: permissionsCache!.permissions,
                isAdmin: permissionsCache!.isAdmin,
                isLoading: false,
            }));
            return;
        }

        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            const response = await fetch('/api/rbac/user-permissions');

            if (!response.ok) {
                throw new Error('Failed to fetch permissions');
            }

            const data = await response.json();

            // Update cache
            permissionsCache = {
                permissions: data.permissions || {},
                isAdmin: data.isAdmin || false,
            };
            cacheTimestamp = now;

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
        return !!state.permissions[code];
    }, [state.isAdmin, state.permissions]);

    /**
     * Check if user has ANY of the specified permissions.
     */
    const hasAnyPermission = useCallback((codes: string[]): boolean => {
        if (state.isAdmin || state.permissions['*']) return true;
        return codes.some(code => !!state.permissions[code]);
    }, [state.isAdmin, state.permissions]);

    /**
     * Check if user has ALL of the specified permissions.
     */
    const hasAllPermissions = useCallback((codes: string[]): boolean => {
        if (state.isAdmin || state.permissions['*']) return true;
        return codes.every(code => !!state.permissions[code]);
    }, [state.isAdmin, state.permissions]);

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
    permissionsCache = null;
    cacheTimestamp = 0;
}
