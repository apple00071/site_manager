'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    FiX, FiSearch, FiDownload, FiStar, FiRefreshCw,
    FiUser, FiMessageSquare, FiTrendingUp, FiFilter, FiAlertCircle
} from 'react-icons/fi';

interface SurveyResponse {
    id: string;
    user_id: string;
    issues: string;
    improvements: string;
    rating: number;
    category: string;
    created_at: string;
    users?: {
        id: string;
        full_name: string;
        email: string;
        designation: string | null;
        role: string;
    } | null;
}

interface SurveyResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SurveyResultsModal({ isOpen, onClose }: SurveyResultsModalProps) {
    const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDesignation, setSelectedDesignation] = useState<string>('all');

    const fetchSurveys = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/surveys');
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to fetch surveys');
            }
            const data = await res.json();
            setSurveys(data.surveys || []);
        } catch (err: any) {
            setError(err.message || 'Error loading survey results');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchSurveys();
        }
    }, [isOpen]);

    // Available designations for filtering
    const designationsList = useMemo(() => {
        const set = new Set<string>();
        surveys.forEach(s => {
            const des = s.users?.designation || 'Unassigned';
            set.add(des);
        });
        return Array.from(set);
    }, [surveys]);

    // Filtered responses
    const filteredSurveys = useMemo(() => {
        return surveys.filter(s => {
            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const name = s.users?.full_name?.toLowerCase() || '';
                const email = s.users?.email?.toLowerCase() || '';
                const des = s.users?.designation?.toLowerCase() || '';
                const issues = s.issues.toLowerCase();
                const improvements = s.improvements.toLowerCase();
                const category = s.category?.toLowerCase() || '';

                if (!name.includes(q) && !email.includes(q) && !des.includes(q) && !issues.includes(q) && !improvements.includes(q)) {
                    return false;
                }
            }

            // Designation filter
            if (selectedDesignation !== 'all') {
                const des = s.users?.designation || 'Unassigned';
                if (des !== selectedDesignation) return false;
            }

            return true;
        });
    }, [surveys, searchQuery, selectedDesignation]);

    // Average rating
    const avgRating = useMemo(() => {
        if (surveys.length === 0) return 0;
        const sum = surveys.reduce((acc, curr) => acc + (Number(curr.rating) || 5), 0);
        return (sum / surveys.length).toFixed(1);
    }, [surveys]);

    // Export to CSV
    const handleExportCSV = () => {
        if (filteredSurveys.length === 0) {
            alert('No responses to export.');
            return;
        }

        const headers = ['Sl.No', 'Employee Name', 'Designation', 'Email', 'Rating (1-5)', 'Issues Faced', 'Suggested Improvements', 'Date'];
        const rows = filteredSurveys.map((s, idx) => [
            idx + 1,
            `"${(s.users?.full_name || 'N/A').replace(/"/g, '""')}"`,
            `"${(s.users?.designation || 'N/A').replace(/"/g, '""')}"`,
            `"${(s.users?.email || 'N/A').replace(/"/g, '""')}"`,
            s.rating || 5,
            `"${(s.issues || '').replace(/"/g, '""')}"`,
            `"${(s.improvements || '').replace(/"/g, '""')}"`,
            `"${new Date(s.created_at).toLocaleString('en-IN')}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `IT_Survey_Results_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl border border-gray-100 overflow-hidden flex flex-col h-[90vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-900 text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#f0b100] text-gray-950 font-bold rounded-lg">
                            <FiTrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-white">Employee Survey & Feedback Dashboard</h3>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#f0b100] text-gray-950">
                                    IT Access Only
                                </span>
                            </div>
                            <p className="text-xs text-gray-400">Review issues and improvement suggestions submitted across all teams</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchSurveys}
                            title="Refresh data"
                            className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* KPI Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-50 border-b border-gray-200 text-xs shrink-0">
                    <div className="bg-white p-3 rounded-xl border border-gray-200">
                        <div className="text-gray-500 font-medium">Total Responses</div>
                        <div className="text-xl font-bold text-gray-900 mt-0.5">{surveys.length}</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-gray-200">
                        <div className="text-gray-500 font-medium">Average Rating</div>
                        <div className="text-xl font-bold text-amber-600 mt-0.5 flex items-center gap-1">
                            <span>{avgRating}</span>
                            <span className="text-xs text-gray-400 font-normal">/ 5.0</span>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-gray-200">
                        <div className="text-gray-500 font-medium">Unique Designations</div>
                        <div className="text-xl font-bold text-blue-600 mt-0.5">{designationsList.length}</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between">
                        <div>
                            <div className="text-gray-500 font-medium">Filtered Items</div>
                            <div className="text-xl font-bold text-gray-900 mt-0.5">{filteredSurveys.length}</div>
                        </div>
                        <button
                            onClick={handleExportCSV}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#f0b100] hover:bg-[#d49b00] text-gray-950 font-bold rounded-lg text-xs transition-colors shadow-sm cursor-pointer"
                        >
                            <FiDownload className="w-3.5 h-3.5" />
                            <span>Export CSV</span>
                        </button>
                    </div>
                </div>

                {/* Filter Controls */}
                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search by employee, designation, issue, or keyword..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#f0b100] outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={selectedDesignation}
                            onChange={(e) => setSelectedDesignation(e.target.value)}
                            className="px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f0b100] outline-none"
                        >
                            <option value="all">All Designations ({surveys.length})</option>
                            {designationsList.map(des => (
                                <option key={des} value={des}>{des}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Responses List Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gray-50/40">
                    {loading ? (
                        <div className="py-20 text-center text-gray-500 text-sm">
                            <div className="w-8 h-8 border-2 border-[#f0b100] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <span>Loading survey responses...</span>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-red-50 text-red-700 text-xs rounded-lg font-medium border border-red-200">
                            {error}
                        </div>
                    ) : filteredSurveys.length === 0 ? (
                        <div className="py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-100">
                            No survey responses found matching your filters.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredSurveys.map((survey, index) => (
                                <div
                                    key={survey.id || index}
                                    className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm space-y-3.5 hover:border-gray-300 transition-all"
                                >
                                    {/* Card Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-xs uppercase border border-gray-200">
                                                {survey.users?.full_name?.slice(0, 2) || 'EM'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-gray-900">
                                                        {survey.users?.full_name || 'Anonymous Employee'}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                        {survey.users?.designation || 'Team Member'}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-gray-400 mt-0.5">
                                                    {survey.users?.email} · Submitted on {new Date(survey.created_at).toLocaleString('en-IN', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 self-start sm:self-auto">
                                            <div className="flex items-center text-amber-500">
                                                {[1, 2, 3, 4, 5].map((s) => (
                                                    <FiStar
                                                        key={s}
                                                        className={`w-3.5 h-3.5 ${s <= (survey.rating || 5) ? 'fill-current' : 'text-gray-200'}`}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-xs font-bold text-gray-700 ml-1">
                                                {survey.rating || 5}/5
                                            </span>
                                        </div>
                                    </div>

                                    {/* Issues Faced Section */}
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 uppercase tracking-wide">
                                            <FiAlertCircle className="w-3.5 h-3.5 text-red-500" />
                                            <span>Issues / Difficulties Faced</span>
                                        </div>
                                        <div className="p-3 bg-red-50/50 border border-red-100 rounded-lg text-xs text-gray-800 leading-relaxed font-normal whitespace-pre-wrap">
                                            {survey.issues}
                                        </div>
                                    </div>

                                    {/* Suggested Improvements Section */}
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wide">
                                            <FiTrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Suggested Improvements</span>
                                        </div>
                                        <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg text-xs text-gray-800 leading-relaxed font-normal whitespace-pre-wrap">
                                            {survey.improvements}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
