'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { FiPlus, FiFilter, FiSearch, FiDollarSign, FiClock, FiCheckCircle, FiXCircle, FiMoreVertical, FiEye, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { formatDateIST } from '@/lib/dateUtils';
import { useToast } from '@/components/ui/Toast';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SidePanel } from '@/components/ui/SidePanel';
import OfficeExpenseForm from '@/components/office-expenses/OfficeExpenseForm';
import OfficeExpenseApprovalModal from '../../../components/office-expenses/OfficeExpenseApprovalModal';

export default function OfficeExpensesPage() {
    const { user, isAdmin } = useAuth();
    const { hasPermission } = useUserPermissions();
    const canCreate = hasPermission('office_expenses.create');
    const canApprove = hasPermission('office_expenses.approve');
    const canDelete = hasPermission('office_expenses.delete');

    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingExpense, setEditingExpense] = useState<any | null>(null);
    const [approvingExpense, setApprovingExpense] = useState<any | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    const { setTitle, setSubtitle } = useHeaderTitle();
    const { showToast } = useToast();

    useEffect(() => {
        setTitle('Expenses');
    }, [setTitle]);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        fetchExpenses();
    }, [user]);

    const fetchExpenses = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('office_expenses')
                .select(`
          *,
          user:users!user_id(full_name, email),
          approver:users!approved_by(full_name)
        `)
                .order('expense_date', { ascending: false });

            if (error) throw error;
            setExpenses(data || []);
        } catch (error: any) {
            console.error('Error fetching office expenses:', error);
            showToast('error', 'Failed to load office expenses');
        } finally {
            setLoading(false);
        }
    };

    const filteredExpenses = useMemo(() => {
        return expenses.filter(expense => {
            const matchesTab = activeTab === 'all' || expense.status === activeTab;
            const matchesSearch =
                expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                expense.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                expense.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesTab && matchesSearch;
        });
    }, [expenses, activeTab, searchQuery]);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this expense?')) return;

        try {
            const { error } = await supabase
                .from('office_expenses')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast('success', 'Expense deleted successfully');
            fetchExpenses();
        } catch (error: any) {
            console.error('Error deleting expense:', error);
            showToast('error', error.message || 'Failed to delete expense');
        }
    };

    const stats = useMemo(() => {
        return {
            pending: expenses.filter(e => e.status === 'pending').length,
            approved: expenses.filter(e => e.status === 'approved').length,
            rejected: expenses.filter(e => e.status === 'rejected').length,
            totalAmount: expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + Number(e.amount), 0)
        };
    }, [expenses]);

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Total Approved</p>
                    <p className="text-2xl font-bold text-gray-900">₹{stats.totalAmount.toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Pending Approval</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Approved This Month</p>
                    <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Rejected</p>
                    <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                </div>
            </div>

            {/* Filters & Actions */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto no-scrollbar">
                    {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            {tab !== 'all' && stats[tab] > 0 && (
                                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${tab === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                    tab === 'approved' ? 'bg-green-100 text-green-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                    {stats[tab]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search expenses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                        />
                    </div>
                    {canCreate && (
                        <button
                            onClick={() => {
                                setEditingExpense(null);
                                setShowForm(true);
                            }}
                            className="btn-primary whitespace-nowrap flex items-center gap-2"
                        >
                            <FiPlus className="w-4 h-4" />
                            Add Expense
                        </button>
                    )}
                </div>
            </div>

            {/* Table/List View */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading expenses...</div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <div className="w-12 h-12 mx-auto mb-4 text-gray-300 flex items-center justify-center text-3xl font-bold">₹</div>
                        <p className="text-lg font-medium">No expenses found</p>
                        <p className="text-sm">Try changing your filters or searching for something else.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Requested By</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredExpenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {formatDateIST(expense.expense_date)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{expense.description}</div>
                                            {expense.admin_remarks && (
                                                <div className="text-xs text-red-500 mt-0.5 mt-1 bg-red-50 p-1 rounded inline-block">
                                                    Note: {expense.admin_remarks}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold uppercase">
                                                {expense.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{expense.user?.full_name}</div>
                                            <div className="text-xs text-gray-500">{expense.user?.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                                            ₹{Number(expense.amount).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${expense.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                expense.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {expense.status === 'approved' && <FiCheckCircle />}
                                                {expense.status === 'pending' && <FiClock />}
                                                {expense.status === 'rejected' && <FiXCircle />}
                                                {expense.status.toUpperCase()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {canApprove && expense.status === 'pending' && (
                                                    <button
                                                        onClick={() => setApprovingExpense(expense)}
                                                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                                                        title="Approve/Reject"
                                                    >
                                                        <FiCheckCircle className="w-5 h-5" />
                                                    </button>
                                                )}
                                                {expense.bill_url && (
                                                    <a
                                                        href={expense.bill_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="View Bill"
                                                    >
                                                        <FiEye className="w-5 h-5" />
                                                    </a>
                                                )}
                                                {(user?.id === expense.user_id || isAdmin) && expense.status === 'pending' && (
                                                    <button
                                                        onClick={() => {
                                                            setEditingExpense(expense);
                                                            setShowForm(true);
                                                        }}
                                                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <FiEdit2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDelete(expense.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <FiTrash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Side Panels & Modals */}
            {/* Form Container: SidePanel for Desktop, BottomSheet for Mobile */}
            {isMobile ? (
                <BottomSheet
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                >
                    <OfficeExpenseForm
                        expense={editingExpense}
                        onSuccess={() => {
                            setShowForm(false);
                            fetchExpenses();
                        }}
                        onCancel={() => setShowForm(false)}
                    />
                </BottomSheet>
            ) : (
                <SidePanel
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                    title=""
                >
                    <OfficeExpenseForm
                        expense={editingExpense}
                        onSuccess={() => {
                            setShowForm(false);
                            fetchExpenses();
                        }}
                        onCancel={() => setShowForm(false)}
                    />
                </SidePanel>
            )}

            <BottomSheet
                isOpen={!!approvingExpense}
                onClose={() => setApprovingExpense(null)}
            >
                <OfficeExpenseApprovalModal
                    expense={approvingExpense}
                    onSuccess={() => {
                        setApprovingExpense(null);
                        fetchExpenses();
                    }}
                    onClose={() => setApprovingExpense(null)}
                />
            </BottomSheet>
        </div>
    );
}
