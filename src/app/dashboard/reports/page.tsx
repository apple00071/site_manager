'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { 
  FiCalendar, 
  FiRefreshCw, 
  FiAlertTriangle, 
  FiDownload
} from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useBranch } from '@/contexts/BranchContext';

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
  }>;
  updates: Array<{
    id: string;
    project_id: string;
    project_title: string;
    customer_name?: string;
    created_at: string;
    description: string;
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
  };
  users: UserReport[];
  availableUsers: AvailableUser[];
}

type PresetType = 'this_week' | 'last_7_days' | 'last_week' | 'this_month' | 'custom';

const toDateInputString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPresetDates = (preset: PresetType): { start: string; end: string } => {
  const now = new Date();
  
  if (preset === 'this_week') {
    const day = now.getDay();
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diffToMonday));
    return {
      start: toDateInputString(monday),
      end: toDateInputString(new Date())
    };
  }

  if (preset === 'last_week') {
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

const formatDateRangeHeader = (startStr: string, endStr: string): string => {
  if (!startStr || !endStr) return '';
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return `${startStr} to ${endStr}`;
  
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const endDay = end.getDate();
  const endYear = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} to ${endDay}, ${endYear}`;
  }
  return `${startMonth} ${startDay} to ${endMonth} ${endDay}, ${endYear}`;
};

export default function ReportsPage() {
  const { showToast } = useToast();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { currentBranch } = useBranch();
  const { hasPermission } = useUserPermissions();
  const { setTitle } = useHeaderTitle();

  const canViewReports = isAdmin || hasPermission('reports.view');
  const canExportReports = isAdmin || hasPermission('reports.export');

  useEffect(() => {
    setTitle('Performance Reports');
  }, [setTitle]);
  
  const [roleFilter, setRoleFilter] = useState<'site_engineer' | 'designer'>('site_engineer');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<PresetType>('last_7_days');
  
  const initialDates = getPresetDates('last_7_days');
  const [startDate, setStartDate] = useState<string>(initialDates.start);
  const [endDate, setEndDate] = useState<string>(initialDates.end);
  
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const slideRef = useRef<HTMLDivElement>(null);

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
    if (!canViewReports) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        role: roleFilter,
        userId: selectedUserId,
        startDate,
        endDate
      });
      if (currentBranch !== 'all') {
        params.set('branch', currentBranch);
      }

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
  }, [canViewReports, roleFilter, selectedUserId, startDate, endDate, currentBranch, showToast]);

  useEffect(() => {
    if (!authLoading && canViewReports) {
      fetchReport();
    }
  }, [authLoading, canViewReports, fetchReport]);

  const roleTitle = roleFilter === 'site_engineer' 
    ? 'Weekly Site Engineer Report' 
    : 'Weekly Designer Report';

  // Sorted user reports by updates descending
  const sortedReports = useMemo(() => {
    if (!reportData?.users) return [];
    return [...reportData.users].sort((a, b) => b.metrics.totalUpdates - a.metrics.totalUpdates);
  }, [reportData]);

  // Compute scale and maximum for dual bar chart
  const maxChartValue = useMemo(() => {
    if (sortedReports.length === 0) return 50;
    const maxVal = Math.max(...sortedReports.map(u => Math.max(u.metrics.attendanceDays, u.metrics.totalUpdates)));
    return Math.max(20, Math.ceil((maxVal + 5) / 10) * 10);
  }, [sortedReports]);

  // Chart Y-Axis tick steps (5 ticks)
  const yAxisTicks = useMemo(() => {
    const step = maxChartValue / 5;
    return [maxChartValue, step * 4, step * 3, step * 2, step, 0];
  }, [maxChartValue]);

  // High-resolution image generator using html-to-image (SVG foreignObject native browser render)
  const getSlideDataUrl = async (): Promise<string> => {
    const el = slideRef.current;
    if (!el) throw new Error('Slide element not found');

    const { toPng } = await import('html-to-image');
    return await toPng(el, {
      pixelRatio: 2.5,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });
  };

  // Download as High-Resolution PNG Image
  const handleDownloadPNG = async () => {
    try {
      setDownloading(true);
      const dataUrl = await getSlideDataUrl();

      const link = document.createElement('a');
      link.href = dataUrl;
      const cleanTitle = roleTitle.replace(/\s+/g, '_');
      link.download = `${cleanTitle}_${startDate}_to_${endDate}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('success', 'Corporate report slide downloaded as PNG image!');
    } catch (err: any) {
      console.error('PNG export failed:', err);
      showToast('error', 'Could not export PNG image: ' + (err?.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-500" />
        <p className="text-xs font-bold text-gray-500">Checking credentials...</p>
      </div>
    );
  }

  if (!canViewReports) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shadow-2xs">
          <FiAlertTriangle className="w-7 h-7 text-rose-600" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900">Reports Access Required</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto font-medium">
            This performance reporting dashboard is restricted. Contact an administrator to grant you access.
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
    <div className="space-y-6 pb-16 text-left w-full">
      
      {/* ─── SLEEK TOP CONTROLS BAR (APPLE INTERIORS BRAND DESIGN) ──────── */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4 print:hidden w-full">
        {/* Top Header Row with Logo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center shrink-0">
              <img 
                src="/New-logo.png" 
                alt="Apple Interiors" 
                className="w-7 h-7 object-contain"
                crossOrigin="anonymous"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                  Performance Reports
                </h1>
              </div>
              <p className="text-xs font-medium text-gray-500">
                Corporate executive presentation slides & team operational summaries
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Role Pill Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl w-fit border border-gray-200">
            <button
              type="button"
              onClick={() => {
                setRoleFilter('site_engineer');
                setSelectedUserId('all');
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                roleFilter === 'site_engineer'
                  ? 'bg-yellow-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              <span>🏗️</span>
              <span>Site Engineers</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleFilter('designer');
                setSelectedUserId('all');
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                roleFilter === 'designer'
                  ? 'bg-yellow-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              <span>🎨</span>
              <span>Designers</span>
            </button>
          </div>

          {/* Action Download Button */}
          {canExportReports && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPNG}
                disabled={downloading || loading}
                className="btn-primary py-2 px-4 text-xs sm:text-sm font-medium cursor-pointer disabled:opacity-50"
                title="Download presentation slide as PNG"
              >
                <FiDownload className="w-4 h-4 text-white" />
                <span>{downloading ? 'Downloading...' : 'Download'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Date Filters Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
              <FiCalendar className="w-3.5 h-3.5 text-gray-400" /> Period:
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
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    datePreset === preset
                      ? 'bg-yellow-500 text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>

          {/* Custom Date Pickers & Refresh Button */}
          <div className="flex items-center gap-2 flex-wrap">
            {datePreset === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-bold border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <span className="text-xs text-gray-400 font-bold">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-bold border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
            )}

            <button
              type="button"
              onClick={fetchReport}
              disabled={loading}
              className="p-2 bg-gray-100 hover:bg-yellow-50 text-gray-700 hover:text-yellow-900 rounded-lg transition-all cursor-pointer disabled:opacity-50 border border-gray-200"
              title="Refresh Report Data"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── MAIN PRESENTATION SLIDE (MATCHES EXACT PROMPT & BRAND IDENTITY) ─ */}
      {loading ? (
        <div className="py-28 flex flex-col items-center justify-center space-y-3 bg-white rounded-2xl border border-gray-200 shadow-sm w-full">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-500" />
          <p className="text-xs font-bold text-gray-500">Generating corporate slide...</p>
        </div>
      ) : !reportData || sortedReports.length === 0 ? (
        <div className="bg-white p-14 text-center rounded-2xl border border-gray-200 shadow-sm space-y-3 w-full">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-xl">
            📋
          </div>
          <h3 className="text-base font-bold text-gray-800">No Activity in Selected Period</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            No updates or attendance logs found between {startDate} and {endDate}. Select another date range above.
          </p>
        </div>
      ) : (
        <div 
          ref={slideRef}
          id="presentation-slide"
          className="w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col p-6 sm:p-10 lg:p-12 print:shadow-none print:border-none print:m-0 print:p-6 print:rounded-none"
          style={{ backgroundColor: '#ffffff' }}
        >
          {/* 1. TOP HEADER: TITLE WITH LOGO & DATE RANGE */}
          <div className="flex items-center justify-between pb-3 sm:pb-4">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <img 
                src="/New-logo.png" 
                alt="Apple Interiors" 
                className="h-9 sm:h-11 w-auto object-contain shrink-0"
                crossOrigin="anonymous"
              />
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-gray-950 tracking-tight">
                {roleTitle} — {formatDateRangeHeader(startDate, endDate)}
              </h1>
            </div>
          </div>

          {/* Sleek Brand Accent Line */}
          <div 
            className="w-full h-1 sm:h-1.5 rounded-full mb-6 sm:mb-8"
            style={{ backgroundColor: '#F59E0B' }}
          />

          {/* Structured Summary Table (Matches Exact 4-Column Format) */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-2xs mb-8 sm:mb-10">
            <table className="w-full text-center border-collapse">
              <tbody className="divide-y divide-gray-300 text-xs sm:text-base font-medium">
                {sortedReports.map((report, idx) => {
                  const projCount = report.activeProjects.length;
                  const isCrossSite = projCount === 0 && report.metrics.attendanceDays > 0;
                  const projText = roleFilter === 'designer'
                    ? `${projCount} Projects Assigned`
                    : (isCrossSite ? 'Cross-Site Supervision' : `${projCount} Projects Under Execution`);
                  
                  const daysText = `${report.metrics.attendanceDays} Days Present`;
                  const updatesText = roleFilter === 'designer'
                    ? `${report.metrics.totalUpdates} Designs Uploaded`
                    : (isCrossSite && report.metrics.totalUpdates === 0 ? 'Multi-Site Support' : `${report.metrics.totalUpdates} Project Updates`);

                  return (
                    <tr 
                      key={report.user.id} 
                      className={idx % 2 === 1 ? 'bg-gray-50/70' : 'bg-white'}
                    >
                      <td className="py-3.5 sm:py-4 px-4 sm:px-6 font-bold text-gray-950 border-r border-gray-300 text-left sm:text-center w-1/4">
                        {report.user.name}
                      </td>
                      <td className="py-3.5 sm:py-4 px-4 sm:px-6 text-gray-800 border-r border-gray-300 w-1/4 font-semibold">
                        {projText}
                      </td>
                      <td className="py-3.5 sm:py-4 px-4 sm:px-6 text-gray-800 border-r border-gray-300 w-1/4 font-semibold">
                        {daysText}
                      </td>
                      <td className="py-3.5 sm:py-4 px-4 sm:px-6 font-bold text-gray-950 w-1/4">
                        {updatesText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 3. DUAL-BAR COMPARISON CHART */}
          <div className="pt-2 pb-4">
            <div className="relative flex h-56 sm:h-68 w-full">
              
              {/* Chart Grid & Bars Container */}
              <div className="relative flex-1 flex flex-col justify-between">
                {/* Horizontal Background Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {yAxisTicks.map((tick) => (
                    <div 
                      key={tick} 
                      className="border-b w-full h-0 border-gray-100" 
                    />
                  ))}
                </div>

                {/* Bars Flex Row */}
                <div className="relative z-10 flex-1 flex items-end justify-around px-2 sm:px-8 border-b-2 border-gray-300">
                  {sortedReports.map((report) => {
                    const daysPresent = report.metrics.attendanceDays;
                    const updates = report.metrics.totalUpdates;
                    const daysHeight = Math.min(100, Math.max(4, (daysPresent / maxChartValue) * 100));
                    const updatesHeight = Math.min(100, Math.max(4, (updates / maxChartValue) * 100));

                    return (
                      <div key={report.user.id} className="flex flex-col items-center group">
                        {/* Paired Bars */}
                        <div className="flex items-end gap-1.5 sm:gap-3.5 h-44 sm:h-56">
                          {/* Dark Charcoal Bar: Attendance Days */}
                          <div className="flex flex-col items-center justify-end h-full">
                            <span 
                              className="text-[10px] sm:text-xs font-black mb-1 text-gray-900"
                            >
                              {daysPresent}
                            </span>
                            <div 
                              className="w-5 sm:w-12 transition-all shadow-2xs rounded-t-xs"
                              style={{ height: `${daysHeight}%`, backgroundColor: '#111827' }}
                              title={`${report.user.name}: ${daysPresent} days present`}
                            />
                          </div>

                          {/* Apple Brand Yellow Bar: Project Updates */}
                          <div className="flex flex-col items-center justify-end h-full">
                            <span 
                              className="text-[10px] sm:text-xs font-black mb-1"
                              style={{ color: '#D97706' }}
                            >
                              {updates}
                            </span>
                            <div 
                              className="w-5 sm:w-12 transition-all shadow-2xs rounded-t-xs"
                              style={{ height: `${updatesHeight}%`, backgroundColor: '#F59E0B' }}
                              title={`${report.user.name}: ${updates} updates`}
                            />
                          </div>
                        </div>

                        {/* X-Axis Name */}
                        <div className="mt-2.5 sm:mt-3 text-center max-w-[85px] sm:max-w-[130px]">
                          <span 
                            className="text-[11px] sm:text-xs font-bold text-gray-900 block truncate"
                          >
                            {report.user.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Centered Chart Legend (Matches Slide Exactly) */}
            <div className="flex items-center justify-center gap-6 sm:gap-8 pt-5 text-xs sm:text-sm font-bold">
              <div className="flex items-center gap-2">
                <span 
                  className="w-3.5 sm:w-4 h-3.5 sm:h-4 inline-block rounded-xs" 
                  style={{ backgroundColor: '#111827' }}
                />
                <span className="text-gray-900">Attendance Days</span>
              </div>
              <div className="flex items-center gap-2">
                <span 
                  className="w-3.5 sm:w-4 h-3.5 sm:h-4 inline-block rounded-xs" 
                  style={{ backgroundColor: '#F59E0B' }}
                />
                <span className="text-gray-900">
                  {roleFilter === 'designer' ? 'Designs Uploaded' : 'Project Updates'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. FOOTER: CENTERED SLIDE SUMMARY (MATCHES SLIDE EXACTLY) */}
          <div className="pt-8 sm:pt-10 text-center text-xs sm:text-sm text-gray-500 font-medium tracking-wide">
            Apple Interior Manager • Weekly Operations Summary
          </div>
        </div>
      )}

    </div>
  );
}
