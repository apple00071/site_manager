'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { FiUser, FiClock, FiCalendar, FiBriefcase, FiActivity, FiArrowLeft, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';
import { formatDateIST } from '@/lib/dateUtils';
import { DataTable, StatusBadge, getStatusVariant } from '@/components/ui/DataTable';
import Link from 'next/link';

interface PerformanceMetrics {
    updateCount: number;
    avgSnagResolveHours: number;
    taskAdherenceRate: number;
    attendanceConsistency: number;
    communicationScore: number;
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

    useEffect(() => {
        setTitle('Employee 360');
        setSubtitle('Comprehensive Performance View');
    }, [setTitle, setSubtitle]);

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                // Fetch basic user info
                const userRes = await fetch(`/api/admin/users?id=${id}`);
                const userData = await userRes.json();
                setUser(userData);

                // Fetch Performance Metrics
                const perfRes = await fetch(`/api/admin/users/${id}/performance`);
                const perfData = await perfRes.json();
                setMetrics(perfData.metrics);

                // Fetch Attendance
                const attRes = await fetch(`/api/attendance?user_id=${id}`);
                const attData = await attRes.json();
                setAttendance(attData);

                // Fetch Projects
                const projRes = await fetch(`/api/admin/projects?userId=${id}`);
                const projData = await projRes.json();
                setProjects(projData);

                // Fetch Leaves
                const leaveRes = await fetch(`/api/leaves?user_id=${id}`);
                const leaveData = await leaveRes.json();
                setLeaves(leaveData.leaves || []);

                // Fetch Expenses
                const expRes = await fetch(`/api/office-expenses?user_id=${id}`);
                const expData = await expRes.json();
                setExpenses(expData.expenses || []);

            } catch (error) {
                console.error('Error fetching profile data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchAllData();
    }, [id]);

    const tabs = [
        { id: 'performance', label: 'Performance', icon: <FiActivity /> },
        { id: 'projects', label: 'Projects', icon: <FiBriefcase /> },
        { id: 'attendance', label: 'Attendance', icon: <FiClock /> },
        { id: 'leaves', label: 'Leaves', icon: <FiCalendar /> },
        { id: 'expenses', label: 'Expenses', icon: <TbCurrencyRupee /> },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header / Profile Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="h-20 w-20 rounded-2xl bg-yellow-50 flex items-center justify-center text-yellow-600">
                        <FiUser size={40} />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-bold text-gray-900">{user?.full_name}</h1>
                            <Link href="/dashboard/organization" className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium">
                                <FiArrowLeft /> Back to Directory
                            </Link>
                        </div>
                        <p className="text-gray-500 font-medium mt-1">{user?.designation || 'Team Member'}</p>
                        <div className="flex flex-wrap gap-4 mt-4">
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider">
                                {user?.roles?.name || user?.role || 'User'}
                            </span>
                            <span className="text-sm text-gray-500 flex items-center gap-1">
                                <FiCalendar className="text-gray-400" /> Member since {formatDateIST(user?.created_at).split(',')[0]}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Site Updates"
                    value={metrics?.updateCount || 0}
                    subtitle="Last 30 days"
                    icon={<FiActivity className="text-blue-500" />}
                    trend={metrics?.updateCount && metrics.updateCount > 5 ? 'High Regularity' : 'Needs Improvement'}
                    trendColor={metrics?.updateCount && metrics.updateCount > 5 ? 'text-green-600' : 'text-orange-600'}
                />
                <StatCard
                    title="Snag Resolution"
                    value={`${metrics?.avgSnagResolveHours || 0}h`}
                    subtitle="Avg. efficiency"
                    icon={<FiCheckCircle className="text-green-500" />}
                    trend={metrics?.avgSnagResolveHours && metrics.avgSnagResolveHours < 48 ? 'Efficient' : 'Slow Response'}
                    trendColor={metrics?.avgSnagResolveHours && metrics.avgSnagResolveHours < 48 ? 'text-green-600' : 'text-orange-600'}
                />
                <StatCard
                    title="Active Projects"
                    value={projects.filter(p => p.status !== 'completed').length}
                    subtitle="Currently assigned"
                    icon={<FiBriefcase className="text-yellow-500" />}
                />
                <StatCard
                    title="Approved Costs"
                    value={`₹${expenses.filter(e => e.status === 'approved').reduce((acc, e) => acc + (Number(e.amount) || 0), 0).toLocaleString()}`}
                    subtitle="Total office expenses"
                    icon={<TbCurrencyRupee className="text-purple-500" />}
                />
            </div>

            {/* Tabbed Content Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Tab Navigation */}
                <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar scroll-smooth">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-all whitespace-nowrap border-b-2 flex-shrink-0 ${activeTab === tab.id
                                ? 'text-yellow-600 border-yellow-500 bg-yellow-50/30'
                                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <span className="flex-shrink-0">{tab.icon}</span>
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
                        <>
                            <div className="hidden md:block">
                                <DataTable
                                    data={attendance}
                                    keyField="id"
                                    columns={[
                                        { label: 'Date', key: 'date', render: (val) => formatDateIST(val).split(',')[0] },
                                        { label: 'Check In', key: 'check_in', render: (val) => formatDateIST(val).split(',')[1] },
                                        { label: 'Check Out', key: 'check_out', render: (val) => val ? formatDateIST(val).split(',')[1] : '-' },
                                        { label: 'Status', key: 'status', render: (_, row) => <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${row.check_out ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{row.check_out ? 'Completed' : 'Active'}</span> },
                                    ]}
                                />
                            </div>
                            <div className="md:hidden divide-y divide-gray-100">
                                {attendance.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">No attendance records found.</div>
                                ) : (
                                    attendance.map(record => (
                                        <div key={record.id} className="p-4 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-gray-900 text-sm">{formatDateIST(record.date).split(',')[0]}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${record.check_out ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} uppercase`}>
                                                    {record.check_out ? 'Completed' : 'Active'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                                                    <span className="block text-[9px] uppercase tracking-wider text-blue-500 font-bold mb-0.5">In</span>
                                                    <span className="font-bold text-blue-700">{formatDateIST(record.check_in).split(',')[1]}</span>
                                                </div>
                                                <div className="bg-orange-50/50 p-2 rounded-lg border border-orange-100/50">
                                                    <span className="block text-[9px] uppercase tracking-wider text-orange-500 font-bold mb-0.5">Out</span>
                                                    <span className="font-bold text-orange-700">{record.check_out ? formatDateIST(record.check_out).split(',')[1] : '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'leaves' && (
                        <>
                            <div className="hidden md:block">
                                <DataTable
                                    data={leaves}
                                    keyField="id"
                                    columns={[
                                        { label: 'Leave Type', key: 'leave_type', render: (val) => <span className="capitalize">{val.replace(/_/g, ' ')}</span> },
                                        { label: 'Duration', key: 'start_date', render: (_, row) => `${formatDateIST(row.start_date).split(',')[0]} to ${formatDateIST(row.end_date).split(',')[0]}` },
                                        { label: 'Status', key: 'status', render: (val) => <StatusBadge status={val} variant={getStatusVariant(val)} /> },
                                        { label: 'Reason', key: 'reason', render: (val) => <span className="text-gray-500 text-xs truncate max-w-[200px] inline-block">{val}</span> },
                                    ]}
                                />
                            </div>
                            <div className="md:hidden divide-y divide-gray-100">
                                {leaves.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">No leave requests found.</div>
                                ) : (
                                    leaves.map(l => (
                                        <div key={l.id} className="p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <span className="font-bold text-gray-900 text-sm capitalize">{l.leave_type.replace(/_/g, ' ')}</span>
                                                <StatusBadge status={l.status} variant={getStatusVariant(l.status)} />
                                            </div>
                                            <div className="flex flex-col gap-1 text-[11px] text-gray-600">
                                                <div className="flex items-center gap-1">
                                                    <FiCalendar className="text-gray-400" />
                                                    {formatDateIST(l.start_date).split(',')[0]} to {formatDateIST(l.end_date).split(',')[0]}
                                                </div>
                                                {l.reason && (
                                                    <p className="text-gray-500 mt-1 line-clamp-2 italic leading-tight">"{l.reason}"</p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'expenses' && (
                        <>
                            <div className="hidden md:block">
                                <DataTable
                                    data={expenses}
                                    keyField="id"
                                    columns={[
                                        { label: 'Date', key: 'expense_date', render: (val) => formatDateIST(val).split(',')[0] },
                                        { label: 'Description', key: 'description' },
                                        { label: 'Amount', key: 'amount', render: (val) => <span className="font-bold text-gray-900">₹{val}</span> },
                                        { label: 'Status', key: 'status', render: (val) => <StatusBadge status={val} variant={getStatusVariant(val)} /> },
                                    ]}
                                />
                            </div>
                            <div className="md:hidden divide-y divide-gray-100">
                                {expenses.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">No expense records found.</div>
                                ) : (
                                    expenses.map(exp => (
                                        <div key={exp.id} className="p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900 text-sm">₹{(Number(exp.amount) || 0).toLocaleString()}</span>
                                                    <span className="text-[10px] text-gray-500">{formatDateIST(exp.expense_date).split(',')[0]}</span>
                                                </div>
                                                <StatusBadge status={exp.status} variant={getStatusVariant(exp.status)} />
                                            </div>
                                            <p className="text-xs text-gray-600 line-clamp-2">{exp.description || 'No description'}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, subtitle, icon, trend, trendColor }: any) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">{title}</span>
                <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
            {trend && <div className={`text-[10px] font-bold mt-2 ${trendColor}`}>{trend}</div>}
        </div>
    );
}

function PerformanceMetricRow({ label, value, percentage, color }: any) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-gray-600">{label}</span>
                <span className="text-gray-900">{value}</span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
}
