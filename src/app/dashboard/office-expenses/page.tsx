'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { createPortal } from 'react-dom';
import { FiPlus, FiFilter, FiSearch, FiDollarSign, FiClock, FiCheckCircle, FiXCircle, FiMoreVertical, FiEye, FiEdit2, FiTrash2, FiChevronDown, FiX, FiCircle, FiUpload, FiSend, FiColumns, FiLayers } from 'react-icons/fi';
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
    const [showActions, setShowActions] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { setTitle, setSubtitle } = useHeaderTitle();
    const { showToast } = useToast();

    useEffect(() => {
        setTitle('Expenses');
    }, [setTitle]);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        setMounted(true);
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
            const response = await fetch('/api/office-expenses');
            if (!response.ok) throw new Error('Failed to fetch expenses');
            const { expenses: data } = await response.json();
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
            const response = await fetch(`/api/office-expenses?id=${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete expense');
            }

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

    const statusTabs = useMemo(() => [
        { key: 'pending', label: 'Pending', count: stats.pending },
        { key: 'approved', label: 'Approved', count: stats.approved },
        { key: 'rejected', label: 'Rejected', count: stats.rejected },
        { key: 'all', label: 'All', count: expenses.length }
    ], [stats, expenses.length]);

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

            {/* Control Bar - Standardized Card Style */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6">
                <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-1.5 sm:py-0">
                    {/* Status Tabs */}
                    <div className="flex overflow-x-auto w-full sm:w-auto no-scrollbar border-b sm:border-b-0 border-gray-100 mb-2 sm:mb-0">
                        {statusTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.key
                                    ? 'border-yellow-500 text-yellow-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {tab.label}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.key
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-500'
                                    }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Search and Actions */}
                    <div className="flex items-center gap-3 w-full sm:w-auto px-2 pb-2 sm:pb-0 sm:py-2">
                        <div className="relative flex-1 sm:w-64">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <input
                                type="text"
                                placeholder="Search expenses..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <FiX className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Desktop Actions Dropdown */}
                        {canCreate && (
                            <div className="relative hidden sm:block">
                                <button
                                    onClick={() => setShowActions(!showActions)}
                                    className="btn-primary py-2 flex items-center gap-2 min-w-[120px]"
                                >
                                    <span className="flex items-center gap-2">
                                        <FiPlus className="w-4 h-4" />
                                        Actions
                                    </span>
                                    <FiChevronDown className={`w-4 h-4 transition-transform ${showActions ? 'rotate-180' : ''}`} />
                                </button>

                                {showActions && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setShowActions(false)}
                                        />
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                                            <button
                                                onClick={() => {
                                                    setEditingExpense(null);
                                                    setShowForm(true);
                                                    setShowActions(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0"
                                            >
                                                <FiPlus className="text-gray-400" />
                                                <span className="font-medium">Add Expense</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
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
                                            <div className="relative flex justify-end">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveMenuId(activeMenuId === expense.id ? null : expense.id);
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                                                >
                                                    <FiMoreVertical className="w-5 h-5" />
                                                </button>

                                                {activeMenuId === expense.id && (
                                                    <div
                                                        ref={menuRef}
                                                        className="absolute right-0 top-8 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {canApprove && expense.status === 'pending' && (
                                                            <button
                                                                onClick={() => {
                                                                    setApprovingExpense(expense);
                                                                    setActiveMenuId(null);
                                                                }}
                                                                className="w-full text-left px-4 py-2.5 text-sm text-yellow-600 hover:bg-yellow-50 flex items-center gap-2"
                                                            >
                                                                <FiCheckCircle className="w-4 h-4" /> Approve/Reject
                                                            </button>
                                                        )}

                                                        {expense.bill_url && (
                                                            <a
                                                                href={expense.bill_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                                                onClick={() => setActiveMenuId(null)}
                                                            >
                                                                <FiEye className="w-4 h-4" /> View Bill
                                                            </a>
                                                        )}

                                                        {(user?.id === expense.user_id || isAdmin) && expense.status === 'pending' && (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingExpense(expense);
                                                                    setShowForm(true);
                                                                    setActiveMenuId(null);
                                                                }}
                                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                            >
                                                                <FiEdit2 className="w-4 h-4" /> Edit
                                                            </button>
                                                        )}

                                                        {canDelete && (
                                                            <button
                                                                onClick={() => {
                                                                    handleDelete(expense.id);
                                                                    setActiveMenuId(null);
                                                                }}
                                                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                            >
                                                                <FiTrash2 className="w-4 h-4" /> Delete
                                                            </button>
                                                        )}
                                                    </div>
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
            {/* Mobile Actions FAB & Bottom Sheet (Matching Project Page) */}
            {mounted && canCreate && (
                createPortal(
                    <>
                        <div className="fixed bottom-6 right-6 z-40 md:hidden">
                            <button
                                onClick={() => setMobileMenuOpen(true)}
                                className="w-14 h-14 bg-yellow-400 text-yellow-900 rounded-full shadow-lg flex items-center justify-center hover:bg-yellow-500 active:scale-95 transition-all duration-200"
                            >
                                <FiPlus className="w-6 h-6" />
                            </button>
                        </div>

                        {mobileMenuOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                                    onClick={() => setMobileMenuOpen(false)}
                                />
                                <div className="fixed bottom-0 left-0 right-0 z-[61] bg-white rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 md:hidden">
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                        <h3 className="text-sm font-semibold text-gray-900">Actions</h3>
                                        <button
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="p-1 rounded-full text-gray-400 hover:bg-gray-100"
                                        >
                                            <FiX className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="p-2 space-y-1 pb-8">
                                        <button
                                            onClick={() => {
                                                setEditingExpense(null);
                                                setShowForm(true);
                                                setMobileMenuOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-base text-gray-700 hover:bg-gray-50 flex items-center gap-4 rounded-xl active:bg-yellow-50 transition-colors"
                                        >
                                            <span className="text-gray-500 text-xl"><FiPlus /></span>
                                            <span className="font-medium">Add Expense</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </>,
                    document.body
                )
            )}
        </div>
    );
}
