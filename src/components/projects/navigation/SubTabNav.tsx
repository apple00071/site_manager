'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

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
 * Displays below the main workflow stage navigator with a smooth sliding active indicator
 */
export function SubTabNav({ tabs, activeTab, onTabChange, className = '' }: SubTabNavProps) {
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean }>({
        left: 0,
        width: 0,
        ready: false,
    });

    const updateIndicator = useCallback(() => {
        const activeEl = tabRefs.current[activeTab];
        if (activeEl) {
            setIndicator({
                left: activeEl.offsetLeft,
                width: activeEl.offsetWidth,
                ready: true,
            });
        }
    }, [activeTab]);

    // Update indicator and auto-scroll active tab into view on mobile
    useEffect(() => {
        updateIndicator();

        const activeEl = tabRefs.current[activeTab];
        if (activeEl && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollLeft = activeEl.offsetLeft - (container.clientWidth / 2) + (activeEl.clientWidth / 2);
            container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
    }, [activeTab, tabs, updateIndicator]);

    // Recalculate indicator position on window resize
    useEffect(() => {
        window.addEventListener('resize', updateIndicator);
        return () => window.removeEventListener('resize', updateIndicator);
    }, [updateIndicator]);

    if (tabs.length === 0) return null;

    return (
        <div className={`border-b border-gray-200 bg-white ${className}`}>
            <div className="flex items-center px-1">
                <div
                    ref={scrollContainerRef}
                    className="scroll-x-mobile w-full relative"
                    style={{
                        overflowX: 'scroll',
                        overflowY: 'hidden',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    <div className="relative flex items-center h-10" style={{ minWidth: 'max-content' }}>
                        {tabs.map((tab, idx) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <React.Fragment key={tab.id}>
                                    <button
                                        ref={(el) => {
                                            tabRefs.current[tab.id] = el;
                                        }}
                                        onClick={() => onTabChange(tab.id)}
                                        className={`
                                          relative px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer select-none rounded-md
                                          ${isActive
                                                ? 'font-semibold text-gray-900'
                                                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50/80'
                                            }
                                        `}
                                    >
                                        {tab.label}
                                    </button>
                                    {/* Separator */}
                                    {idx < tabs.length - 1 && (
                                        <span className="text-gray-300 mx-0.5 text-[10px] font-light select-none">|</span>
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {/* Smooth Sliding Yellow Underline Indicator */}
                        <div
                            className={`absolute bottom-0 h-[2.5px] bg-[#f0b100] rounded-full pointer-events-none will-change-transform ${
                                indicator.ready ? 'transition-all duration-300 ease-out' : 'transition-none'
                            }`}
                            style={{
                                left: 0,
                                transform: `translateX(${indicator.left}px)`,
                                width: `${indicator.width}px`,
                                opacity: indicator.ready && indicator.width > 0 ? 1 : 0,
                            }}
                        />
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
        { id: 'workers', label: 'Vendor Details' },
    ],
    requirement: [
        { id: 'notes', label: 'Site Notes', permission: 'requirements.view' },
    ],
    design: [
        { id: 'files', label: 'Design Files' },
        { id: 'task_history', label: 'Design Task History' },
    ],
    boq: [
        { id: 'boq', label: 'BOQ Items', permission: 'boq.view' },
        { id: 'laminate', label: 'Laminate', permission: 'boq.view' },
        { id: 'delivery_bills', label: 'Delivery Bills', permission: 'boq.view' },
    ],
    work_progress: [
        { id: 'updates', label: 'Updates', permission: 'updates.view' },
    ],
    snag: [
        { id: 'snag_list', label: 'Snag List', permission: 'snags.view' },
    ],
    finance: [
        { id: 'overview', label: 'Payments', permission: 'finance.view' },
        { id: 'expenses', label: 'Project Expenses', permission: 'inventory.view' },
    ],
};

// Get default sub-tab for a stage
export function getDefaultSubTab(stageId: string): string {
    const tabs = STAGE_SUB_TABS[stageId];
    return tabs && tabs.length > 0 ? tabs[0].id : 'details';
}
