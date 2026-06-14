'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { getRelativeTime } from '@/lib/dateUtils';
import { FiRefreshCw, FiSearch, FiAlertTriangle, FiActivity, FiUsers, FiClock, FiGrid, FiArrowLeft } from 'react-icons/fi';

export default function AdminTelemetryPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const router = useRouter();

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

  // Check if current user is an IT admin
  const userDesignation = (user?.user_metadata?.designation || '').toLowerCase();
  const isITUser = isAdmin && userDesignation.includes('it');

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

  // Handle redirect if not admin
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push('/admin/login');
    }
  }, [isLoading, isAdmin, router]);

  // Initial fetch and auto refresh
  useEffect(() => {
    if (isLoading || !isAdmin || !isITUser) return;

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
  }, [isLoading, isAdmin, isITUser, autoRefresh, fetchTelemetry]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
          <p className="mt-4 text-gray-400 font-medium">Initializing secure IT dashboard...</p>
        </div>
      </div>
    );
  }

  // Gate page to IT designation users only
  if (!isITUser) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 border border-red-500/20 rounded-2xl p-6 shadow-2xl text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-950 text-red-500 mb-6">
            <FiAlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            This dashboard is restricted strictly to <strong>IT Designation</strong> administrator accounts. 
            Your current designation ({user?.user_metadata?.designation || 'None'}) does not have sufficient privileges.
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="/admin/dashboard"
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-700 text-sm font-semibold rounded-xl text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <FiArrowLeft className="mr-2" /> Back to Dashboard
            </a>
            <button
              onClick={() => signOut()}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-xl text-white bg-red-600 hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-12">
      {/* Premium Header */}
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 shadow-lg px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 gap-4">
          <div className="flex items-center gap-4">
            <a
              href="/admin/dashboard"
              className="inline-flex items-center text-sm font-semibold text-gray-400 hover:text-gray-200 transition-colors bg-gray-800/50 hover:bg-gray-800 px-3 py-2 rounded-lg"
            >
              <FiArrowLeft className="mr-1.5 h-4 w-4" /> Dashboard
            </a>
            <div className="h-6 w-px bg-gray-800 hidden sm:block"></div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-100 tracking-tight">IT Status & Telemetry</h1>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              </div>
              <p className="text-xs text-gray-400">Live application metrics & active user tracker</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Auto Refresh Toggle */}
            <div className="flex items-center bg-gray-800/60 rounded-xl px-3 py-2 border border-gray-700/50 text-xs">
              <label className="flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
                <span className="ml-2 text-gray-300 font-medium">
                  {autoRefresh ? `Auto Refreshing (${refreshCountdown}s)` : 'Auto Refresh Off'}
                </span>
              </label>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={loadingData}
              className={`inline-flex items-center justify-center p-2 rounded-xl text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-white border border-gray-700/50 transition-colors shadow-sm disabled:opacity-50`}
              title="Refresh telemetry"
            >
              <FiRefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin text-yellow-500' : ''}`} />
            </button>

            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              IT SECURE CONSOLE
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Live Metrics Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-md flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-xl text-green-500 border border-green-500/20">
              <FiUsers className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Presently Online</p>
              <h3 className="text-3xl font-extrabold text-gray-100 mt-1">{telemetryData.liveUsers.length}</h3>
              <p className="text-xs text-gray-500 mt-0.5">Active in last 5 minutes</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-md flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-500 border border-yellow-500/20">
              <FiActivity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Operations (24h)</p>
              <h3 className="text-3xl font-extrabold text-gray-100 mt-1">
                {telemetryData.heavyUsers24h.reduce((sum, u) => sum + parseInt(u.activity_count), 0)}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Interaction volume last 24h</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-md flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500 border border-indigo-500/20">
              <FiClock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Usage Spike Peak</p>
              <h3 className="text-3xl font-extrabold text-gray-100 mt-1">
                {telemetryData.heavyUsers7d[0] ? `${telemetryData.heavyUsers7d[0].full_name.split(' ')[0]}` : 'N/A'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {telemetryData.heavyUsers7d[0] ? `Top user: ${telemetryData.heavyUsers7d[0].activity_count} hits/7d` : 'No heavy users logged'}
              </p>
            </div>
          </div>
        </section>

        {/* Live Users Pane */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiGrid className="text-yellow-500" />
              <h2 className="text-lg font-bold text-gray-100">Live Active User Grid</h2>
            </div>
            <span className="text-xs font-medium bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20">
              Real-time
            </span>
          </div>

          {telemetryData.liveUsers.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-base">No active users recorded in the last 5 minutes.</p>
              <p className="text-xs text-gray-600 mt-1">Heartbeats only log when user tabs are open and active.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase bg-gray-950/40">
                    <th className="px-6 py-3.5">User</th>
                    <th className="px-6 py-3.5">Security Role</th>
                    <th className="px-6 py-3.5">Designation</th>
                    <th className="px-6 py-3.5">Last Active Page</th>
                    <th className="px-6 py-3.5">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {telemetryData.liveUsers.map((liveUser, index) => {
                    const initials = liveUser.user.full_name
                      ?.split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .slice(0, 2) || '?';
                    
                    return (
                      <tr key={index} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-gray-900 font-bold text-sm select-none">
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-200">{liveUser.user.full_name}</p>
                            <p className="text-xs text-gray-400">{liveUser.user.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            liveUser.user.role === 'admin' 
                              ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            {liveUser.user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            liveUser.user.designation?.toLowerCase().includes('it')
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                              : 'bg-gray-800 text-gray-300 border-gray-700'
                          }`}>
                            {liveUser.user.designation || 'Staff'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-xs bg-gray-950 px-2 py-1 rounded border border-gray-800 text-yellow-500 max-w-[200px] sm:max-w-xs truncate block font-mono">
                            {liveUser.last_path}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-xs text-gray-300 font-medium">
                              {getRelativeTime(liveUser.last_active_at)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Heavy Users Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Top 24h Heavy Users */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiActivity className="text-yellow-500" />
                <h2 className="text-base font-bold text-gray-100">Top Heavy Users (Last 24h)</h2>
              </div>
              <span className="text-xs bg-yellow-500/15 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded-full font-medium">
                Volume
              </span>
            </div>
            
            {telemetryData.heavyUsers24h.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No activity logs available for the last 24 hours.
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {telemetryData.heavyUsers24h.slice(0, 5).map((u, index) => (
                  <div key={index} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-800/20 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-gray-200">{u.full_name}</p>
                      <p className="text-xs text-gray-400">{u.email} • <span className="text-gray-500">{u.designation || 'Staff'}</span></p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-bold font-mono">
                      {u.activity_count} hits
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top 7d Heavy Users */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiActivity className="text-indigo-400" />
                <h2 className="text-base font-bold text-gray-100">Top Heavy Users (Last 7 Days)</h2>
              </div>
              <span className="text-xs bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">
                Volume
              </span>
            </div>

            {telemetryData.heavyUsers7d.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No activity logs available for the last 7 days.
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {telemetryData.heavyUsers7d.slice(0, 5).map((u, index) => (
                  <div key={index} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-800/20 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-gray-200">{u.full_name}</p>
                      <p className="text-xs text-gray-400">{u.email} • <span className="text-gray-500">{u.designation || 'Staff'}</span></p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold font-mono">
                      {u.activity_count} hits
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Searchable Activity Log Feed */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-800 bg-gray-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-100">Live Activity Feed</h2>
              <p className="text-xs text-gray-400 mt-0.5">Most recent 100 interaction logs</p>
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
                  className="pl-10 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-yellow-500 w-full sm:w-64 text-gray-200 placeholder-gray-500"
                />
              </div>

              {/* Action Filter */}
              <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
                <button
                  onClick={() => setActionFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${actionFilter === 'all' ? 'bg-yellow-500 text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setActionFilter('page_view')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${actionFilter === 'page_view' ? 'bg-yellow-500 text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  Pages
                </button>
                <button
                  onClick={() => setActionFilter('heartbeat')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${actionFilter === 'heartbeat' ? 'bg-yellow-500 text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  Heartbeats
                </button>
              </div>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              No matching activity logs found.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase bg-gray-950/40 sticky top-0 z-10">
                    <th className="px-6 py-3 bg-gray-900">User</th>
                    <th className="px-6 py-3 bg-gray-900">Action</th>
                    <th className="px-6 py-3 bg-gray-900">Path</th>
                    <th className="px-6 py-3 bg-gray-900">Logged At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-800/10 transition-colors">
                      <td className="px-6 py-3">
                        <p className="text-sm font-medium text-gray-200">{log.users?.full_name || 'Unknown User'}</p>
                        <p className="text-xs text-gray-400 font-mono">{log.users?.email || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          log.action === 'page_view'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <code className="text-xs text-yellow-500 font-mono bg-gray-950 border border-gray-800 px-1.5 py-0.5 rounded block max-w-sm sm:max-w-md truncate">
                          {log.path}
                        </code>
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-400">
                        {getRelativeTime(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
