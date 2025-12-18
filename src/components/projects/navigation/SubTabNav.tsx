'use client';

import React from 'react';

export interface SubTab {
    id: string;
    label: string;
    permission?: string;
}

interface SubTabNavProps {
    tabs: SubTab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    className?: string;
}

/**
 * Horizontal sub-tab navigation component
 * Displays below the main workflow stage navigator
 */
export function SubTabNav({ tabs, activeTab, onTabChange, className = '' }: SubTabNavProps) {
    if (tabs.length === 0) return null;

    return (
        <div
            className={`border-b border-gray-200 bg-white scroll-x-mobile ${className}`}
            style={{
                overflowX: 'scroll',
                overflowY: 'hidden',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
                width: '100%',
                position: 'relative'
            }}
        >
            <div
                className="flex gap-0 px-4"
                style={{
                    display: 'inline-flex',
                    minWidth: '100%',
                    width: 'max-content'
                }}
            >
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
              relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0
              ${activeTab === tab.id
                                ? 'text-yellow-600'
                                : 'text-gray-500 hover:text-gray-700'
                            }
            `}
                    >
                        {tab.label}
                        {/* Active indicator */}
                        {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}

// Define sub-tabs for each workflow stage
export const STAGE_SUB_TABS: Record<string, SubTab[]> = {
    visit: [
        { id: 'details', label: 'Project Details' },
        { id: 'workers', label: 'Worker Details' },
    ],
    design: [],
    boq: [
        { id: 'boq', label: 'BOQ Items', permission: 'boq.view' },
    ],
    orders: [
        { id: 'proposals', label: 'Proposals For Client', permission: 'proposals.view' },
        { id: 'client_orders', label: 'Client Orders', permission: 'orders.view' },
        { id: 'client_invoices', label: 'Client Invoices', permission: 'invoices.view' },
        { id: 'payments_from_client', label: 'Payments From Client', permission: 'payments.view' },
        { id: 'my_scope', label: 'My Scope', permission: 'procurement.view' },
    ],
    work_progress: [
        { id: 'inventory', label: 'Inventory', permission: 'inventory.view' },
        { id: 'daily_logs', label: 'Daily Logs', permission: 'site_logs.view' },
        { id: 'updates', label: 'Updates', permission: 'updates.view' },
    ],
    snag: [
        { id: 'snag_list', label: 'Snag List', permission: 'snags.view' },
    ],
    finance: [
        { id: 'finance_overview', label: 'Finance Overview', permission: 'finance.view' },
    ],
};

// Get default sub-tab for a stage
export function getDefaultSubTab(stageId: string): string {
    const tabs = STAGE_SUB_TABS[stageId];
    return tabs && tabs.length > 0 ? tabs[0].id : 'details';
}
