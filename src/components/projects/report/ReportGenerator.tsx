'use client';

import React, { useState, useEffect } from 'react';
import { FiArrowRight, FiArrowLeft, FiCheck, FiCamera, FiUsers, FiMessageSquare, FiTruck, FiBox, FiActivity } from 'react-icons/fi';
import { formatDateIST } from '@/lib/dateUtils';
import { useToast } from '@/components/ui/Toast';

interface ReportGeneratorProps {
    projectId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export function ReportGenerator({ projectId, onClose, onSuccess }: ReportGeneratorProps) {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isAggregating, setIsAggregating] = useState(true);
    const [aggregatedData, setAggregatedData] = useState<any>(null);
    const { showToast } = useToast();

    // Form State
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [summary, setSummary] = useState('');
    const [blockers, setBlockers] = useState('');
    const [tomorrowPlan, setTomorrowPlan] = useState('');
    const [manpower, setManpower] = useState<any[]>([]);

    useEffect(() => {
        const fetchTodayData = async () => {
            try {
                setIsAggregating(true);
                const res = await fetch(`/api/reports/aggregate?project_id=${projectId}&date=${selectedDate}`);
                const data = await res.json();
                setAggregatedData(data);

                // Pre-fill summary from site logs if available
                if (data.site_logs && data.site_logs.length > 0) {
                    setSummary(data.site_logs[0].work_description);
                } else {
                    setSummary('');
                }
            } catch (err) {
                console.error('Failed to aggregate data:', err);
            } finally {
                setIsAggregating(false);
            }
        };
        fetchTodayData();
    }, [projectId, selectedDate]);

    const handleSubmit = async () => {
        try {
            setIsLoading(true);
            const reportData = {
                project_id: projectId,
                report_date: selectedDate,
                summary,
                blockers,
                tomorrow_plan: tomorrowPlan,
                manpower_details: manpower,
                aggregated_data: aggregatedData,
                status: 'submitted'
            };

            const res = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reportData)
            });

            if (res.ok) {
                const { report } = await res.json();

                // Trigger broadcast
                showToast('info', 'Compiling PDF & Broadcasting...');
                const sendRes = await fetch('/api/reports/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ report_id: report.id })
                });

                if (sendRes.ok) {
                    showToast('success', 'Report Broadcasted Successfully!');
                } else {
                    showToast('warning', 'Report saved, but broadcast failed.');
                }

                onSuccess();
                onClose();
            } else {
                throw new Error('Failed to save report');
            }
        } catch (err) {
            showToast('error', 'Submission failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-20">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                        <span className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0">
                            Step {step} of 3
                        </span>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Daily Progress Report</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">Report Date:</p>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className="text-xs sm:text-sm font-semibold text-gray-900 border-none bg-transparent focus:ring-0 cursor-pointer p-0"
                        />
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 ml-2 shrink-0">
                    <FiArrowRight className="w-5 h-5 sm:w-6 sm:h-6 rotate-45" />
                </button>
            </div>

            {/* Stepper Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 pb-24 sm:pb-6">
                {step === 1 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
                                <FiActivity className="text-blue-500" />
                                1. Automated Site Aggregation
                            </h3>
                            {isAggregating ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-16 bg-gray-50 animate-pulse rounded-xl"></div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-blue-800">Completed Tasks</span>
                                            <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                                                {aggregatedData?.tasks?.length || 0}
                                            </span>
                                        </div>
                                        <div className="text-xs text-blue-600">
                                            {aggregatedData?.tasks?.map((t: any) => t.title).join(', ') || 'No tasks completed today.'}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-green-800">Materials Inward</span>
                                            <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-bold">
                                                {aggregatedData?.inventory?.length || 0}
                                            </span>
                                        </div>
                                        <div className="text-xs text-green-600">
                                            {aggregatedData?.inventory?.map((i: any) => i.item_name).join(', ') || 'No materials received today.'}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-amber-800">Scope Progress (BOQ)</span>
                                            <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                                                {aggregatedData?.boq?.length || 0}
                                            </span>
                                        </div>
                                        <div className="text-xs text-amber-600">
                                            {aggregatedData?.boq?.map((b: any) => b.item_name).join(', ') || 'No major scope completions today.'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-gray-700">Daily Summary (Editorial)</label>
                            <textarea
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                rows={4}
                                className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm outline-none"
                                placeholder="Describe the overall activity of the day..."
                            />
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <FiUsers className="text-purple-500" />
                            2. Manpower & Forward Planning
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Blockers / Red Flags</label>
                                <textarea
                                    value={blockers}
                                    onChange={(e) => setBlockers(e.target.value)}
                                    rows={3}
                                    className="w-full p-3 bg-red-50 border border-red-100 rounded-xl text-sm focus:ring-2 focus:ring-red-200 outline-none"
                                    placeholder="Anything delaying the site?"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Tomorrow's Plan</label>
                                <textarea
                                    value={tomorrowPlan}
                                    onChange={(e) => setTomorrowPlan(e.target.value)}
                                    rows={3}
                                    className="w-full p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm focus:ring-2 focus:ring-emerald-200 outline-none"
                                    placeholder="What's the goal for tomorrow?"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl border-dashed">
                            <p className="text-xs text-gray-500 text-center italic">
                                Viewpoints & Camera capture logic will be integrated here in the next update.
                            </p>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <FiCheck className="text-green-500" />
                            3. Review & Broadcast
                        </h3>

                        <div className="p-6 bg-gray-900 rounded-2xl text-white space-y-4">
                            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                                <span className="text-gray-400 text-sm font-medium">Report Date</span>
                                <span className="font-bold">{formatDateIST(selectedDate)}</span>
                            </div>
                            <div className="space-y-2">
                                <span className="text-gray-400 text-sm font-medium">Recipients</span>
                                <div className="flex flex-wrap gap-2">
                                    <span className="bg-gray-800 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-gray-700">Project Manager</span>
                                    <span className="bg-gray-800 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-gray-700 text-yellow-500">CLIENT (WhatsApp)</span>
                                </div>
                            </div>
                            <div className="p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
                                <p className="text-xs text-yellow-300 leading-relaxed">
                                    Generating this report will compile a professional PDF and simultaneously send it to the configured subscribers via WhatsApp and Email.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 border-t border-gray-50 flex items-center justify-between bg-gray-50 sticky bottom-0 z-20">
                <button
                    onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                    {step === 1 ? 'Cancel' : <><FiArrowLeft /> Back</>}
                </button>

                <button
                    onClick={() => step < 3 ? setStep(step + 1) : handleSubmit()}
                    disabled={isLoading || isAggregating}
                    className="flex items-center gap-2 px-8 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-black transition-transform active:scale-95 disabled:opacity-50"
                >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                            Processing...
                        </div>
                    ) : step === 3 ? (
                        <>Submit & Broadcast <FiCheck /></>
                    ) : (
                        <>Next Step <FiArrowRight /></>
                    )}
                </button>
            </div>
        </div>
    );
}
