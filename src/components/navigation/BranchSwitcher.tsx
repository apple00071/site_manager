'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import { FiChevronDown, FiCheck, FiMapPin, FiLayers } from 'react-icons/fi';
import { BranchFilter } from '@/lib/branch-constants';

export default function BranchSwitcher() {
  const { currentBranch, userBranch, isAdmin, availableBranches, setBranch } = useBranch();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // For non-admin employees: no badge needed, branch scoping is handled seamlessly in the background
  if (!isAdmin) {
    return null;
  }

  // For Admins: dropdown switcher
  const getBranchLabel = (b: BranchFilter) => {
    if (b === 'all') return 'All Branches';
    return b;
  };

  const getMobileLabel = (b: BranchFilter) => {
    if (b === 'all') return 'All';
    if (b === 'AS Rao Nagar') return 'AS Rao';
    if (b === 'Kukatpally') return 'KPHB';
    return b;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-semibold text-gray-800 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
        title="Switch active branch view"
        aria-expanded={isOpen}
      >
        {currentBranch === 'all' ? (
          <FiLayers className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
        ) : (
          <FiMapPin className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
        )}
        <span className="hidden sm:inline max-w-[120px] truncate text-[11px] font-bold">
          {getBranchLabel(currentBranch)}
        </span>
        <span className="sm:hidden text-[11px] font-bold">
          {getMobileLabel(currentBranch)}
        </span>
        <FiChevronDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-48 sm:w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 border-b border-gray-100 mb-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Select Branch Scope
            </p>
          </div>

          {/* Option: All Branches */}
          <button
            type="button"
            onClick={() => {
              setBranch('all');
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
              currentBranch === 'all'
                ? 'bg-yellow-50/80 font-bold text-yellow-950'
                : 'text-gray-700 hover:bg-gray-50 font-medium'
            }`}
          >
            <div className="flex items-center gap-2">
              <FiLayers className="w-3.5 h-3.5 text-yellow-600" />
              <span>All Branches</span>
            </div>
            {currentBranch === 'all' && (
              <FiCheck className="w-3.5 h-3.5 text-yellow-600" />
            )}
          </button>

          {/* Individual Branches */}
          {availableBranches.map((branch) => {
            const isSelected = currentBranch === branch;
            return (
              <button
                key={branch}
                type="button"
                onClick={() => {
                  setBranch(branch);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-yellow-50/80 font-bold text-yellow-950'
                    : 'text-gray-700 hover:bg-gray-50 font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FiMapPin className="w-3.5 h-3.5 text-yellow-600" />
                  <span>{branch}</span>
                </div>
                {isSelected && (
                  <FiCheck className="w-3.5 h-3.5 text-yellow-600" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
