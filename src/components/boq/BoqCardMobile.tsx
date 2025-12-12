'use client';

import React, { useState } from 'react';
import { FiEdit2, FiTrash2, FiX, FiCheck, FiChevronRight } from 'react-icons/fi';

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
    linked_pos?: { id: string; po_number: string }[];
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

export function BoqCardMobile({
    items,
    isAdmin,
    selectedItems,
    onSelect,
    onUpdate,
    onDelete
}: BoqCardMobileProps) {
    const [editingItem, setEditingItem] = useState<BOQItem | null>(null);
    const [editForm, setEditForm] = useState({
        item_name: '',
        quantity: 0,
        rate: 0,
        unit: 'Nos',
        status: 'draft',
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
            quantity: item.quantity,
            rate: item.rate,
            unit: item.unit,
            status: item.status,
        });
    };

    const saveEdit = async () => {
        if (!editingItem) return;

        await onUpdate(editingItem.id, 'item_name', editForm.item_name);
        await onUpdate(editingItem.id, 'quantity', editForm.quantity);
        await onUpdate(editingItem.id, 'rate', editForm.rate);
        await onUpdate(editingItem.id, 'unit', editForm.unit);
        await onUpdate(editingItem.id, 'status', editForm.status);

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
        <div className="space-y-3 p-4">
            {items.map(item => (
                <div
                    key={item.id}
                    className={`bg-white rounded-xl border shadow-sm overflow-hidden ${selectedItems.includes(item.id) ? 'ring-2 ring-amber-400' : ''
                        }`}
                >
                    <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                            {isAdmin && (
                                <input
                                    type="checkbox"
                                    checked={selectedItems.includes(item.id)}
                                    onChange={() => toggleSelect(item.id)}
                                    className="mt-1 rounded border-gray-300 text-amber-500"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-gray-900 truncate">{item.item_name}</h3>
                                {item.description && (
                                    <p className="text-sm text-gray-500 truncate">{item.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500">{item.category || 'Uncategorized'}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                        {item.status}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-gray-900">{formatAmount(item.amount)}</p>
                                <p className="text-xs text-gray-500">
                                    {item.quantity} {item.unit} × ₹{item.rate}
                                </p>
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

                    {/* Actions */}
                    {isAdmin && (
                        <div className="flex border-t divide-x">
                            <button
                                onClick={() => openEdit(item)}
                                className="flex-1 py-2.5 flex items-center justify-center gap-1 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                <FiEdit2 className="w-4 h-4" />
                                Edit
                            </button>
                            <button
                                onClick={() => onDelete(item.id)}
                                className="flex-1 py-2.5 flex items-center justify-center gap-1 text-sm text-red-600 hover:bg-red-50"
                            >
                                <FiTrash2 className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    )}
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
                                        className="w-full px-3 py-2.5 border rounded-lg"
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
                                            className="w-full px-3 py-2.5 border rounded-lg"
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
                                            className="w-full px-3 py-2.5 border rounded-lg"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Unit
                                        </label>
                                        <select
                                            value={editForm.unit}
                                            onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                                            className="w-full px-3 py-2.5 border rounded-lg bg-white"
                                        >
                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Status
                                        </label>
                                        <select
                                            value={editForm.status}
                                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                            className="w-full px-3 py-2.5 border rounded-lg bg-white"
                                        >
                                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Amount Preview */}
                                <div className="bg-amber-50 p-4 rounded-xl">
                                    <div className="flex justify-between items-center">
                                        <span className="text-amber-800">Amount</span>
                                        <span className="text-2xl font-bold text-amber-900">
                                            {formatAmount(editForm.quantity * editForm.rate)}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={saveEdit}
                                    className="w-full py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 flex items-center justify-center gap-2"
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
