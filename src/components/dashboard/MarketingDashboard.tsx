'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  FiPlus, 
  FiTrendingUp, 
  FiUsers, 
  FiCalendar, 
  FiCheckCircle, 
  FiClock, 
  FiSearch,
  FiTag,
  FiRefreshCw,
  FiPieChart
} from 'react-icons/fi';

import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';

interface Lead {
  id: string;
  ref_no: string;
  created_date: string;
  client_name: string;
  phone: string;
  site_project: string;
  area_sqft: number;
  status: string;
  assigned_by: string;
  remarks: string;
  branch?: string;
}

export default function MarketingDashboard({ user }: { user: any }) {
  const { isAdmin } = useAuth();
  const { currentBranch, userBranch } = useBranch();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentBranch !== 'all') {
        params.append('branch', currentBranch);
      }
      const qs = params.toString();
      const url = qs ? `/api/crm?${qs}` : '/api/crm';

      const res = await fetch(url, {
        headers: {
          'x-branch': currentBranch,
        }
      });
      if (res.ok) {
        const json = await res.json();
        setLeads(Array.isArray(json.data) ? json.data : []);
      }
    } catch (err) {
      console.error('Error fetching marketing leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [isAdmin, currentBranch]);

  useEffect(() => {
    const handleBranchChange = () => fetchLeads();
    window.addEventListener('branch_changed', handleBranchChange);
    return () => window.removeEventListener('branch_changed', handleBranchChange);
  }, []);

  // Smart source extraction: checks new form metadata [Source: ...] first,
  // then falls back to historical CRM assignment origin (Walk-in, Office Mobile, Direct Call, Referral, etc.)
  const extractSource = (lead: Lead): string => {
    if (lead.remarks) {
      const match = lead.remarks.match(/\[Source:\s*([^\]]+)\]/i);
      if (match && match[1]?.trim()) return match[1].trim();
    }
    const assigned = (lead.assigned_by || '').trim();
    if (!assigned) return 'Direct / Unspecified';
    if (assigned.toLowerCase() === 'walk-in') return 'Walk-in / Visit';
    if (assigned.toLowerCase() === 'office mobile') return 'Inbound / Office Mobile';
    if (assigned.toLowerCase() === 'direct call') return 'Direct Call';
    if (assigned.toLowerCase().includes('aravind')) return 'Referral (Aravind Sir)';
    if (assigned.toLowerCase().startsWith('marketing')) return 'Marketing Campaign';
    return `Referral (${assigned})`;
  };

  // Lead Metrics Calculation
  const metrics = useMemo(() => {
    const total = leads.length;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const day = now.getDay();
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diffToMonday);

    let thisMonthCount = 0;
    let thisWeekCount = 0;
    let convertedCount = 0;
    let inProgressCount = 0;
    const sourceCounts: Record<string, number> = {};

    leads.forEach((l) => {
      const created = new Date(l.created_date || (l as any).created_at || now);
      if (created.getFullYear() === currentYear && created.getMonth() === currentMonth) {
        thisMonthCount++;
      }
      if (created >= startOfWeek) {
        thisWeekCount++;
      }
      if (l.status === 'Approved' || (l.status && l.status.toLowerCase().includes('approved'))) {
        convertedCount++;
      } else {
        inProgressCount++;
      }

      const src = extractSource(l);
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });

    const sortedSources = Object.entries(sourceCounts)
      .map(([name, count]) => ({ name, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      thisMonthCount,
      thisWeekCount,
      convertedCount,
      inProgressCount,
      conversionRate: total > 0 ? Math.round((convertedCount / total) * 100) : 0,
      sources: sortedSources
    };
  }, [leads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        !searchQuery.trim() ||
        l.client_name?.toLowerCase().includes(q) ||
        l.ref_no?.toLowerCase().includes(q) ||
        l.site_project?.toLowerCase().includes(q) ||
        l.phone?.toLowerCase().includes(q);

      const src = extractSource(l);
      const matchesSource = sourceFilter === 'all' || src === sourceFilter;

      return matchesSearch && matchesSource;
    });
  }, [leads, searchQuery, sourceFilter]);

  return (
    <div className="w-full space-y-5">
      
      {/* ─── Marketing Toolbar ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">
              Marketing & Lead Acquisition
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time inquiry capture, campaign performance, and CRM dispatch status
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/dashboard/leads/new"
            className="btn-primary py-2 px-4 text-xs font-medium cursor-pointer shadow-xs"
          >
            <FiPlus className="w-4 h-4 text-white" />
            <span>Add New Lead</span>
          </Link>

          <button
            onClick={() => fetchLeads()}
            disabled={loading}
            className="p-2 bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all shadow-2xs cursor-pointer"
            title="Refresh Leads"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-yellow-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── KPI Metric Cards (Full Width 4-Column Grid) ───── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
        
        {/* Total Inquiries */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Total Inquiries
            </span>
            <div className="w-8 h-8 rounded-lg bg-yellow-50 text-yellow-600 flex items-center justify-center">
              <FiUsers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {metrics.total}
            </div>
            <div className="text-[11px] text-gray-400 font-medium mt-0.5">
              Lifetime leads registered
            </div>
          </div>
        </div>

        {/* This Month */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              This Month
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FiCalendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {metrics.thisMonthCount}
            </div>
            <div className="text-[11px] text-gray-400 font-medium mt-0.5">
              Current month intake
            </div>
          </div>
        </div>

        {/* This Week */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              This Week
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <FiClock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {metrics.thisWeekCount}
            </div>
            <div className="text-[11px] text-gray-400 font-medium mt-0.5">
              Past 7 days velocity
            </div>
          </div>
        </div>

        {/* Converted */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Converted
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FiCheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {metrics.convertedCount}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
              {metrics.conversionRate}% approved into quotes
            </div>
          </div>
        </div>

      </div>

      {/* ─── Middle Section: Balanced Channel & Pipeline Overview ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start w-full">
        
        {/* Source Channels Performance (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FiTrendingUp className="w-4 h-4 text-yellow-600" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Inquiries by Marketing Channel
              </h3>
            </div>
            <span className="text-[11px] text-gray-400 font-medium">
              {metrics.sources.length} active channels
            </span>
          </div>

          {metrics.sources.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              No channel data recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.sources.map((src) => (
                <div key={src.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-gray-800">{src.name}</span>
                    <span className="text-gray-500 text-[11px]">
                      {src.count} lead{src.count > 1 ? 's' : ''} ({src.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#f0b100] h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(src.pct, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline Distribution Card (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FiPieChart className="w-4 h-4 text-yellow-600" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                CRM Pipeline Distribution
              </h3>
            </div>
            <span className="text-[11px] text-gray-400 font-medium">Active Leads</span>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                <span className="text-xs font-semibold text-gray-700">Draft / New Leads</span>
              </div>
              <span className="text-xs font-bold text-gray-900">
                {metrics.inProgressCount}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/70 border border-emerald-100">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-emerald-900">Approved Quotations</span>
              </div>
              <span className="text-xs font-bold text-emerald-900">
                {metrics.convertedCount}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ─── Full-Width Recent Marketing Inquiries Table ───── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden w-full">
        
        {/* Table Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FiTag className="w-4 h-4 text-yellow-600" />
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Recent Lead Inquiries
            </h3>
            <span className="text-xs text-gray-400 font-semibold">
              ({filteredLeads.length})
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Box */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-2.5 text-gray-400 w-3.5 h-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by client, ref, site..."
                className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500/20 text-gray-900 font-medium"
              />
            </div>

            {/* Source Filter Dropdown */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
            >
              <option value="all">All Sources</option>
              {metrics.sources.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-16 text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-500 border-t-transparent mx-auto" />
            <p className="text-xs font-medium text-gray-400">Loading recent leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center mx-auto">
              <FiUsers className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-gray-900">
              {!isAdmin && leads.length === 0
                ? "You haven't captured any leads yet"
                : 'No leads found'}
            </div>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {!isAdmin && leads.length === 0
                ? "Inquiries you register through '+ Add New Lead' will appear here in real-time."
                : searchQuery || sourceFilter !== 'all'
                ? 'Try adjusting your search terms or filters.'
                : 'No inquiry records found under this view.'}
            </p>
            {!isAdmin && leads.length === 0 && (
              <div className="pt-2">
                <Link
                  href="/dashboard/leads/new"
                  className="btn-primary inline-flex items-center gap-2 text-xs py-2 px-4 text-white"
                >
                  <FiPlus className="w-4 h-4 text-white" />
                  <span>Register First Lead</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/70 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Ref No</th>
                  <th className="py-3 px-4">Client Name</th>
                  <th className="py-3 px-4">Site Location</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Lead Source</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
                {filteredLeads.slice(0, 30).map((l) => {
                  const src = extractSource(l);
                  return (
                    <tr key={l.id} className="hover:bg-yellow-50/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        {l.ref_no || '—'}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900">
                        {l.client_name}
                      </td>
                      <td className="py-3 px-4 text-gray-600 max-w-[240px] truncate" title={l.site_project}>
                        {l.site_project || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-mono">
                        {l.phone || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-semibold">
                          {src}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          l.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : l.status === 'Draft'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {l.status || 'Draft'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-[11px]">
                        {l.created_date || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
}
