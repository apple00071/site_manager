'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FiSend, FiX, FiCheck, FiAlertCircle } from 'react-icons/fi';

interface BOQItem {
    id: string;
    item_name: string;
    description?: string | null;
    category?: string | null;
    quantity: number;
    rate: number;
    amount: number;
    status: string;
}

interface ProposalBuilderProps {
    projectId: string;
    items: BOQItem[];
    selectedItemIds: string[];
    onClose: () => void;
    onSuccess: () => void;
}

export function ProposalBuilder({
    projectId,
    items,
    selectedItemIds,
    onClose,
    onSuccess
}: ProposalBuilderProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>(selectedItemIds);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedItems = useMemo(() =>
        items.filter(i => selectedIds.includes(i.id)),
        [items, selectedIds]
    );

    const totalAmount = useMemo(() =>
        selectedItems.reduce((sum, i) => sum + (i.amount || 0), 0),
        [selectedItems]
    );

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const toggleItem = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleSend = async () => {
        if (!title.trim()) {
            setError('Please enter a proposal title');
            return;
        }
        if (selectedIds.length === 0) {
            setError('Please select at least one item');
            return;
        }

        setSending(true);
        setError(null);

        try {
            // Create proposal
            const res = await fetch('/api/proposals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    title,
                    description,
                    selected_items: selectedIds,
                }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Send proposal
            await fetch('/api/proposals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: data.proposal.id,
                    action: 'send',
                }),
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send proposal');
        } finally {
            setSending(false);
        }
    };

    // Group items by category - show draft items and any pre-selected items
    const itemsByCategory = useMemo(() => {
        const grouped: Record<string, BOQItem[]> = {};
        items.filter(i => i.status === 'draft' || selectedIds.includes(i.id)).forEach(item => {
            const cat = item.category || 'Uncategorized';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        });
        return grouped;
    }, [items, selectedIds]);

    return (
        <div className="fixed inset-0 bg-black/50 z-50">
            <div className="absolute right-0 top-0 bottom-0 bg-white w-full max-w-lg flex flex-col shadow-2xl animate-slide-in-right">
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Create Proposal</h2>
                        <p className="text-sm text-gray-500">Select BOQ items to include in the proposal</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 space-y-6">
                    {/* Title & Description */}
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Proposal Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 rounded-lg outline-none"
                                placeholder="e.g., Phase 1 - Civil Works Proposal"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description (optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 rounded-lg outline-none"
                                rows={2}
                                placeholder="Additional notes for the client..."
                            />
                        </div>
                    </div>

                    {/* Item Selection */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-gray-700">
                                Select Items ({selectedIds.length} selected)
                            </label>
                            <button
                                onClick={() => {
                                    const draftIds = items.filter(i => i.status === 'draft').map(i => i.id);
                                    if (selectedIds.length === draftIds.length) {
                                        setSelectedIds([]);
                                    } else {
                                        setSelectedIds(draftIds);
                                    }
                                }}
                                className="text-sm text-amber-600 hover:underline"
                            >
                                {selectedIds.length === items.filter(i => i.status === 'draft').length
                                    ? 'Deselect All'
                                    : 'Select All Draft Items'}
                            </button>
                        </div>

                        <div className="bg-gray-50 rounded-lg max-h-64 overflow-y-auto">
                            {Object.entries(itemsByCategory).map(([category, catItems]) => (
                                <div key={category}>
                                    <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-gray-600">
                                        {category}
                                    </div>
                                    {catItems.map(item => (
                                        <label
                                            key={item.id}
                                            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => toggleItem(item.id)}
                                                className="rounded border-gray-300 text-amber-500"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {item.item_name}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {item.quantity} × ₹{item.rate}
                                                </p>
                                            </div>
                                            <span className="text-sm font-medium text-gray-900">
                                                {formatAmount(item.amount)}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            ))}

                            {Object.keys(itemsByCategory).length === 0 && (
                                <div className="p-8 text-center text-gray-500">
                                    <p>No draft items available for proposal</p>
                                    <p className="text-sm mt-1">Only draft items can be included</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-100">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-amber-800">Proposal Total</p>
                                <p className="text-xs text-amber-600">{selectedIds.length} items selected</p>
                            </div>
                            <span className="text-2xl font-bold text-amber-900">
                                {formatAmount(totalAmount)}
                            </span>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                            <FiAlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 flex justify-between bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || selectedIds.length === 0}
                        className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50"
                    >
                        <FiSend className="w-4 h-4" />
                        {sending ? 'Sending...' : 'Create & Send Proposal'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ProposalBuilder;
