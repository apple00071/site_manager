import { NextRequest } from 'next/server';
import { AuthUser } from '@/lib/supabase-server';
import { Branch, BranchFilter, DEFAULT_BRANCH, isValidBranch, isSuperAdminUser } from '@/lib/branch-constants';

/**
 * Resolves the active branch for a request:
 * - For non-super-admins: STRICTLY returns their assigned branch (or DEFAULT_BRANCH).
 * - For super-admins: Reads from x-branch header, ?branch query param, or active_branch cookie. Defaults to 'all'.
 */
export function getActiveBranch(request: NextRequest, user: AuthUser): BranchFilter {
  if (isSuperAdminUser(user)) {
    // 1. Header
    const headerBranch = request.headers.get('x-branch');
    if (headerBranch === 'all' || isValidBranch(headerBranch)) {
      return headerBranch as BranchFilter;
    }

    // 2. Query param
    const { searchParams } = new URL(request.url);
    const queryBranch = searchParams.get('branch');
    if (queryBranch === 'all' || isValidBranch(queryBranch)) {
      return queryBranch as BranchFilter;
    }

    // 3. Cookie
    const cookieBranch = request.cookies.get('active_branch')?.value;
    if (cookieBranch === 'all' || isValidBranch(cookieBranch)) {
      return cookieBranch as BranchFilter;
    }

    return 'all';
  }

  // Non-super-admin user: strictly scoped to their assigned branch
  const userBranch = user.branch || user.user_metadata?.branch;
  if (isValidBranch(userBranch)) {
    return userBranch;
  }

  return DEFAULT_BRANCH;
}
