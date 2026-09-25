'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { useToast } from '@/components/ui/Toast';
import { formatDateIST } from '@/lib/dateUtils';
import RecordPaymentModal from '@/components/finance/RecordPaymentModal';
import {
  FiPlus,
  FiSearch,
  FiTrendingUp,
  FiClock,
  FiCreditCard,
  FiFileText,
  FiExternalLink,
  FiEdit2,
  FiTrash2,
  FiFilter,
  FiCheckCircle,
  FiAlertCircle,
  FiArrowUpRight,
  FiRefreshCw
} from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';

const getProjectStatusConfig = (status?: string | null) => {
  const st = (status || 'pending').toLowerCase();
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Design Phase' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Execution Phase' },
    on_hold: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'On Hold' },
    completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
    handover: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Handover Phase' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
  };
  return configs[st] || { bg: 'bg-gray-100', text: 'text-gray-700', label: st.replace(/_/g, ' ') };
};

export default function FinanceOverviewPage() {
  const { user } = useAuth();
  const { hasPermission, isAdmin, isLoading: permLoading } = useUserPermissions();
  const { setTitle, setSubtitle } = useHeaderTitle();
  const { showToast } = useToast();

  const canManage = Boolean(isAdmin || hasPermission('finance.manage'));

  const [activeTab, setActiveTab] = useState<'ledger' | 'projects'>('ledger');
  const [loading, setLoading] = useState(true);

  // Overview data
  const [kpis, setKpis] = useState({
    totalBudget: 0,
    totalCollected: 0,
    totalPending: 0,
    totalExpenses: 0,
    netMargin: 0,
    projectCount: 0,
    paymentCount: 0,
  });
  const [projectSummaries, setProjectSummaries] = useState<any[]>([]);

  // Payments ledger data
  const [payments, setPayments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState<string>('all');

  // Modal states
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [recordForProjectId, setRecordForProjectId] = useState<string | undefined>(undefined);

  // Quick edit budget modal / state
  const [editingBudgetProj, setEditingBudgetProj] = useState<{ id: string; title: string; currentBudget: number } | null>(null);
  const [newBudgetVal, setNewBudgetVal] = useState<string>('');
  const [savingBudget, setSavingBudget] = useState(false);

  useEffect(() => {
    setTitle('Finance Overview');
    setSubtitle(null);
  }, [setTitle, setSubtitle]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [overviewRes, paymentsRes] = await Promise.all([
        fetch('/api/finance/overview'),
        fetch('/api/finance/payments'),
      ]);

      if (overviewRes.ok) {
        const overviewData = await overviewRes.json();
        setKpis(overviewData.kpis || {});
        setProjectSummaries(overviewData.projects || []);
      }

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData.payments || []);
      }
    } catch (err) {
      console.error('Failed to load finance data:', err);
      showToast('error', 'Failed to load finance information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm('Are you sure you want to delete this payment record? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/finance/payments/${paymentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('success', 'Payment record deleted');
        loadData();
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to delete payment');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showToast('error', 'Network error while deleting payment');
    }
  };

  const handleSaveBudget = async () => {
    if (!editingBudgetProj) return;
    const num = parseFloat(newBudgetVal);
    if (isNaN(num) || num < 0) {
      showToast('error', 'Please enter a valid budget amount');
      return;
    }

    try {
      setSavingBudget(true);
      const res = await fetch(`/api/projects/${editingBudgetProj.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_budget: num }),
      });

      if (res.ok) {
        showToast('success', 'Project budget updated');
        setEditingBudgetProj(null);
        loadData();
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to update budget');
      }
    } catch (err) {
      console.error('Budget update error:', err);
      showToast('error', 'Error updating budget');
    } finally {
      setSavingBudget(false);
    }
  };

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.project?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.project?.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.project?.client?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.milestone_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.reference_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesMode = selectedMode === 'all' || p.payment_mode === selectedMode;

      return matchesSearch && matchesMode;
    });
  }, [payments, searchQuery, selectedMode]);

  // Overall collection rate percentage
  const overallCollectionPercent = kpis.totalBudget > 0
    ? Math.min(100, Math.round((kpis.totalCollected / kpis.totalBudget) * 100))
    : (kpis.totalCollected > 0 ? 100 : 0);

  if (permLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Actions Bar */}
      <div className="flex items-center justify-end gap-2.5">
        <button
          onClick={() => loadData()}
          title="Refresh Financials"
          className="inline-flex items-center justify-center p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl border border-gray-200 transition-all cursor-pointer"
        >
          <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {canManage && (
          <button
            onClick={() => {
              setRecordForProjectId(undefined);
              setEditingPayment(null);
              setIsRecordModalOpen(true);
            }}
            className="inline-flex items-center justify-center text-center gap-2 px-4 py-2.5 bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-gray-950 text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <FiPlus className="w-4 h-4" />
            <span>Record Client Payment</span>
          </button>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Contract Value */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Contract Value</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <FiFileText className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              ₹{kpis.totalBudget.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">Across {kpis.projectCount} active projects</div>
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Collected</span>
            <span className="p-1.5 bg-green-50 text-green-600 rounded-lg">
              <FiCheckCircle className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-green-600 tracking-tight">
              ₹{kpis.totalCollected.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-green-700 font-medium mt-1 flex items-center gap-1">
              <span>{overallCollectionPercent}% of contract value collected</span>
            </div>
          </div>
        </div>

        {/* Pending Receivables */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Receivables</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <FiClock className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight">
              ₹{kpis.totalPending.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-1">
              Outstanding client balance
            </div>
          </div>
        </div>

        {/* Site Material Expenses */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Site Material Expenses</span>
            <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <FiCreditCard className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-purple-600 tracking-tight">
              ₹{kpis.totalExpenses.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">From project site expenses</div>
          </div>
        </div>

        {/* Gross Profit Margin */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Cash Margin</span>
            <span className="p-1.5 bg-yellow-50 text-yellow-600 rounded-lg">
              <FiTrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-black tracking-tight ${kpis.netMargin >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
              ₹{kpis.netMargin.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">Collected minus site expenses</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === 'ledger'
              ? 'border-yellow-500 text-yellow-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Payments Ledger ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === 'projects'
              ? 'border-yellow-500 text-yellow-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Project Financials ({projectSummaries.length})
        </button>
      </div>

      {/* Tab 1: Payments Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search project, client, milestone, UTR..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-gray-500 hidden sm:inline">Mode:</span>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-700 focus:ring-2 focus:ring-yellow-500"
              >
                <option value="all">All Modes</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-3"></div>
                Loading payments ledger...
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <TbCurrencyRupee className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-700">No client payments found</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  {searchQuery || selectedMode !== 'all'
                    ? 'Try clearing your search filters.'
                    : 'Record your first incoming client milestone payment to track collections.'}
                </p>
                {canManage && !searchQuery && selectedMode === 'all' && (
                  <button
                    onClick={() => {
                      setRecordForProjectId(undefined);
                      setEditingPayment(null);
                      setIsRecordModalOpen(true);
                    }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-xl shadow transition-all"
                  >
                    <FiPlus className="w-4 h-4" /> Record Payment
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Mobile Cards View */}
                <div className="block md:hidden divide-y divide-gray-100 p-3 space-y-3 bg-gray-50/40">
                  {filteredPayments.map((p) => (
                    <div key={p.id} className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 space-y-3">
                      {/* Date & Milestone Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-gray-500">
                          {p.payment_date ? formatDateIST(p.payment_date) : '-'}
                        </span>
                        <span className="inline-flex items-center justify-center text-center px-2.5 py-0.5 bg-yellow-50 text-yellow-800 font-semibold text-[11px] rounded-full border border-yellow-200/60">
                          {p.milestone_name}
                        </span>
                      </div>

                      {/* Project & Client */}
                      <div>
                        <Link
                          href={`/dashboard/projects/${p.project_id}?stage=finance&tab=overview`}
                          className="font-bold text-sm text-gray-900 hover:text-yellow-600 inline-flex items-center gap-1 group leading-snug"
                        >
                          <span className="break-words">{p.project?.title || 'Unknown Project'}</span>
                          <FiArrowUpRight className="w-3.5 h-3.5 shrink-0 text-gray-400 group-hover:text-yellow-600 transition-colors" />
                        </Link>
                        {(p.project?.customer_name || p.project?.client?.name) && (
                          <p className="text-xs text-gray-500 font-medium mt-0.5">
                            {p.project.customer_name || p.project.client?.name}
                          </p>
                        )}
                      </div>

                      {/* Amount and Mode Banner */}
                      <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-semibold block">Amount Paid</span>
                          <span className="text-base font-black text-green-700">₹{Number(p.amount).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-gray-800 block">{p.payment_mode}</span>
                          {p.reference_number && (
                            <span className="text-[10px] text-gray-400 font-mono block">Ref: {p.reference_number}</span>
                          )}
                        </div>
                      </div>

                      {p.notes && (
                        <p className="text-xs text-gray-600 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                          {p.notes}
                        </p>
                      )}

                      {/* Footer Actions / Receipt */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                        {p.receipt_url ? (
                          <a
                            href={p.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center text-center gap-1.5 h-8 px-3 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                          >
                            <FiExternalLink className="w-3.5 h-3.5" />
                            <span>View Receipt</span>
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">No Receipt</span>
                        )}

                        {canManage && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingPayment(p);
                                setIsRecordModalOpen(true);
                              }}
                              title="Edit Payment"
                              className="inline-flex items-center justify-center text-center h-8 w-8 text-gray-500 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg border border-gray-200 transition-colors cursor-pointer"
                            >
                              <FiEdit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              title="Delete Payment"
                              className="inline-flex items-center justify-center text-center h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 transition-colors cursor-pointer"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-semibold uppercase text-[11px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5">Project & Client</th>
                        <th className="px-4 py-3.5">Milestone / Purpose</th>
                        <th className="px-4 py-3.5 text-right">Amount (₹)</th>
                        <th className="px-4 py-3.5">Mode & Ref</th>
                        <th className="px-4 py-3.5 text-center">Receipt</th>
                        {canManage && <th className="px-4 py-3.5 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-yellow-50/30 transition-colors">
                          <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap font-medium">
                            {p.payment_date ? formatDateIST(p.payment_date) : '-'}
                          </td>
                          <td className="px-4 py-3.5">
                            <Link
                              href={`/dashboard/projects/${p.project_id}?stage=finance&tab=overview`}
                              className="font-bold text-gray-900 hover:text-yellow-600 inline-flex items-center gap-1.5 transition-colors group"
                            >
                              <span>{p.project?.title || 'Unknown Project'}</span>
                              <FiArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-yellow-600 transition-opacity" />
                            </Link>
                            {(p.project?.customer_name || p.project?.client?.name) && (
                              <span className="text-xs text-gray-500 block mt-0.5">
                                {p.project.customer_name || p.project.client?.name}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center justify-center text-center px-2.5 py-1 bg-yellow-50 text-yellow-700 font-semibold text-xs rounded-full border border-yellow-200/60">
                              {p.milestone_name}
                            </span>
                            {p.notes && (
                              <span className="text-[11px] text-gray-400 block mt-1 line-clamp-1">
                                {p.notes}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-green-700 whitespace-nowrap text-sm sm:text-base">
                            ₹{Number(p.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-medium text-gray-800 text-xs">{p.payment_mode}</div>
                            {p.reference_number && (
                              <span className="text-[11px] text-gray-400 font-mono block">
                                Ref: {p.reference_number}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {p.receipt_url ? (
                              <a
                                href={p.receipt_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center text-center gap-1 h-7 px-2.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                              >
                                <FiExternalLink className="w-3.5 h-3.5" />
                                <span>View</span>
                              </a>
                            ) : (
                              <span className="text-gray-300 text-xs">-</span>
                            )}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingPayment(p);
                                    setIsRecordModalOpen(true);
                                  }}
                                  title="Edit Payment"
                                  className="inline-flex items-center justify-center text-center h-7 w-7 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <FiEdit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePayment(p.id)}
                                  title="Delete Payment"
                                  className="inline-flex items-center justify-center text-center h-7 w-7 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <FiTrash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Project Financials */}
      {activeTab === 'projects' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-3"></div>
              Loading project financials...
            </div>
          ) : projectSummaries.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No projects found.
            </div>
          ) : (
            <>
              {/* Mobile Cards View */}
              <div className="block md:hidden space-y-3 p-3 bg-gray-50/40">
                {projectSummaries.map((p) => {
                  const cfg = getProjectStatusConfig(p.status);
                  return (
                    <div key={p.id} className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 space-y-3">
                      {/* Header: Title full width, then Customer & Status */}
                      <div className="space-y-1.5">
                        <Link
                          href={`/dashboard/projects/${p.id}?stage=finance&tab=overview`}
                          className="font-bold text-sm text-gray-900 hover:text-yellow-600 flex items-start justify-between gap-1.5 group leading-snug"
                        >
                          <span className="break-all">{p.title}</span>
                          <FiArrowUpRight className="w-3.5 h-3.5 shrink-0 text-gray-400 group-hover:text-yellow-600 transition-colors mt-0.5" />
                        </Link>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-gray-500 font-medium truncate">{p.customerName}</p>
                          <span className={`inline-flex items-center justify-center text-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${cfg.bg} ${cfg.text}`}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>

                      {/* Collections Progress */}
                      <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 font-medium">Collections</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-green-700">₹{p.collected.toLocaleString('en-IN')}</span>
                            <span className="text-[11px] font-semibold text-gray-400">({p.collectionRate}%)</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, p.collectionRate)}%` }}
                          />
                        </div>
                      </div>

                      {/* Financial Metrics 2x2 Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-gray-500">Contract Budget</span>
                            {canManage && (
                              <button
                                onClick={() => {
                                  setEditingBudgetProj({ id: p.id, title: p.title, currentBudget: p.budget });
                                  setNewBudgetVal(p.budget ? p.budget.toString() : '');
                                }}
                                title="Edit Project Budget"
                                className="inline-flex items-center justify-center text-center p-1 text-gray-400 hover:text-yellow-600 rounded transition-colors cursor-pointer"
                              >
                                <FiEdit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="font-bold text-gray-900 mt-0.5">
                            ₹{p.budget ? p.budget.toLocaleString('en-IN') : '0'}
                          </div>
                        </div>

                        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="text-[11px] text-gray-500 block">Pending Balance</span>
                          <div className="font-bold text-amber-600 mt-0.5">
                            ₹{p.pending.toLocaleString('en-IN')}
                          </div>
                        </div>

                        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="text-[11px] text-gray-500 block">Site Expenses</span>
                          <div className="font-bold text-purple-600 mt-0.5">
                            ₹{p.expenses.toLocaleString('en-IN')}
                          </div>
                        </div>

                        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="text-[11px] text-gray-500 block">Gross Margin</span>
                          <div className={`font-black mt-0.5 ${p.netMargin >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                            ₹{p.netMargin.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons with centered text */}
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                        {canManage && (
                          <button
                            onClick={() => {
                              setRecordForProjectId(p.id);
                              setEditingPayment(null);
                              setIsRecordModalOpen(true);
                            }}
                            className="inline-flex items-center justify-center text-center flex-1 h-9 px-3 text-xs font-bold text-gray-950 bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 rounded-xl transition-colors shadow-xs cursor-pointer"
                          >
                            + Record Payment
                          </button>
                        )}
                        <Link
                          href={`/dashboard/projects/${p.id}?stage=finance&tab=overview`}
                          className="inline-flex items-center justify-center text-center flex-1 h-9 px-3 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors cursor-pointer"
                        >
                          Project Details
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-semibold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">Project</th>
                      <th className="px-4 py-3.5">Customer</th>
                      <th className="px-4 py-3.5 text-right">Contract Budget (₹)</th>
                      <th className="px-4 py-3.5">Collection Status</th>
                      <th className="px-4 py-3.5 text-right">Pending (₹)</th>
                      <th className="px-4 py-3.5 text-right">Site Expenses (₹)</th>
                      <th className="px-4 py-3.5 text-right">Gross Margin (₹)</th>
                      <th className="px-4 py-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {projectSummaries.map((p) => (
                      <tr key={p.id} className="hover:bg-yellow-50/30 transition-colors">
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/dashboard/projects/${p.id}?stage=finance&tab=overview`}
                            className="font-bold text-gray-900 hover:text-yellow-600 inline-flex items-center gap-1.5 transition-colors group"
                          >
                            <span>{p.title}</span>
                            <FiArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-yellow-600 transition-opacity" />
                          </Link>
                          {(() => {
                            const cfg = getProjectStatusConfig(p.status);
                            return (
                              <div className="mt-1">
                                <span className={`inline-flex items-center justify-center text-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
                                  {cfg.label}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-gray-700">
                          {p.customerName}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <span>₹{p.budget ? p.budget.toLocaleString('en-IN') : '0'}</span>
                            {canManage && (
                              <button
                                onClick={() => {
                                  setEditingBudgetProj({ id: p.id, title: p.title, currentBudget: p.budget });
                                  setNewBudgetVal(p.budget ? p.budget.toString() : '');
                                }}
                                title="Edit Project Budget"
                                className="inline-flex items-center justify-center text-center text-gray-400 hover:text-yellow-600 p-1 rounded transition-colors cursor-pointer"
                              >
                                <FiEdit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 min-w-[160px]">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-green-700">
                              ₹{p.collected.toLocaleString('en-IN')}
                            </span>
                            <span className="font-semibold text-gray-500">
                              {p.collectionRate}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-green-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, p.collectionRate)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-amber-600 whitespace-nowrap">
                          ₹{p.pending.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-purple-600 whitespace-nowrap">
                          ₹{p.expenses.toLocaleString('en-IN')}
                        </td>
                        <td className={`px-4 py-3.5 text-right font-black whitespace-nowrap ${p.netMargin >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                          ₹{p.netMargin.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {canManage && (
                              <button
                                onClick={() => {
                                  setRecordForProjectId(p.id);
                                  setEditingPayment(null);
                                  setIsRecordModalOpen(true);
                                }}
                                className="inline-flex items-center justify-center text-center h-7 px-3 text-xs font-bold text-yellow-800 bg-yellow-50 hover:bg-yellow-100 rounded-lg border border-yellow-200 transition-colors cursor-pointer"
                              >
                                + Pay
                              </button>
                            )}
                            <Link
                              href={`/dashboard/projects/${p.id}?stage=finance&tab=overview`}
                              className="inline-flex items-center justify-center text-center h-7 px-3 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors cursor-pointer"
                            >
                              Details
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Record / Edit Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSuccess={() => loadData()}
        defaultProjectId={recordForProjectId}
        editingPayment={editingPayment}
        projectsList={projectSummaries.map((p) => ({
          id: p.id,
          title: p.title,
          customer_name: p.customerName,
          project_budget: p.budget,
        }))}
      />

      {/* Edit Budget Quick Modal */}
      {editingBudgetProj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 border border-gray-100 space-y-4">
            <h3 className="text-base font-bold text-gray-900">
              Set Contract Budget
            </h3>
            <p className="text-xs text-gray-500">
              Update the total contract budget value for <span className="font-semibold text-gray-800">{editingBudgetProj.title}</span>.
            </p>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                Project Budget (₹)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={newBudgetVal}
                onChange={(e) => setNewBudgetVal(e.target.value)}
                placeholder="e.g. 1500000"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingBudgetProj(null)}
                className="inline-flex items-center justify-center text-center px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingBudget}
                onClick={handleSaveBudget}
                className="inline-flex items-center justify-center text-center px-4 py-1.5 text-xs font-bold text-gray-950 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {savingBudget ? 'Saving...' : 'Save Budget'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
