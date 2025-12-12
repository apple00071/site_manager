'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiDownload, FiMail,
    FiFileText, FiAlertCircle, FiMoreVertical, FiDollarSign,
    FiTruck, FiClock, FiCheckCircle, FiPackage
} from 'react-icons/fi';

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

    const [poStats, setPoStats] = useState<any>({});
    const [invoiceStats, setInvoiceStats] = useState<any>({});
    const [paymentStats, setPaymentStats] = useState<any>({});

    // Form states
    const [poForm, setPoForm] = useState({
        supplier_id: '',
        delivery_date: '',
        delivery_address: '',
        notes: '',
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

    useEffect(() => {
        fetchData();
    }, [projectId]);

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <FiPackage className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Purchase Orders</p>
                            <p className="text-xl font-bold">{poStats.total || 0}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <FiDollarSign className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">PO Value</p>
                            <p className="text-xl font-bold">{formatAmount(poStats.totalValue || 0)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <FiClock className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Pending Invoices</p>
                            <p className="text-xl font-bold">{formatAmount(invoiceStats.pendingValue || 0)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <FiCheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Paid</p>
                            <p className="text-xl font-bold">{formatAmount(paymentStats.totalAmount || 0)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b">
                {[
                    { key: 'orders', label: 'Purchase Orders', count: pos.length },
                    { key: 'invoices', label: 'Invoices', count: invoices.length },
                    { key: 'payments', label: 'Payments', count: payments.length },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as TabType)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.key
                                ? 'border-yellow-500 text-yellow-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        {tab.label}
                        <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                            {tab.count}
                        </span>
                    </button>
                ))}
                <div className="ml-auto flex gap-2">
                    {isAdmin && activeTab === 'orders' && (
                        <button
                            onClick={() => setShowPoForm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg font-medium hover:bg-yellow-600"
                        >
                            <FiPlus className="w-4 h-4" />
                            New PO
                        </button>
                    )}
                    {isAdmin && activeTab === 'invoices' && (
                        <button
                            onClick={() => setShowInvoiceForm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg font-medium hover:bg-yellow-600"
                        >
                            <FiPlus className="w-4 h-4" />
                            New Invoice
                        </button>
                    )}
                    {isAdmin && activeTab === 'payments' && (
                        <button
                            onClick={() => setShowPaymentForm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg font-medium hover:bg-yellow-600"
                        >
                            <FiPlus className="w-4 h-4" />
                            Record Payment
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
                <div className="bg-white border rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">PO Number</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Supplier</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Amount</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pos.map((po) => (
                                <tr key={po.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{po.po_number}</td>
                                    <td className="px-4 py-3 text-gray-600">{po.supplier?.name || '-'}</td>
                                    <td className="px-4 py-3 text-gray-600">{formatDate(po.po_date)}</td>
                                    <td className="px-4 py-3 text-right font-medium">{formatAmount(po.total_amount)}</td>
                                    <td className="px-4 py-3 text-center">{getPoStatusBadge(po.status)}</td>
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
            )}

            {/* Invoices Tab */}
            {activeTab === 'invoices' && (
                <div className="bg-white border rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Invoice #</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Amount</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Status</th>
                                {isAdmin && (
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {invoices.map((invoice) => (
                                <tr key={invoice.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{invoice.invoice_number || '-'}</td>
                                    <td className="px-4 py-3 text-gray-600 capitalize">{invoice.invoice_type.replace(/_/g, ' ')}</td>
                                    <td className="px-4 py-3 text-gray-600">{formatDate(invoice.created_at)}</td>
                                    <td className="px-4 py-3 text-right font-medium">{formatAmount(invoice.total_amount)}</td>
                                    <td className="px-4 py-3 text-center">{getInvoiceStatusBadge(invoice.status)}</td>
                                    {isAdmin && (
                                        <td className="px-4 py-3 text-right">
                                            {invoice.status === 'pending' && (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleApproveInvoice(invoice.id, true)}
                                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                        title="Approve"
                                                    >
                                                        <FiCheck className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleApproveInvoice(invoice.id, false)}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
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
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
                <div className="bg-white border rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Method</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {payments.map((payment) => (
                                <tr key={payment.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{formatDate(payment.payment_date)}</td>
                                    <td className="px-4 py-3 text-gray-600 capitalize">{payment.payment_method?.replace(/_/g, ' ') || '-'}</td>
                                    <td className="px-4 py-3 text-right font-medium text-green-600">{formatAmount(payment.amount)}</td>
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
            )}

            {/* New PO Modal */}
            {showPoForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h3 className="text-lg font-bold mb-4">Create Purchase Order</h3>
                            <form onSubmit={handleCreatePO} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Supplier</label>
                                        <select
                                            value={poForm.supplier_id}
                                            onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg"
                                        >
                                            <option value="">Select Supplier</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Delivery Date</label>
                                        <input
                                            type="date"
                                            value={poForm.delivery_date}
                                            onChange={(e) => setPoForm({ ...poForm, delivery_date: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Line Items</label>
                                    {poForm.line_items.map((item, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                                            <div className="col-span-4">
                                                <select
                                                    value={item.boq_item_id}
                                                    onChange={(e) => updateLineItem(index, 'boq_item_id', e.target.value)}
                                                    className="w-full px-2 py-1 border rounded text-sm"
                                                >
                                                    <option value="">Select from BOQ</option>
                                                    {boqItems.map(b => (
                                                        <option key={b.id} value={b.id}>{b.item_name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="text"
                                                    placeholder="Unit"
                                                    value={item.unit}
                                                    onChange={(e) => updateLineItem(index, 'unit', e.target.value)}
                                                    className="w-full px-2 py-1 border rounded text-sm"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    placeholder="Qty"
                                                    value={item.quantity || ''}
                                                    onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1 border rounded text-sm"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    placeholder="Rate"
                                                    value={item.rate || ''}
                                                    onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1 border rounded text-sm"
                                                />
                                            </div>
                                            <div className="col-span-2 flex items-center justify-between">
                                                <span className="text-sm font-medium">
                                                    {formatAmount(item.quantity * item.rate)}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeLineItem(index)}
                                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
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

                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Subtotal</span>
                                        <span className="font-medium">
                                            {formatAmount(poForm.line_items.reduce((sum, i) => sum + (i.quantity * i.rate), 0))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-sm text-gray-600">GST (18%)</span>
                                        <span className="font-medium">
                                            {formatAmount(poForm.line_items.reduce((sum, i) => sum + (i.quantity * i.rate), 0) * 0.18)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                                        <span className="font-medium">Total</span>
                                        <span className="text-lg font-bold">
                                            {formatAmount(poForm.line_items.reduce((sum, i) => sum + (i.quantity * i.rate), 0) * 1.18)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowPoForm(false)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg font-medium hover:bg-yellow-600"
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
        </div>
    );
}

export default ProcurementTab;
