'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import UsersTab from './UsersTab';
import RolesTab from './RolesTab';
import BasicDetailsTab from './BasicDetailsTab';
import ApprovalHierarchyTab from './ApprovalHierarchyTab';
import HolidaysTab from './HolidaysTab';
import BroadcastTab from './BroadcastTab';
import { useSearchParams } from 'next/navigation';

import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { useEffect } from 'react';

export default function OrganizationPage() {
  const { isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'users';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { setTitle, setSubtitle } = useHeaderTitle();

  useEffect(() => {
    setTitle('Org Settings');
    setSubtitle(null);
  }, [setTitle, setSubtitle]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  if (isLoading) return <div>Loading...</div>;
  if (!isAdmin) {
    router.push('/dashboard');
    return null;
  }

  const tabs = [
    { id: 'users', label: 'Users' },
    { id: 'roles', label: 'Roles' },
    { id: 'basic', label: 'Basic Details' },
    { id: 'approvals', label: 'Approval Hierarchy' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'broadcast', label: 'Broadcast' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Mobile Tab Selector */}
      <div className="lg:hidden">
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>{tab.label}</option>
          ))}
        </select>
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
        {activeTab === 'broadcast' && <BroadcastTab />}
      </div>
    </div>
  );
}
