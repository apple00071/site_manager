// ... imports
import React, { useRef, useEffect, useState } from 'react';
import { FiCheck, FiClock, FiCircle, FiChevronDown } from 'react-icons/fi';

export type StageId = 'visit' | 'design' | 'boq' | 'orders' | 'work_progress' | 'snag' | 'finance';

interface Stage {
    id: StageId;
    label: string;
    status: 'completed' | 'current' | 'upcoming';
}

export interface ActionItem {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: 'primary' | 'danger' | 'default';
}

export interface StageStatus {
    label: string;
    value: string;
    color: 'orange' | 'green' | 'blue' | 'gray';
}

interface StageNavigatorProps {
    currentStage: StageId;
    onStageSelect: (stage: StageId) => void;
    completedStages?: StageId[];
    actions?: ActionItem[];
    stageStatus?: StageStatus;
    visibleStages?: StageId[]; // If provided, only show these stages
}
// ... STAGES constant
const STAGES: { id: StageId; label: string }[] = [
    { id: 'visit', label: 'Details' },
    { id: 'design', label: 'Design' },
    { id: 'boq', label: 'BOQ' },
    { id: 'orders', label: 'Orders' },
    { id: 'work_progress', label: 'Work Progress' },
    { id: 'snag', label: 'Snag' },
    { id: 'finance', label: 'Finance' },
];

export function StageNavigator({ currentStage, onStageSelect, completedStages = [], actions = [], stageStatus, visibleStages }: StageNavigatorProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showActions, setShowActions] = useState(false);
    const actionsRef = useRef<HTMLDivElement>(null);

    // Filter stages based on visibleStages prop (if provided)
    const filteredStages = visibleStages
        ? STAGES.filter(stage => visibleStages.includes(stage.id))
        : STAGES;

    // ... useEffects

    // Helper for status colors
    const getStatusColors = (color: string) => {
        const map: Record<string, string> = {
            orange: 'bg-orange-50 text-orange-700',
            green: 'bg-green-50 text-green-700',
            blue: 'bg-blue-50 text-blue-700',
            gray: 'bg-gray-50 text-gray-700',
        };
        return map[color] || map.gray;
    };

    return (
        <div className="bg-white border-b border-gray-200 w-full max-w-full sticky top-0 z-10 transition-all duration-200">
            {/* DESKTOP PIPELINE (md+) */}
            <div className="hidden md:flex items-center justify-between px-2 py-1.5">
                <div className="flex-1 flex items-center">
                    {filteredStages.map((stage, index) => {
                        const isActive = currentStage === stage.id;
                        const isCompleted = completedStages.includes(stage.id);
                        const isLast = index === filteredStages.length - 1;

                        const state = isActive ? 'current' : isCompleted ? 'completed' : 'upcoming';

                        return (
                            <div key={stage.id} className="flex items-center">
                                {/* Connector Line */}
                                {index > 0 && (
                                    <div className={`w-8 h-0.5 mx-2 ${state === 'completed' || (isActive && completedStages.includes(filteredStages[index - 1].id)) ? 'bg-teal-500' : 'bg-gray-200 border-t border-dashed border-gray-300'
                                        }`} />
                                )}

                                <button
                                    onClick={() => onStageSelect(stage.id)}
                                    className={`flex items-center gap-2 group ${state === 'upcoming' ? 'opacity-50 hover:opacity-100' : ''
                                        }`}
                                >
                                    <span className={`
                                        flex items-center justify-center w-5 h-5 rounded-full text-[10px] transition-colors
                                        ${state === 'current'
                                            ? 'bg-teal-500 text-white shadow-sm ring-2 ring-teal-100'
                                            : state === 'completed'
                                                ? 'bg-teal-500 text-white'
                                                : 'bg-gray-200 text-gray-500'
                                        }
                                    `}>
                                        {(state === 'completed' || state === 'current') ? <FiCheck className="w-3 h-3" /> : (
                                            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                                        )}
                                    </span>
                                    <span className={`text-sm font-medium ${state === 'current' ? 'text-gray-900' : 'text-gray-500'
                                        }`}>{stage.label}</span>
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Right Action Area */}
                <div className="hidden lg:flex items-center gap-4 pl-4 border-l border-gray-200 ml-4">
                    {/* Dynamic Status Badge */}




                    {/* Primary Actions Dropdown - Brand Color */}
                    <div className="relative" ref={actionsRef}>
                        <button
                            onClick={() => setShowActions(!showActions)}
                            className="btn-primary py-1.5"
                        >
                            <span className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                                    <polyline points="10 17 15 12 10 7"></polyline>
                                    <line x1="15" y1="12" x2="3" y2="12"></line>
                                </svg>
                                Actions
                            </span>
                            <FiChevronDown className={`w-4 h-4 transition-transform ${showActions ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {showActions && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                                {actions.length === 0 ? (
                                    <div className="px-4 py-3 text-xs text-gray-400 text-center">No actions available</div>
                                ) : (
                                    actions.map((action, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                action.onClick();
                                                setShowActions(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50/80 hover:text-gray-900 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0"
                                        >
                                            {action.icon && <span className="text-gray-400">{action.icon}</span>}
                                            <span className="font-medium">{action.label}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MOBILE SCROLL (md-) */}
            <div
                ref={scrollContainerRef}
                className="block md:hidden scroll-x-mobile border-b border-gray-100"
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
                    className="flex gap-2 px-2 py-2"
                    style={{
                        display: 'inline-flex',
                        minWidth: '100%',
                        width: 'max-content'
                    }}
                >
                    {filteredStages.map((stage, index) => {
                        const isActive = currentStage === stage.id;
                        const isCompleted = completedStages.includes(stage.id);

                        const state = isActive ? 'current' : isCompleted ? 'completed' : 'upcoming';

                        return (
                            <button
                                key={stage.id}
                                data-stage={stage.id}
                                onClick={() => onStageSelect(stage.id)}
                                className={`
                                flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
                                ${state === 'current'
                                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-600 ring-offset-1'
                                        : state === 'completed'
                                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                    }
                            `}
                            >
                                <span className={`
                                flex items-center justify-center w-4 h-4 rounded-full text-[10px]
                                ${state === 'current'
                                        ? 'bg-blue-600 text-white'
                                        : state === 'completed'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-200 text-gray-500'
                                    }
                            `}>
                                    {state === 'completed' ? (
                                        <FiCheck className="w-2.5 h-2.5" />
                                    ) : state === 'current' ? (
                                        <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                                    ) : (
                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                                    )}
                                </span>
                                <span className="whitespace-nowrap">{stage.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* MOBILE ACTION TOOLBAR (md-) - NEW ADDITION */}
            <div className="flex md:hidden items-center justify-between px-3 py-2 bg-gray-50/50">
                {/* Mobile Stage Status */}
                <div className="flex-1">

                </div>

                {/* Mobile Actions Dropdown */}
                {actions.length > 0 && (
                    <div className="relative ml-2" ref={actionsRef}>
                        <button
                            onClick={() => setShowActions(!showActions)}
                            className="btn-primary py-1 px-3 text-xs h-8"
                        >
                            <span>Actions</span>
                            <FiChevronDown className={`w-3 h-3 transition-transform ${showActions ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Mobile Dropdown Menu (Anchored Right) */}
                        {showActions && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                                {actions.map((action, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            action.onClick();
                                            setShowActions(false);
                                        }}
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
                                    >
                                        {action.icon && <span className="text-gray-400">{action.icon}</span>}
                                        <span className="font-medium">{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
