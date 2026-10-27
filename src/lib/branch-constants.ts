export const BRANCHES = ['Kukatpally', 'AS Rao Nagar'] as const;
export type Branch = typeof BRANCHES[number];
export type BranchFilter = 'all' | Branch;

export const DEFAULT_BRANCH: Branch = 'Kukatpally';

export function isValidBranch(val: any): val is Branch {
  return BRANCHES.includes(val);
}
