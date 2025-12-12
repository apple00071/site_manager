'use client';

import React from 'react';

interface PO {
    id: string;
    po_number: string;
    status?: string;
}

interface PoChipsProps {
    linkedPos: PO[];
    onClick?: (po: PO) => void;
}

export function PoChips({ linkedPos, onClick }: PoChipsProps) {
    if (!linkedPos || linkedPos.length === 0) return null;

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'sent': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'received': return 'bg-green-50 text-green-700 border-green-200';
            case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
            default: return 'bg-purple-50 text-purple-700 border-purple-200';
        }
    };

    return (
        <div className="flex flex-wrap gap-1">
            {linkedPos.map(po => (
                <button
                    key={po.id}
                    onClick={() => onClick?.(po)}
                    className={`px-2 py-0.5 text-xs rounded border transition-colors hover:opacity-80 ${getStatusColor(po.status)}`}
                >
                    {po.po_number}
                </button>
            ))}
        </div>
    );
}

export default PoChips;
