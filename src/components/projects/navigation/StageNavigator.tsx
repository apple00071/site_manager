'use client';

import React, { useRef, useEffect } from 'react';
import { FiCheck, FiClock, FiCircle } from 'react-icons/fi';

export type StageId = 'visit' | 'design' | 'boq' | 'orders' | 'work_progress' | 'snag' | 'finance';

interface Stage {
    id: StageId;
    label: string;
    status: 'completed' | 'current' | 'upcoming';
}

interface StageNavigatorProps {
    currentStage: StageId;
    onStageSelect: (stage: StageId) => void;
    completedStages?: StageId[];
}

const STAGES: { id: StageId; label: string }[] = [
    { id: 'visit', label: 'Visit' },
    { id: 'design', label: 'Design' },
    { id: 'boq', label: 'BOQ' },
    { id: 'orders', label: 'Orders' },
    { id: 'work_progress', label: 'Work Progress' },
    { id: 'snag', label: 'Snag' },
    { id: 'finance', label: 'Finance' },
];

export function StageNavigator({ currentStage, onStageSelect, completedStages = [] }: StageNavigatorProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to active stage on mount/change
    useEffect(() => {
        if (scrollContainerRef.current) {
            const activeElement = scrollContainerRef.current.querySelector(`[data-stage="${currentStage}"]`);
            if (activeElement) {
                const container = scrollContainerRef.current;
                const scrollLeft = (activeElement as HTMLElement).offsetLeft - container.offsetWidth / 2 + (activeElement as HTMLElement).offsetWidth / 2;
                container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
        }
    }, [currentStage]);

    return (
        <div className="bg-white border-b border-gray-200 w-full sticky top-0 z-10 transition-all duration-200">
            {/* DESKTOP PIPELINE (md+) */}
            <div className="hidden md:flex items-center justify-between px-6 py-3">
                <div className="flex-1 flex items-center">
                    {STAGES.map((stage, index) => {
                        const isActive = currentStage === stage.id;
                        const isCompleted = completedStages.includes(stage.id);
                        const isLast = index === STAGES.length - 1;

                        const state = isActive ? 'current' : isCompleted ? 'completed' : 'upcoming';

                        return (
                            <div key={stage.id} className="flex items-center">
                                {/* Connector Line */}
                                {index > 0 && (
                                    <div className={`w-8 h-0.5 mx-2 ${state === 'completed' || (isActive && completedStages.includes(STAGES[index - 1].id)) ? 'bg-teal-500' : 'bg-gray-200 border-t border-dashed border-gray-300'
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

                {/* Optional Right Action Area - Can be re-enabled later if needed */}
                <div className="hidden lg:flex items-center gap-4 pl-4 border-l border-gray-200 ml-4">
                    {/* Placeholder for future status/actions if needed */}
                </div>
            </div>

            {/* MOBILE SCROLL (md-) */}
            <div
                ref={scrollContainerRef}
                className="flex md:hidden overflow-x-auto px-4 py-3 gap-2 w-full"
                style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                {STAGES.map((stage, index) => {
                    const isActive = currentStage === stage.id;
                    const isCompleted = completedStages.includes(stage.id);
                    // Removed isPassed logic to prevent auto-completion visual

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
    );
}
