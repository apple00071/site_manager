'use client';

import React, { useState, useRef } from 'react';
import { FiUpload, FiFile, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import * as XLSX from 'xlsx';

interface ImportRow {
    category?: string;
    item_name: string;
    description?: string;
    unit: string;
    quantity: number;
    rate: number;
    item_type?: string;
    source?: string;
}

interface BoqImportProps {
    projectId: string;
    onImportComplete: () => void;
    onClose: () => void;
}

const REQUIRED_COLUMNS = ['item_name', 'unit', 'quantity', 'rate'];
const COLUMN_ALIASES: Record<string, string[]> = {
    item_name: ['item_name', 'item name', 'name', 'element', 'element name', 'description'],
    category: ['category', 'section', 'group'],
    description: ['description', 'desc', 'details', 'specification'],
    unit: ['unit', 'uom', 'unit of measure'],
    quantity: ['quantity', 'qty', 'no', 'nos', 'count'],
    rate: ['rate', 'price', 'unit rate', 'unit price', 'cost'],
    item_type: ['item_type', 'type', 'item type'],
    source: ['source', 'procurement source'],
};

export function BoqImport({ projectId, onImportComplete, onClose }: BoqImportProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ImportRow[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [importing, setImporting] = useState(false);
    const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const normalizeColumnName = (col: string): string | null => {
        const lower = col.toLowerCase().trim();
        for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
            if (aliases.includes(lower)) return key;
        }
        return null;
    };

    const parseFile = async (file: File) => {
        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

            if (jsonData.length < 2) {
                setErrors(['File must have at least a header row and one data row']);
                return;
            }

            const headers = jsonData[0] as string[];
            const columnMap: Record<number, string> = {};

            headers.forEach((h, idx) => {
                const normalized = normalizeColumnName(String(h));
                if (normalized) columnMap[idx] = normalized;
            });

            // Check required columns
            const foundColumns = Object.values(columnMap);
            const missingRequired = REQUIRED_COLUMNS.filter(r => !foundColumns.includes(r));
            if (missingRequired.length > 0) {
                setErrors([`Missing required columns: ${missingRequired.join(', ')}`]);
                return;
            }

            // Parse rows
            const rows: ImportRow[] = [];
            const rowErrors: string[] = [];

            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0 || row.every(cell => !cell)) continue;

                const parsed: Partial<ImportRow> = {};
                Object.entries(columnMap).forEach(([idx, key]) => {
                    const value = row[parseInt(idx)];
                    if (key === 'quantity' || key === 'rate') {
                        parsed[key as 'quantity' | 'rate'] = parseFloat(value) || 0;
                    } else {
                        (parsed as any)[key] = value?.toString() || '';
                    }
                });

                if (!parsed.item_name) {
                    rowErrors.push(`Row ${i + 1}: Missing item name`);
                    continue;
                }

                rows.push({
                    category: parsed.category || 'Uncategorized',
                    item_name: parsed.item_name || '',
                    description: parsed.description || '',
                    unit: parsed.unit || 'Nos',
                    quantity: parsed.quantity || 0,
                    rate: parsed.rate || 0,
                    item_type: parsed.item_type || 'material',
                    source: parsed.source || 'bought_out',
                });
            }

            if (rows.length === 0) {
                setErrors(['No valid rows found in file']);
                return;
            }

            setPreview(rows);
            setErrors(rowErrors);
            setStep('preview');
        } catch (err) {
            setErrors(['Failed to parse file. Please ensure it is a valid CSV or Excel file.']);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            parseFile(f);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) {
            setFile(f);
            parseFile(f);
        }
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const res = await fetch('/api/boq/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: projectId, items: preview }),
            });
            const data = await res.json();

            if (data.error) {
                setErrors([data.error]);
            } else {
                setStep('done');
                setTimeout(() => {
                    onImportComplete();
                    onClose();
                }, 1500);
            }
        } catch (err) {
            setErrors(['Import failed. Please try again.']);
        } finally {
            setImporting(false);
        }
    };

    const formatAmount = (qty: number, rate: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(qty * rate);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50">
            <div className="absolute right-0 top-0 bottom-0 bg-white w-full max-w-2xl flex flex-col shadow-2xl">
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Import BOQ Items</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {step === 'upload' && (
                        <div
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center hover:border-yellow-400 transition-colors"
                        >
                            <FiUpload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                Drop your file here
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Supports CSV and Excel files (.csv, .xlsx, .xls)
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600"
                            >
                                Choose File
                            </button>

                            <div className="mt-8 p-4 bg-gray-50 rounded-lg text-left text-sm">
                                <p className="font-medium text-gray-700 mb-2">Required columns:</p>
                                <ul className="text-gray-600 space-y-1">
                                    <li>• <strong>Item Name</strong> (or Element Name)</li>
                                    <li>• <strong>Unit</strong> (or UOM)</li>
                                    <li>• <strong>Quantity</strong> (or Qty)</li>
                                    <li>• <strong>Rate</strong> (or Price)</li>
                                </ul>
                                <p className="text-gray-500 mt-2">
                                    Optional: Category, Description, Item Type, Source
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-medium">Preview ({preview.length} items)</h3>
                                    <p className="text-sm text-gray-500">
                                        Review the data before importing
                                    </p>
                                </div>
                                {file && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <FiFile className="w-4 h-4" />
                                        {file.name}
                                    </div>
                                )}
                            </div>

                            {errors.length > 0 && (
                                <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <FiAlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-medium text-yellow-800">Warnings</p>
                                            <ul className="text-sm text-yellow-700 mt-1">
                                                {errors.map((e, i) => <li key={i}>{e}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-gray-50 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">#</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Category</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Item Name</th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Unit</th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Qty</th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Rate</th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-600">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.slice(0, 50).map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                                                <td className="px-3 py-2">{row.category}</td>
                                                <td className="px-3 py-2 font-medium">{row.item_name}</td>
                                                <td className="px-3 py-2">{row.unit}</td>
                                                <td className="px-3 py-2 text-right">{row.quantity}</td>
                                                <td className="px-3 py-2 text-right">{row.rate}</td>
                                                <td className="px-3 py-2 text-right font-medium">
                                                    {formatAmount(row.quantity, row.rate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {preview.length > 50 && (
                                    <div className="p-3 text-center text-sm text-gray-500 bg-gray-50">
                                        ... and {preview.length - 50} more items
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                                <span className="text-sm text-gray-600">
                                    Total: <strong>{preview.length} items</strong>
                                </span>
                                <span className="text-lg font-bold text-gray-900">
                                    {formatAmount(
                                        preview.reduce((sum, r) => sum + r.quantity * r.rate, 0),
                                        1
                                    )}
                                </span>
                            </div>
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiCheck className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Import Complete!</h3>
                            <p className="text-gray-600">{preview.length} items imported successfully</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'preview' && (
                    <div className="px-6 py-4 bg-gray-50 flex justify-between">
                        <button
                            onClick={() => { setStep('upload'); setPreview([]); setFile(null); }}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={importing}
                            className="px-6 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 disabled:opacity-50"
                        >
                            {importing ? 'Importing...' : `Import ${preview.length} Items`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default BoqImport;
