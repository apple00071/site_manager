'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useToast } from '@/components/ui/Toast';
import { formatDateIST } from '@/lib/dateUtils';
import RecordPaymentModal from '@/components/finance/RecordPaymentModal';
import {
  FiPlus,
  FiClock,
  FiCheckCircle,
  FiTrendingUp,
  FiCreditCard,
  FiExternalLink,
  FiEdit2,
  FiTrash2,
  FiRefreshCw,
  FiFileText
} from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';

interface ProjectFinanceTabProps {
  projectId: string;
  projectBudget?: number | null;
  projectTitle?: string;
  customerName?: string | null;
  onBudgetUpdated?: (newBudget: number) => void;
}

export default function ProjectFinanceTab({
  projectId,
  projectBudget = null,
  projectTitle = '',
  customerName = null,
  onBudgetUpdated,
}: ProjectFinanceTabProps) {
  const { user } = useAuth();
  const { hasPermission, isAdmin } = useUserPermissions();
  const { showToast } = useToast();

  const canView = Boolean(isAdmin || hasPermission('finance.view'));
  const canManage = Boolean(isAdmin || hasPermission('finance.manage'));

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [siteExpenses, setSiteExpenses] = useState<number>(0);

  // Modal & Edit state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);

  // Quick edit budget state
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [currentBudget, setCurrentBudget] = useState<number>(projectBudget || 0);
  const [budgetInput, setBudgetInput] = useState<string>(projectBudget ? projectBudget.toString() : '');
  const [savingBudget, setSavingBudget] = useState(false);

  useEffect(() => {
    if (projectBudget !== undefined && projectBudget !== null) {
      setCurrentBudget(projectBudget);
      setBudgetInput(projectBudget.toString());
    }
  }, [projectBudget]);

  const loadProjectFinances = async () => {
    try {
      setLoading(true);
      const [paymentsRes, expensesRes] = await Promise.all([
        fetch(`/api/finance/payments?projectId=${projectId}`),
        fetch(`/api/inventory-items?project_id=${projectId}`),
      ]);

      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        setPayments(data.payments || []);
      }

      if (expensesRes.ok) {
        const expData = await expensesRes.json();
        const items = expData.items || [];
        const total = items.reduce((sum: number, item: any) => {
          if (item.bill_approval_status === 'rejected') return sum;
          return sum + (Number(item.total_cost) || 0);
        }, 0);
        setSiteExpenses(total);
      }
    } catch (err) {
      console.error('Error fetching project finances:', err);
      showToast('error', 'Failed to load project financial records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadProjectFinances();
    }
  }, [projectId]);

  const totalCollected = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const pendingAmount = currentBudget > 0 ? Math.max(0, currentBudget - totalCollected) : 0;
  const netMargin = totalCollected - siteExpenses;
  const collectionPercent = currentBudget > 0
    ? Math.min(100, Math.round((totalCollected / currentBudget) * 100))
    : (totalCollected > 0 ? 100 : 0);

  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm('Are you sure you want to delete this payment record?')) return;

    try {
      const res = await fetch(`/api/finance/payments/${paymentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('success', 'Payment record deleted');
        loadProjectFinances();
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to delete payment');
      }
    } catch (err) {
      showToast('error', 'Error deleting payment');
    }
  };

  const handleSaveBudget = async () => {
    const num = parseFloat(budgetInput);
    if (isNaN(num) || num < 0) {
      showToast('error', 'Please enter a valid budget amount');
      return;
    }

    try {
      setSavingBudget(true);
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_budget: num }),
      });

      if (res.ok) {
        showToast('success', 'Project budget updated');
        setCurrentBudget(num);
        setIsEditingBudget(false);
        if (onBudgetUpdated) onBudgetUpdated(num);
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to update budget');
      }
    } catch (err) {
      showToast('error', 'Error updating budget');
    } finally {
      setSavingBudget(false);
    }
  };

  if (!canView) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-200">
        You do not have permission to view project financial records.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Project Financial Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Contract Budget */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Contract Budget</span>
            <div className="flex items-center gap-1">
              {canManage && (
                <button
                  onClick={() => setIsEditingBudget(!isEditingBudget)}
                  className="p-1 text-gray-400 hover:text-yellow-600 rounded transition-colors"
                  title="Edit Contract Budget"
                >
                  <FiEdit2 className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <FiFileText className="w-4 h-4" />
              </span>
            </div>
          </div>

          {isEditingBudget ? (
            <div className="space-y-2 mt-1">
              <input
                type="number"
                step="any"
                min="0"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="Enter budget ₹"
                className="w-full px-3 py-1.5 text-sm font-bold border border-yellow-400 rounded-lg focus:ring-2 focus:ring-yellow-500"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveBudget}
                  disabled={savingBudget}
                  className="px-3 py-1 bg-yellow-500 text-white rounded text-xs font-bold hover:bg-yellow-600"
                >
                  {savingBudget ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditingBudget(false)}
                  className="px-2 py-1 text-gray-500 text-xs hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                ₹{currentBudget.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                {currentBudget > 0 ? 'Agreed client contract amount' : 'No budget set (click edit to set)'}
              </div>
            </div>
          )}
        </div>

        {/* Collected */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Collected</span>
            <span className="p-1.5 bg-green-50 text-green-600 rounded-lg">
              <FiCheckCircle className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-green-600 tracking-tight">
              ₹{totalCollected.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-green-700 font-medium mt-1">
              {collectionPercent}% collected ({payments.length} milestone payments)
            </div>
          </div>
        </div>

        {/* Pending Receivables */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Balance</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <FiClock className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight">
              ₹{pendingAmount.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-1">
              Remaining milestone amount to collect
            </div>
          </div>
        </div>

        {/* Site Expenses vs Margin */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Site Expenses & Margin</span>
            <span className="p-1.5 bg-yellow-50 text-yellow-600 rounded-lg">
              <FiTrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-600">
              Expenses: <span className="text-purple-600 font-bold">₹{siteExpenses.toLocaleString('en-IN')}</span>
            </div>
            <div className={`text-sm font-black mt-0.5 ${netMargin >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
              Net Cash: ₹{netMargin.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* Collection Progress Bar */}
      {currentBudget > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-gray-600">Client Milestone Collection Progress</span>
            <span className="text-yellow-600">{collectionPercent}% Completed</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-yellow-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, collectionPercent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>Collected: ₹{totalCollected.toLocaleString('en-IN')}</span>
            <span>Target: ₹{currentBudget.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* Payments History Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <TbCurrencyRupee className="w-5 h-5 text-yellow-600" />
              Client Payment Milestones
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              History of all payments recorded for this project
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => loadProjectFinances()}
              title="Refresh"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {canManage && (
              <button
                onClick={() => {
                  setEditingPayment(null);
                  setIsRecordModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                <FiPlus className="w-4 h-4" />
                <span>Record Payment</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-3"></div>
            Loading payments...
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <TbCurrencyRupee className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-gray-700">No client payments recorded yet</h4>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
              Record payments as the client clears milestone invoices (e.g. advance, design approval, site execution).
            </p>
            {canManage && (
              <button
                onClick={() => {
                  setEditingPayment(null);
                  setIsRecordModalOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-xl shadow transition-all"
              >
                <FiPlus className="w-4 h-4" /> Record First Payment
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Payment Date</th>
                  <th className="px-4 py-3.5">Milestone / Purpose</th>
                  <th className="px-4 py-3.5 text-right">Amount (₹)</th>
                  <th className="px-4 py-3.5">Payment Mode</th>
                  <th className="px-4 py-3.5">Ref / UTR #</th>
                  <th className="px-4 py-3.5 text-center">Receipt</th>
                  {canManage && <th className="px-4 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-yellow-50/30 transition-colors">
                    <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap font-medium">
                      {p.payment_date ? formatDateIST(p.payment_date) : '-'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block px-2.5 py-1 bg-yellow-50 text-yellow-700 font-semibold text-xs rounded-full border border-yellow-200/60">
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
                    <td className="px-4 py-3.5 font-medium text-gray-800">
                      {p.payment_mode}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-600">
                      {p.reference_number || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {p.receipt_url ? (
                        <a
                          href={p.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
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
                            title="Edit"
                            className="p-1.5 text-gray-400 hover:text-yellow-600 rounded-lg hover:bg-yellow-50 transition-colors"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePayment(p.id)}
                            title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal pre-scoped to this project */}
      <RecordPaymentModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSuccess={() => loadProjectFinances()}
        defaultProjectId={projectId}
        editingPayment={editingPayment}
        projectsList={[
          {
            id: projectId,
            title: projectTitle,
            customer_name: customerName,
            project_budget: currentBudget,
          },
        ]}
      />
    </div>
  );
}
