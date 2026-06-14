'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getRelativeTime } from '@/lib/dateUtils';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import {
  FiRefreshCw,
  FiSearch,
  FiAlertTriangle,
  FiActivity,
  FiUsers,
  FiClock,
  FiGrid,
  FiArrowLeft,
  FiCompass,
  FiShield,
  FiDatabase,
  FiTrendingUp
} from 'react-icons/fi';

export default function TelemetryPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { setTitle, setSubtitle } = useHeaderTitle();

  const [telemetryData, setTelemetryData] = useState<{
    liveUsers: any[];
    heavyUsers24h: any[];
    heavyUsers7d: any[];
    recentLogs: any[];
  }>({
    liveUsers: [],
    heavyUsers24h: [],
    heavyUsers7d: [],
    recentLogs: [],
  });

  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(15);

  // Check if current user is an IT user
  const userDesignation = (user?.designation || '').toLowerCase();
  const isITUser = userDesignation.includes('it') || (user?.user_metadata?.designation || '').toLowerCase().includes('it');

  // Set header title
  useEffect(() => {
    setTitle('App Telemetry');
    setSubtitle('Live status and activity tracker');
  }, [setTitle, setSubtitle]);

  const fetchTelemetry = useCallback(async () => {
    if (!user || !isITUser) return;

    try {
      const response = await fetch('/api/admin/telemetry', {
        cache: 'no-cache',
      });
      if (response.ok) {
        const payload = await response.json();
        if (payload.success && payload.data) {
          setTelemetryData(payload.data);
        }
      } else if (response.status === 403) {
        console.error('Access forbidden to telemetry endpoint');
      }
    } catch (error) {
      console.error('Error fetching telemetry data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user, isITUser]);

  // Initial fetch and auto refresh
  useEffect(() => {
    if (isLoading || !user || !isITUser) return;

    fetchTelemetry();

    let countdownInterval: ReturnType<typeof setInterval>;
    if (autoRefresh) {
      countdownInterval = setInterval(() => {
        setRefreshCountdown((prev) => {
          if (prev <= 1) {
            fetchTelemetry();
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [isLoading, user, isITUser, autoRefresh, fetchTelemetry]);

  // Manual refresh trigger
  const handleManualRefresh = () => {
    setLoadingData(true);
    fetchTelemetry();
    setRefreshCountdown(15);
  };

  // Filter logs based on search and action filter
  const filteredLogs = telemetryData.recentLogs.filter((log) => {
    const userEmail = (log.users?.email || '').toLowerCase();
    const userName = (log.users?.full_name || '').toLowerCase();
    const logPath = (log.path || '').toLowerCase();
    const query = searchTerm.toLowerCase();

    const matchesSearch =
      userEmail.includes(query) || userName.includes(query) || logPath.includes(query);

    const matchesAction =
      actionFilter === 'all' ||
      (actionFilter === 'page_view' && log.action === 'page_view') ||
      (actionFilter === 'heartbeat' && log.action === 'heartbeat');

    return matchesSearch && matchesAction;
  });

  // Calculate relative usage progress for Top Users
  const maxHits24h = useMemo(() => {
    return Math.max(...telemetryData.heavyUsers24h.map(u => parseInt(u.activity_count) || 1), 1);
  }, [telemetryData.heavyUsers24h]);

  const maxHits7d = useMemo(() => {
    return Math.max(...telemetryData.heavyUsers7d.map(u => parseInt(u.activity_count) || 1), 1);
  }, [telemetryData.heavyUsers7d]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
          <span className="text-xs text-gray-500 font-medium">Securing connection to telemetry feed...</span>
        </div>
      </div>
    );
  }

  // Gate page to IT designation users only
  if (!isITUser) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white border border-gray-200 rounded-3xl p-8 shadow-mobile-lg text-center animate-scale-in">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-50 text-red-500 mb-6 border border-red-100">
          <FiAlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-extrabold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          This secure console is restricted strictly to users with the <strong className="font-semibold text-gray-800">IT Designation</strong>.
          Your current designation ({user?.designation || 'None'}) does not have permission to view live app telemetry.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-gray-200 text-sm font-semibold rounded-xl text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors shadow-2xs cursor-pointer"
        >
          <FiArrowLeft className="mr-2" /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Controls Bar / Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-50 rounded-xl border border-green-100">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-gray-900 leading-tight">Database Socket Active</h4>
            <span className="text-[11px] font-medium text-gray-400">Listening to real-time user telemetry</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Auto Refresh Toggle */}
          <div className="flex items-center bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-200 text-xs">
            <label className="flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
              <span className="ml-2.5 text-gray-600 font-semibold text-[11px]">
                {autoRefresh ? `Auto Refreshing (${refreshCountdown}s)` : 'Auto Refresh Off'}
              </span>
            </label>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={loadingData}
            className="inline-flex items-center justify-center p-2.5 rounded-xl text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Refresh telemetry"
          >
            <FiRefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin text-yellow-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Live Metrics Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Metric 1 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100 group-hover:scale-105 transition-transform">
              <FiUsers className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Presently Online</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1 leading-none">{telemetryData.liveUsers.length}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Active sessions last 5m</p>
            </div>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse self-start mt-1"></span>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600 border border-amber-100 group-hover:scale-105 transition-transform">
              <FiActivity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Operations (24h)</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1 leading-none">
                {telemetryData.heavyUsers24h.reduce((sum, u) => sum + parseInt(u.activity_count), 0)}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">Total metrics logged</p>
            </div>
          </div>
          <div className="text-amber-500 self-start mt-1">
            <FiTrendingUp className="h-4 w-4" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100 group-hover:scale-105 transition-transform">
              <FiShield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Usage Spike Peak</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1 leading-none truncate max-w-[150px]">
                {telemetryData.heavyUsers7d[0] ? `${telemetryData.heavyUsers7d[0].full_name.split(' ')[0]}` : 'N/A'}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">
                {telemetryData.heavyUsers7d[0] ? `Top user: ${telemetryData.heavyUsers7d[0].activity_count} hits` : 'No logs'}
              </p>
            </div>
          </div>
          <div className="p-1 bg-indigo-50 rounded text-indigo-600 text-[9px] font-bold self-start mt-0.5 border border-indigo-100">
            PEAK
          </div>
        </div>
      </section>

      {/* Live Users Pane */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <FiGrid className="text-yellow-500 h-4 w-4" />
            <h2 className="text-sm font-extrabold text-gray-900">Live Active User Directory</h2>
          </div>
          <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full border border-green-100 uppercase tracking-wider">
            {telemetryData.liveUsers.length} Online
          </span>
        </div>

        {telemetryData.liveUsers.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            <FiUsers className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            No active users detected in the last 5 minutes.
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {telemetryData.liveUsers.map((liveUser, index) => {
              const initials = liveUser.user.full_name
                ?.split(' ')
                .map((n: string) => n[0])
                .join('')
                .slice(0, 2) || '?';

              return (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden group border-l-4 border-l-yellow-500"
                >
                  {/* Pulse indicator top right */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                    </span>
                    <span className="text-[8px] font-bold text-green-750 uppercase tracking-wider">Live</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center text-white font-black text-sm select-none shadow-sm shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-extrabold text-gray-900 leading-snug truncate pr-8">{liveUser.user.full_name}</h4>
                      <p className="text-xs text-gray-400 truncate">{liveUser.user.email}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[10px]">
                    <div>
                      <span className="text-gray-400 uppercase font-bold tracking-wider text-[9px] block">Role</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold mt-0.5 border ${liveUser.user.role === 'admin'
                          ? 'bg-green-50 text-green-700 border-green-100'
                          : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                        {liveUser.user.role}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-400 uppercase font-bold tracking-wider text-[9px] block">Designation</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold mt-0.5 border ${liveUser.user.designation?.toLowerCase().includes('it')
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                        {liveUser.user.designation || 'Staff'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-600 min-w-0 font-medium">
                      <FiCompass className="text-yellow-600 shrink-0 h-3.5 w-3.5" />
                      <span className="font-mono truncate bg-white px-1.5 py-0.5 rounded border border-gray-100 w-full" title={liveUser.last_path}>
                        {liveUser.last_path}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-200/60 pt-2 text-[10px] font-semibold text-gray-400">
                      <span className="capitalize text-gray-500">{liveUser.last_action.replace('_', ' ')}</span>
                      <span className="text-gray-500 flex items-center gap-1">
                        <FiClock className="h-3 w-3" />
                        {getRelativeTime(liveUser.last_active_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Heavy Users Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 24h Heavy Users */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiActivity className="text-yellow-500 h-4 w-4" />
              <h2 className="text-sm font-extrabold text-gray-900">Top Heavy Users (Last 24h)</h2>
            </div>
            <span className="text-[10px] font-bold bg-yellow-50 text-yellow-750 border border-yellow-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Activity Scale
            </span>
          </div>

          {telemetryData.heavyUsers24h.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No activity logs available for the last 24 hours.
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {telemetryData.heavyUsers24h.slice(0, 5).map((u, index) => {
                const percent = Math.round((parseInt(u.activity_count) / maxHits24h) * 100);
                const medalColors = [
                  'bg-gradient-to-r from-amber-400 to-yellow-500 text-white ring-yellow-200',
                  'bg-slate-300 text-slate-700 ring-slate-100',
                  'bg-amber-600 text-amber-50 ring-amber-100',
                ];

                return (
                  <div key={index} className="flex items-center gap-3 bg-gray-50/30 p-3 rounded-xl border border-gray-100">
                    <span className={`text-xs font-black h-6 w-6 rounded-full flex items-center justify-center ring-4 shrink-0 ${index < 3 ? medalColors[index] : 'bg-gray-100 text-gray-400 ring-transparent'
                      }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-extrabold text-gray-900 truncate pr-4">{u.full_name}</span>
                        <span className="font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-md border border-yellow-100 shrink-0 font-mono text-[10px]">{u.activity_count} hits</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden border border-gray-200/50">
                        <div
                          className="bg-gradient-to-r from-yellow-400 to-amber-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-semibold text-gray-400 mt-1 block truncate">
                        {u.email} • {u.designation || 'Staff'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top 7d Heavy Users */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiActivity className="text-indigo-500 h-4 w-4" />
              <h2 className="text-sm font-extrabold text-gray-900">Top Heavy Users (Last 7 Days)</h2>
            </div>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-750 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Activity Scale
            </span>
          </div>

          {telemetryData.heavyUsers7d.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No activity logs available for the last 7 days.
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {telemetryData.heavyUsers7d.slice(0, 5).map((u, index) => {
                const percent = Math.round((parseInt(u.activity_count) / maxHits7d) * 100);
                const medalColors = [
                  'bg-gradient-to-r from-indigo-500 to-purple-600 text-white ring-indigo-200',
                  'bg-slate-300 text-slate-700 ring-slate-100',
                  'bg-amber-600 text-amber-50 ring-amber-100',
                ];

                return (
                  <div key={index} className="flex items-center gap-3 bg-gray-50/30 p-3 rounded-xl border border-gray-100">
                    <span className={`text-xs font-black h-6 w-6 rounded-full flex items-center justify-center ring-4 shrink-0 ${index < 3 ? medalColors[index] : 'bg-gray-100 text-gray-400 ring-transparent'
                      }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-extrabold text-gray-900 truncate pr-4">{u.full_name}</span>
                        <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0 font-mono text-[10px]">{u.activity_count} hits</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden border border-gray-200/50">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-semibold text-gray-400 mt-1 block truncate">
                        {u.email} • {u.designation || 'Staff'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Searchable Activity Log Feed */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
          <div>
            <div className="flex items-center gap-2">
              <FiDatabase className="text-yellow-500 h-4 w-4" />
              <h2 className="text-sm font-extrabold text-gray-900">Live Activity Feed</h2>
            </div>
            <p className="text-[11px] font-medium text-gray-400 mt-0.5">Most recent 100 interaction logs</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Search input */}
            <div className="relative">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search email, name, path..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-yellow-500 w-full sm:w-60 text-gray-705 placeholder-gray-400 font-medium shadow-2xs focus:ring-1 focus:ring-yellow-400"
              />
            </div>

            {/* Action Filter */}
            <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-2xs">
              <button
                onClick={() => setActionFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${actionFilter === 'all' ? 'bg-yellow-500 text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-750'}`}
              >
                All
              </button>
              <button
                onClick={() => setActionFilter('page_view')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${actionFilter === 'page_view' ? 'bg-yellow-500 text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-750'}`}
              >
                Pages
              </button>
              <button
                onClick={() => setActionFilter('heartbeat')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${actionFilter === 'heartbeat' ? 'bg-yellow-500 text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-750'}`}
              >
                Heartbeats
              </button>
            </div>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No matching activity logs found.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                  <th className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">User</th>
                  <th className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">Action</th>
                  <th className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">Visited Path</th>
                  <th className="px-5 py-3.5 text-right bg-gray-50 border-b border-gray-200">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors text-sm text-gray-700">
                    <td className="px-5 py-3.5">
                      <p className="font-extrabold text-gray-900 leading-tight">{log.users?.full_name || 'Unknown User'}</p>
                      <p className="text-[11px] text-gray-450 font-mono mt-0.5">{log.users?.email || 'N/A'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${log.action === 'page_view'
                          ? 'bg-blue-50 text-blue-750 border-blue-100'
                          : 'bg-emerald-50 text-emerald-750 border-emerald-100'
                        }`}>
                        {log.action === 'page_view' ? 'Page View' : 'Heartbeat'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <code className="text-xs text-yellow-700 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg font-mono truncate max-w-xs block" title={log.path}>
                        {log.path}
                      </code>
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-gray-500 font-bold">
                      {getRelativeTime(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
