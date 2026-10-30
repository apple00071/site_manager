'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Branch, BranchFilter, BRANCHES, DEFAULT_BRANCH, isValidBranch } from '@/lib/branch-constants';

interface BranchContextType {
  currentBranch: BranchFilter;
  userBranch: Branch;
  isAdmin: boolean;
  isAllBranches: boolean;
  availableBranches: readonly Branch[];
  setBranch: (branch: BranchFilter) => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();

  // Strict check: Only Super Admin (admin@appleinteriors.in) has global multi-branch access
  const isSuperAdmin = Boolean(
    user?.email?.toLowerCase() === 'admin@appleinteriors.in' ||
    (isAdmin && !(user as any)?.branch && !user?.user_metadata?.branch)
  );

  // User's assigned branch
  const userBranch: Branch = (
    isValidBranch((user as any)?.branch)
      ? (user as any).branch
      : isValidBranch(user?.user_metadata?.branch)
      ? user?.user_metadata?.branch
      : DEFAULT_BRANCH
  );

  // Active branch:
  // - If Super Admin: can be 'all' | 'Kukatpally' | 'AS Rao Nagar' (persisted in localStorage/cookies)
  // - If non-admin: strictly locked to userBranch
  const [currentBranch, setCurrentBranchState] = useState<BranchFilter>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('active_branch');
        if (saved === 'all' || isValidBranch(saved)) {
          return saved as BranchFilter;
        }
      } catch {}
    }
    return 'all';
  });

  // Sync when user changes or role loads
  useEffect(() => {
    if (!isLoading && user) {
      if (!isSuperAdmin) {
        // Non-admin is strictly locked to their branch
        setCurrentBranchState(userBranch);
        try {
          localStorage.setItem('active_branch', userBranch);
          document.cookie = `active_branch=${encodeURIComponent(userBranch)}; path=/; max-age=31536000; SameSite=Lax`;
        } catch {}
      } else {
        // Super Admin: read saved preference or default to 'all'
        try {
          const saved = localStorage.getItem('active_branch');
          if (saved === 'all' || isValidBranch(saved)) {
            setCurrentBranchState(saved as BranchFilter);
            document.cookie = `active_branch=${encodeURIComponent(saved)}; path=/; max-age=31536000; SameSite=Lax`;
          }
        } catch {}
      }
    }
  }, [isLoading, user, isSuperAdmin, userBranch]);

  const setBranch = useCallback((branch: BranchFilter) => {
    if (!isSuperAdmin) {
      // Non-admins cannot switch branches
      return;
    }

    if (branch === 'all' || isValidBranch(branch)) {
      setCurrentBranchState(branch);
      try {
        localStorage.setItem('active_branch', branch);
        document.cookie = `active_branch=${encodeURIComponent(branch)}; path=/; max-age=31536000; SameSite=Lax`;
        // Dispatch custom event for reactive refresh across components
        window.dispatchEvent(new CustomEvent('branch_changed', { detail: { branch } }));
      } catch {}
    }
  }, [isSuperAdmin]);

  const value: BranchContextType = {
    currentBranch: isSuperAdmin ? currentBranch : userBranch,
    userBranch,
    isAdmin: isSuperAdmin,
    isAllBranches: isSuperAdmin && currentBranch === 'all',
    availableBranches: BRANCHES,
    setBranch,
  };

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch(): BranchContextType {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}
