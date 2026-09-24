'use client';
// ponytail: robust RBAC client hook with user-scoped sessionStorage and bidirectional singular/plural alias normalization

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
const CACHE_PREFIX = 'user_permissions_cache_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Concurrency control: single promise for in-flight permission requests
let pendingPermissionsRequest: Promise<any> | null = null;

// Bidirectional singular <-> plural alias map for permission prefixes
const ALIAS_PREFIX_MAP: Record<string, string> = {
    project: 'projects',
    projects: 'project',
    design: 'designs',
    designs: 'design',
    order: 'orders',
    orders: 'order',
    invoice: 'invoices',
    invoices: 'invoice',
    payment: 'payments',
    payments: 'payment',
    supplier: 'suppliers',
    suppliers: 'supplier',
    worker: 'workers',
    workers: 'worker',
    vendor: 'vendors',
    vendors: 'vendor',
    task: 'tasks',
    tasks: 'task',
    user: 'users',
    users: 'user',
    update: 'updates',
    updates: 'update',
    snag: 'snags',
    snags: 'snag',
    holiday: 'holidays',
    holidays: 'holiday',
    leave: 'leaves',
    leaves: 'leave'
};

function getCodeVariants(code: string): string[] {
    const variants = [code];
    const dotIndex = code.indexOf('.');
    if (dotIndex > 0) {
        const prefix = code.slice(0, dotIndex);
        const rest = code.slice(dotIndex + 1);
        const alternatePrefix = ALIAS_PREFIX_MAP[prefix];
        if (alternatePrefix) {
            variants.push(`${alternatePrefix}.${rest}`);
        }
    }
    return variants;
}

/**
 * Get permissions from sessionStorage scoped by user ID
 */
function getCachedPermissions(userId?: string) {
    if (typeof window === 'undefined' || !userId) return null;
    try {
        const cached = sessionStorage.getItem(`${CACHE_PREFIX}${userId}`);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > CACHE_DURATION) {
            sessionStorage.removeItem(`${CACHE_PREFIX}${userId}`);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

/**
 * Save permissions to sessionStorage scoped by user ID
 */
function setCachedPermissions(userId: string, data: any) {
    if (typeof window === 'undefined' || !userId) return;
    try {
        sessionStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify({
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
    const { user } = useAuth();
    const userId = user?.id;

    // Initialize state from cache if available for immediate UI response
    const initialCache = getCachedPermissions(userId);

    const [state, setState] = useState<UserPermissions>({
        permissions: initialCache?.permissions || {},
        isAdmin: initialCache?.isAdmin || false,
        isLoading: !initialCache && !!user,
        error: null,
    });

    const fetchPermissions = useCallback(async (forceRefresh = false) => {
        if (!userId) {
            setState({
                permissions: {},
                isAdmin: false,
                isLoading: false,
                error: null,
            });
            return;
        }

        // Stale-while-revalidate: if cache exists and not forced, hydrate state immediately without returning early
        const cached = getCachedPermissions(userId);
        if (cached && !forceRefresh) {
            setState(prev => ({
                ...prev,
                permissions: cached.permissions || {},
                isAdmin: cached.isAdmin || false,
                isLoading: false,
            }));
        }

        // Handle concurrent requests (batching)
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
                // If shared request fails, fall through to own fetch
            }
        }

        try {
            // Only show loading spinner if we don't have any cached permissions yet
            if (!cached || forceRefresh) {
                setState(prev => ({ ...prev, isLoading: true, error: null }));
            }

            const fetchPromise = fetch('/api/rbac/user-permissions').then(async res => {
                if (!res.ok) throw new Error('Failed to fetch permissions');
                return res.json();
            });
            pendingPermissionsRequest = fetchPromise;

            const data = await fetchPromise;

            // Update cache scoped by userId
            setCachedPermissions(userId, {
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
    }, [userId]);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    // Listen for custom permissions-updated event (e.g., when roles/permissions are saved in RolesTab)
    useEffect(() => {
        const handleUpdate = () => {
            fetchPermissions(true);
        };
        window.addEventListener('permissions-updated', handleUpdate);
        return () => window.removeEventListener('permissions-updated', handleUpdate);
    }, [fetchPermissions]);

    /**
     * Check if user has a specific permission.
     * Admin users always return true.
     * Checks both direct code and singular/plural aliases, as well as wildcards.
     */
    const hasPermission = useCallback((code: string): boolean => {
        if (state.isAdmin || state.permissions['*']) return true;
        if (!code) return false;

        const variants = getCodeVariants(code);
        for (const variant of variants) {
            if (state.permissions[variant]) return true;

            const parts = variant.split('.');
            if (parts.length > 1) {
                const wildcardCode = `${parts[0]}.*`;
                if (state.permissions[wildcardCode]) return true;
            }
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
        refetch: () => fetchPermissions(true),
    };
}

/**
 * Clear permissions cache.
 * Call this when user logs out or role changes.
 */
export function clearPermissionsCache(userId?: string) {
    if (typeof window !== 'undefined') {
        try {
            if (userId) {
                sessionStorage.removeItem(`${CACHE_PREFIX}${userId}`);
            } else {
                for (let i = sessionStorage.length - 1; i >= 0; i--) {
                    const key = sessionStorage.key(i);
                    if (key && (key.startsWith(CACHE_PREFIX) || key === 'user_permissions_cache')) {
                        sessionStorage.removeItem(key);
                    }
                }
            }
        } catch { }
    }
}

