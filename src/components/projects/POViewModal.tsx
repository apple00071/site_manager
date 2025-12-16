'use client';

import React from 'react';
import { FiX, FiPrinter, FiDownload } from 'react-icons/fi';

interface POViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    po: any;
}

export function POViewModal({ isOpen, onClose, po }: POViewModalProps) {
    if (!isOpen || !po) return null;

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

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto print:fixed print:inset-0 print:w-full print:max-w-none print:h-full print:rounded-none print:shadow-none">
                {/* Header Actions - Hidden on Print */}
                <div className="flex justify-between items-center p-4 border-b border-gray-100 print:hidden">
                    <h3 className="text-lg font-bold text-gray-900">Purchase Order Details</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-3 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            <FiPrinter className="w-4 h-4" />
                            Print / PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* PO Document Content */}
                <div className="p-8 space-y-8" id="po-content">
                    {/* Document Header */}
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">PURCHASE ORDER</h1>
                            <p className="text-gray-500">PO #: <span className="text-gray-900 font-medium">{po.po_number}</span></p>
                            <p className="text-gray-500">Date: <span className="text-gray-900 font-medium">{formatDate(po.po_date)}</span></p>
                            <p className="text-gray-500 mt-2">Status: <span className="uppercase text-xs font-bold px-2 py-0.5 bg-gray-100 rounded">{po.status}</span></p>
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
                            <p className="text-sm text-gray-500 font-medium mt-1">GST: 36ARVPB2384E1ZO</p>
                        </div>
                    </div>

                    {/* Addresses */}
                    <div className="grid grid-cols-2 gap-8 border-t border-b border-gray-200 py-6">
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Vendor</h4>
                            <p className="font-bold text-gray-900 text-lg">{po.supplier?.name}</p>
                            {po.supplier?.address && <p className="text-gray-600 whitespace-pre-line">{po.supplier.address}</p>}
                            {po.supplier?.contact_email && <p className="text-gray-600">{po.supplier.contact_email}</p>}
                            {po.supplier?.contact_phone && <p className="text-gray-600">{po.supplier.contact_phone}</p>}
                            {po.supplier?.gst_number && <p className="text-gray-600 mt-1">GST: {po.supplier.gst_number}</p>}
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ship To</h4>
                            <p className="font-bold text-gray-900 text-lg">Project Site</p>
                            <p className="text-gray-600 whitespace-pre-line">{po.delivery_address || 'Address not specified'}</p>
                            {po.delivery_date && <p className="text-gray-600 mt-2">Delivery Expected: {formatDate(po.delivery_date)}</p>}
                        </div>
                    </div>

                    {/* Line Items Table */}
                    <div>
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
                                {po.line_items?.map((item: any, index: number) => (
                                    <tr key={index}>
                                        <td className="py-4 pr-4">
                                            <p className="font-medium text-gray-900">{item.description}</p>
                                        </td>
                                        <td className="py-4 text-center text-gray-600">
                                            {item.quantity} {item.unit}
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
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal</span>
                                <span>{formatAmount(po.subtotal || 0)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Tax (18%)</span>
                                <span>{formatAmount(po.tax_amount || 0)}</span>
                            </div>
                            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                                <span>Total</span>
                                <span>{formatAmount(po.total_amount || 0)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Notes */}
                    {(po.notes || po.terms_conditions) && (
                        <div className="border-t border-gray-200 pt-6 mt-8">
                            {po.notes && (
                                <div className="mb-4">
                                    <h4 className="font-bold text-gray-900 mb-1">Notes</h4>
                                    <p className="text-gray-600 text-sm whitespace-pre-line">{po.notes}</p>
                                </div>
                            )}
                            {po.terms_conditions && (
                                <div>
                                    <h4 className="font-bold text-gray-900 mb-1">Terms & Conditions</h4>
                                    <p className="text-gray-600 text-sm whitespace-pre-line">{po.terms_conditions}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
