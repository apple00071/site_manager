'use client';

import React, { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';

interface BOQItem {
    id?: string;
    item_name: string;
    category: string | null;
    unit: string;
    quantity: number;
    rate: number;
    gst?: number;
    order_status?: string;
    item_type?: string;
    source?: string;
    status: string;
    draft_quantity?: number;
    description?: string | null;
}

interface BoqEditModalProps {
    item: any | null; // null for new item
    categories: string[];
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: any) => Promise<void>;
}

const UNITS = ['Sqft', 'Rft', 'Nos', 'Kg', 'Cum', 'Sqm', 'Lump Sum', 'Set', 'Pair', 'Metric Ton'];
const ORDER_STATUSES = ['pending', 'ordered', 'received', 'cancelled'];
const ITEM_TYPES = ['material', 'labour', 'equipment', 'subcontract'];
const SOURCES = ['bought_out', 'raw_material', 'site_work'];
const STATUSES = ['draft', 'confirmed', 'completed'];

export function BoqEditModal({ item, categories, isOpen, onClose, onSave }: BoqEditModalProps) {
    const [form, setForm] = useState<Partial<BOQItem>>({
        item_name: '',
        category: categories[0] || 'Uncategorized',
        unit: 'Nos',
        quantity: 0,
        rate: 0,
        gst: 18,
        order_status: 'pending',
        item_type: 'material',
        source: 'bought_out',
        status: 'draft',
        draft_quantity: 0,
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (item) {
            setForm({
                item_name: item.item_name || '',
                category: item.category || 'Uncategorized',
                unit: item.unit || 'Nos',
                quantity: item.quantity || 0,
                rate: item.rate || 0,
                gst: item.gst ?? 18,
                order_status: item.order_status || 'pending',
                item_type: item.item_type || 'material',
                source: item.source || 'bought_out',
                status: item.status || 'draft',
                draft_quantity: item.draft_quantity || 0,
            });
        } else {
            setForm({
                item_name: '',
                category: categories[0] || 'Uncategorized',
                unit: 'Nos',
                quantity: 0,
                rate: 0,
                gst: 18,
                order_status: 'pending',
                item_type: 'material',
                source: 'bought_out',
                status: 'draft',
                draft_quantity: 0,
            });
        }
    }, [item, categories, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.item_name?.trim()) return;

        setSaving(true);
        try {
            await onSave(form);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const baseAmount = (form.quantity || 0) * (form.rate || 0);
    const gstAmount = baseAmount * ((form.gst || 0) / 100);
    const totalAmount = baseAmount + gstAmount;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
            <div
                className="bg-white shadow-2xl w-full max-w-md h-full overflow-y-auto animate-slide-in-right"
                style={{ animation: 'slideInRight 0.2s ease-out' }}
            >
                {/* Header */}
                <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white z-10">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {item ? 'Edit BOQ Item' : 'Add BOQ Item'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Item Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Element Name & Description *
                        </label>
                        <input
                            type="text"
                            value={form.item_name || ''}
                            onChange={e => setForm({ ...form, item_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="Enter item name"
                            required
                        />
                    </div>

                    {/* Category & Unit Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <select
                                value={form.category || ''}
                                onChange={e => setForm({ ...form, category: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Unit (UOM)</label>
                            <select
                                value={form.unit || 'Nos'}
                                onChange={e => setForm({ ...form, unit: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                                {UNITS.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Quantity & Rate Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                            <input
                                type="number"
                                value={form.quantity || 0}
                                onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rate (₹)</label>
                            <input
                                type="number"
                                value={form.rate || 0}
                                onChange={e => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                    {/* GST Row */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">GST (%)</label>
                        <select
                            value={form.gst || 18}
                            onChange={e => setForm({ ...form, gst: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value={0}>0% (Exempt)</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                        </select>
                    </div>

                    {/* Amount Display with GST */}
                    <div className="bg-amber-50 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Base Amount</span>
                            <span className="text-gray-700">₹{baseAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">GST ({form.gst || 0}%)</span>
                            <span className="text-gray-700">₹{gstAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="border-t border-amber-200 pt-2 flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700">Total Amount</span>
                            <span className="text-lg font-bold text-amber-600">₹{totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                    </div>

                    {/* Item Type & Source Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
                            <select
                                value={form.item_type || 'material'}
                                onChange={e => setForm({ ...form, item_type: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                                {ITEM_TYPES.map(t => (
                                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                            <select
                                value={form.source || 'bought_out'}
                                onChange={e => setForm({ ...form, source: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                                {SOURCES.map(s => (
                                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Status & Order Status Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={form.status || 'draft'}
                                onChange={e => setForm({ ...form, status: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                                {STATUSES.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Order Status</label>
                            <select
                                value={form.order_status || 'pending'}
                                onChange={e => setForm({ ...form, order_status: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                                {ORDER_STATUSES.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Draft Quantity */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Draft Quantity</label>
                        <input
                            type="number"
                            value={form.draft_quantity || 0}
                            onChange={e => setForm({ ...form, draft_quantity: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            min="0"
                            step="0.01"
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="sticky bottom-0 flex justify-end gap-3 px-4 py-3 border-t border-gray-100 bg-white">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={saving || !form.item_name?.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : (item ? 'Update' : 'Add Item')}
                    </button>
                </div>
            </div>
        </div>
    );
}
