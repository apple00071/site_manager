'use client';

import React, { useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    FiPlus, FiUpload, FiSend, FiGrid, FiList,
    FiAlertCircle, FiX, FiPackage, FiRefreshCw, FiDownload, FiCheckCircle, FiChevronDown
} from 'react-icons/fi';
import { BoqGrid } from '@/components/boq/BoqGrid';
import { BoqCardMobile } from '@/components/boq/BoqCardMobile';
import { BoqImport } from '@/components/boq/BoqImport';
import { ProposalBuilder } from '@/components/boq/ProposalBuilder';
import { BoqEditModal } from '@/components/boq/BoqEditModal';
import { CompareBoqOrderModal } from '@/components/boq/CompareBoqOrderModal';

interface BOQItem {
    id: string;
    project_id: string;
    category: string | null;
    sub_category: string | null;
    item_name: string;
    description: string | null;
    unit: string;
    quantity: number;
    rate: number;
    amount: number;
    status: 'draft' | 'confirmed' | 'completed';
    order_status?: string;
    item_type?: string;
    source?: string;
    draft_quantity?: number;
    linked_pos?: { id: string; po_number: string; status?: string }[];
    sort_order: number;
    remarks: string | null;
}

interface BOQTabProps {
    projectId: string;
}

const UNITS = ['Sqft', 'Rft', 'Nos', 'Kg', 'Cum', 'Sqm', 'Lump Sum', 'Set', 'Pair', 'Metric Ton'];
const STATUSES = ['draft', 'confirmed', 'completed'];

export interface BOQTabHandle {
    openAddItem: () => void;
    openImport: () => void;
    openProposal: () => void;
    openComparison: () => void;
}

export const BOQTab = forwardRef<BOQTabHandle, BOQTabProps>(({ projectId }, ref) => {
    const { isAdmin } = useAuth();
    const [items, setItems] = useState<BOQItem[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]); // New state for inventory
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'cards'>('grid');
    const [showImport, setShowImport] = useState(false);
    const [showProposal, setShowProposal] = useState(false);
    const [showComparison, setShowComparison] = useState(false);
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [sectionTotals, setSectionTotals] = useState<Record<string, { count: number; amount: number }>>({});
    const [isMobile, setIsMobile] = useState(false);
    const [customCategories, setCustomCategories] = useState<string[]>([]);
    const [editingItem, setEditingItem] = useState<BOQItem | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    // Expose actions to parent via ref
    useImperativeHandle(ref, () => ({
        openAddItem: () => {
            setEditingItem(null);
            setShowEditModal(true);
        },
        openImport: () => setShowImport(true),
        openProposal: () => setShowProposal(true),
        openComparison: () => setShowComparison(true)
    }));

    // Load custom categories from localStorage on mount
    useEffect(() => {
        const storageKey = `boq_custom_categories_${projectId}`;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setCustomCategories(parsed);
                }
            } catch (e) {
                // Invalid JSON, ignore
            }
        }
    }, [projectId]);

    // Save custom categories to localStorage when they change
    useEffect(() => {
        const storageKey = `boq_custom_categories_${projectId}`;
        if (customCategories.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(customCategories));
        }
    }, [customCategories, projectId]);

    // Detect mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Dynamic categories from data + custom categories
    const categories = useMemo(() => {
        const catsFromItems = [...new Set(items.map(i => i.category).filter(Boolean))] as string[];
        const allCats = [...new Set([...catsFromItems, ...customCategories])];
        return allCats.sort();
    }, [items, customCategories]);

    const fetchItems = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({ project_id: projectId });
            // Don't filter by category at API level - fetch all items

            const res = await fetch(`/api/boq?${params}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setItems(data.items || []);
            setSectionTotals(data.sectionTotals || {});
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch BOQ');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            // Filter by category if one is selected
            if (activeCategory && item.category !== activeCategory) return false;
            if (filterStatus !== 'all' && item.status !== filterStatus) return false;
            return true;
        });
    }, [items, filterStatus, activeCategory]);

    const totals = useMemo(() => {
        const total = filteredItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        return { total };
    }, [filteredItems]);

    // Inline update
    const handleInlineUpdate = async (id: string, field: string, value: any) => {
        try {
            const res = await fetch('/api/boq', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, [field]: value }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Update local state with the full item from API (includes recalculated amount)
            if (data.item) {
                setItems(prev => prev.map(item =>
                    item.id === id ? { ...item, ...data.item } : item
                ));
            } else {
                // Fallback if API doesn't return the item
                setItems(prev => prev.map(item =>
                    item.id === id ? { ...item, [field]: value } : item
                ));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Update failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this item?')) return;
        try {
            const res = await fetch(`/api/boq?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchItems();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
        }
    };

    // Open modal to add new item
    const handleAddItem = () => {
        setEditingItem(null); // null means new item
        setShowEditModal(true);
    };

    // Open modal to edit existing item
    const handleEditItem = (item: BOQItem) => {
        setEditingItem(item);
        setShowEditModal(true);
    };

    // Save item (new or update)
    const handleSaveItem = async (formData: Partial<BOQItem>) => {
        console.log('handleSaveItem called:', { editingItem, formData });
        try {
            if (editingItem) {
                // Update existing item
                console.log('Updating existing item:', editingItem.id);
                const res = await fetch('/api/boq', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingItem.id, ...formData }),
                });
                const data = await res.json();
                console.log('Update response:', data);
                if (data.error) throw new Error(data.error);
            } else {
                // Create new item
                console.log('Creating new item');
                const res = await fetch('/api/boq', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        project_id: projectId,
                        ...formData,
                    }),
                });
                const data = await res.json();
                console.log('Create response:', data);
                if (data.error) throw new Error(data.error);
            }
            console.log('Fetching items after save...');
            await fetchItems();
            setShowEditModal(false);
            setEditingItem(null);
        } catch (err) {
            console.error('Save error:', err);
            setError(err instanceof Error ? err.message : 'Save failed');
        }
    };

    const handleBulkStatusUpdate = async (status: string) => {
        if (selectedItems.length === 0) return;
        try {
            const res = await fetch('/api/boq', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_status',
                    project_id: projectId,
                    item_ids: selectedItems,
                    status,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchItems();
            setSelectedItems([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Update failed');
        }
    };

    const addCategory = () => {
        const trimmedName = newCategoryName.trim();
        if (trimmedName) {
            // Always add to custom categories
            setCustomCategories(prev => {
                if (prev.includes(trimmedName)) return prev;
                return [...prev, trimmedName];
            });
            setActiveCategory(trimmedName);
            setNewCategoryName('');
            setShowAddCategory(false);
        }
    };

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="flex gap-2 pb-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-9 w-24 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                    <div className="h-12 bg-gray-100 rounded"></div>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-14 bg-gray-50 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            {/* Header Removed as per user request */}

            {/* Unified Sub-Tab Bar */}
            <div className="px-4 border-b border-gray-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Categories (Tabs) */}
                <div className="flex gap-6 overflow-x-auto no-scrollbar -mb-px">
                    <button
                        onClick={() => setActiveCategory(null)}
                        className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeCategory === null
                            ? 'border-yellow-500 text-yellow-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        All Items
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeCategory === null ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                            {items.length}
                        </span>
                    </button>

                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeCategory === cat
                                ? 'border-yellow-500 text-yellow-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {cat}
                            {sectionTotals[cat] && (
                                <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeCategory === cat ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {sectionTotals[cat].count}
                                </span>
                            )}
                        </button>
                    ))}

                    {/* Add Category Button - integrated into tab list */}
                    {showAddCategory ? (
                        <div className="flex items-center gap-2 py-2">
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Name"
                                className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:bhover:bg-yellow-50 focus:border-yellow-500 focus:ring-yellow-500 outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') addCategory();
                                    if (e.key === 'Escape') { setShowAddCategory(false); setNewCategoryName(''); }
                                }}
                            />
                            <button onClick={addCategory} className="p-1 text-yellow-600 hover:bg-yellow-50 rounded"><FiPlus className="w-4 h-4" /></button>
                            <button onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} className="p-1 text-gray-400 hover:text-gray-600"><FiX className="w-4 h-4" /></button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAddCategory(true)}
                            className="py-3 text-sm font-medium text-gray-400 hover:text-yellow-600 flex items-center gap-1 border-b-2 border-transparent"
                        >
                            <FiPlus className="w-4 h-4" />
                            New Category
                        </button>
                    )}
                </div>

                {/* Right Side Controls (View & Filter) */}
                <div className="flex items-center gap-3 py-2 md:py-0">
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 roundedmd transition-all ${viewMode === 'grid' ? 'bg-white shadow text-yellow-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Grid View"
                        >
                            <FiGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white shadow text-yellow-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Card View"
                        >
                            <FiList className="w-4 h-4" />
                        </button>
                    </div>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="text-sm border-none bg-transparent font-medium text-gray-600 focus:ring-0 cursor-pointer"
                    >
                        <option value="all">All Status</option>
                        {STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Bulk Actions */}
            {
                selectedItems.length > 0 && isAdmin && (
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 text-white px-2 py-1.5 rounded-lg shadow-xl animate-in slide-in-from-bottom-4 duration-200 border border-gray-800">
                        {/* Selected Count */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-md">
                            <FiCheckCircle className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm font-medium whitespace-nowrap">
                                {selectedItems.length} Selected
                            </span>
                        </div>

                        {/* Divider */}
                        <div className="h-6 w-px bg-gray-700 mx-1"></div>

                        {/* Move to Proposal */}
                        <div className="relative group">
                            <button
                                onClick={() => setShowProposal(true)}
                                className="flex items-center gap-2 px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md transition-colors shadow-sm"
                            >
                                <span className="text-sm font-medium">Move to Proposal</span>
                                <FiChevronDown className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Select All */}
                        <button
                            onClick={() => {
                                // Select all visible items
                                const allIds = filteredItems.map(i => i.id);
                                setSelectedItems(allIds);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors ml-1"
                        >
                            <FiGrid className="w-4 h-4" />
                            <span className="text-sm font-medium whitespace-nowrap">Select All</span>
                        </button>

                        {/* Clear All */}
                        <button
                            onClick={() => setSelectedItems([])}
                            className="flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
                        >
                            <FiX className="w-4 h-4" />
                            <span className="text-sm font-medium whitespace-nowrap">Clear All</span>
                        </button>
                    </div>
                )
            }

            {
                error && (
                    <div className="mx-2 md:mx-3 mt-3 p-2 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                        <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm flex-1">{error}</span>
                        <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded">
                            <FiX className="w-4 h-4" />
                        </button>
                    </div>
                )
            }

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <FiPackage className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No BOQ items yet</h3>
                        <p className="text-sm text-gray-500 text-center max-w-sm">
                            Start by adding items to your bill of quantities
                        </p>
                        {isAdmin && (
                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={() => setShowImport(true)}
                                    className="btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium"
                                >
                                    <FiUpload className="w-4 h-4" />
                                    Import from Excel
                                </button>
                                <button
                                    onClick={handleAddItem}
                                    className="btn-brand flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium"
                                >
                                    <FiPlus className="w-4 h-4" />
                                    Add Item
                                </button>
                            </div>
                        )}
                    </div>
                ) : (viewMode === 'cards' || isMobile) ? (
                    <BoqCardMobile
                        items={filteredItems}
                        isAdmin={isAdmin}
                        selectedItems={selectedItems}
                        onSelect={setSelectedItems}
                        onUpdate={handleInlineUpdate}
                        onDelete={handleDelete}
                    />
                ) : (
                    <div className="p-2 md:p-3">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                            <BoqGrid
                                items={filteredItems}
                                isAdmin={isAdmin}
                                selectedItems={selectedItems}
                                onSelect={setSelectedItems}
                                onUpdate={handleInlineUpdate}
                                onDelete={handleDelete}
                                onAdd={handleAddItem}
                                onEdit={handleEditItem}
                                onSendProposal={(itemIds) => {
                                    setSelectedItems(itemIds);
                                    setShowProposal(true);
                                }}
                                categories={categories}
                            />

                            {/* Grand Total */}
                            <div className="border-t border-gray-100 bg-white px-4 py-4 flex justify-between items-center rounded-b-xl">
                                <span className="text-sm font-semibold text-gray-700">
                                    {activeCategory ? `${activeCategory} Total` : 'Grand Total'}
                                </span>
                                <span className="text-lg font-bold text-gray-900">
                                    {formatAmount(totals.total)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {
                showImport && (
                    <BoqImport
                        projectId={projectId}
                        onImportComplete={fetchItems}
                        onClose={() => setShowImport(false)}
                    />
                )
            }

            {
                showProposal && (
                    <ProposalBuilder
                        projectId={projectId}
                        items={items}
                        selectedItemIds={selectedItems}
                        onClose={() => setShowProposal(false)}
                        onSuccess={() => {
                            fetchItems();
                            setSelectedItems([]);
                        }}
                    />
                )
            }

            {/* BOQ Edit Modal */}
            <BoqEditModal
                item={editingItem}
                categories={categories}
                isOpen={showEditModal}
                onClose={() => { setShowEditModal(false); setEditingItem(null); }}
                onSave={handleSaveItem}
            />

            {/* Compare Modal */}
            <CompareBoqOrderModal
                isOpen={showComparison}
                onClose={() => setShowComparison(false)}
                items={items}
                inventoryItems={inventoryItems}
            />
        </div >
    );
});

BOQTab.displayName = 'BOQTab';

export default BOQTab;
