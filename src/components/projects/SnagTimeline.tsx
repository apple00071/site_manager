'use client';

import React from 'react';
import { FiClock, FiUser, FiCheckCircle, FiAlertCircle, FiMessageSquare } from 'react-icons/fi';

import Image from 'next/image';

export interface TimelineItem {
    id: string;
    type: 'reported' | 'assigned' | 'progress' | 'resolved' | 'verified' | 'closed' | 'reopened';
    author: string;
    date: string;
    note?: string;
    photos?: string[];
}

interface SnagTimelineProps {
    items: TimelineItem[];
}

export function SnagTimeline({ items }: SnagTimelineProps) {
    if (items.length === 0) {
        return (
            <div className="py-8 text-center text-gray-400">
                <FiClock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm italic">No timeline history available</p>
            </div>
        );
    }

    const getIcon = (type: TimelineItem['type']) => {
        switch (type) {
            case 'reported': return <FiAlertCircle className="w-4 h-4" />;
            case 'assigned': return <FiUser className="w-4 h-4" />;
            case 'progress': return <FiMessageSquare className="w-4 h-4" />;
            case 'resolved': return <FiCheckCircle className="w-4 h-4 text-green-500" />;
            case 'verified':
            case 'closed': return <FiCheckCircle className="w-4 h-4 text-blue-500" />;
            case 'reopened': return <FiAlertCircle className="w-4 h-4 text-red-500" />;
            default: return <FiClock className="w-4 h-4" />;
        }
    };

    const getBgColor = (type: TimelineItem['type']) => {
        switch (type) {
            case 'resolved': return 'bg-green-100';
            case 'verified':
            case 'closed': return 'bg-blue-100';
            case 'reopened': return 'bg-red-100';
            default: return 'bg-gray-100';
        }
    };

    return (
        <div className="flow-root">
            <ul role="list" className="-mb-8">
                {items.map((item, itemIdx) => (
                    <li key={item.id}>
                        <div className="relative pb-8">
                            {itemIdx !== items.length - 1 ? (
                                <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                            ) : null}
                            <div className="relative flex space-x-3">
                                <div className="shrink-0">
                                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getBgColor(item.type)}`}>
                                        {getIcon(item.type)}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-500">
                                            <span className="font-bold text-gray-900 capitalize">{item.type.replace('_', ' ')}</span> by{' '}
                                            <span className="font-medium text-gray-900">{item.author}</span>
                                        </p>
                                        {item.note && (
                                            <div className="mt-2 text-sm text-gray-700 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                                {item.note}
                                            </div>
                                        )}
                                        {item.photos && item.photos.length > 0 && (
                                            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar overflow-y-hidden">
                                                {item.photos.map((photo, i) => (
                                                    <div key={i} className="relative w-12 h-12 flex-shrink-0 rounded-md border border-gray-200 overflow-hidden">
                                                        <Image src={photo} alt="" fill className="object-cover" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right text-[10px] whitespace-nowrap text-gray-400 font-bold uppercase tracking-tighter shrink-0 pt-1">
                                        {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
