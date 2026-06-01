'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { FiUser, FiClock, FiCalendar, FiBriefcase, FiActivity, FiArrowLeft, FiCheckCircle, FiAlertCircle, FiFileText, FiUploadCloud, FiTrash2, FiDownload, FiEye, FiX, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';
import { formatDateIST, formatTimeIST } from '@/lib/dateUtils';
import { DataTable, StatusBadge, getStatusVariant } from '@/components/ui/DataTable';
import Link from 'next/link';
import { ImageModal } from '@/components/ui/ImageModal';
import { supabase } from '@/lib/supabase';

const openExternalLink = (url: string) => {
    if (!url) return;
    
    // Median / GoNative support
    // @ts-ignore
    if (typeof window !== 'undefined' && window.median && window.median.open && window.median.open.external) {
        // @ts-ignore
        window.median.open.external({ url });
        return;
    }
    
    // Capacitor support
    // @ts-ignore
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
        try {
            // @ts-ignore
            window.Capacitor.Plugins.Browser.open({ url });
            return;
        } catch (e) {
            console.error('Capacitor browser open failed', e);
        }
    }
    
    // Standard window.open fallback
    if (typeof window !== 'undefined') {
        window.open(url, '_blank');
    }
};

interface PerformanceMetrics {
    updateCount: number;
    avgSnagResolveHours: number;
    taskAdherenceRate: number;
    attendanceConsistency: number;
    communicationScore: number;
}

const BRAND = '#F3C133';
const BRAND_LIGHT = '#FEF9EC';

const AVATAR_COLORS = [
    '#F3C133', '#3B82F6', '#10B981', '#8B5CF6',
    '#EC4899', '#06B6D4', '#EF4444', '#6366F1'
];

function useCountUp(target: number, duration = 900) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (target === 0) { setCount(0); return; }
        let start = 0;
        const step = target / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= target) { setCount(target); clearInterval(timer); }
            else setCount(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [target, duration]);
    return count;
}

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user: currentUser, isAdmin } = useAuth();
    const { setTitle, setSubtitle } = useHeaderTitle();

    const [user, setUser] = useState<any>(null);
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('performance');
    const [collapsedAttendanceMonths, setCollapsedAttendanceMonths] = useState<Record<string, boolean>>({});
    const [collapsedLeaveMonths, setCollapsedLeaveMonths] = useState<Record<string, boolean>>({});
    const [collapsedExpenseProjects, setCollapsedExpenseProjects] = useState<Record<string, boolean>>({});
    const [viewingBills, setViewingBills] = useState<string[]>([]);
    const [viewingBillIndex, setViewingBillIndex] = useState<number>(0);
    const [documents, setDocuments] = useState<any[]>([]);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [docName, setDocName] = useState('');
    const [docFile, setDocFile] = useState<File | null>(null);

    useEffect(() => {
        setTitle('Employee 360');
        setSubtitle('Comprehensive Performance View');
    }, [setTitle, setSubtitle]);

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                // Fetch all endpoints concurrently
                const [userRes, perfRes, attRes, projRes, leaveRes, expRes, docRes] = await Promise.all([
                    fetch(`/api/admin/users?id=${id}`),
                    fetch(`/api/admin/users/${id}/performance`),
                    fetch(`/api/attendance?user_id=${id}`),
                    fetch(`/api/admin/projects?userId=${id}`),
                    fetch(`/api/leaves?user_id=${id}`),
                    fetch(`/api/office-expenses?user_id=${id}`),
                    fetch(`/api/admin/users/${id}/documents`)
                ]);

                // Parse all json bodies concurrently
                const [userData, perfData, attData, projData, leaveData, expData, docData] = await Promise.all([
                    userRes.json(),
                    perfRes.json(),
                    attRes.json(),
                    projRes.json(),
                    leaveRes.json(),
                    expRes.json(),
                    docRes.json()
                ]);

                setUser(userData);
                setMetrics(perfData.metrics);
                setAttendance(attData);
                setProjects(projData);
                setLeaves(leaveData.leaves || []);
                setExpenses(expData.expenses || []);
                setDocuments(docData.documents || []);

            } catch (error) {
                console.error('Error fetching profile data concurrently:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchAllData();
    }, [id]);

    const handleUploadDocument = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docName || !docFile) return;

        setUploadingDoc(true);
        try {
            // 1. Upload file to supabase storage
            const fileExt = docFile.name.split('.').pop();
            const fileName = `${id}/${crypto.randomUUID()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('employee-documents')
                .upload(fileName, docFile);

            if (uploadError) throw uploadError;

            // 2. Save record in database via API
            const res = await fetch(`/api/admin/users/${id}/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    document_name: docName,
                    file_url: fileName
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to save document record');
            }

            // 3. Refresh documents
            const docsRes = await fetch(`/api/admin/users/${id}/documents`);
            const docsData = await docsRes.json();
            setDocuments(docsData.documents || []);

            // 4. Close modal and reset
            setIsUploadModalOpen(false);
            setDocName('');
            setDocFile(null);
        } catch (error: any) {
            console.error('Error uploading document:', error);
            alert(error.message || 'Failed to upload document');
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleDeleteDocument = async (docId: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return;

        try {
            const res = await fetch(`/api/admin/users/${id}/documents/${docId}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete document');
            }

            // Remove from state
            setDocuments(docs => docs.filter(d => d.id !== docId));
        } catch (error: any) {
            console.error('Error deleting document:', error);
            alert(error.message || 'Failed to delete document');
        }
    };

    const tabs = [
        { id: 'performance', label: 'Performance', icon: <FiActivity /> },
        { id: 'projects', label: 'Projects', icon: <FiBriefcase /> },
        { id: 'attendance', label: 'Attendance', icon: <FiClock /> },
        { id: 'leaves', label: 'Leaves', icon: <FiCalendar /> },
        { id: 'expenses', label: 'Expenses', icon: <TbCurrencyRupee /> },
        { id: 'documents', label: 'Documents', icon: <FiFileText /> },
    ];

    const attendanceMonths = useMemo(() => {
        const months = new Set<string>();
        attendance.forEach(record => {
            if (record.date) {
                const date = new Date(record.date);
                const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                months.add(monthStr);
            }
        });
        return Array.from(months).sort().reverse();
    }, [attendance]);

    const toggleAttendanceMonth = (month: string) => {
        setCollapsedAttendanceMonths(prev => ({
            ...prev,
            [month]: !prev[month]
        }));
    };

    const groupedAttendance = useMemo(() => {
        const groups: Record<string, any[]> = {};
        attendance.forEach(record => {
            if (!record.date) return;
            const date = new Date(record.date);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!groups[monthStr]) groups[monthStr] = [];
            groups[monthStr].push(record);
        });
        return groups;
    }, [attendance]);

    const leaveMonths = useMemo(() => {
        const months = new Set<string>();
        leaves.forEach(record => {
            if (record.start_date) {
                const date = new Date(record.start_date);
                const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                months.add(monthStr);
            }
        });
        return Array.from(months).sort().reverse();
    }, [leaves]);

    const toggleLeaveMonth = (month: string) => {
        setCollapsedLeaveMonths(prev => ({
            ...prev,
            [month]: !prev[month]
        }));
    };

    const groupedLeaves = useMemo(() => {
        const groups: Record<string, any[]> = {};
        leaves.forEach(record => {
            if (!record.start_date) return;
            const date = new Date(record.start_date);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!groups[monthStr]) groups[monthStr] = [];
            groups[monthStr].push(record);
        });
        return groups;
    }, [leaves]);

    const expenseProjects = useMemo(() => {
        const projects = new Set<string>();
        expenses.forEach(record => {
            const projectName = record.project_name || 'Office';
            projects.add(projectName);
        });
        return Array.from(projects).sort();
    }, [expenses]);

    const toggleExpenseProject = (project: string) => {
        setCollapsedExpenseProjects(prev => ({
            ...prev,
            [project]: !prev[project]
        }));
    };

    const groupedExpenses = useMemo(() => {
        const groups: Record<string, any[]> = {};
        expenses.forEach(record => {
            const projectName = record.project_name || 'Office';
            if (!groups[projectName]) groups[projectName] = [];
            groups[projectName].push(record);
        });
        return groups;
    }, [expenses]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
            </div>
        );
    }

    const getAvatarColor = (name: string) => {
        if (!name) return BRAND;
        const i = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
        return AVATAR_COLORS[i];
    };
    const getInitials = (name: string) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className="space-y-5 pb-20">
            {/* Header / Profile Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-yellow-50 to-transparent rounded-bl-full opacity-50 -z-10 pointer-events-none" />
                <div className="flex flex-col md:flex-row gap-5 items-start md:items-center">
                    <div 
                        className="h-16 w-16 md:h-20 md:w-20 rounded-2xl flex items-center justify-center text-white text-2xl md:text-3xl font-bold shadow-sm shrink-0"
                        style={{ backgroundColor: getAvatarColor(user?.full_name) }}
                    >
                        {getInitials(user?.full_name)}
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="space-y-3">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 truncate">{user?.full_name}</h1>
                                    <p className="text-gray-500 font-medium">{user?.designation || 'Team Member'}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <span className="px-2.5 py-1 bg-yellow-50 text-yellow-700 border border-yellow-100 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                                        {user?.roles?.name || user?.role || 'User'}
                                    </span>
                                    <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                                        <FiCalendar className="w-3.5 h-3.5 text-gray-400" /> Member since {formatDateIST(user?.created_at).split(',')[0]}
                                    </span>
                                </div>
                            </div>
                            <Link href="/dashboard/organization" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold text-xs transition-colors shrink-0">
                                <FiArrowLeft className="w-3.5 h-3.5" /> Directory
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard
                    title="Site Updates"
                    value={metrics?.updateCount || 0}
                    subtitle="Last 30 days"
                    icon={<FiActivity className="h-5 w-5" />}
                    iconBg="#EFF6FF"
                    iconColor="#3B82F6"
                    trend={metrics?.updateCount && metrics.updateCount > 5 ? 'High Regularity' : 'Needs Improvement'}
                    trendColor={metrics?.updateCount && metrics.updateCount > 5 ? 'text-green-600' : 'text-orange-600'}
                />
                <StatCard
                    title="Snag Resolution"
                    value={metrics?.avgSnagResolveHours || 0}
                    suffix="h"
                    subtitle="Avg. efficiency"
                    icon={<FiCheckCircle className="h-5 w-5" />}
                    iconBg="#ECFDF5"
                    iconColor="#10B981"
                    trend={metrics?.avgSnagResolveHours && metrics.avgSnagResolveHours < 48 ? 'Efficient' : 'Slow Response'}
                    trendColor={metrics?.avgSnagResolveHours && metrics.avgSnagResolveHours < 48 ? 'text-green-600' : 'text-orange-600'}
                />
                <StatCard
                    title="Active Projects"
                    value={projects.filter(p => p.status !== 'completed').length}
                    subtitle="Currently assigned"
                    icon={<FiBriefcase className="h-5 w-5" />}
                    iconBg={BRAND_LIGHT}
                    iconColor={BRAND}
                />
                <StatCard
                    title="Approved Costs"
                    value={expenses.filter(e => e.status === 'approved').reduce((acc, e) => acc + (Number(e.amount) || 0), 0)}
                    prefix="₹"
                    subtitle="Total office expenses"
                    icon={<TbCurrencyRupee className="h-5 w-5" />}
                    iconBg="#F5F3FF"
                    iconColor="#8B5CF6"
                />
            </div>

            {/* Tabbed Content Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Tab Navigation */}
                <div className="flex p-2 gap-1 overflow-x-auto no-scrollbar scroll-smooth border-b border-gray-100 bg-gray-50/50">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all whitespace-nowrap flex-shrink-0 ${activeTab === tab.id
                                ? 'bg-white text-yellow-700 shadow-sm border border-gray-100'
                                : 'text-gray-500 border border-transparent hover:text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            <span className={`flex-shrink-0 ${activeTab === tab.id ? 'text-yellow-600' : ''}`}>{tab.icon}</span>
                            <span className="flex-shrink-0">{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="p-1">
                    {activeTab === 'performance' && (
                        <div className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold text-gray-900">Work Summary</h3>
                                    <div className="space-y-3">
                                        <PerformanceMetricRow label="Task Adherence" value={`${metrics?.taskAdherenceRate || 0}%`} percentage={metrics?.taskAdherenceRate || 0} color="bg-green-500" />
                                        <PerformanceMetricRow label="Attendance Consistency" value={`${metrics?.attendanceConsistency || 0}%`} percentage={metrics?.attendanceConsistency || 0} color="bg-blue-500" />
                                        <PerformanceMetricRow label="Site Communication" value={`${metrics?.communicationScore || 0}%`} percentage={metrics?.communicationScore || 0} color="bg-purple-500" />
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                                        <FiAlertCircle className="text-yellow-600" /> Admin Note
                                    </h4>
                                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                                        Performance metrics are calculated based on the last 90 days of activity. These scores help identify leaders and areas where team members might need more support or training.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'projects' && (
                        <>
                            <div className="hidden md:block">
                                <DataTable
                                    data={projects}
                                    keyField="id"
                                    columns={[
                                        { label: 'Project Title', key: 'title', render: (val) => <span className="font-semibold text-gray-900">{val}</span> },
                                        { label: 'Status', key: 'status', render: (val) => <StatusBadge status={val} variant={getStatusVariant(val)} /> },
                                        { label: 'Customer', key: 'customer_name' },
                                        { label: 'Start Date', key: 'start_date', render: (val) => formatDateIST(val).split(',')[0] },
                                    ]}
                                />
                            </div>
                            <div className="md:hidden divide-y divide-gray-100">
                                {projects.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">No projects assigned.</div>
                                ) : (
                                    projects.map(proj => (
                                        <div key={proj.id} className="p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <span className="font-bold text-gray-900 text-sm">{proj.title}</span>
                                                <StatusBadge status={proj.status} variant={getStatusVariant(proj.status)} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <span className="text-gray-500">Customer:</span>
                                                <span className="text-right text-gray-700 font-medium">{proj.customer_name || 'N/A'}</span>
                                                <span className="text-gray-500">Start Date:</span>
                                                <span className="text-right text-gray-700 font-medium">{formatDateIST(proj.start_date).split(',')[0]}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'attendance' && (
                        <div className="flex flex-col">
                            <div className="p-4 md:px-6 md:py-4 border-b border-gray-100 bg-white/50">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Attendance Log</h3>
                            </div>
                            
                            {/* Desktop View */}
                            <div className="hidden md:block bg-white">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Date</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Check In</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Check Out</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {attendanceMonths.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No attendance records found.</td>
                                            </tr>
                                        )}
                                        {attendanceMonths.map(monthStr => {
                                            const [year, m] = monthStr.split('-');
                                            const date = new Date(parseInt(year), parseInt(m) - 1, 1);
                                            const monthLabel = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                                            const monthRecords = groupedAttendance[monthStr] || [];
                                            
                                            return (
                                                <React.Fragment key={monthStr}>
                                                    <tr
                                                        className="bg-gray-50/50 cursor-pointer hover:bg-gray-100/50 transition-colors"
                                                        onClick={() => toggleAttendanceMonth(monthStr)}
                                                    >
                                                        <td colSpan={4} className="px-6 py-3 border-y border-gray-100/50">
                                                            <div className="flex items-center gap-2">
                                                                {collapsedAttendanceMonths[monthStr] ? (
                                                                    <FiChevronRight className="w-4 h-4 text-gray-400" />
                                                                ) : (
                                                                    <FiChevronDown className="w-4 h-4 text-gray-400" />
                                                                )}
                                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                                                    {monthLabel} — {monthRecords.length} {monthRecords.length === 1 ? 'Record' : 'Records'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {!collapsedAttendanceMonths[monthStr] && monthRecords.map(record => (
                                                        <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatDateIST(record.date)}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatTimeIST(record.check_in) || '-'}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.check_out ? formatTimeIST(record.check_out) : '-'}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${record.check_out ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                    {record.check_out ? 'Completed' : 'Active'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View */}
                            <div className="md:hidden space-y-3 p-2 bg-gray-50/30">
                                {attendanceMonths.length === 0 && (
                                    <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-100">No attendance records found.</div>
                                )}
                                {attendanceMonths.map(monthStr => {
                                    const [year, m] = monthStr.split('-');
                                    const date = new Date(parseInt(year), parseInt(m) - 1, 1);
                                    const monthLabel = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                                    const monthRecords = groupedAttendance[monthStr] || [];

                                    return (
                                        <div key={monthStr} className="space-y-2">
                                            <div
                                                className="flex items-center gap-2 px-1 cursor-pointer py-1"
                                                onClick={() => toggleAttendanceMonth(monthStr)}
                                            >
                                                {collapsedAttendanceMonths[monthStr]
                                                    ? <FiChevronRight className="w-4 h-4 text-gray-400" />
                                                    : <FiChevronDown className="w-4 h-4 text-gray-400" />
                                                }
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                                    {monthLabel}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                                    {monthRecords.length}
                                                </span>
                                            </div>

                                            {!collapsedAttendanceMonths[monthStr] && (
                                                <div className="space-y-2">
                                                    {monthRecords.map(record => (
                                                        <div key={record.id} className="p-4 space-y-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-bold text-gray-900 text-sm">{formatDateIST(record.date)}</span>
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${record.check_out ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} uppercase`}>
                                                                    {record.check_out ? 'Completed' : 'Active'}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                                <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                                                                    <span className="block text-[9px] uppercase tracking-wider text-blue-500 font-bold mb-0.5">In</span>
                                                                    <span className="font-bold text-blue-700">{formatTimeIST(record.check_in) || '-'}</span>
                                                                </div>
                                                                <div className="bg-orange-50/50 p-2 rounded-lg border border-orange-100/50">
                                                                    <span className="block text-[9px] uppercase tracking-wider text-orange-500 font-bold mb-0.5">Out</span>
                                                                    <span className="font-bold text-orange-700">{record.check_out ? formatTimeIST(record.check_out) : '-'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'leaves' && (
                        <div className="flex flex-col">
                            <div className="p-4 md:px-6 md:py-4 border-b border-gray-100 bg-white/50">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Leave Requests</h3>
                            </div>
                            
                            {/* Desktop View */}
                            <div className="hidden md:block bg-white">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Leave Type</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Duration</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Status</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {leaveMonths.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No leave requests found.</td>
                                            </tr>
                                        )}
                                        {leaveMonths.map(monthStr => {
                                            const [year, m] = monthStr.split('-');
                                            const date = new Date(parseInt(year), parseInt(m) - 1, 1);
                                            const monthLabel = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                                            const monthRecords = groupedLeaves[monthStr] || [];
                                            
                                            return (
                                                <React.Fragment key={monthStr}>
                                                    <tr
                                                        className="bg-gray-50/50 cursor-pointer hover:bg-gray-100/50 transition-colors"
                                                        onClick={() => toggleLeaveMonth(monthStr)}
                                                    >
                                                        <td colSpan={4} className="px-6 py-3 border-y border-gray-100/50">
                                                            <div className="flex items-center gap-2">
                                                                {collapsedLeaveMonths[monthStr] ? (
                                                                    <FiChevronRight className="w-4 h-4 text-gray-400" />
                                                                ) : (
                                                                    <FiChevronDown className="w-4 h-4 text-gray-400" />
                                                                )}
                                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                                                    {monthLabel} — {monthRecords.length} {monthRecords.length === 1 ? 'Request' : 'Requests'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {!collapsedLeaveMonths[monthStr] && monthRecords.map(record => (
                                                        <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">{record.leave_type.replace(/_/g, ' ')}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDateIST(record.start_date)} to {formatDateIST(record.end_date)}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={record.status} variant={getStatusVariant(record.status)} /></td>
                                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                                <span className="truncate max-w-[200px] inline-block">{record.reason || '-'}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View */}
                            <div className="md:hidden space-y-3 p-2 bg-gray-50/30">
                                {leaveMonths.length === 0 && (
                                    <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-100">No leave requests found.</div>
                                )}
                                {leaveMonths.map(monthStr => {
                                    const [year, m] = monthStr.split('-');
                                    const date = new Date(parseInt(year), parseInt(m) - 1, 1);
                                    const monthLabel = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                                    const monthRecords = groupedLeaves[monthStr] || [];

                                    return (
                                        <div key={monthStr} className="space-y-2">
                                            <div
                                                className="flex items-center gap-2 px-1 cursor-pointer py-1"
                                                onClick={() => toggleLeaveMonth(monthStr)}
                                            >
                                                {collapsedLeaveMonths[monthStr]
                                                    ? <FiChevronRight className="w-4 h-4 text-gray-400" />
                                                    : <FiChevronDown className="w-4 h-4 text-gray-400" />
                                                }
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                                    {monthLabel}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                                    {monthRecords.length}
                                                </span>
                                            </div>

                                            {!collapsedLeaveMonths[monthStr] && (
                                                <div className="space-y-2">
                                                    {monthRecords.map(record => (
                                                        <div key={record.id} className="p-4 space-y-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                                            <div className="flex justify-between items-start">
                                                                <span className="font-bold text-gray-900 text-sm capitalize">{record.leave_type.replace(/_/g, ' ')}</span>
                                                                <StatusBadge status={record.status} variant={getStatusVariant(record.status)} />
                                                            </div>
                                                            <div className="flex flex-col gap-1 text-[11px] text-gray-600">
                                                                <div className="flex items-center gap-1">
                                                                    <FiCalendar className="text-gray-400" />
                                                                    {formatDateIST(record.start_date)} to {formatDateIST(record.end_date)}
                                                                </div>
                                                                {record.reason && (
                                                                    <p className="text-gray-500 mt-1 line-clamp-2 italic leading-tight">"{record.reason}"</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'expenses' && (
                        <div className="flex flex-col">
                            <div className="p-4 md:px-6 md:py-4 border-b border-gray-100 bg-white/50">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Expense Records</h3>
                            </div>
                            
                            {/* Desktop View */}
                            <div className="hidden md:block bg-white">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[15%]">Date</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[20%]">Description</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[35%]">Bill</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[15%]">Amount</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[15%]">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {expenseProjects.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No expense records found.</td>
                                            </tr>
                                        )}
                                        {expenseProjects.map(projectName => {
                                            const projectRecords = groupedExpenses[projectName] || [];
                                            const totalAmount = projectRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
                                            
                                            return (
                                                <React.Fragment key={projectName}>
                                                    <tr
                                                        className="bg-gray-50/50 cursor-pointer hover:bg-gray-100/50 transition-colors"
                                                        onClick={() => toggleExpenseProject(projectName)}
                                                    >
                                                        <td colSpan={5} className="px-6 py-3 border-y border-gray-100/50">
                                                            <div className="flex items-center gap-2">
                                                                {collapsedExpenseProjects[projectName] ? (
                                                                    <FiChevronRight className="w-4 h-4 text-gray-400" />
                                                                ) : (
                                                                    <FiChevronDown className="w-4 h-4 text-gray-400" />
                                                                )}
                                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                                                    {projectName} — {projectRecords.length} {projectRecords.length === 1 ? 'Record' : 'Records'} (Total: ₹{totalAmount.toLocaleString()})
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {!collapsedExpenseProjects[projectName] && projectRecords.map(exp => {
                                                        const bills = Array.isArray(exp.bill_urls) ? exp.bill_urls.filter(Boolean) : [];
                                                        return (
                                                            <tr key={exp.id} className="hover:bg-gray-50/50 transition-colors">
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{exp.expense_date ? formatDateIST(exp.expense_date) : 'N/A'}</td>
                                                                <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate">{exp.description || 'No description'}</td>
                                                                <td className="px-6 py-4">
                                                                    {bills.length === 0 ? (
                                                                        <span className="text-gray-400 text-xs italic">No Bill</span>
                                                                    ) : (
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {bills.map((url: string, idx: number) => (
                                                                                <button 
                                                                                    key={idx} 
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setViewingBills(bills);
                                                                                        setViewingBillIndex(idx);
                                                                                    }}
                                                                                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 hover:text-yellow-800 transition-colors cursor-pointer"
                                                                                >
                                                                                    View Bill{bills.length > 1 ? ` ${idx + 1}` : ''}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">₹{(Number(exp.amount) || 0).toLocaleString()}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={exp.status} variant={getStatusVariant(exp.status)} /></td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View */}
                            <div className="md:hidden space-y-3 p-2 bg-gray-50/30">
                                {expenseProjects.length === 0 && (
                                    <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-100">No expense records found.</div>
                                )}
                                {expenseProjects.map(projectName => {
                                    const projectRecords = groupedExpenses[projectName] || [];
                                    const totalAmount = projectRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

                                    return (
                                        <div key={projectName} className="space-y-2">
                                            <div
                                                className="flex items-center gap-2 px-1 cursor-pointer py-1"
                                                onClick={() => toggleExpenseProject(projectName)}
                                            >
                                                {collapsedExpenseProjects[projectName]
                                                    ? <FiChevronRight className="w-4 h-4 text-gray-400" />
                                                    : <FiChevronDown className="w-4 h-4 text-gray-400" />
                                                }
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">
                                                    {projectName}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">
                                                    ₹{totalAmount.toLocaleString()}
                                                </span>
                                            </div>

                                            {!collapsedExpenseProjects[projectName] && (
                                                <div className="space-y-2">
                                                    {projectRecords.map(exp => {
                                                        const bills = Array.isArray(exp.bill_urls) ? exp.bill_urls.filter(Boolean) : [];
                                                        return (
                                                            <div key={exp.id} className="p-4 space-y-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="space-y-0.5">
                                                                        <span className="font-bold text-gray-900 text-base">₹{(Number(exp.amount) || 0).toLocaleString()}</span>
                                                                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                                                            <span>{exp.expense_date ? formatDateIST(exp.expense_date) : 'N/A'}</span>
                                                                        </div>
                                                                    </div>
                                                                    <StatusBadge status={exp.status} variant={getStatusVariant(exp.status)} />
                                                                </div>
                                                                <p className="text-xs text-gray-600 leading-relaxed font-medium">{exp.description || 'No description'}</p>
                                                                {bills.length > 0 && (
                                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                                        {bills.map((url: string, idx: number) => (
                                                                            <button 
                                                                                key={idx} 
                                                                                onClick={() => {
                                                                                    setViewingBills(bills);
                                                                                    setViewingBillIndex(idx);
                                                                                }}
                                                                                className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 transition-colors cursor-pointer"
                                                                            >
                                                                                View Bill{bills.length > 1 ? ` ${idx + 1}` : ''}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-900">Employee Documents</h3>
                                {isAdmin && (
                                    <button
                                        onClick={() => setIsUploadModalOpen(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold rounded-xl transition-colors"
                                    >
                                        <FiUploadCloud /> Upload Document
                                    </button>
                                )}
                            </div>

                            {documents.length === 0 ? (
                                <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                                    <FiFileText className="mx-auto text-4xl text-gray-300 mb-3" />
                                    <h3 className="text-gray-900 font-bold mb-1">No Documents</h3>
                                    <p className="text-gray-500 text-sm">No documents have been uploaded for this employee yet.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {documents.map(doc => (
                                        <div key={doc.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                                                        <FiFileText size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 line-clamp-1" title={doc.document_name}>{doc.document_name}</h4>
                                                        <p className="text-xs text-gray-500 mt-0.5">{formatDateIST(doc.created_at).split(',')[0]}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50">
                                                {doc.signed_url && (
                                                    <button 
                                                        onClick={() => openExternalLink(doc.signed_url)}
                                                        className="flex-1 inline-flex justify-center items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-lg transition-colors"
                                                    >
                                                        <FiEye /> View
                                                    </button>
                                                )}
                                                {isAdmin && (
                                                    <button 
                                                        onClick={() => handleDeleteDocument(doc.id)}
                                                        className="inline-flex justify-center items-center p-2 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                                                        title="Delete Document"
                                                    >
                                                        <FiTrash2 />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">Upload Document</h3>
                            <button 
                                onClick={() => !uploadingDoc && setIsUploadModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                                disabled={uploadingDoc}
                            >
                                <FiX size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleUploadDocument} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Document Name</label>
                                <input 
                                    type="text" 
                                    value={docName}
                                    onChange={(e) => setDocName(e.target.value)}
                                    placeholder="e.g. Aadhar Card, Offer Letter"
                                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                                    required
                                    disabled={uploadingDoc}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">File</label>
                                <input 
                                    type="file" 
                                    onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 transition-all"
                                    required
                                    disabled={uploadingDoc}
                                    accept="image/*,.pdf,.doc,.docx"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-50 transition-colors"
                                    disabled={uploadingDoc}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    disabled={uploadingDoc || !docName || !docFile}
                                >
                                    {uploadingDoc ? (
                                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Uploading...</>
                                    ) : (
                                        <><FiUploadCloud /> Upload</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {viewingBills.length > 0 && (
                <ImageModal
                    images={viewingBills}
                    currentIndex={viewingBillIndex}
                    isOpen={viewingBills.length > 0}
                    onClose={() => setViewingBills([])}
                    onNavigate={(index) => setViewingBillIndex(index)}
                />
            )}
        </div>
    );
}

function StatCard({ title, value, prefix = '', suffix = '', subtitle, icon, iconBg, iconColor, trend, trendColor }: any) {
    const animatedValue = useCountUp(typeof value === 'number' ? value : 0);
    const displayValue = typeof value === 'number' ? animatedValue : value;
    
    return (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: iconBg, color: iconColor }}
                >
                    {icon}
                </div>
                {trend && (
                    <span className={`text-[10px] font-extrabold px-2 py-1 rounded-md bg-gray-50 ${trendColor}`}>
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <p className="text-3xl font-bold text-gray-900 flex items-baseline gap-1">
                    {prefix && <span className="text-xl text-gray-400">{prefix}</span>}
                    {typeof displayValue === 'number' && prefix === '₹' ? displayValue.toLocaleString() : displayValue}
                    {suffix && <span className="text-xl text-gray-400">{suffix}</span>}
                </p>
                <p className="text-sm font-medium text-gray-500 mt-0.5">{title}</p>
                {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
            </div>
        </div>
    );
}

function PerformanceMetricRow({ label, value, percentage, color }: any) {
    const animatedPercentage = useCountUp(percentage || 0);
    
    return (
        <div className="space-y-2.5">
            <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-gray-700">{label}</span>
                <span className="text-gray-900 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">{value}</span>
            </div>
            <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`} 
                    style={{ width: `${animatedPercentage}%` }}
                ></div>
            </div>
        </div>
    );
}
