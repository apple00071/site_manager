'use server';

/**
 * RBAC — zero extra DB hits when called with an AuthUser.
 *
 * Old path: every checkPermission() → 2 DB queries (users + role_permissions).
 * New path: pass the AuthUser returned by getAuthUser() → pure Set lookup, 0 DB hits.
 *
 * Legacy path (userId-only) still works but hits DB; migrate callers over time.
 * ponytail: keep the DB fallback so old routes don't break.
 */

import { supabaseAdmin, type AuthUser } from '@/lib/supabase-server';
import { PERMISSION_NODES, PermissionNode } from './rbac-constants';

export type { PermissionNode };

interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

const ALIAS_PREFIX_MAP: Record<string, string> = {
  project: 'projects', projects: 'project',
  design: 'designs', designs: 'design',
  order: 'orders', orders: 'order',
  invoice: 'invoices', invoices: 'invoice',
  payment: 'payments', payments: 'payment',
  supplier: 'suppliers', suppliers: 'supplier',
  worker: 'workers', workers: 'worker',
  vendor: 'vendors', vendors: 'vendor',
  task: 'tasks', tasks: 'task',
  user: 'users', users: 'user',
  update: 'updates', updates: 'update',
  snag: 'snags', snags: 'snag',
  holiday: 'holidays', holidays: 'holiday',
  leave: 'leaves', leaves: 'leave',
  popup: 'popups', popups: 'popup',
};

function getCodeVariants(code: string): string[] {
  const variants = [code];
  const dotIndex = code.indexOf('.');
  if (dotIndex > 0) {
    const prefix = code.slice(0, dotIndex);
    const rest = code.slice(dotIndex + 1);
    const alt = ALIAS_PREFIX_MAP[prefix];
    if (alt) variants.push(`${alt}.${rest}`);
  }
  return variants;
}

function matchesSet(codes: Set<string>, node: PermissionNode): boolean {
  if (codes.has('*')) return true;
  for (const variant of getCodeVariants(node)) {
    if (codes.has(variant)) return true;
    // wildcard prefix match e.g. "projects.*"
    const dot = variant.indexOf('.');
    if (dot > 0 && codes.has(variant.slice(0, dot) + '.*')) return true;
  }
  return false;
}

// In-memory cache for legacy userId string queries:
// ponytail: short 60s cache eliminates duplicate DB hits across routes that pass userId
interface CachedLegacyPerm {
  isAdmin: boolean;
  codes: Set<string>;
  expiresAt: number;
}
const legacyPermCache = new Map<string, CachedLegacyPerm>();
const LEGACY_CACHE_TTL = 60_000;

export function invalidateLegacyPermCache(userId?: string) {
  if (userId) {
    legacyPermCache.delete(userId);
  } else {
    legacyPermCache.clear();
  }
}

/**
 * Check permission.
 * - Fast path: pass `user` (AuthUser) → pure in-memory Set lookup, 0 DB hits.
 * - Slow path: pass `userId` (string) → 60s in-memory cached lookup.
 */
export async function checkPermission(
  userOrId: AuthUser | string,
  permissionNode: PermissionNode,
  projectId?: string,
): Promise<PermissionCheckResult> {
  try {
    // Fast path — caller already has the AuthUser with permissionCodes loaded
    if (typeof userOrId !== 'string') {
      const user = userOrId;
      if (user.isAdmin || matchesSet(user.permissionCodes, permissionNode)) {
        return { allowed: true };
      }
      // project-level override still needs a DB hit (rare case)
      if (projectId) {
        const { data: member } = await supabaseAdmin
          .from('project_members')
          .select('permissions')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (member?.permissions) {
          const p = member.permissions as string[];
          if (p.includes(permissionNode as string) || p.includes('*')) return { allowed: true };
        }
      }
      return { allowed: false, reason: 'Permission denied' };
    }

    // Legacy path (userId string) — cached for 60s to avoid repeated DB queries
    const userId = userOrId;
    const now = Date.now();
    const cached = legacyPermCache.get(userId);

    let isAdmin = false;
    let codes = new Set<string>();

    if (cached && now < cached.expiresAt) {
      isAdmin = cached.isAdmin;
      codes = cached.codes;
    } else {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('role, role_id, roles(name)')
        .eq('id', userId)
        .single();

      if (!userData) return { allowed: false, reason: 'User not found' };

      isAdmin =
        userData.role?.toLowerCase() === 'admin' ||
        (userData.roles as any)?.name?.toLowerCase() === 'admin';

      if (!isAdmin && userData.role_id) {
        const { data: rolePermissions } = await supabaseAdmin
          .from('role_permissions')
          .select('permissions(code)')
          .eq('role_id', userData.role_id);

        codes = new Set<string>(
          (rolePermissions || []).map((rp: any) => rp.permissions?.code).filter(Boolean)
        );
      }

      legacyPermCache.set(userId, { isAdmin, codes, expiresAt: now + LEGACY_CACHE_TTL });
    }

    if (isAdmin) return { allowed: true };
    if (matchesSet(codes, permissionNode)) return { allowed: true };

    if (projectId) {
      const { data: member } = await supabaseAdmin
        .from('project_members')
        .select('permissions')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle();
      if (member?.permissions) {
        const p = member.permissions as string[];
        if (p.includes(permissionNode as string) || p.includes('*')) return { allowed: true };
      }
    }

    return { allowed: false, reason: 'Permission denied' };
  } catch (err) {
    console.error('Permission check error:', err);
    return { allowed: false, reason: 'Permission check failed' };
  }
}

export async function verifyPermission(
  userOrId: AuthUser | string,
  permissionNode: PermissionNode,
  projectId?: string,
): Promise<{ allowed: true } | { allowed: false; status: 403; message: string }> {
  const result = await checkPermission(userOrId, permissionNode, projectId);
  return result.allowed
    ? { allowed: true }
    : { allowed: false, status: 403, message: `Permission denied: ${permissionNode} is required` };
}

export async function hasAnyPermission(
  userOrId: AuthUser | string,
  permissionNodes: PermissionNode[],
  projectId?: string,
): Promise<boolean> {
  // Fast path when AuthUser is available
  if (typeof userOrId !== 'string') {
    if (userOrId.isAdmin) return true;
    return permissionNodes.some(node => matchesSet(userOrId.permissionCodes, node));
  }
  for (const node of permissionNodes) {
    const result = await checkPermission(userOrId, node, projectId);
    if (result.allowed) return true;
  }
  return false;
}

export async function hasAllPermissions(
  userOrId: AuthUser | string,
  permissionNodes: PermissionNode[],
  projectId?: string,
): Promise<boolean> {
  if (typeof userOrId !== 'string') {
    if (userOrId.isAdmin) return true;
    return permissionNodes.every(node => matchesSet(userOrId.permissionCodes, node));
  }
  for (const node of permissionNodes) {
    const result = await checkPermission(userOrId, node, projectId);
    if (!result.allowed) return false;
  }
  return true;
}
