export const BRANCHES = ['Kukatpally', 'AS Rao Nagar'] as const;
export type Branch = typeof BRANCHES[number];
export type BranchFilter = 'all' | Branch;

export const DEFAULT_BRANCH: Branch = 'Kukatpally';

export function isValidBranch(val: any): val is Branch {
  return BRANCHES.includes(val);
}

export const SUPER_ADMIN_EMAILS = [
  'admin@appleinteriors.in',
  'pavankumarv1497@gmail.com',
] as const;

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase() as any);
}

export function isSuperAdminUser(user: any): boolean {
  if (!user) return false;
  const email = (user.email || user.user_metadata?.email || '').trim().toLowerCase();
  return isSuperAdminEmail(email);
}
