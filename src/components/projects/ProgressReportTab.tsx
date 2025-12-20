'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { FiPlus, FiFileText, FiDownload, FiSend, FiClock, FiCheckCircle, FiTrash2, FiSettings, FiCamera, FiUsers } from 'react-icons/fi';
import { formatDateIST } from '@/lib/dateUtils';
import { useToast } from '@/components/ui/Toast';
import { ReportGenerator } from './report/ReportGenerator';
import { DPRSettings } from './report/DPRSettings';

interface ProgressReport {
    id: string;
    report_date: string;
    summary: string;
    status: 'draft' | 'submitted';
    pdf_url?: string;
    created_at: string;
}

interface ProgressReportTabProps {
    projectId: string;
}

export const ProgressReportTab = forwardRef(({ projectId }: ProgressReportTabProps, ref) => {
    const [reports, setReports] = useState<ProgressReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isRetrying, setIsRetrying] = useState<string | null>(null);
    const { showToast } = useToast();

    useImperativeHandle(ref, () => ({
        openGenerator: () => setIsGeneratorOpen(true),
        openSettings: () => setIsSettingsOpen(true),
    }));

    const fetchReports = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/reports?project_id=${projectId}`);
            const data = await res.json();
            if (data.reports) setReports(data.reports);
        } catch (err) {
            console.error('Error fetching reports:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRetry = async (reportId: string) => {
        try {
            setIsRetrying(reportId);
            showToast('info', 'Retrying PDF Generation...');
            const res = await fetch('/api/reports/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report_id: reportId })
            });

            if (res.ok) {
                showToast('success', 'Report Generated Successfully!');
                fetchReports();
            } else {
                showToast('error', 'Retry failed. Please check site logs.');
            }
        } catch (err) {
            showToast('error', 'Connection error');
        } finally {
            setIsRetrying(null);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [projectId]);

    return (
        <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">Daily Progress Reports (DPR)</h2>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                        <FiFileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No reports generated yet.</p>
                        <button
                            onClick={() => setIsGeneratorOpen(true)}
                            className="mt-4 text-yellow-600 font-medium hover:text-yellow-700"
                        >
                            + Generate first report
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {reports.map((report) => (
                            <div key={report.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                            {formatDateIST(report.report_date)}
                                        </div>
                                        <h3 className="text-sm font-bold text-gray-900 line-clamp-1">
                                            Report for {formatDateIST(report.report_date)}
                                        </h3>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${report.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {report.status.toUpperCase()}
                                    </span>
                                </div>

                                <p className="text-xs text-gray-600 line-clamp-2 mb-4">
                                    {report.summary || 'No summary provided.'}
                                </p>

                                <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-100">
                                    {report.pdf_url ? (
                                        <a
                                            href={report.pdf_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                                        >
                                            <FiDownload className="w-3.5 h-3.5" />
                                            View/Download PDF
                                        </a>
                                    ) : (
                                        <button
                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                            onClick={() => handleRetry(report.id)}
                                            disabled={isRetrying === report.id}
                                        >
                                            <FiClock className={`w-3.5 h-3.5 ${isRetrying === report.id ? 'animate-spin' : ''}`} />
                                            {isRetrying === report.id ? 'Retrying...' : 'Retry Generation'}
                                        </button>
                                    )}
                                    <button className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                                        <FiTrash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Placeholder for Modals */}
            {isGeneratorOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 sm:p-4">
                    <div className="w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] bg-white sm:rounded-2xl overflow-hidden shadow-2xl">
                        <ReportGenerator
                            projectId={projectId}
                            onClose={() => setIsGeneratorOpen(false)}
                            onSuccess={() => {
                                fetchReports();
                                setIsGeneratorOpen(false);
                            }}
                        />
                    </div>
                </div>
            )}

            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 sm:p-4">
                    <div className="w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] bg-white sm:rounded-2xl overflow-hidden shadow-2xl">
                        <DPRSettings
                            projectId={projectId}
                            onClose={() => setIsSettingsOpen(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
});

ProgressReportTab.displayName = 'ProgressReportTab';
