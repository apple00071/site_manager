'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiPrinter } from 'react-icons/fi';

interface ProposalViewModalProps {
    proposal: any;
    onClose: () => void;
    projectAddress?: string;
}

export function ProposalViewModal({ proposal, onClose, projectAddress }: ProposalViewModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!proposal || !mounted) return null;

    const handlePrint = () => {
        window.print();
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const content = (
        <div id="proposal-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:p-0 print:bg-white print:static print:block">
            <style type="text/css" media="print">
                {`
                @page { size: auto; margin: 15mm; }
                
                html, body {
                    height: initial !important;
                    overflow: initial !important;
                    background-color: white;
                }
                
                /* Hide the main app root and everything else */
                body > *:not(#proposal-modal-overlay) {
                    display: none !important;
                }

                /* Ensure our portal is visible and positioned correctly */
                #proposal-modal-overlay {
                    display: block !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: auto !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    background: white !important;
                    visibility: visible !important;
                }

                #proposal-print-container {
                    box-shadow: none !important;
                    max-width: 100% !important;
                    width: 100% !important;
                    overflow: visible !important;
                }
                
                ::-webkit-scrollbar { display: none; }
                `}
            </style>
            <div id="proposal-print-container" className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl print:shadow-none print:max-h-none print:w-full print:max-w-none print:overflow-visible text-left">
                {/* Header Actions - Hidden in Print */}
                <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white border-b border-gray-100 print:hidden">
                    <h3 className="font-bold text-gray-900">Proposal Details</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <span className="text-lg"><FiPrinter /></span>
                            Print / PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Printable Content */}
                <div className="p-8 md:p-12 print:p-8" id="proposal-content">
                    {/* Document Header */}
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">PROPOSAL / QUOTATION</h1>
                            <p className="text-gray-500">Ref #: <span className="text-gray-900 font-medium">{proposal.title}</span></p>
                            <p className="text-gray-500">Date: <span className="text-gray-900 font-medium">{formatDate(proposal.created_at)}</span></p>
                            <p className="text-gray-500 mt-2">Status: <span className={`uppercase text-xs font-bold px-2 py-0.5 rounded ${proposal.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{proposal.status}</span></p>
                        </div>
                        <div className="text-right">
                            <img
                                src="/icon-512x512.png"
                                alt="Apple Interiors Logo"
                                className="w-32 h-auto object-contain mb-2 ml-auto"
                            />
                            <h2 className="font-bold text-gray-900">APPLE INTERIORS</h2>
                            <p className="text-sm text-gray-500 whitespace-pre-line text-right">
                                H.NO.12-6-36/4/11, OPPOSITE TO KUKATPALLY BUS DEPOT,<br />
                                KUKATPALLY, HYDERABAD, Medchal - Malkajgiri,<br />
                                Telangana, 500072
                            </p>
                        </div>
                    </div>

                    {/* Proposal Description */}
                    {proposal.description && (
                        <div className="mt-8 mb-6">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description / Scope</h4>
                            <p className="text-gray-800 whitespace-pre-line">{proposal.description}</p>
                        </div>
                    )}

                    {/* Line Items Table */}
                    <div className="mt-8">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b-2 border-gray-900">
                                    <th className="py-3 text-left font-bold text-gray-900">Item & Description</th>
                                    <th className="py-3 text-center font-bold text-gray-900 w-24">Qty</th>
                                    <th className="py-3 text-right font-bold text-gray-900 w-32">Rate</th>
                                    <th className="py-3 text-right font-bold text-gray-900 w-32">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {proposal.items?.map((item: any, index: number) => (
                                    <tr key={index}>
                                        <td className="py-4 pr-4">
                                            <p className="font-medium text-gray-900">{item.item_name}</p>
                                        </td>
                                        <td className="py-4 text-center text-gray-600">
                                            {item.quantity}
                                        </td>
                                        <td className="py-4 text-right text-gray-600">
                                            {formatAmount(item.rate)}
                                        </td>
                                        <td className="py-4 text-right font-medium text-gray-900">
                                            {formatAmount(item.amount || (item.quantity * item.rate))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end pt-4">
                        <div className="w-64 space-y-2">
                            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                                <span>Total</span>
                                <span>{formatAmount(proposal.total_amount || 0)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-200 pt-8 mt-12 text-center text-sm text-gray-500">
                        <p>Thank you for considering Apple Interiors for your project.</p>
                        <p className="mt-1">This is a system generated proposal.</p>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
