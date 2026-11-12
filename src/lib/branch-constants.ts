export const BRANCHES = ['Kukatpally', 'AS Rao Nagar'] as const;
export type Branch = typeof BRANCHES[number];
export type BranchFilter = 'all' | Branch;

export const DEFAULT_BRANCH: Branch = 'Kukatpally';

export function isValidBranch(val: any): val is Branch {
  return BRANCHES.includes(val);
}

export interface BranchDetails {
  name: Branch;
  city: string;
  phone: string;
  phoneDisplay: string;
  phones: string[];
  address: string;
  fullAddress: string;
  website: string;
  headerLocation: string;
}

export const BRANCH_DETAILS: Record<Branch, BranchDetails> = {
  'Kukatpally': {
    name: 'Kukatpally',
    city: 'Hyderabad',
    phone: '+91 9603 9603 37',
    phoneDisplay: '+91 9603 9603 37 · +91 91606 77899',
    phones: ['+91 9603 9603 37', '+91 91606 77899'],
    address: 'Opp. Pillar No. C1730, Kukatpally, Hyderabad - 500072',
    fullAddress: 'Opp. Pillar No. C1730, Kukatpally, Hyderabad, Telangana 500072',
    website: 'www.appleinteriors.in',
    headerLocation: 'Kukatpally, Hyderabad',
  },
  'AS Rao Nagar': {
    name: 'AS Rao Nagar',
    city: 'Secunderabad',
    phone: '+91 9912 368 368',
    phoneDisplay: '+91 9912 368 368 · +91 90100 94082',
    phones: ['+91 9912 368 368', '+91 90100 94082'],
    address: 'LIG-B-219, Anupuram Colony, AS Rao Nagar, Secunderabad, Telangana 500062',
    fullAddress: 'LIG-B-219, Anupuram Colony, AS Rao Nagar, Secunderabad, Telangana 500062',
    website: 'www.appleinteriors.in',
    headerLocation: 'AS Rao Nagar, Secunderabad',
  },
};

export function getBranchDetails(branch?: string | null): BranchDetails {
  if (branch && isValidBranch(branch)) {
    return BRANCH_DETAILS[branch];
  }
  return BRANCH_DETAILS[DEFAULT_BRANCH];
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

  return false;
}
