'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiDownload, FiMail,
    FiFileText, FiAlertCircle, FiMoreVertical, FiDollarSign,
    FiTruck, FiClock, FiCheckCircle, FiPackage, FiSearch, FiChevronDown, FiEye
} from 'react-icons/fi';
import { POViewModal } from './POViewModal';

interface Supplier {
    id: string;
    name: string;
}

interface PurchaseOrder {
    id: string;
    project_id: string;
    supplier_id: string | null;
    supplier: Supplier | null;
    po_number: string;
    po_date: string;
    delivery_date: string | null;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    status: string;
    created_at: string;
    line_items?: { quantity: number; rate: number; amount: number }[];
}

interface Invoice {
    id: string;
    invoice_number: string | null;
    invoice_type: string;
    total_amount: number;
    status: string;
    created_at: string;
}

interface Payment {
    id: string;
    amount: number;
    payment_date: string;
    payment_method: string | null;
}

interface ProcurementTabProps {
    projectId: string;
}

type TabType = 'orders' | 'invoices' | 'payments';

export function ProcurementTab({ projectId }: ProcurementTabProps) {
    const { isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('orders');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [pos, setPos] = useState<PurchaseOrder[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [boqItems, setBoqItems] = useState<any[]>([]);

    const [showPoForm, setShowPoForm] = useState(false);
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [showSupplierForm, setShowSupplierForm] = useState(false);
    const [supplierForm, setSupplierForm] = useState({
        name: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        gst_number: '',
    });

    const [poStats, setPoStats] = useState<any>({});
    const [invoiceStats, setInvoiceStats] = useState<any>({});
    const [paymentStats, setPaymentStats] = useState<any>({});

    // Filter states
    const [poFilters, setPoFilters] = useState({ number: '', supplier: '', date: '', status: '' });
    const [invoiceFilters, setInvoiceFilters] = useState({ number: '', type: '', date: '', status: '' });
    const [paymentFilters, setPaymentFilters] = useState({ date: '', method: '', amount: '' });

    // Form states
    const [poForm, setPoForm] = useState({
        supplier_id: '',
        delivery_date: '',
        delivery_address: '',
        notes: '',
        gst_rate: 18,
        line_items: [{ boq_item_id: '', description: '', unit: '', quantity: 0, rate: 0 }],
    });

    const [invoiceForm, setInvoiceForm] = useState({
        po_id: '',
        supplier_id: '',
        invoice_number: '',
        invoice_date: '',
        invoice_type: 'ra_bill',
        amount: 0,
        tax_amount: 0,
        total_amount: 0,
        notes: '',
    });

    const [paymentForm, setPaymentForm] = useState({
        invoice_id: '',
        supplier_id: '',
        amount: 0,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'bank_transfer',
        reference_number: '',
        notes: '',
    });

    // View PO State
    const [viewPo, setViewPo] = useState<any>(null);
    const [showPoView, setShowPoView] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);

            const [posRes, invoicesRes, paymentsRes, suppliersRes, boqRes] = await Promise.all([
                fetch(`/api/purchase-orders?project_id=${projectId}`),
                fetch(`/api/invoices?project_id=${projectId}`),
                fetch(`/api/payments?project_id=${projectId}`),
                fetch('/api/suppliers?active=true'),
                fetch(`/api/boq?project_id=${projectId}`),
            ]);

            const [posData, invoicesData, paymentsData, suppliersData, boqData] = await Promise.all([
                posRes.json(),
                invoicesRes.json(),
                paymentsRes.json(),
                suppliersRes.json(),
                boqRes.json(),
            ]);

            setPos(posData.pos || []);
            setPoStats(posData.stats || {});
            setInvoices(invoicesData.invoices || []);
            setInvoiceStats(invoicesData.stats || {});
            setPayments(paymentsData.payments || []);
            setPaymentStats(paymentsData.stats || {});
            setSuppliers(suppliersData.suppliers || []);
            setBoqItems(boqData.items || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    // Filtered lists
    const filteredPos = useMemo(() => {
        return pos.filter(po => {
            const matchNumber = !poFilters.number || po.po_number.toLowerCase().includes(poFilters.number.toLowerCase());
            const matchSupplier = !poFilters.supplier || (po.supplier?.name || '').toLowerCase().includes(poFilters.supplier.toLowerCase());
            const poDate = new Date(po.po_date).toLocaleDateString();
            const matchDate = !poFilters.date || poDate.includes(poFilters.date);
            const matchStatus = !poFilters.status || po.status === poFilters.status;
            return matchNumber && matchSupplier && matchDate && matchStatus;
        });
    }, [pos, poFilters]);

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const matchNumber = !invoiceFilters.number || (inv.invoice_number || '').toLowerCase().includes(invoiceFilters.number.toLowerCase());
            const matchType = !invoiceFilters.type || inv.invoice_type === invoiceFilters.type;
            const invDate = new Date(inv.created_at).toLocaleDateString();
            const matchDate = !invoiceFilters.date || invDate.includes(invoiceFilters.date);
            const matchStatus = !invoiceFilters.status || inv.status === invoiceFilters.status;
            return matchNumber && matchType && matchDate && matchStatus;
        });
    }, [invoices, invoiceFilters]);

    const filteredPayments = useMemo(() => {
        return payments.filter(pay => {
            const payDate = new Date(pay.payment_date).toLocaleDateString();
            const matchDate = !paymentFilters.date || payDate.includes(paymentFilters.date);
            const matchMethod = !paymentFilters.method || (pay.payment_method || '').includes(paymentFilters.method);
            const matchAmount = !paymentFilters.amount || pay.amount.toString().includes(paymentFilters.amount);
            return matchDate && matchMethod && matchAmount;
        });
    }, [payments, paymentFilters]);

    useEffect(() => {
        fetchData();
    }, [projectId]);

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount).replace(/^(\D+)/, '₹');
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const handleCreateSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/suppliers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(supplierForm),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Refresh suppliers list
            const suppliersRes = await fetch(`/api/suppliers?active=true`);
            const suppliersData = await suppliersRes.json();
            setSuppliers(suppliersData.suppliers || []);

            // Auto-select the new supplier
            setPoForm({ ...poForm, supplier_id: data.supplier.id });

            // Reset form and close
            setSupplierForm({ name: '', contact_name: '', contact_phone: '', contact_email: '', gst_number: '' });
            setShowSupplierForm(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to create supplier');
        }
    };

    // Get confirmed BOQ items ready for PO
    const orderedBoqItemIds = useMemo(() => {
        const ids = new Set<string>();
        pos.forEach(po => {
            if (po.status !== 'cancelled' && po.line_items) {
                po.line_items.forEach((item: any) => {
                    if (item.boq_item_id) ids.add(item.boq_item_id);
                });
            }
        });
        return ids;
    }, [pos]);

    const confirmedItems = boqItems.filter((item: any) =>
        item.status === 'confirmed' && !orderedBoqItemIds.has(item.id)
    );

    const getPoStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'bg-gray-100 text-gray-700',
            sent: 'bg-blue-100 text-blue-700',
            acknowledged: 'bg-purple-100 text-purple-700',
            partially_received: 'bg-yellow-100 text-yellow-700',
            received: 'bg-green-100 text-green-700',
            cancelled: 'bg-red-100 text-red-700',
        };
        return (
            <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || 'bg-gray-100'}`}>
                {status.replace(/_/g, ' ')}
            </span>
        );
    };

    const getInvoiceStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-yellow-100 text-yellow-700',
            approved: 'bg-blue-100 text-blue-700',
            rejected: 'bg-red-100 text-red-700',
            paid: 'bg-green-100 text-green-700',
        };
        return (
            <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || 'bg-gray-100'}`}>
                {status}
            </span>
        );
    };

    const handleCreatePO = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/purchase-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    ...poForm,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchData();
            setShowPoForm(false);
            setPoForm({
                supplier_id: '',
                delivery_date: '',
                delivery_address: '',
                notes: '',
                gst_rate: 18,
                line_items: [{ boq_item_id: '', description: '', unit: '', quantity: 0, rate: 0 }],
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create PO');
        }
    };

    const handleCreateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    ...invoiceForm,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchData();
            setShowInvoiceForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create invoice');
        }
    };

    const handleCreatePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    ...paymentForm,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchData();
            setShowPaymentForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to record payment');
        }
    };

    const handleApproveInvoice = async (invoiceId: string, approve: boolean) => {
        try {
            const res = await fetch('/api/invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: invoiceId,
                    action: approve ? 'approve' : 'reject',
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update invoice');
        }
    };

    const addLineItem = () => {
        setPoForm({
            ...poForm,
            line_items: [...poForm.line_items, { boq_item_id: '', description: '', unit: '', quantity: 0, rate: 0 }],
        });
    };

    const updateLineItem = (index: number, field: string, value: any) => {
        const newItems = [...poForm.line_items];
        newItems[index] = { ...newItems[index], [field]: value };

        // If selecting from BOQ, auto-fill
        if (field === 'boq_item_id' && value) {
            const boqItem = boqItems.find(b => b.id === value);
            if (boqItem) {
                newItems[index] = {
                    ...newItems[index],
                    description: boqItem.item_name,
                    unit: boqItem.unit,
                    rate: boqItem.rate,
                };
            }
        }

        setPoForm({ ...poForm, line_items: newItems });
    };

    const removeLineItem = (index: number) => {
        if (poForm.line_items.length > 1) {
            setPoForm({
                ...poForm,
                line_items: poForm.line_items.filter((_, i) => i !== index),
            });
        }
    };

    if (loading) {
        return (
            <div className="p-6 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 bg-gray-100 rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-bold text-gray-900">Procurement</h2>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-2 bg-yellow-50 rounded-lg">
                            <FiPackage className="w-4 h-4 md:w-5 md:h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-xs md:text-sm text-gray-500">POs</p>
                            <p className="text-lg md:text-xl font-bold">{poStats.total || 0}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-2 bg-yellow-50 rounded-lg">
                            <FiDollarSign className="w-4 h-4 md:w-5 md:h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-xs md:text-sm text-gray-500">PO Value</p>
                            <p className="text-lg md:text-xl font-bold">{formatAmount(poStats.totalValue || 0)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-2 bg-yellow-50 rounded-lg">
                            <FiClock className="w-4 h-4 md:w-5 md:h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-xs md:text-sm text-gray-500">Pending</p>
                            <p className="text-lg md:text-xl font-bold">{formatAmount(invoiceStats.pendingValue || 0)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <FiCheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs md:text-sm text-gray-500">Paid</p>
                            <p className="text-lg md:text-xl font-bold">{formatAmount(paymentStats.totalAmount || 0)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 md:gap-2 mb-4 border-b border-gray-200 overflow-x-auto no-scrollbar">
                {[
                    { key: 'orders', label: 'POs', count: pos.length },
                    { key: 'invoices', label: 'Invoices', count: invoices.length },
                    { key: 'payments', label: 'Payments', count: payments.length },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as TabType)}
                        className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap focus:outline-none ${activeTab === tab.key
                            ? 'border-yellow-500 text-yellow-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        {tab.label}
                        <span className="ml-1 md:ml-2 px-1.5 md:px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                            {tab.count}
                        </span>
                    </button>
                ))}
                <div className="ml-auto flex gap-2 flex-shrink-0">
                    {isAdmin && activeTab === 'orders' && (
                        <button
                            onClick={() => setShowPoForm(true)}
                            className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 text-white rounded-lg font-medium text-sm focus:outline-none hover:opacity-90"
                            style={{ backgroundColor: '#eab308' }}
                        >
                            <FiPlus className="w-4 h-4" />
                            <span className="hidden sm:inline">New PO</span>
                        </button>
                    )}
                    {isAdmin && activeTab === 'invoices' && (
                        <button
                            onClick={() => setShowInvoiceForm(true)}
                            className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 text-white rounded-lg font-medium text-sm focus:outline-none hover:opacity-90"
                            style={{ backgroundColor: '#eab308' }}
                        >
                            <FiPlus className="w-4 h-4" />
                            <span className="hidden sm:inline">New Invoice</span>
                        </button>
                    )}
                    {isAdmin && activeTab === 'payments' && (
                        <button
                            onClick={() => setShowPaymentForm(true)}
                            className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 text-white rounded-lg font-medium text-sm focus:outline-none hover:opacity-90"
                            style={{ backgroundColor: '#eab308' }}
                        >
                            <FiPlus className="w-4 h-4" />
                            <span className="hidden sm:inline">Record Payment</span>
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                    <FiAlertCircle className="w-4 h-4" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto">
                        <FiX className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Purchase Orders Tab */}
            {activeTab === 'orders' && (
                <>
                    {/* Ready for PO Section - Approved BOQ Items */}
                    {confirmedItems.length > 0 && (
                        <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-green-500 rounded-lg">
                                        <FiCheck className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Ready for Purchase Order</h3>
                                        <p className="text-sm text-gray-600">{confirmedItems.length} approved items awaiting PO</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowPoForm(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700"
                                >
                                    <FiPlus className="w-4 h-4" />
                                    Create PO
                                </button>
                            </div>
                            <div className="space-y-2">
                                {confirmedItems.slice(0, 5).map((item: any) => (
                                    <div key={item.id} className="flex justify-between items-center py-2 px-3 bg-white/70 rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">{item.item_name}</p>
                                            <p className="text-xs text-gray-500">
                                                {item.quantity} {item.unit || 'units'} × ₹{(item.rate || 0).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                        <span className="font-medium text-green-700">
                                            ₹{(item.amount || 0).toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                ))}
                                {confirmedItems.length > 5 && (
                                    <p className="text-sm text-gray-500 text-center pt-2">
                                        +{confirmedItems.length - 5} more items
                                    </p>
                                )}
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-green-200">
                                <span className="font-medium text-gray-700">Total Approved Value</span>
                                <span className="text-lg font-bold text-green-700">
                                    ₹{confirmedItems.reduce((sum: number, i: any) => sum + (i.amount || 0), 0).toLocaleString('en-IN')}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {pos.map((po) => (
                            <div key={po.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-semibold text-gray-900">{po.po_number}</p>
                                        <p className="text-sm text-gray-500">{po.supplier?.name || '-'}</p>
                                    </div>
                                    {getPoStatusBadge(po.status)}
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">{formatDate(po.po_date)}</span>
                                    <span className="font-bold text-gray-900">{formatAmount(po.total_amount)}</span>
                                </div>
                            </div>
                        ))}
                        {pos.length === 0 && (
                            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
                                <FiPackage className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p>No purchase orders yet</p>
                            </div>
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-white border-b border-gray-200">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO Number</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                                {/* Inline Filter Row */}
                                <tr className="bg-white border-b border-gray-100">
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400 p-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                                            </span>
                                            <div className="relative w-full">
                                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                                                    <FiSearch className="w-3 h-3 text-gray-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Search PO #"
                                                    value={poFilters.number}
                                                    onChange={(e) => setPoFilters(prev => ({ ...prev, number: e.target.value }))}
                                                    className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-gray-100 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white"
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="relative w-full">
                                            <input
                                                type="text"
                                                placeholder="Filter Supplier"
                                                value={poFilters.supplier}
                                                onChange={(e) => setPoFilters(prev => ({ ...prev, supplier: e.target.value }))}
                                                className="w-full px-2 py-1.5 text-xs bg-white border border-gray-100 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="relative w-full">
                                            <input
                                                type="text"
                                                placeholder="Filter Date"
                                                value={poFilters.date}
                                                onChange={(e) => setPoFilters(prev => ({ ...prev, date: e.target.value }))}
                                                className="w-full px-2 py-1.5 text-xs bg-white border border-gray-100 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2"></td>
                                    <td className="px-3 py-2">
                                        <div className="relative w-full">
                                            <select
                                                value={poFilters.status}
                                                onChange={(e) => setPoFilters(prev => ({ ...prev, status: e.target.value }))}
                                                className="w-full pl-2 pr-6 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white appearance-none"
                                            >
                                                <option value="">All Status</option>
                                                <option value="draft">Draft</option>
                                                <option value="sent">Sent</option>
                                                <option value="acknowledged">Acknowledged</option>
                                                <option value="partially_received">Partial</option>
                                                <option value="received">Received</option>
                                                <option value="cancelled">Cancelled</option>
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                                <FiChevronDown className="w-3 h-3" />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredPos.map((po) => (
                                    <tr key={po.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-3 font-medium text-gray-900">{po.po_number}</td>
                                        <td className="px-3 py-3 text-gray-600">{po.supplier?.name || '-'}</td>
                                        <td className="px-3 py-3 text-gray-600">{formatDate(po.po_date)}</td>
                                        <td className="px-3 py-3 text-right font-medium">{formatAmount(po.total_amount)}</td>
                                        <td className="px-3 py-3 text-center">{getPoStatusBadge(po.status)}</td>
                                        <td className="px-3 py-3 text-right">
                                            <button
                                                onClick={() => {
                                                    setViewPo(po);
                                                    setShowPoView(true);
                                                }}
                                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="View PO"
                                            >
                                                <FiEye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {pos.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                                            <FiPackage className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                            <p>No purchase orders yet</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Invoices Tab */}
            {activeTab === 'invoices' && (
                <>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {invoices.map((invoice) => (
                            <div key={invoice.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-semibold text-gray-900">{invoice.invoice_number || 'No #'}</p>
                                        <p className="text-sm text-gray-500 capitalize">{invoice.invoice_type.replace(/_/g, ' ')}</p>
                                    </div>
                                    {getInvoiceStatusBadge(invoice.status)}
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">{formatDate(invoice.created_at)}</span>
                                    <span className="font-bold text-gray-900">{formatAmount(invoice.total_amount)}</span>
                                </div>
                                {isAdmin && invoice.status === 'pending' && (
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                                        <button
                                            onClick={() => handleApproveInvoice(invoice.id, true)}
                                            className="flex-1 py-2 text-sm text-green-600 bg-green-50 rounded-lg font-medium focus:outline-none"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleApproveInvoice(invoice.id, false)}
                                            className="flex-1 py-2 text-sm text-red-600 bg-red-50 rounded-lg font-medium focus:outline-none"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {invoices.length === 0 && (
                            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
                                <FiFileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p>No invoices yet</p>
                            </div>
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-white border-b border-gray-200">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    {isAdmin && (
                                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    )}
                                </tr>
                                {/* Inline Filter Row */}
                                <tr className="bg-white border-b border-gray-100">
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400 p-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                                            </span>
                                            <div className="relative w-full">
                                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                                                    <FiSearch className="w-3 h-3 text-gray-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Search Invoice #"
                                                    value={invoiceFilters.number}
                                                    onChange={(e) => setInvoiceFilters(prev => ({ ...prev, number: e.target.value }))}
                                                    className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-gray-100 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white"
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="relative w-full">
                                            <select
                                                value={invoiceFilters.type}
                                                onChange={(e) => setInvoiceFilters(prev => ({ ...prev, type: e.target.value }))}
                                                className="w-full pl-2 pr-6 py-1.5 text-xs bg-white border border-gray-100 rounded-lg text-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white appearance-none"
                                            >
                                                <option value="">All Types</option>
                                                <option value="advance">Advance</option>
                                                <option value="ra_bill">RA Bill</option>
                                                <option value="final_bill">Final Bill</option>
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                                <FiChevronDown className="w-3 h-3" />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="relative w-full">
                                            <input
                                                type="text"
                                                placeholder="Filter Date"
                                                value={invoiceFilters.date}
                                                onChange={(e) => setInvoiceFilters(prev => ({ ...prev, date: e.target.value }))}
                                                className="w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-100 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2"></td>
                                    <td className="px-3 py-2">
                                        <div className="relative w-full">
                                            <select
                                                value={invoiceFilters.status}
                                                onChange={(e) => setInvoiceFilters(prev => ({ ...prev, status: e.target.value }))}
                                                className="w-full pl-2 pr-6 py-1.5 text-xs bg-gray-50 border border-gray-100 rounded-lg text-gray-600 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white appearance-none"
                                            >
                                                <option value="">Status</option>
                                                <option value="pending">Pending</option>
                                                <option value="approved">Approved</option>
                                                <option value="paid">Paid</option>
                                                <option value="rejected">Rejected</option>
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                                <FiChevronDown className="w-3 h-3" />
                                            </div>
                                        </div>
                                    </td>
                                    {isAdmin && <td className="px-3 py-2"></td>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredInvoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-3 font-medium text-gray-900">{invoice.invoice_number || '-'}</td>
                                        <td className="px-3 py-3 text-gray-600 capitalize">{invoice.invoice_type.replace(/_/g, ' ')}</td>
                                        <td className="px-3 py-3 text-gray-600">{formatDate(invoice.created_at)}</td>
                                        <td className="px-3 py-3 text-right font-medium">{formatAmount(invoice.total_amount)}</td>
                                        <td className="px-3 py-3 text-center">{getInvoiceStatusBadge(invoice.status)}</td>
                                        {isAdmin && (
                                            <td className="px-4 py-3 text-right">
                                                {invoice.status === 'pending' && (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleApproveInvoice(invoice.id, true)}
                                                            className="p-1 text-green-600 hover:bg-green-50 rounded focus:outline-none"
                                                            title="Approve"
                                                        >
                                                            <FiCheck className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleApproveInvoice(invoice.id, false)}
                                                            className="p-1 text-red-600 hover:bg-red-50 rounded focus:outline-none"
                                                            title="Reject"
                                                        >
                                                            <FiX className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {invoices.length === 0 && (
                                    <tr>
                                        <td colSpan={isAdmin ? 6 : 5} className="px-4 py-12 text-center text-gray-500">
                                            <FiFileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                            <p>No invoices yet</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
                <>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {payments.map((payment) => (
                            <div key={payment.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-gray-900">{formatDate(payment.payment_date)}</p>
                                        <p className="text-sm text-gray-500 capitalize">{payment.payment_method?.replace(/_/g, ' ') || 'Unknown'}</p>
                                    </div>
                                    <span className="font-bold text-green-600">{formatAmount(payment.amount)}</span>
                                </div>
                            </div>
                        ))}
                        {payments.length === 0 && (
                            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
                                <FiDollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p>No payments recorded yet</p>
                            </div>
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-white border-b border-gray-200">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Method</th>
                                    <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                                </tr>
                                {/* Inline Filter Row */}
                                <tr className="bg-white border-b border-gray-100">
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400 p-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                                            </span>
                                            <div className="relative w-full">
                                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                                                    <FiSearch className="w-3 h-3 text-gray-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Search Date"
                                                    value={paymentFilters.date}
                                                    onChange={(e) => setPaymentFilters(prev => ({ ...prev, date: e.target.value }))}
                                                    className="w-full pl-7 pr-2 py-1.5 text-xs bg-gray-50 border border-gray-100 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="relative w-full">
                                            <select
                                                value={paymentFilters.method}
                                                onChange={(e) => setPaymentFilters(prev => ({ ...prev, method: e.target.value }))}
                                                className="w-full pl-2 pr-6 py-1.5 text-xs bg-gray-50 border border-gray-100 rounded-lg text-gray-600 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white appearance-none"
                                            >
                                                <option value="">All Methods</option>
                                                <option value="bank_transfer">Bank Transfer</option>
                                                <option value="upi">UPI</option>
                                                <option value="cash">Cash</option>
                                                <option value="cheque">Cheque</option>
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                                <FiChevronDown className="w-3 h-3" />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="relative w-full">
                                            <input
                                                type="text"
                                                placeholder="Filter Amount"
                                                value={paymentFilters.amount}
                                                onChange={(e) => setPaymentFilters(prev => ({ ...prev, amount: e.target.value }))}
                                                className="w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-100 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredPayments.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-3 font-medium text-gray-900">{formatDate(payment.payment_date)}</td>
                                        <td className="px-3 py-3 text-gray-600 capitalize">{payment.payment_method?.replace(/_/g, ' ') || '-'}</td>
                                        <td className="px-3 py-3 text-right font-medium text-green-600">{formatAmount(payment.amount)}</td>
                                    </tr>
                                ))}
                                {payments.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-12 text-center text-gray-500">
                                            <FiDollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                            <p>No payments recorded yet</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* New PO Modal/Bottom Sheet */}
            {showPoForm && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-stretch justify-end z-50">
                    {/* Backdrop */}
                    <div className="absolute inset-0" onClick={() => setShowPoForm(false)} />

                    {/* Sheet/Side Panel */}
                    <div className="relative bg-white rounded-t-2xl md:rounded-none w-full md:w-[500px] md:max-w-xl max-h-[85vh] md:max-h-full overflow-y-auto md:shadow-2xl animate-slide-up md:animate-slide-left">
                        {/* Handle (mobile only) */}
                        <div className="md:hidden w-12 h-1 bg-gray-300 rounded mx-auto my-3" />

                        <div className="p-4 md:p-6 pb-6">
                            <h3 className="text-lg font-bold mb-4">Create Purchase Order</h3>
                            <form onSubmit={handleCreatePO} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-sm font-medium text-gray-700">Supplier</label>
                                            <button
                                                type="button"
                                                onClick={() => setShowSupplierForm(true)}
                                                className="text-xs text-yellow-600 font-medium hover:text-yellow-700 focus:outline-none"
                                            >
                                                + Add New
                                            </button>
                                        </div>
                                        <select
                                            value={poForm.supplier_id}
                                            onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                        >
                                            <option value="">Select Supplier</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-gray-700">Delivery Date</label>
                                        <input
                                            type="date"
                                            value={poForm.delivery_date}
                                            onChange={(e) => setPoForm({ ...poForm, delivery_date: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700">Line Items</label>
                                    {poForm.line_items.map((item, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                                            <div className="col-span-12 md:col-span-4">
                                                <select
                                                    value={item.boq_item_id}
                                                    onChange={(e) => updateLineItem(index, 'boq_item_id', e.target.value)}
                                                    className="w-full px-2 py-2 border border-gray-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                                >
                                                    <option value="">Select from BOQ</option>
                                                    {boqItems.map(b => (
                                                        <option key={b.id} value={b.id}>{b.item_name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-span-3 md:col-span-2">
                                                <input
                                                    type="text"
                                                    placeholder="Unit"
                                                    value={item.unit}
                                                    onChange={(e) => updateLineItem(index, 'unit', e.target.value)}
                                                    className="w-full px-2 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                                />
                                            </div>
                                            <div className="col-span-3 md:col-span-2">
                                                <input
                                                    type="number"
                                                    placeholder="Qty"
                                                    value={item.quantity || ''}
                                                    onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                                />
                                            </div>
                                            <div className="col-span-4 md:col-span-2">
                                                <input
                                                    type="number"
                                                    placeholder="Rate"
                                                    value={item.rate || ''}
                                                    onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                                />
                                            </div>
                                            <div className="col-span-2 flex items-center justify-end gap-1">
                                                <span className="text-xs md:text-sm font-medium truncate">
                                                    ₹{(item.quantity * item.rate).toFixed(0)}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeLineItem(index)}
                                                    className="p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                                                >
                                                    <FiX className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={addLineItem}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        + Add Line Item
                                    </button>
                                </div>

                                <div className="bg-yellow-50 p-3 md:p-4 rounded-lg">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Subtotal</span>
                                        <span className="font-medium">
                                            {formatAmount(poForm.line_items.reduce((sum, i) => sum + (i.quantity * i.rate), 0))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-600">GST</span>
                                            <select
                                                value={poForm.gst_rate}
                                                onChange={(e) => setPoForm({ ...poForm, gst_rate: parseInt(e.target.value) })}
                                                className="px-2 py-1 text-sm border border-gray-200 rounded-lg bg-white"
                                            >
                                                <option value={0}>0%</option>
                                                <option value={5}>5%</option>
                                                <option value={12}>12%</option>
                                                <option value={18}>18%</option>
                                                <option value={28}>28%</option>
                                            </select>
                                        </div>
                                        <span className="font-medium">
                                            {formatAmount(poForm.line_items.reduce((sum, i) => sum + (i.quantity * i.rate), 0) * (poForm.gst_rate / 100))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-yellow-200">
                                        <span className="text-lg font-bold text-yellow-900">Total</span>
                                        <span className="text-lg font-bold text-yellow-900">
                                            {formatAmount(poForm.line_items.reduce((sum, i) => sum + (i.quantity * i.rate), 0) * (1 + poForm.gst_rate / 100))}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowPoForm(false)}
                                        className="flex-1 px-4 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 text-white rounded-lg font-medium shadow-sm"
                                        style={{ backgroundColor: '#eab308' }}
                                    >
                                        Create PO
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* New Invoice Modal */}
            {showInvoiceForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md">
                        <div className="p-6">
                            <h3 className="text-lg font-bold mb-4">Add Invoice</h3>
                            <form onSubmit={handleCreateInvoice} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Invoice Type *</label>
                                    <select
                                        value={invoiceForm.invoice_type}
                                        onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_type: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                        required
                                    >
                                        <option value="advance">Advance</option>
                                        <option value="ra_bill">RA Bill</option>
                                        <option value="final">Final</option>
                                        <option value="credit_note">Credit Note</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Invoice Number</label>
                                    <input
                                        type="text"
                                        value={invoiceForm.invoice_number}
                                        onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Amount *</label>
                                    <input
                                        type="number"
                                        value={invoiceForm.amount}
                                        onChange={(e) => {
                                            const amount = parseFloat(e.target.value) || 0;
                                            const tax = amount * 0.18;
                                            setInvoiceForm({
                                                ...invoiceForm,
                                                amount,
                                                tax_amount: tax,
                                                total_amount: amount + tax
                                            });
                                        }}
                                        className="w-full px-3 py-2 border rounded-lg"
                                        required
                                    />
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <div className="flex justify-between">
                                        <span>Total (incl. GST)</span>
                                        <span className="font-bold">{formatAmount(invoiceForm.total_amount)}</span>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <button type="button" onClick={() => setShowInvoiceForm(false)} className="px-4 py-2 text-gray-600">
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg font-medium">
                                        Add Invoice
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* New Payment Modal */}
            {showPaymentForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md">
                        <div className="p-6">
                            <h3 className="text-lg font-bold mb-4">Record Payment</h3>
                            <form onSubmit={handleCreatePayment} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Amount *</label>
                                    <input
                                        type="number"
                                        value={paymentForm.amount}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Payment Date *</label>
                                    <input
                                        type="date"
                                        value={paymentForm.payment_date}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Payment Method</label>
                                    <select
                                        value={paymentForm.payment_method}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    >
                                        <option value="bank_transfer">Bank Transfer</option>
                                        <option value="cheque">Cheque</option>
                                        <option value="cash">Cash</option>
                                        <option value="upi">UPI</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Reference Number</label>
                                    <input
                                        type="text"
                                        value={paymentForm.reference_number}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                        placeholder="Transaction ID / Cheque No."
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <button type="button" onClick={() => setShowPaymentForm(false)} className="px-4 py-2 text-gray-600">
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg font-medium">
                                        Record Payment
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Supplier Form */}
            {showSupplierForm && (
                <div className="fixed inset-0 z-50">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setShowSupplierForm(false)} />
                    <div className="fixed bottom-0 left-0 right-0 md:top-0 md:left-auto md:right-0 md:w-[400px] bg-white rounded-t-2xl md:rounded-none shadow-2xl animate-slide-up md:animate-slide-left">
                        <div className="w-12 h-1 bg-gray-300 rounded mx-auto my-3 md:hidden" />
                        <div className="p-4 md:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold">Add New Supplier</h3>
                                <button onClick={() => setShowSupplierForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleCreateSupplier} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700">Supplier Name *</label>
                                    <input
                                        type="text"
                                        value={supplierForm.name}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                        placeholder="Enter supplier name"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700">Contact Person</label>
                                    <input
                                        type="text"
                                        value={supplierForm.contact_name}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, contact_name: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                        placeholder="Contact person name"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-gray-700">Phone</label>
                                        <input
                                            type="tel"
                                            value={supplierForm.contact_phone}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, contact_phone: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                            placeholder="Phone number"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-gray-700">Email</label>
                                        <input
                                            type="email"
                                            value={supplierForm.contact_email}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, contact_email: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                            placeholder="Email address"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700">GST Number</label>
                                    <input
                                        type="text"
                                        value={supplierForm.gst_number}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, gst_number: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                        placeholder="GST registration number"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowSupplierForm(false)}
                                        className="flex-1 px-4 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 bg-yellow-500 text-white hover:bg-yellow-600 rounded-lg font-medium"
                                    >
                                        Add Supplier
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {/* PO View Modal */}
            <POViewModal
                isOpen={showPoView}
                onClose={() => setShowPoView(false)}
                po={viewPo}
            />
        </div>
    );
}

export default ProcurementTab;


