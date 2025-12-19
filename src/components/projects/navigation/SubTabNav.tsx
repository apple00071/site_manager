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
        <div className={`border-b border-gray-200 bg-white ${className}`}>
            <div className="flex items-center px-1">
                <div
                    className="scroll-x-mobile w-full"
                    style={{
                        overflowX: 'scroll',
                        overflowY: 'hidden',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    <div className="flex items-center h-10" style={{ minWidth: 'max-content' }}>
                        {tabs.map((tab, idx) => (
                            <React.Fragment key={tab.id}>
                                <button
                                    onClick={() => onTabChange(tab.id)}
                                    className={`
                                      relative px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0
                                      ${activeTab === tab.id
                                            ? 'text-gray-900 border-b-2 border-yellow-500'
                                            : 'text-gray-500 hover:text-gray-700'
                                        }
                                    `}
                                >
                                    {tab.label}
                                </button>
                                {/* Separator */}
                                {idx < tabs.length - 1 && (
                                    <span className="text-gray-300 mx-0.5 text-[10px] font-light">|</span>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
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
