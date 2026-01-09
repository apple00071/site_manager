'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { FiPlus, FiFilter, FiSearch, FiMoreVertical, FiEdit2, FiTrash2, FiFileText, FiCheck, FiX, FiEye, FiUser } from 'react-icons/fi';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/ui/Toast';
import OfficeExpenseForm from '@/components/office-expenses/OfficeExpenseForm';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Modal } from '@/components/ui/Modal'; // Import the new Modal
import { SidePanel } from '@/components/ui/SidePanel'; // Import SidePanel
import { ImageModal } from '@/components/ui/ImageModal';
import OfficeExpenseApprovalModal from '@/components/office-expenses/OfficeExpenseApprovalModal';
import { formatDateIST } from '@/lib/dateUtils';
import { DataTable, StatusBadge, CurrencyCell, Column } from '@/components/ui/DataTable';

interface OfficeExpense {
    id: string;
    description: string;
    amount: number;
    expense_date: string;
    category: string;
    status: 'pending' | 'approved' | 'rejected';
    bill_url?: string;
    bill_urls?: string[];
    created_at: string;
    user_id: string;
    user?: {
        full_name: string;
        email: string;
    };
    approved_by?: string;
    admin_remarks?: string;
}

export default function OfficeExpensesPage() {
    const { user, isAdmin } = useAuth();
    const { hasPermission } = useUserPermissions();
    const { showToast } = useToast();

    // Permissions
    const canCreate = hasPermission('office_expenses.create');
    const canApprove = hasPermission('office_expenses.approve');
    const canDelete = hasPermission('office_expenses.delete');

    // State
    const [expenses, setExpenses] = useState<OfficeExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

    // Modal States
    const [showForm, setShowForm] = useState(false);
    const [editingExpense, setEditingExpense] = useState<OfficeExpense | null>(null);
    const [approvingExpense, setApprovingExpense] = useState<OfficeExpense | null>(null);
    const [viewingBillUrl, setViewingBillUrl] = useState<string | null>(null);

    // Kebab Menu State
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showMobileActions, setShowMobileActions] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        fetchExpenses();
    }, []);

    // Close menu on scroll or click outside
    useEffect(() => {
        const handleScroll = () => {
            if (activeMenuId) {
                setActiveMenuId(null);
                setMenuPosition(null);
            }
        };

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setActiveMenuId(null);
                setMenuPosition(null);
            }
        };

        window.addEventListener('scroll', handleScroll, true);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeMenuId]);

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/office-expenses');
            if (res.ok) {
                const data = await res.json();
                setExpenses(data.expenses);
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
            showToast('error', 'Failed to load expenses');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this expense?')) return;

        try {
            const res = await fetch(`/api/office-expenses?id=${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                showToast('success', 'Expense deleted successfully');
                fetchExpenses();
            } else {
                throw new Error('Failed to delete');
            }
        } catch (error) {
            console.error('Error deleting expense:', error);
            showToast('error', 'Failed to delete expense');
        }
    };

    const updateStatus = async (id: string, status: 'approved' | 'rejected', remarks?: string) => {
        try {
            const res = await fetch(`/api/office-expenses?id=${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, admin_remarks: remarks }),
            });

            if (res.ok) {
                showToast('success', `Expense ${status} successfully`);
                fetchExpenses();
            } else {
                throw new Error('Failed to update status');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            showToast('error', 'Failed to update expense status');
        }
    };

    const handleMenuClick = (e: React.MouseEvent, expenseId: string) => {
        e.stopPropagation();
        if (isMobile) {
            setShowMobileActions(expenseId);
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuPosition({
            top: rect.bottom + window.scrollY + 5,
            left: rect.right + window.scrollX - 160,
        });
        setActiveMenuId(activeMenuId === expenseId ? null : expenseId);
    };

    const filteredExpenses = expenses.filter(expense => {
        const matchesSearch =
            expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            expense.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
            expense.user?.full_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || expense.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Stats
    const stats = {
        totalApproved: expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + Number(e.amount), 0),
        pendingCount: expenses.filter(e => e.status === 'pending').length,
        approvedCount: expenses.filter(e => e.status === 'approved').length,
        rejectedCount: expenses.filter(e => e.status === 'rejected').length,
        totalCount: expenses.length
    };

    // Columns for DataTable
    const columns: Column<OfficeExpense>[] = [
        {
            key: 'date',
            label: 'Date',
            width: 'w-32',
            render: (_, row) => <span className="text-gray-600">{formatDateIST(row.expense_date)}</span>
        },
        {
            key: 'description',
            label: 'Description',
            render: (_, row) => (
                <div className="max-w-xs">
                    <p className="font-medium text-gray-900 truncate" title={row.description}>{row.description}</p>
                    {row.admin_remarks && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate" title={row.admin_remarks}>Remark: {row.admin_remarks}</p>
                    )}
                </div>
            )
        },
        {
            key: 'category',
            label: 'Category',
            width: 'w-32',
            render: (_, row) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 uppercase tracking-wide">
                    {row.category}
                </span>
            )
        },
        {
            key: 'requested_by',
            label: 'Requested By',
            render: (_, row) => (
                <div>
                    <p className="text-sm font-medium text-gray-900">{row.user?.full_name}</p>
                </div>
            )
        },
        {
            key: 'amount',
            label: 'Amount',
            width: 'w-32',
            align: 'right',
            render: (_, row) => <CurrencyCell value={Number(row.amount)} />
        },
        {
            key: 'status',
            label: 'Status',
            width: 'w-32',
            render: (_, row) => (
                <StatusBadge
                    status={row.status.toUpperCase()}
                    variant={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'error' : 'warning'}
                />
            )
        },
        {
            key: 'actions',
            label: '',
            width: 'w-10',
            render: (_, row) => (
                <div className="flex justify-end">
                    <button
                        onClick={(e) => handleMenuClick(e, row.id)}
                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <FiMoreVertical className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ];

    if (!mounted) return null;

    return (
        <div className="space-y-6">

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Total Approved</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">₹{stats.totalApproved.toLocaleString()}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Pending</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg font-bold text-yellow-600">{stats.pendingCount}</span>
                    </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Approved</p>
                    <p className="text-lg font-bold text-green-600 mt-1">{stats.approvedCount}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Rejected</p>
                    <p className="text-lg font-bold text-red-600 mt-1">{stats.rejectedCount}</p>
                </div>
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Tabs */}
                    <div className="flex gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                        {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`
                                    px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                                    ${statusFilter === status
                                        ? 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200' // Active Tab style
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }
                                `}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                                <span className={`ml-2 text-xs py-0.5 px-1.5 rounded-full ${statusFilter === status ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                                    {status === 'all' ? stats.totalCount :
                                        status === 'pending' ? stats.pendingCount :
                                            status === 'approved' ? stats.approvedCount :
                                                stats.rejectedCount}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search expenses..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 w-full md:w-64"
                            />
                        </div>

                        {canCreate && (
                            <button
                                onClick={() => {
                                    setEditingExpense(null);
                                    setShowForm(true);
                                }}
                                className="btn-primary flex items-center gap-2 whitespace-nowrap"
                            >
                                <FiPlus className="w-4 h-4" />
                                Add Expense
                            </button>
                        )}
                    </div>
                </div>

                {/* Table or Card View */}
                {isMobile ? (
                    <div className="space-y-4">
                        {filteredExpenses.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                                <FiFileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No expenses found matching your criteria.</p>
                            </div>
                        ) : (
                            filteredExpenses.map((expense) => {
                                const isOwner = user?.id === expense.user_id;
                                const isPending = expense.status === 'pending';
                                const billUrl = (expense.bill_urls && expense.bill_urls.length > 0)
                                    ? expense.bill_urls[0]
                                    : expense.bill_url;

                                return (
                                    <div key={expense.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                                        {/* Card Header */}
                                        <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                                    {expense.category || 'Office Expense'}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <StatusBadge
                                                        status={expense.status.toUpperCase()}
                                                        variant={expense.status === 'approved' ? 'success' : expense.status === 'rejected' ? 'error' : 'warning'}
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => handleMenuClick(e, expense.id)}
                                                className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors border border-transparent active:border-gray-100"
                                            >
                                                <FiMoreVertical className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Card Body */}
                                        <div className="p-4 flex-1">
                                            <div className="flex justify-between items-start mb-4">
                                                <h4 className="text-sm font-bold text-gray-900 leading-tight">
                                                    {expense.description}
                                                </h4>
                                                <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap ml-2">
                                                    {formatDateIST(expense.expense_date)}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 flex-shrink-0">
                                                        <FiUser className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] text-gray-400 font-bold uppercase">Requested by</span>
                                                        <span className="text-xs font-semibold text-gray-700">
                                                            {expense.user?.full_name || 'System User'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">Amount</div>
                                                    <div className="text-lg font-black text-gray-900">
                                                        ₹{Number(expense.amount).toLocaleString('en-IN')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={filteredExpenses}
                        keyField="id"
                        loading={loading}
                        emptyMessage="No expenses found matching your criteria."
                        className="min-w-full"
                    />
                )}
            </div>

            {/* Desktop Portal for Actions Menu */}
            {mounted && !isMobile && activeMenuId && menuPosition && createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[60]"
                        onClick={() => setActiveMenuId(null)}
                    />
                    <div
                        ref={menuRef}
                        style={{
                            position: 'absolute',
                            top: `${menuPosition.top}px`,
                            left: `${menuPosition.left}px`,
                        }}
                        className="fixed z-[70] w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1"
                    >
                        {(() => {
                            const expense = expenses.find(e => e.id === activeMenuId);
                            if (!expense) return null;
                            const isOwner = user?.id === expense.user_id;
                            const isPending = expense.status === 'pending';

                            // Determine bill URL to view
                            const billUrl = (expense.bill_urls && expense.bill_urls.length > 0)
                                ? expense.bill_urls[0]
                                : expense.bill_url;

                            return (
                                <>
                                    {canApprove && isPending && (
                                        <button
                                            onClick={() => {
                                                setApprovingExpense(expense);
                                                setActiveMenuId(null);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <FiCheck className="w-4 h-4 text-green-600" />
                                            Approve/Reject
                                        </button>
                                    )}

                                    {billUrl && (
                                        <button
                                            onClick={() => {
                                                setViewingBillUrl(billUrl);
                                                setActiveMenuId(null);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <FiFileText className="w-4 h-4 text-blue-600" />
                                            View Bill
                                        </button>
                                    )}

                                    {isOwner && isPending && (
                                        <button
                                            onClick={() => {
                                                setEditingExpense(expense);
                                                setShowForm(true);
                                                setActiveMenuId(null);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <FiEdit2 className="w-4 h-4 text-gray-600" />
                                            Edit
                                        </button>
                                    )}

                                    {(canDelete || (isOwner && isPending)) && (
                                        <button
                                            onClick={() => {
                                                handleDelete(expense.id);
                                                setActiveMenuId(null);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                            <FiTrash2 className="w-4 h-4" />
                                            Delete
                                        </button>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </>,
                document.body
            )}

            {/* Mobile BottomSheet for More Actions */}
            {isMobile && showMobileActions && (
                <BottomSheet
                    isOpen={!!showMobileActions}
                    onClose={() => setShowMobileActions(null)}
                    title="Actions"
                >
                    <div className="p-4 space-y-3">
                        {(() => {
                            const expense = expenses.find(e => e.id === showMobileActions);
                            if (!expense) return null;
                            const isOwner = user?.id === expense.user_id;
                            const isPending = expense.status === 'pending';
                            const billUrl = (expense.bill_urls && expense.bill_urls.length > 0)
                                ? expense.bill_urls[0]
                                : expense.bill_url;

                            return (
                                <div className="divide-y divide-gray-50 -mx-4 -mb-4">
                                    {canApprove && isPending && (
                                        <button
                                            onClick={() => {
                                                setApprovingExpense(expense);
                                                setShowMobileActions(null);
                                            }}
                                            className="w-full flex items-center gap-4 p-4 text-sm font-semibold text-green-600 hover:bg-green-50 active:bg-green-50 transition-colors"
                                        >
                                            <FiCheck className="w-5 h-5" />
                                            Approve Expense
                                        </button>
                                    )}

                                    {billUrl && (
                                        <button
                                            onClick={() => {
                                                setViewingBillUrl(billUrl);
                                                setShowMobileActions(null);
                                            }}
                                            className="w-full flex items-center gap-4 p-4 text-sm font-semibold text-blue-600 hover:bg-blue-50 active:bg-blue-50 transition-colors"
                                        >
                                            <FiFileText className="w-5 h-5" />
                                            View Bill
                                        </button>
                                    )}

                                    {isOwner && isPending && (
                                        <button
                                            onClick={() => {
                                                setEditingExpense(expense);
                                                setShowForm(true);
                                                setShowMobileActions(null);
                                            }}
                                            className="w-full flex items-center gap-4 p-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-50 transition-colors"
                                        >
                                            <FiEdit2 className="w-5 h-5 text-gray-400" />
                                            Edit Expense
                                        </button>
                                    )}

                                    {(canDelete || (isOwner && isPending)) && (
                                        <button
                                            onClick={() => {
                                                handleDelete(expense.id);
                                                setShowMobileActions(null);
                                            }}
                                            className="w-full flex items-center gap-4 p-4 text-sm font-semibold text-red-600 hover:bg-red-50 active:bg-red-50 transition-colors"
                                        >
                                            <FiTrash2 className="w-5 h-5" />
                                            Delete Expense
                                        </button>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </BottomSheet>
            )}

            {/* Image Modal for Viewing Bills */}
            {viewingBillUrl && (
                <ImageModal
                    images={[viewingBillUrl]}
                    currentIndex={0}
                    isOpen={!!viewingBillUrl}
                    onClose={() => setViewingBillUrl(null)}
                />
            )}

            {/* Modals */}
            {/* Mobile BottomSheet for Form */}
            {isMobile && (
                <BottomSheet
                    isOpen={showForm}
                    onClose={() => {
                        setShowForm(false);
                        setEditingExpense(null);
                    }}
                    title={editingExpense ? "Edit Expense" : "Add Expense"}
                >
                    <div className="p-4">
                        <OfficeExpenseForm
                            onSuccess={() => {
                                setShowForm(false);
                                setEditingExpense(null);
                                fetchExpenses();
                            }}
                            onCancel={() => {
                                setShowForm(false);
                                setEditingExpense(null);
                            }}
                            expense={editingExpense || undefined}
                        />
                    </div>
                </BottomSheet>
            )}

            {/* Desktop SidePanel for Form */}
            {!isMobile && (
                <SidePanel
                    isOpen={showForm}
                    onClose={() => {
                        setShowForm(false);
                        setEditingExpense(null);
                    }}
                    title={editingExpense ? "Edit Expense" : "Add Expense"}
                    width="md"
                >
                    <OfficeExpenseForm
                        onSuccess={() => {
                            setShowForm(false);
                            setEditingExpense(null);
                            fetchExpenses();
                        }}
                        onCancel={() => {
                            setShowForm(false);
                            setEditingExpense(null);
                        }}
                        expense={editingExpense || undefined}
                    />
                </SidePanel>
            )}

            {/* Desktop Modal for Approvals */}
            {!isMobile && approvingExpense && (
                <Modal
                    isOpen={!!approvingExpense}
                    onClose={() => setApprovingExpense(null)}
                    title="Review Expense Request"
                >
                    <OfficeExpenseApprovalModal
                        expense={approvingExpense}
                        onSuccess={() => {
                            setApprovingExpense(null);
                            fetchExpenses();
                        }}
                        onClose={() => setApprovingExpense(null)}
                    />
                </Modal>
            )}

            {/* Mobile BottomSheet for Approvals */}
            {isMobile && approvingExpense && (
                <BottomSheet
                    isOpen={!!approvingExpense}
                    onClose={() => setApprovingExpense(null)}
                    title="Review Expense Request"
                >
                    <div className="p-4">
                        <OfficeExpenseApprovalModal
                            expense={approvingExpense}
                            onSuccess={() => {
                                setApprovingExpense(null);
                                fetchExpenses();
                            }}
                            onClose={() => setApprovingExpense(null)}
                        />
                    </div>
                </BottomSheet>
            )}
        </div>
    );
}
