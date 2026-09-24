'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import UsersTab from './UsersTab';
import RolesTab from './RolesTab';
import BasicDetailsTab from './BasicDetailsTab';
import ApprovalHierarchyTab from './ApprovalHierarchyTab';
import HolidaysTab from './HolidaysTab';
import BroadcastTab from './BroadcastTab';
import AdminPayrollDashboard from '@/components/payroll/AdminPayrollDashboard';
import { useSearchParams } from 'next/navigation';

import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { useEffect } from 'react';
import { CustomDropdown } from '@/components/ui/CustomControls';

export default function OrganizationPage() {
  const { isLoading: authLoading } = useAuth();
  const { hasPermission, hasAnyPermission, isAdmin, isLoading: permLoading } = useUserPermissions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTitle, setSubtitle } = useHeaderTitle();

  const canAccessUsers = hasAnyPermission(['users.view', 'users.create', 'users.edit', 'users.delete']);
  const canAccessRoles = hasPermission('users.manage_roles');
  const canAccessBasic = hasAnyPermission(['settings.view', 'settings.edit']);
  const canAccessApprovals = hasAnyPermission(['settings.workflows', 'settings.edit', 'settings.view']);
  const canAccessHolidays = hasAnyPermission(['holidays.view', 'holidays.manage']);
  const canAccessPayroll = Boolean(isAdmin || hasAnyPermission(['payroll.view', 'payroll.manage']));
  const canAccessBroadcast = hasAnyPermission(['popups.view', 'popups.manage']);

  const tabs = [
    canAccessUsers && { id: 'users', label: 'Users' },
    canAccessRoles && { id: 'roles', label: 'Roles' },
    canAccessBasic && { id: 'basic', label: 'Basic Details' },
    canAccessApprovals && { id: 'approvals', label: 'Approval Hierarchy' },
    canAccessHolidays && { id: 'holidays', label: 'Holidays' },
    canAccessPayroll && { id: 'payroll', label: 'Payroll' },
    canAccessBroadcast && { id: 'broadcast', label: 'In-App Popups' },
  ].filter(Boolean) as { id: string; label: string }[];

  const initialTab = searchParams.get('tab') || (tabs[0]?.id ?? 'users');
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setTitle('Org Settings');
    setSubtitle(null);
  }, [setTitle, setSubtitle]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tabs.some(t => t.id === tab)) {
      setActiveTab(tab);
    } else if (tabs.length > 0 && !tabs.some(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [searchParams, tabs, activeTab]);

  if (authLoading || permLoading) return <div>Loading...</div>;
  if (tabs.length === 0) {
    router.push('/dashboard');
    return null;
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Mobile Tab Selector */}
      <div className="lg:hidden">
        <CustomDropdown
          value={activeTab}
          onChange={(val) => setActiveTab(val)}
          options={tabs.map(tab => ({ id: tab.id, title: tab.label }))}
          placeholder="Select Section"
        />
      </div>

      {/* Desktop Tabs */}
      <div className="hidden lg:block border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'roles' && <RolesTab />}
        {activeTab === 'basic' && <BasicDetailsTab />}
        {activeTab === 'approvals' && <ApprovalHierarchyTab />}
        {activeTab === 'holidays' && <HolidaysTab />}
        {activeTab === 'payroll' && <AdminPayrollDashboard />}
        {activeTab === 'broadcast' && <BroadcastTab />}
      </div>
    </div>
  );
}
