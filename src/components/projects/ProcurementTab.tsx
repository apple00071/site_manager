'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiDownload, FiMail,
    FiFileText, FiAlertCircle, FiMoreVertical, FiDollarSign,
    FiTruck, FiClock, FiCheckCircle, FiPackage, FiSearch, FiChevronDown, FiEye, FiPrinter
} from 'react-icons/fi';
import { FaRupeeSign } from 'react-icons/fa';
import { POViewModal } from './POViewModal';
import { ProposalViewModal } from './ProposalViewModal';

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
    supplier_id?: string | null;
    po_id?: string | null;
}

interface Payment {
    id: string;
    amount: number;
    payment_date: string;
    payment_method: string | null;
    supplier_id?: string | null;
    invoice_id?: string | null;
}

// Maps the parent's subTab ID to our internal logic
// 'proposals' | 'client_orders' | 'client_invoices' | 'payments_from_client' | 'my_scope'

interface ProcurementTabProps {
    projectId: string;
    projectAddress?: string;
    activeSubTab?: string; // Passed from parent ProjectDetailsPage
}

type TabType = 'proposals' | 'orders' | 'invoices' | 'payments';

export function ProcurementTab({ projectId, projectAddress, activeSubTab = 'my_scope' }: ProcurementTabProps) {
    const { isAdmin } = useAuth();

    // Derived State from activeSubTab
    // 'my_scope' is exclusively for Vendor related items (Purchase Orders, Vendor Invoices, Vendor Payments)
    const isVendorMode = activeSubTab === 'my_scope';
    const viewMode = isVendorMode ? 'vendor' : 'client';

    // Internal Active Tab logic
    // We map the parent's specific tab (e.g. 'client_orders') to our internal generic tab name ('orders')
    const [internalTab, setInternalTab] = useState<TabType>('orders');

    useEffect(() => {
        if (activeSubTab === 'proposals') setInternalTab('proposals');
        else if (activeSubTab === 'client_orders') setInternalTab('orders');
        else if (activeSubTab === 'client_invoices') setInternalTab('invoices');
        else if (activeSubTab === 'payments_from_client') setInternalTab('payments');
        else if (activeSubTab === 'my_scope') setInternalTab('orders'); // Default for My Scope
    }, [activeSubTab]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [pos, setPos] = useState<PurchaseOrder[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [proposals, setProposals] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [boqItems, setBoqItems] = useState<any[]>([]);

    const [showPoForm, setShowPoForm] = useState(false);
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [showSupplierForm, setShowSupplierForm] = useState(false);

    const [supplierForm, setSupplierForm] = useState({
        name: '', contact_name: '', contact_phone: '', contact_email: '', gst_number: '',
    });

    const [poFilters, setPoFilters] = useState({ number: '', supplier: '', date: '', status: '' });
    const [invoiceFilters, setInvoiceFilters] = useState({ number: '', type: '', date: '', status: '' });
    const [paymentFilters, setPaymentFilters] = useState({ date: '', method: '', amount: '' });

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

    const [viewPo, setViewPo] = useState<any>(null);
    const [showPoView, setShowPoView] = useState(false);
    const [viewProposal, setViewProposal] = useState<any>(null);
    const [showProposalView, setShowProposalView] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch each dataset independently to handle partial permissions
            const fetchDataset = async (url: string, setter: (data: any) => void) => {
                try {
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        setter(data);
                    } else if (res.status === 403) {
                        console.warn(`Access denied for ${url}`);
                    }
                } catch (err) {
                    console.error(`Error fetching ${url}:`, err);
                }
            };

            await Promise.all([
                fetchDataset(`/api/purchase-orders?project_id=${projectId}`, (data) => setPos(data.pos || [])),
                fetchDataset(`/api/invoices?project_id=${projectId}`, (data) => setInvoices(data.invoices || [])),
                fetchDataset(`/api/payments?project_id=${projectId}`, (data) => setPayments(data.payments || [])),
                fetchDataset('/api/suppliers?active=true', (data) => setSuppliers(data.suppliers || [])),
                fetchDataset(`/api/boq?project_id=${projectId}`, (data) => setBoqItems(data.items || [])),
                fetchDataset(`/api/proposals?project_id=${projectId}`, (data) => setProposals(data.proposals || [])),
            ]);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const vendorPos = useMemo(() => pos, [pos]);
    const vendorInvoices = useMemo(() => invoices.filter(i => i.supplier_id), [invoices]);
    const vendorPayments = useMemo(() => payments.filter(p => p.supplier_id), [payments]);

    const clientProposals = useMemo(() => proposals, [proposals]);
    const clientOrders = useMemo(() => proposals.filter(p => p.status === 'approved'), [proposals]);
    const clientInvoices = useMemo(() => invoices.filter(i => !i.supplier_id), [invoices]);
    const clientPayments = useMemo(() => payments.filter(p => !p.supplier_id), [payments]);

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

    const getFilteredInvoices = (list: Invoice[]) => {
        return list.filter(inv => {
            const matchNumber = !invoiceFilters.number || (inv.invoice_number || '').toLowerCase().includes(invoiceFilters.number.toLowerCase());
            const matchType = !invoiceFilters.type || inv.invoice_type === invoiceFilters.type;
            const invDate = new Date(inv.created_at).toLocaleDateString();
            const matchDate = !invoiceFilters.date || invDate.includes(invoiceFilters.date);
            const matchStatus = !invoiceFilters.status || inv.status === invoiceFilters.status;
            return matchNumber && matchType && matchDate && matchStatus;
        });
    };

    const getFilteredPayments = (list: Payment[]) => {
        return list.filter(pay => {
            const payDate = new Date(pay.payment_date).toLocaleDateString();
            const matchDate = !paymentFilters.date || payDate.includes(paymentFilters.date);
            const matchMethod = !paymentFilters.method || (pay.payment_method || '').includes(paymentFilters.method);
            const matchAmount = !paymentFilters.amount || pay.amount.toString().includes(paymentFilters.amount);
            return matchDate && matchMethod && matchAmount;
        });
    };

    const confirmedItems = useMemo(() => boqItems.filter((item: any) =>
        item.status === 'confirmed' && (item.ordered_quantity || 0) < item.quantity
    ), [boqItems]);

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

            const suppliersRes = await fetch(`/api/suppliers?active=true`);
            const suppliersData = await suppliersRes.json();
            setSuppliers(suppliersData.suppliers || []);
            setPoForm({ ...poForm, supplier_id: data.supplier.id });
            setSupplierForm({ name: '', contact_name: '', contact_phone: '', contact_email: '', gst_number: '' });
            setShowSupplierForm(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to create supplier');
        }
    };

    const handleUpdatePoStatus = async (status: string) => {
        if (!viewPo) return;
        try {
            const response = await fetch('/api/purchase-orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: viewPo.id, status }),
            });

            if (!response.ok) throw new Error('Failed to update status');

            const { po } = await response.json();
            setPos((prev: any[]) => prev.map(p => p.id === po.id ? { ...p, status: po.status } : p));
            setViewPo((prev: any) => prev ? { ...prev, status: po.status } : null);
        } catch (error) {
            console.error('Error updating PO status:', error);
            alert('Failed to update status');
        }
    };

    const handleCreatePO = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                project_id: projectId,
                ...poForm,
                delivery_date: poForm.delivery_date || null,
            };

            const res = await fetch('/api/purchase-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            if (data.budget_warning) {
                if (data.budget_warning.warning === 'validation_warnings') {
                    alert(`PO Created with Warnings:\n\n${data.budget_warning.messages.join('\n')}`);
                } else if (data.budget_warning.warning === 'order_exceeds_budget') {
                    alert(`PO Created but Project Budget Exceeded!\n\nOver by: ₹${data.budget_warning.over_amount.toLocaleString()}`);
                }
            }
            fetchData();
            setShowPoForm(false);
            setPoForm({
                supplier_id: '',
                delivery_date: '',
                delivery_address: projectAddress || '',
                notes: '',
                gst_rate: 18,
                line_items: [{ boq_item_id: '', description: '', unit: '', quantity: 0, rate: 0 }],
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create PO');
        }
    };

    const handleCreateInvoice = async (e: React.FormEvent, isClient = false) => {
        e.preventDefault();
        try {
            const payload = {
                project_id: projectId,
                ...invoiceForm,
                invoice_date: invoiceForm.invoice_date || null,
            };

            if (isClient) {
                payload.supplier_id = null as any;
                payload.po_id = null as any;
            }

            const res = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchData();
            setShowInvoiceForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create invoice');
        }
    };

    const handleCreatePayment = async (e: React.FormEvent, isClient = false) => {
        e.preventDefault();
        try {
            const payload = {
                project_id: projectId,
                ...paymentForm,
                payment_date: paymentForm.payment_date || new Date().toISOString().split('T')[0], // Default to today if empty? Or null? Payment date is usually required. Form maps to required input.
            };

            if (isClient) {
                payload.supplier_id = null as any;
            }

            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchData();
            setShowPaymentForm(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to record payment');
        }
    };

    const handleApproveInvoice = async (id: string, approved: boolean) => {
        try {
            const status = approved ? 'approved' : 'rejected';
            const res = await fetch('/api/invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status }),
            });
            if (!res.ok) throw new Error('Failed to update invoice');
            fetchData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update invoice');
        }
    };

    const addLineItem = () => {
        setPoForm(prev => ({
            ...prev,
            line_items: [...prev.line_items, { boq_item_id: '', description: '', unit: '', quantity: 0, rate: 0 }]
        }));
    };

    const updateLineItem = (index: number, field: string, value: any) => {
        const newItems = [...poForm.line_items];
        newItems[index] = { ...newItems[index], [field]: value };
        setPoForm(prev => ({ ...prev, line_items: newItems }));
    };

    const removeLineItem = (index: number) => {
        const newItems = poForm.line_items.filter((_, i) => i !== index);
        setPoForm(prev => ({ ...prev, line_items: newItems }));
    };

    const handleCreateClientInvoice = (e: React.FormEvent) => handleCreateInvoice(e, true);
    const handleCreateClientPayment = (e: React.FormEvent) => handleCreatePayment(e, true);

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

    const currentInvoices = viewMode === 'client' ? clientInvoices : vendorInvoices;
    const currentPayments = viewMode === 'client' ? clientPayments : vendorPayments;
    const currentOrders = viewMode === 'client' ? clientOrders : vendorPos;

    // Calculate Stats for current view
    const stats = useMemo(() => {
        if (viewMode === 'client') {
            return {
                ordersCount: clientOrders.length,
                ordersValue: clientOrders.reduce((acc, o) => acc + (o.total_amount || 0), 0),
                pendingInvoices: clientInvoices.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.total_amount, 0),
                paidAmount: clientPayments.reduce((acc, p) => acc + p.amount, 0)
            };
        } else {
            return {
                ordersCount: vendorPos.length,
                ordersValue: vendorPos.reduce((acc, p) => acc + p.total_amount, 0),
                pendingInvoices: vendorInvoices.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.total_amount, 0),
                paidAmount: vendorPayments.reduce((acc, p) => acc + p.amount, 0)
            };
        }
    }, [viewMode, clientOrders, clientInvoices, clientPayments, vendorPos, vendorInvoices, vendorPayments]);

    return (
        <div className="p-4 md:p-6">
            {/* Stats Cards - Show for all views to give context */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <FiPackage className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs md:text-sm text-gray-500">{viewMode === 'client' ? 'Approved Orders' : 'Purchase Orders'}</p>
                            <p className="text-lg md:text-xl font-bold">{stats.ordersCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-2 bg-yellow-50 rounded-lg">
                            <FaRupeeSign className="w-4 h-4 md:w-5 md:h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-xs md:text-sm text-gray-500">Total Value</p>
                            <p className="text-lg md:text-xl font-bold">{formatAmount(stats.ordersValue)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-2 bg-red-50 rounded-lg">
                            <FiClock className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-xs md:text-sm text-gray-500">Pending</p>
                            <p className="text-lg md:text-xl font-bold">{formatAmount(stats.pendingInvoices)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <FiCheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs md:text-sm text-gray-500">{viewMode === 'client' ? 'Received' : 'Paid'}</p>
                            <p className="text-lg md:text-xl font-bold">{formatAmount(stats.paidAmount)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Internal Navigation: Only show for 'My Scope' (Vendor) as it has sub-modules */}
            {isVendorMode && (
                <div className="flex gap-1 md:gap-2 mb-4 border-b border-gray-200 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setInternalTab('orders')}
                        className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium border-b-2 -mb-px hover:text-gray-900 transition-colors whitespace-nowrap focus:outline-none ${internalTab === 'orders' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-600'}`}
                    >
                        Purchase Orders
                        <span className="ml-1 bg-gray-100 px-1.5 py-0.5 rounded-full text-xs">{currentOrders.length}</span>
                    </button>

                    <button
                        onClick={() => setInternalTab('invoices')}
                        className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium border-b-2 -mb-px hover:text-gray-900 transition-colors whitespace-nowrap focus:outline-none ${internalTab === 'invoices' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-600'}`}
                    >
                        Invoices <span className="ml-1 bg-gray-100 px-1.5 py-0.5 rounded-full text-xs">{currentInvoices.length}</span>
                    </button>

                    <button
                        onClick={() => setInternalTab('payments')}
                        className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium border-b-2 -mb-px hover:text-gray-900 transition-colors whitespace-nowrap focus:outline-none ${internalTab === 'payments' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-600'}`}
                    >
                        Payments <span className="ml-1 bg-gray-100 px-1.5 py-0.5 rounded-full text-xs">{currentPayments.length}</span>
                    </button>

                    <div className="ml-auto flex gap-2 flex-shrink-0">
                        {internalTab === 'orders' && isAdmin && (
                            <button onClick={() => setShowPoForm(true)} className="flex items-center gap-2 px-3 py-1.5 text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg text-sm transition-colors">
                                <FiPlus className="w-4 h-4" /> New PO
                            </button>
                        )}
                        {internalTab === 'invoices' && isAdmin && (
                            <button onClick={() => setShowInvoiceForm(true)} className="flex items-center gap-2 px-3 py-1.5 text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg text-sm transition-colors">
                                <FiPlus className="w-4 h-4" /> New Invoice
                            </button>
                        )}
                        {internalTab === 'payments' && isAdmin && (
                            <button onClick={() => setShowPaymentForm(true)} className="flex items-center gap-2 px-3 py-1.5 text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg text-sm transition-colors">
                                <FiPlus className="w-4 h-4" /> Record Payment
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Action Buttons for Single View Modes (Client) */}
            {!isVendorMode && (
                <div className="flex justify-end mb-4">
                    {internalTab === 'invoices' && isAdmin && (
                        <button onClick={() => setShowInvoiceForm(true)} className="flex items-center gap-2 px-3 py-1.5 text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg text-sm transition-colors">
                            <FiPlus className="w-4 h-4" /> New Invoice
                        </button>
                    )}
                    {internalTab === 'payments' && isAdmin && (
                        <button onClick={() => setShowPaymentForm(true)} className="flex items-center gap-2 px-3 py-1.5 text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg text-sm transition-colors">
                            <FiPlus className="w-4 h-4" /> Record Payment
                        </button>
                    )}
                </div>
            )}

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                    <FiAlertCircle className="w-4 h-4" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto">
                        <FiX className="w-4 h-4" />
                    </button>
                </div>
            )}

            {internalTab === 'proposals' && viewMode === 'client' && (
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                    {clientProposals.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <FiFileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>No proposals generated yet</p>
                            <p className="text-xs mt-2">Create proposals in the BOQ / Estimate tab</p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {clientProposals.map(p => (
                                    <tr key={p.id}>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.title}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(p.created_at)}</td>
                                        <td className="px-6 py-4 text-sm text-right font-medium">{formatAmount(p.total_amount)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 text-xs rounded-full ${p.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => { setViewProposal(p); setShowProposalView(true); }} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 justify-end ml-auto">
                                                <FiEye className="w-4 h-4" /> View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {internalTab === 'orders' && (
                <div className="space-y-4">
                    {viewMode === 'vendor' ? (
                        <>
                            {confirmedItems.length > 0 && (
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Ready for Purchase Order</h3>
                                        <p className="text-sm text-gray-600">{confirmedItems.length} approved BOQ items</p>
                                    </div>
                                    <button
                                        onClick={() => setShowPoForm(true)}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700"
                                    >
                                        Create PO
                                    </button>
                                </div>
                            )}

                            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hidden md:block">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {filteredPos.map(po => (
                                            <tr key={po.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm font-medium">{po.po_number}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{po.supplier?.name}</td>
                                                <td className="px-4 py-3 text-sm text-gray-500">{formatDate(po.po_date)}</td>
                                                <td className="px-4 py-3 text-sm text-right font-medium">{formatAmount(po.total_amount)}</td>
                                                <td className="px-4 py-3 text-center">{getPoStatusBadge(po.status)}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={() => { setViewPo(po); setShowPoView(true); }} className="text-blue-600 hover:text-blue-800">
                                                        <FiEye className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="md:hidden space-y-3">
                                {filteredPos.map(po => (
                                    <div key={po.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-bold text-gray-900">{po.po_number}</span>
                                            {getPoStatusBadge(po.status)}
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{po.supplier?.name}</p>
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                            <span className="font-bold">{formatAmount(po.total_amount)}</span>
                                            <button onClick={() => { setViewPo(po); setShowPoView(true); }} className="text-blue-600 text-sm">
                                                View
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm p-4">
                            {/* Client Orders (Approved Proposals) List */}
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Ref</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {clientOrders.map(o => (
                                        <tr key={o.id}>
                                            <td className="px-6 py-4 text-sm font-medium">{o.title}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{formatDate(o.created_at)}</td>
                                            <td className="px-6 py-4 text-sm text-right font-medium">{formatAmount(o.total_amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {clientOrders.length === 0 && (
                                <div className="p-8 text-center text-gray-500">No client orders (approved proposals) found.</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {internalTab === 'invoices' && (
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 hidden md:table">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                {viewMode === 'vendor' && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>}
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {getFilteredInvoices(currentInvoices).map(inv => (
                                <tr key={inv.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium">{inv.invoice_number || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(inv.created_at)}</td>
                                    {viewMode === 'vendor' && <td className="px-4 py-3 text-sm text-gray-500">{(inv as any).supplier?.name || '-'}</td>}
                                    <td className="px-4 py-3 text-sm text-right font-bold">{formatAmount(inv.total_amount)}</td>
                                    <td className="px-4 py-3 text-center">{getInvoiceStatusBadge(inv.status)}</td>
                                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                                        {isAdmin && inv.status === 'pending' && (
                                            <>
                                                <button onClick={() => handleApproveInvoice(inv.id, true)} className="text-green-600 hover:text-green-800" title="Approve"><FiCheckCircle className="w-4 h-4" /></button>
                                                <button onClick={() => handleApproveInvoice(inv.id, false)} className="text-red-600 hover:text-red-800" title="Reject"><FiX className="w-4 h-4" /></button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="md:hidden">
                        {getFilteredInvoices(currentInvoices).map(inv => (
                            <div key={inv.id} className="p-4 border-b border-gray-100">
                                <div className="flex justify-between mb-1">
                                    <span className="font-medium">{inv.invoice_number || 'No #'}</span>
                                    {getInvoiceStatusBadge(inv.status)}
                                </div>
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>{formatDate(inv.created_at)}</span>
                                    <span className="font-bold text-gray-900">{formatAmount(inv.total_amount)}</span>
                                </div>
                                {isAdmin && inv.status === 'pending' && (
                                    <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                                        <button onClick={() => handleApproveInvoice(inv.id, true)} className="flex-1 py-1.5 bg-green-50 text-green-700 rounded text-xs font-medium">Approve</button>
                                        <button onClick={() => handleApproveInvoice(inv.id, false)} className="flex-1 py-1.5 bg-red-50 text-red-700 rounded text-xs font-medium">Reject</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {currentInvoices.length === 0 && <div className="p-8 text-center text-gray-500">No invoices found</div>}
                </div>
            )}

            {internalTab === 'payments' && (
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 hidden md:table">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {getFilteredPayments(currentPayments).map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium">{formatDate(p.payment_date)}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500 capitalize">{p.payment_method?.replace(/_/g, ' ') || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatAmount(p.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="md:hidden">
                        {getFilteredPayments(currentPayments).map(p => (
                            <div key={p.id} className="p-4 border-b border-gray-100 flex justify-between items-center">
                                <div>
                                    <div className="font-medium text-gray-900">{formatDate(p.payment_date)}</div>
                                    <div className="text-xs text-gray-500 capitalize">{p.payment_method?.replace(/_/g, ' ')}</div>
                                </div>
                                <div className="font-bold text-gray-900">{formatAmount(p.amount)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showPoForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                        <h3 className="text-lg font-bold mb-4">Create Purchase Order</h3>
                        <form onSubmit={handleCreatePO} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Supplier</label>
                                    <select value={poForm.supplier_id} onChange={e => setPoForm({ ...poForm, supplier_id: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" required>
                                        <option value="">Select</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Delivery Date</label>
                                    <input type="date" value={poForm.delivery_date} onChange={e => setPoForm({ ...poForm, delivery_date: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Items</label>
                                <div className="space-y-2">
                                    {poForm.line_items.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <select
                                                value={item.boq_item_id}
                                                onChange={e => updateLineItem(idx, 'boq_item_id', e.target.value)}
                                                className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm"
                                            >
                                                <option value="">Select BOQ Item</option>
                                                {boqItems.map(b => (
                                                    <option key={b.id} value={b.id}>{b.item_name} (Qty: {b.quantity})</option>
                                                ))}
                                            </select>
                                            <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateLineItem(idx, 'quantity', parseFloat(e.target.value))} className="w-20 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm" />
                                            <input type="number" placeholder="Rate" value={item.rate} onChange={e => updateLineItem(idx, 'rate', parseFloat(e.target.value))} className="w-24 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm" />
                                            <button
                                                type="button"
                                                onClick={() => removeLineItem(idx)}
                                                className="flex items-center justify-center w-10 h-10 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <FiTrash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={addLineItem} className="mt-2 text-sm text-blue-600 font-medium hover:text-blue-700">+ Add Item</button>
                            </div>

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setShowPoForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm">Create PO</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showInvoiceForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold mb-4">{viewMode === 'client' ? 'Create Client Invoice' : 'Add Vendor Invoice'}</h3>
                        <form onSubmit={viewMode === 'client' ? handleCreateClientInvoice : handleCreateInvoice} className="space-y-4">
                            {!viewMode && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Supplier</label>
                                    <select value={invoiceForm.supplier_id} onChange={e => setInvoiceForm({ ...invoiceForm, supplier_id: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" required>
                                        <option value="">Select Supplier</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium mb-1">Invoice Number</label>
                                <input type="text" value={invoiceForm.invoice_number} onChange={e => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Amount</label>
                                <input type="number" value={invoiceForm.amount} onChange={e => setInvoiceForm({ ...invoiceForm, amount: parseFloat(e.target.value), total_amount: parseFloat(e.target.value) })} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" required />
                            </div>
                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setShowInvoiceForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm">Submit</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showPaymentForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold mb-4">{viewMode === 'client' ? 'Record Client Payment' : 'Record Vendor Payment'}</h3>
                        <form onSubmit={viewMode === 'client' ? handleCreateClientPayment : handleCreatePayment} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Amount</label>
                                <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) })} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Date</label>
                                <input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Method</label>
                                <select value={paymentForm.payment_method} onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all">
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="cheque">Cheque</option>
                                    <option value="cash">Cash</option>
                                    <option value="upi">UPI</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setShowPaymentForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm">Record</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showSupplierForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold mb-4">Add Supplier</h3>
                        <form onSubmit={handleCreateSupplier} className="space-y-4">
                            <input type="text" placeholder="Name" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" required />
                            <input type="text" placeholder="Contact Person" value={supplierForm.contact_name} onChange={e => setSupplierForm({ ...supplierForm, contact_name: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" />
                            <input type="text" placeholder="Phone" value={supplierForm.contact_phone} onChange={e => setSupplierForm({ ...supplierForm, contact_phone: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" />
                            <input type="email" placeholder="Email" value={supplierForm.contact_email} onChange={e => setSupplierForm({ ...supplierForm, contact_email: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" />
                            <input type="text" placeholder="GST Number" value={supplierForm.gst_number} onChange={e => setSupplierForm({ ...supplierForm, gst_number: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" />

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setShowSupplierForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showPoView && viewPo && (
                <POViewModal
                    po={viewPo}
                    onClose={() => setShowPoView(false)}
                    onUpdateStatus={handleUpdatePoStatus}
                    projectAddress={projectAddress}
                />
            )}

            {showProposalView && viewProposal && (
                <ProposalViewModal
                    proposal={viewProposal}
                    onClose={() => setShowProposalView(false)}
                    projectAddress={projectAddress}
                />
            )}
        </div>
    );
}
