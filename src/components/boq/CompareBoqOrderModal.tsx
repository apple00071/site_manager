'use client';

import React, { useMemo, useState } from 'react';
import { FiX, FiCheckCircle, FiAlertCircle, FiTrendingUp, FiTrendingDown, FiArchive, FiPackage } from 'react-icons/fi';

interface CompareBoqOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: any[];
    inventoryItems?: any[]; // Added optional prop
}

export const CompareBoqOrderModal: React.FC<CompareBoqOrderModalProps> = ({ isOpen, onClose, items, inventoryItems = [] }) => {
    const [filter, setFilter] = useState<'all' | 'variance' | 'completed'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const comparisonData = useMemo(() => {
        // Create a map of inventory items by normalized name for faster lookup
        const inventoryMap = new Map<string, number>();
        inventoryItems.forEach(inv => {
            const name = inv.item_name?.toLowerCase().trim();
            if (name) {
                const currentQty = inventoryMap.get(name) || 0;
                inventoryMap.set(name, currentQty + (inv.quantity || 0));
            }
        });

        return items.map(item => {
            const boqQty = item.quantity || 0;
            const orderedQty = item.ordered_quantity || 0;
            // Match inventory by name
            const normalizedName = item.item_name?.toLowerCase().trim();
            const receivedQty = inventoryMap.get(normalizedName) || 0;

            const difference = orderedQty - boqQty;
            const variance = boqQty > 0 ? (difference / boqQty) * 100 : 0;

            // Execution Status: Received vs BOQ
            const executionDiff = receivedQty - boqQty;

            let status = 'on_track';
            if (orderedQty > boqQty) status = 'over_ordered';
            if (orderedQty < boqQty && item.status === 'confirmed') status = 'pending_order';

            // Check if received matches ordered
            let receivedStatus = 'pending';
            if (receivedQty >= orderedQty && orderedQty > 0) receivedStatus = 'fully_received';
            else if (receivedQty > 0) receivedStatus = 'partially_received';

            const boqAmount = item.amount || 0;
            // Estimate ordered amount based on BOQ rate (since we don't have actual PO rate easily here without joining)
            // or use the rate from the item if available. 
            // Ideally we should use actual PO amount but for now BOQ rate is a proxy.
            const orderedAmount = orderedQty * item.rate;

            return {
                ...item,
                boqQty,
                orderedQty,
                receivedQty,
                difference,
                variance,
                status,
                receivedStatus,
                boqAmount,
                orderedAmount
            };
        });
    }, [items, inventoryItems]);

    const filteredData = useMemo(() => {
        return comparisonData.filter(item => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!item.item_name.toLowerCase().includes(term)) return false;
            }

            if (filter === 'variance') return item.difference !== 0;
            if (filter === 'completed') return item.orderedQty >= item.boqQty;
            return true;
        });
    }, [comparisonData, filter, searchTerm]);

    const stats = useMemo(() => {
        const totalBoqValue = comparisonData.reduce((sum, item) => sum + item.boqAmount, 0);
        const totalOrderedValue = comparisonData.reduce((sum, item) => sum + item.orderedAmount, 0);
        const totalItems = comparisonData.length;
        const overOrderedCount = comparisonData.filter(i => i.status === 'over_ordered').length;

        return { totalBoqValue, totalOrderedValue, totalItems, overOrderedCount };
    }, [comparisonData]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">BOQ vs Order & Inventory Comparison</h2>
                        <p className="text-sm text-gray-500 mt-1">Compare planned quantities against ordered and received stock.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <FiX className="w-6 h-6" />
                    </button>
                </div>

                {/* Controls & Stats */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-white border-b border-gray-100">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Total BOQ Value</p>
                        <p className="text-lg font-bold text-blue-900">₹{stats.totalBoqValue.toLocaleString()}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                        <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">Ordered Value (Est)</p>
                        <p className="text-lg font-bold text-purple-900">₹{stats.totalOrderedValue.toLocaleString()}</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                        <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Over Ordered Items</p>
                        <p className="text-lg font-bold text-orange-900">{stats.overOrderedCount}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Search items..."
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 p-2 px-6 bg-white border-b border-gray-100 overflow-x-auto">
                    {(['all', 'variance', 'completed'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${filter === f
                                    ? 'bg-gray-900 text-white border-gray-900'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)} Items
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto bg-gray-50">
                    <table className="w-full border-collapse">
                        <thead className="bg-white sticky top-0 z-10 shadow-sm text-left">
                            <tr>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Item Details</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">BOQ Qty</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ordered</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-orange-50/50 text-orange-800">Received (Site)</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Variance</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {filteredData.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all text-gray-400">
                                                <FiPackage className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 line-clamp-1" title={item.item_name}>{item.item_name}</p>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                        {item.category || 'General'}
                                                    </span>
                                                    <span className="text-xs text-gray-400 flex items-center">{item.unit}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="text-sm font-medium text-gray-900">{item.boqQty}</span>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className={`text-sm font-bold ${item.orderedQty > item.boqQty ? 'text-red-600' : 'text-blue-600'}`}>
                                                {item.orderedQty}
                                            </span>
                                            {item.orderedQty > 0 && (
                                                <span className="text-[10px] text-gray-400">
                                                    {((item.orderedQty / item.boqQty) * 100).toFixed(0)}%
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right bg-orange-50/30">
                                        <div className="flex flex-col items-end">
                                            <span className={`text-sm font-bold ${item.receivedQty < item.orderedQty ? 'text-orange-600' : 'text-green-600'}`}>
                                                {item.receivedQty}
                                            </span>
                                            {item.receivedQty > 0 && (
                                                <span className="text-[10px] text-gray-400">
                                                    Match: {((item.receivedQty / (item.orderedQty || 1)) * 100).toFixed(0)}%
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        {item.difference !== 0 ? (
                                            <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ${item.difference > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                                                }`}>
                                                {item.difference > 0 ? '+' : ''}{item.difference}
                                                {item.difference > 0 ? <FiTrendingUp className="w-3" /> : <FiTrendingDown className="w-3" />}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            {item.status === 'over_ordered' && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    <FiAlertCircle className="w-3 h-3" /> Over
                                                </span>
                                            )}
                                            {item.status === 'pending_order' && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                    Pending
                                                </span>
                                            )}
                                            {item.status === 'on_track' && item.orderedQty > 0 && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    On Track
                                                </span>
                                            )}
                                            {/* Received Status Indicator */}
                                            {item.receivedStatus === 'fully_received' && item.receivedQty > 0 && (
                                                <span className="text-[10px] text-green-600 font-medium">Full Recv</span>
                                            )}
                                            {item.receivedStatus === 'partially_received' && (
                                                <span className="text-[10px] text-orange-600 font-medium">Partial Recv</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 bg-gray-50/50">
                                        <div className="flex flex-col items-center justify-center">
                                            <FiArchive className="w-10 h-10 text-gray-300 mb-3" />
                                            <p className="font-medium">No items found matching criteria</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
