'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { 
  FiFileText, 
  FiCalendar, 
  FiFilter, 
  FiPrinter, 
  FiShare2, 
  FiRefreshCw, 
  FiCheckCircle, 
  FiCamera, 
  FiClock, 
  FiAlertTriangle, 
  FiUser, 
  FiMapPin, 
  FiLayers, 
  FiFolder,
  FiChevronRight
} from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';

interface AvailableUser {
  id: string;
  name: string;
  designation?: string;
  type: 'site_engineer' | 'designer';
}

interface UserReport {
  user: {
    id: string;
    name: string;
    email: string;
    designation: string;
    role: string;
    phone?: string;
    type: 'site_engineer' | 'designer' | 'other';
  };
  metrics: {
    totalUpdates: number;
    totalPhotos: number;
    activeProjectsCount: number;
    attendanceDays: number;
    snagsTotal: number;
    snagsResolved: number;
    designsUploaded: number;
    designsFrozen: number;
  };
  activeProjects: Array<{
    id: string;
    title: string;
    customer_name?: string;
    status: string;
    workflow_stage?: string;
    unified_status?: string;
    project_notes?: string;
    deadline?: string;
    estimated_completion_date?: string;
  }>;
  updates: Array<{
    id: string;
    project_id: string;
    project_title: string;
    customer_name?: string;
    update_date: string;
    created_at: string;
    description: string;
    photosCount: number;
    photos: string[];
  }>;
  designs?: Array<{
    id: string;
    project_title: string;
    file_name: string;
    file_type: string;
    version: number;
    approval_status: string;
    is_frozen: boolean;
    created_at: string;
  }>;
}

interface ReportData {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalUpdates: number;
    totalPhotos: number;
    activeProjectsCount: number;
    totalSnagsResolved: number;
    totalAttendanceDays: number;
    totalDesignsUploaded: number;
    totalDesignsFrozen: number;
  };
  users: UserReport[];
  availableUsers: AvailableUser[];
}

type PresetType = 'this_week' | 'last_7_days' | 'last_week' | 'this_month' | 'custom';

// Helpers to compute standard date strings (YYYY-MM-DD)
const toDateInputString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPresetDates = (preset: PresetType): { start: string; end: string } => {
  const now = new Date();
  
  if (preset === 'this_week') {
    // Current week starting Monday
    const day = now.getDay();
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diffToMonday));
    return {
      start: toDateInputString(monday),
      end: toDateInputString(new Date())
    };
  }

  if (preset === 'last_week') {
    // Previous week Monday to Sunday
    const day = now.getDay();
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
    const prevMonday = new Date(now.setDate(diffToMonday));
    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);
    return {
      start: toDateInputString(prevMonday),
      end: toDateInputString(prevSunday)
    };
  }

  if (preset === 'this_month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      start: toDateInputString(firstDay),
      end: toDateInputString(now)
    };
  }

  // Default: last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return {
    start: toDateInputString(sevenDaysAgo),
    end: toDateInputString(new Date())
  };
};

export default function ReportsPage() {
  const { showToast } = useToast();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [roleFilter, setRoleFilter] = useState<'all' | 'site_engineer' | 'designer'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<PresetType>('last_7_days');
  
  const initialDates = getPresetDates('last_7_days');
  const [startDate, setStartDate] = useState<string>(initialDates.start);
  const [endDate, setEndDate] = useState<string>(initialDates.end);
  
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  // Apply preset dates
  const handlePresetChange = (preset: PresetType) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const { start, end } = getPresetDates(preset);
      setStartDate(start);
      setEndDate(end);
    }
  };

  // Fetch report data from API
  const fetchReport = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        role: roleFilter,
        userId: selectedUserId,
        startDate,
        endDate
      });

      const res = await fetch(`/api/admin/reports?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch report data');
      }

      const data = await res.json();
      setReportData(data);
    } catch (err: any) {
      console.error('Error fetching report:', err);
      showToast('error', err.message || 'Error loading report');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, roleFilter, selectedUserId, startDate, endDate, showToast]);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchReport();
    }
  }, [authLoading, isAdmin, fetchReport]);

  // Copy Executive Summary for WhatsApp / Sharing
  const copyWhatsAppSummary = () => {
    if (!reportData) return;

    const lines: string[] = [];
    lines.push(`📊 *APPLE INTERIOR - WEEKLY PERFORMANCE REPORT*`);
    lines.push(`📅 Period: ${reportData.period.startDate} to ${reportData.period.endDate}`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📈 *TEAM TOTALS:*`);
    lines.push(`• Daily Updates Logged: ${reportData.summary.totalUpdates}`);
    lines.push(`• Active Sites / Projects: ${reportData.summary.activeProjectsCount}`);
    lines.push(`• Site Photos Uploaded: ${reportData.summary.totalPhotos}`);
    lines.push(`• Snags Resolved: ${reportData.summary.totalSnagsResolved}`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━\n`);

    reportData.users.forEach(u => {
      const icon = u.user.type === 'site_engineer' ? '🏗️' : '🎨';
      lines.push(`${icon} *${u.user.name}* (${u.user.designation})`);
      lines.push(`  • Updates: ${u.metrics.totalUpdates} | Photos: ${u.metrics.totalPhotos} | Sites: ${u.metrics.activeProjectsCount}`);
      lines.push(`  • Attendance: ${u.metrics.attendanceDays} days present`);
      if (u.user.type === 'designer') {
        lines.push(`  • Drawings Uploaded: ${u.metrics.designsUploaded} (Frozen: ${u.metrics.designsFrozen})`);
      }
      if (u.updates.length > 0) {
        const latestUpdate = u.updates[0];
        lines.push(`  • Latest: "${latestUpdate.project_title}" - ${latestUpdate.description.slice(0, 70)}...`);
      }
      lines.push(``);
    });

    lines.push(`Generated via Apple Interior Manager`);

    navigator.clipboard.writeText(lines.join('\n'));
    showToast('success', 'Executive report summary copied to clipboard!');
  };

  // Filter available users for dropdown by current role filter
  const filteredAvailableUsers = useMemo(() => {
    if (!reportData?.availableUsers) return [];
    if (roleFilter === 'all') return reportData.availableUsers;
    return reportData.availableUsers.filter(u => u.type === roleFilter);
  }, [reportData?.availableUsers, roleFilter]);

  if (authLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-500" />
        <p className="text-xs font-bold text-gray-500">Checking credentials...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shadow-2xs">
          <FiAlertTriangle className="w-7 h-7 text-rose-600" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900">Admin Access Required</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto font-medium">
            This performance reporting dashboard is restricted to system administrators only.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 text-left">
      {/* Print-only Header */}
      <div className="hidden print:block mb-6 border-b border-gray-300 pb-4">
        <h1 className="text-2xl font-black text-gray-900">Apple Interior - Team Performance Report</h1>
        <p className="text-sm text-gray-600 mt-1">
          Period: <strong>{startDate}</strong> to <strong>{endDate}</strong> | Filter: {roleFilter === 'all' ? 'All Team' : roleFilter === 'site_engineer' ? 'Site Engineers' : 'Designers'}
        </p>
      </div>

      {/* Main Top Header (Screen Only) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 border border-yellow-200/80 flex items-center justify-center text-yellow-600">
              <FiFileText className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Team Performance Reports</h1>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Weekly &amp; custom activity reports for Site Engineers and Designers
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={copyWhatsAppSummary}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Copy formatted summary to paste into WhatsApp"
          >
            <FiShare2 className="w-4 h-4 text-emerald-600" />
            <span>Copy WhatsApp Summary</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <FiPrinter className="w-4 h-4 text-gray-600" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Card (Screen Only) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Role Segmented Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => {
                setRoleFilter('all');
                setSelectedUserId('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                roleFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              👥 All Team
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleFilter('site_engineer');
                setSelectedUserId('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                roleFilter === 'site_engineer'
                  ? 'bg-yellow-500 text-white shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              🏗️ Site Engineers
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleFilter('designer');
                setSelectedUserId('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                roleFilter === 'designer'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              🎨 Designers
            </button>
          </div>

          {/* Member Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 hidden sm:inline">Member:</span>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 hover:bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 cursor-pointer"
            >
              <option value="all">
                {roleFilter === 'site_engineer' ? 'All Site Engineers' : roleFilter === 'designer' ? 'All Designers' : 'All Team Members'}
              </option>
              {filteredAvailableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.designation ? `(${u.designation})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filters Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
              <FiCalendar className="w-3.5 h-3.5 text-gray-400" /> Date:
            </span>
            {(['this_week', 'last_7_days', 'last_week', 'this_month', 'custom'] as PresetType[]).map((preset) => {
              const labels: Record<PresetType, string> = {
                this_week: 'This Week',
                last_7_days: 'Last 7 Days',
                last_week: 'Last Week',
                this_month: 'This Month',
                custom: 'Custom Range'
              };
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetChange(preset)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    datePreset === preset
                      ? 'bg-gray-900 text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80'
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>

          {/* Custom Date Inputs & Fetch Button */}
          <div className="flex items-center gap-2 flex-wrap">
            {datePreset === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1 text-xs font-bold border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-yellow-500"
                />
                <span className="text-xs text-gray-400 font-bold">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1 text-xs font-bold border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-yellow-500"
                />
              </div>
            )}

            <button
              type="button"
              onClick={fetchReport}
              disabled={loading}
              className="px-3.5 py-1 bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Generate'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-500" />
          <p className="text-xs font-bold text-gray-500">Aggregating site logs and designer milestones...</p>
        </div>
      ) : !reportData || reportData.users.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-200 space-y-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-xl">
            📋
          </div>
          <h3 className="text-base font-bold text-gray-800">No Activity Logged</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            No updates or site logs were found for the selected team members and date range ({startDate} to {endDate}). Try selecting a broader date range or another role.
          </p>
        </div>
      ) : (
        <>
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Updates Logged</span>
              <div className="text-2xl font-black text-gray-900 mt-1 flex items-center justify-between">
                <span>{reportData.summary.totalUpdates}</span>
                <span className="text-base">📝</span>
              </div>
              <p className="text-[10px] text-gray-500 font-medium mt-1">Daily reports posted</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Active Projects</span>
              <div className="text-2xl font-black text-yellow-600 mt-1 flex items-center justify-between">
                <span>{reportData.summary.activeProjectsCount}</span>
                <span className="text-base">🏗️</span>
              </div>
              <p className="text-[10px] text-gray-500 font-medium mt-1">Sites in progress</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Site Photos</span>
              <div className="text-2xl font-black text-blue-600 mt-1 flex items-center justify-between">
                <span>{reportData.summary.totalPhotos}</span>
                <span className="text-base">📸</span>
              </div>
              <p className="text-[10px] text-gray-500 font-medium mt-1">Visual proof uploads</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Snags Resolved</span>
              <div className="text-2xl font-black text-emerald-600 mt-1 flex items-center justify-between">
                <span>{reportData.summary.totalSnagsResolved}</span>
                <span className="text-base">✅</span>
              </div>
              <p className="text-[10px] text-gray-500 font-medium mt-1">Quality defects closed</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs col-span-2 sm:col-span-1">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Attendance Days</span>
              <div className="text-2xl font-black text-purple-600 mt-1 flex items-center justify-between">
                <span>{reportData.summary.totalAttendanceDays}</span>
                <span className="text-base">📅</span>
              </div>
              <p className="text-[10px] text-gray-500 font-medium mt-1">Cumulative days present</p>
            </div>
          </div>

          {/* Member Detailed Breakdown Cards */}
          <div className="space-y-6">
            {reportData.users.map((memberReport) => {
              const { user, metrics, activeProjects, updates: userUpdates, designs } = memberReport;
              const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'ST';
              const isEngineer = user.type === 'site_engineer';

              return (
                <div 
                  key={user.id} 
                  className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden break-inside-avoid"
                >
                  {/* Member Card Header */}
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-gray-50/90 to-white border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-xs ${
                        isEngineer ? 'bg-gradient-to-br from-yellow-500 to-amber-600' : 'bg-gradient-to-br from-purple-500 to-indigo-600'
                      }`}>
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-sm sm:text-base text-gray-900">{user.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                            isEngineer 
                              ? 'bg-amber-50 text-amber-800 border-amber-200' 
                              : 'bg-purple-50 text-purple-800 border-purple-200'
                          }`}>
                            {user.designation}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                          {user.email} {user.phone ? `• ${user.phone}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Member Quick Stats Chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="px-2.5 py-1 bg-white rounded-xl border border-gray-200/80 text-xs font-bold text-gray-700 shadow-2xs">
                        <span className="text-gray-400 font-medium">Updates:</span> {metrics.totalUpdates}
                      </div>
                      <div className="px-2.5 py-1 bg-white rounded-xl border border-gray-200/80 text-xs font-bold text-gray-700 shadow-2xs">
                        <span className="text-gray-400 font-medium">Photos:</span> {metrics.totalPhotos}
                      </div>
                      <div className="px-2.5 py-1 bg-white rounded-xl border border-gray-200/80 text-xs font-bold text-gray-700 shadow-2xs">
                        <span className="text-gray-400 font-medium">Active Sites:</span> {activeProjects.length}
                      </div>
                      <div className="px-2.5 py-1 bg-white rounded-xl border border-gray-200/80 text-xs font-bold text-gray-700 shadow-2xs">
                        <span className="text-gray-400 font-medium">Attendance:</span> {metrics.attendanceDays}d
                      </div>
                    </div>
                  </div>

                  {/* Body: Active Projects & Chronological Update Log */}
                  <div className="p-4 sm:p-5 space-y-5">
                    
                    {/* Active Projects Assigned */}
                    {activeProjects.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-black uppercase text-gray-400 tracking-wider mb-2 flex items-center gap-1.5">
                          <FiFolder className="w-3.5 h-3.5 text-gray-400" />
                          <span>Active Projects Assigned ({activeProjects.length})</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {activeProjects.map(proj => (
                            <Link 
                              key={proj.id}
                              href={`/dashboard/projects/${proj.id}`}
                              className="p-2.5 rounded-xl border border-gray-100 hover:border-yellow-300 bg-gray-50/60 hover:bg-white transition-all flex items-start justify-between gap-2 group cursor-pointer"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-xs text-gray-900 group-hover:text-yellow-600 truncate">
                                  {proj.title}
                                </p>
                                <p className="text-[10px] text-gray-500 truncate mt-0.5">
                                  {proj.customer_name || 'No client specified'}
                                </p>
                              </div>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 bg-white border border-gray-200 text-gray-600">
                                {proj.workflow_stage || proj.status || 'Active'}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Designer Drawing Milestones (If Designer) */}
                    {!isEngineer && designs && designs.length > 0 && (
                      <div className="pt-2 border-t border-gray-100">
                        <h4 className="text-[11px] font-black uppercase text-gray-400 tracking-wider mb-2 flex items-center gap-1.5">
                          <FiLayers className="w-3.5 h-3.5 text-purple-500" />
                          <span>Drawings &amp; Design Files Uploaded ({designs.length})</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {designs.map(d => (
                            <div key={d.id} className="p-2.5 bg-purple-50/40 rounded-xl border border-purple-100 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-gray-900 truncate">{d.file_name}</p>
                                <p className="text-[10px] text-gray-500 truncate">Project: {d.project_title} • v{d.version}</p>
                              </div>
                              {d.is_frozen ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                                  Frozen ❄️
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-gray-600 border border-gray-200 shrink-0">
                                  {d.approval_status || 'Draft'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Site Engineer Activity Log Stream */}
                    <div>
                      <h4 className="text-[11px] font-black uppercase text-gray-400 tracking-wider mb-2.5 flex items-center gap-1.5">
                        <FiClock className="w-3.5 h-3.5 text-gray-400" />
                        <span>Work Updates Posted ({userUpdates.length})</span>
                      </h4>

                      {userUpdates.length === 0 ? (
                        <div className="py-4 px-3 bg-amber-50/50 rounded-xl border border-amber-200/60 text-xs text-amber-800 flex items-center gap-2">
                          <FiAlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>No site updates or logs were posted by this member during this period.</span>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {userUpdates.map((u) => {
                            const dateStr = u.update_date || u.created_at;
                            const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'Recent';

                            return (
                              <div 
                                key={u.id}
                                className="p-3 bg-gray-50/70 hover:bg-gray-50 rounded-xl border border-gray-100 space-y-1.5 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-black text-xs text-gray-900 truncate">
                                      {u.project_title}
                                    </span>
                                    {u.customer_name && (
                                      <span className="text-[10px] text-gray-500 font-medium truncate">
                                        ({u.customer_name})
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {u.photosCount > 0 && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                        <FiCamera className="w-3 h-3 text-blue-600" />
                                        <span>{u.photosCount} photo{u.photosCount > 1 ? 's' : ''}</span>
                                      </span>
                                    )}
                                    <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">
                                      {formattedDate}
                                    </span>
                                  </div>
                                </div>

                                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line font-medium">
                                  {u.description}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
