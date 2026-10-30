export const BRANCHES = ['Kukatpally', 'AS Rao Nagar'] as const;
export type Branch = typeof BRANCHES[number];
export type BranchFilter = 'all' | Branch;

export const DEFAULT_BRANCH: Branch = 'Kukatpally';

export function isValidBranch(val: any): val is Branch {
  return BRANCHES.includes(val);
}

/**
 * Resolves whether a user is a Super Admin based purely on role & designation.
 * - Real system admins have role strictly 'admin' (Aravind & Pavan).
 * - Changing 'Admin HR' to 'HR' keeps HR users scoped to their branch without admin privileges.
 */
export function isSuperAdminUser(user: any): boolean {
  if (!user) return false;

  const role = (
    user.role ||
    user.roles?.name ||
    user.user_metadata?.role ||
    ''
  ).trim().toLowerCase();

  const designation = (
    user.designation ||
    user.user_metadata?.designation ||
    ''
  ).trim().toLowerCase();

  // Role must be strictly 'admin' (not 'admin hr', 'hr', 'employee', etc.)
  if (role === 'admin') {
    return true;
  }

  // IT designation with admin privileges
  if (designation === 'it' && (user.isAdmin || role === 'admin')) {
    return true;
  }

  // Admin designation without HR role
  if (designation === 'admin' && !role.includes('hr')) {
    return true;
  }

  return false;
}
