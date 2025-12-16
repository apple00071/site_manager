'use client';

import React, { useState } from 'react';
import { FiEdit2, FiTrash2, FiX, FiCheck, FiChevronRight, FiMoreVertical } from 'react-icons/fi';

interface BOQItem {
    id: string;
    project_id: string;
    category: string | null;
    item_name: string;
    description: string | null;
    unit: string;
    quantity: number;
    rate: number;
    amount: number;
    status: string;
    order_status?: string;
    item_type?: string;
    source?: string;
    draft_quantity?: number;
    linked_pos?: { id: string; po_number: string }[];
    sort_order?: number;
    remarks?: string | null;
}

interface BoqCardMobileProps {
    items: BOQItem[];
    isAdmin: boolean;
    selectedItems: string[];
    onSelect: (ids: string[]) => void;
    onUpdate: (id: string, field: string, value: any) => Promise<void>;
    onDelete: (id: string) => void;
}

const UNITS = ['Sqft', 'Rft', 'Nos', 'Kg', 'Cum', 'Sqm', 'Lump Sum', 'Set', 'Pair', 'Metric Ton'];
const STATUSES = ['draft', 'confirmed', 'completed'];
const ORDER_STATUSES = ['pending', 'ordered', 'received', 'cancelled'];
const ITEM_TYPES = ['material', 'labour', 'equipment', 'subcontract'];
const SOURCES = ['bought_out', 'raw_material', 'site_work'];

export function BoqCardMobile({
    items,
    isAdmin,
    selectedItems,
    onSelect,
    onUpdate,
    onDelete
}: BoqCardMobileProps) {
    const [editingItem, setEditingItem] = useState<BOQItem | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        item_name: '',
        description: '',
        quantity: 0,
        rate: 0,
        unit: 'Nos',
        status: 'draft',
        order_status: 'pending',
        item_type: 'material',
        source: 'bought_out',
    });

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            draft: 'bg-slate-100 text-slate-600',
            confirmed: 'bg-emerald-50 text-emerald-700',
            completed: 'bg-blue-50 text-blue-700',
            pending: 'bg-yellow-50 text-yellow-700',
            ordered: 'bg-purple-50 text-purple-700',
        };
        return colors[status] || 'bg-gray-100 text-gray-600';
    };

    const openEdit = (item: BOQItem) => {
        setEditingItem(item);
        setEditForm({
            item_name: item.item_name,
            description: item.description || '',
            quantity: item.quantity,
            rate: item.rate,
            unit: item.unit,
            status: item.status,
            order_status: item.order_status || 'pending',
            item_type: item.item_type || 'material',
            source: item.source || 'bought_out',
        });
    };

    const saveEdit = async () => {
        if (!editingItem) return;

        // Batch all updates into a single object
        const updates = {
            item_name: editForm.item_name,
            description: editForm.description,
            quantity: editForm.quantity,
            rate: editForm.rate,
            unit: editForm.unit,
            status: editForm.status,
            order_status: editForm.order_status,
            item_type: editForm.item_type,
            source: editForm.source,
        };

        // Make a single API call with all updates
        try {
            const res = await fetch('/api/boq', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingItem.id, ...updates }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Refresh to get updated data
            window.location.reload();
        } catch (err) {
            console.error('Failed to save:', err);
            alert('Failed to save changes');
        }

        setEditingItem(null);
    };

    const toggleSelect = (id: string) => {
        if (selectedItems.includes(id)) {
            onSelect(selectedItems.filter(i => i !== id));
        } else {
            onSelect([...selectedItems, id]);
        }
    };

    return (
        <div className="space-y-2 px-1.5 md:px-3 pt-3">
            {items.map(item => (
                <div
                    key={item.id}
                    className={`bg-white rounded-xl shadow-sm overflow-visible transition-all relative ${selectedItems.includes(item.id) ? 'ring-2 ring-yellow-400 border-transparent' : 'border border-gray-100'
                        }`}
                >
                    <div className="p-3">
                        <div className="flex items-start gap-1.5">
                            {isAdmin && (
                                <input
                                    type="checkbox"
                                    checked={selectedItems.includes(item.id)}
                                    onChange={() => toggleSelect(item.id)}
                                    className="mt-1 w-[18px] h-[18px] flex-shrink-0 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400 focus:ring-offset-0 cursor-pointer"
                                />
                            )}
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <h3 className="font-medium text-gray-900 text-sm truncate">{item.item_name}</h3>
                                {item.description && (
                                    <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                )}
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-xs text-gray-500 truncate">{item.category || 'Uncategorized'}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-xs flex-shrink-0 ${getStatusColor(item.status)}`}>
                                        {item.status}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-start gap-1 flex-shrink-0">
                                <div className="text-right">
                                    <p className="font-bold text-gray-900 text-xs whitespace-nowrap">{formatAmount(item.amount)}</p>
                                    <p className="text-xs text-gray-500 whitespace-nowrap">
                                        {item.quantity} {item.unit}
                                    </p>
                                </div>
                                {isAdmin && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                                            className="p-1 hover:bg-gray-100 rounded focus:outline-none"
                                            aria-label="More options"
                                        >
                                            <FiMoreVertical className="w-4 h-4 text-gray-600" />
                                        </button>

                                        {/* Dropdown Menu */}
                                        {openMenuId === item.id && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-10"
                                                    onClick={() => setOpenMenuId(null)}
                                                />
                                                <div className="absolute right-0 top-8 z-20 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                                                    <button
                                                        onClick={() => {
                                                            openEdit(item);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                    >
                                                        <FiEdit2 className="w-3.5 h-3.5" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            onDelete(item.id);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                    >
                                                        <FiTrash2 className="w-3.5 h-3.5" />
                                                        Delete
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Linked POs */}
                        {item.linked_pos && item.linked_pos.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                                {item.linked_pos.map(po => (
                                    <span
                                        key={po.id}
                                        className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded"
                                    >
                                        {po.po_number}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {items.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    No items to display
                </div>
            )}

            {/* Bottom Sheet Editor */}
            {editingItem && (
                <div className="fixed inset-0 z-50">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setEditingItem(null)}
                    />

                    {/* Bottom Sheet */}
                    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl animate-slide-up">
                        <div className="w-12 h-1 bg-gray-300 rounded mx-auto my-3" />

                        <div className="px-4 pb-6 pt-2">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold">Quick Edit</h3>
                                <button
                                    onClick={() => setEditingItem(null)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Item Name
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.item_name}
                                        onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Quantity
                                        </label>
                                        <input
                                            type="number"
                                            value={editForm.quantity}
                                            onChange={(e) => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Rate
                                        </label>
                                        <input
                                            type="number"
                                            value={editForm.rate}
                                            onChange={(e) => setEditForm({ ...editForm, rate: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description (Optional)
                                    </label>
                                    <textarea
                                        value={editForm.description}
                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                        rows={2}
                                        placeholder="Add item description..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Order Status
                                        </label>
                                        <select
                                            value={editForm.order_status}
                                            onChange={(e) => setEditForm({ ...editForm, order_status: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                        >
                                            {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Item Type
                                        </label>
                                        <select
                                            value={editForm.item_type}
                                            onChange={(e) => setEditForm({ ...editForm, item_type: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                        >
                                            {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Source
                                        </label>
                                        <select
                                            value={editForm.source}
                                            onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                        >
                                            {SOURCES.map(src => <option key={src} value={src}>{src.replace(/_/g, ' ')}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Status
                                        </label>
                                        <select
                                            value={editForm.status}
                                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                                        >
                                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Amount Preview */}
                                <div className="bg-yellow-50 p-4 rounded-xl">
                                    <div className="flex justify-between items-center">
                                        <span className="text-yellow-800">Amount</span>
                                        <span className="text-2xl font-bold text-yellow-900">
                                            {formatAmount(editForm.quantity * editForm.rate)}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={saveEdit}
                                    className="w-full py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 focus:outline-none flex items-center justify-center gap-2"
                                >
                                    <FiCheck className="w-5 h-5" />
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}

export default BoqCardMobile;
