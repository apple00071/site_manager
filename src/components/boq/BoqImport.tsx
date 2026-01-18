'use client';

import React, { useState, useRef } from 'react';
import { FiUpload, FiFile, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';


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
    existingCategories?: string[];
}

const REQUIRED_COLUMNS = ['item_name', 'quantity'];
const COLUMN_ALIASES: Record<string, string[]> = {
    item_name: ['item_name', 'item name', 'name', 'element', 'element name', 'description', 'particular', 'particulars'],
    category: ['category', 'section', 'group'],
    description: ['description', 'desc', 'details', 'specification'],
    unit: ['unit', 'uom', 'unit of measure'],
    quantity: ['quantity', 'qty', 'no', 'nos', 'count', 'quantity/unit'],
    rate: ['rate', 'price', 'unit rate', 'unit price', 'cost'],
    item_type: ['item_type', 'type', 'item type'],
    source: ['source', 'procurement source'],
};

export function BoqImport({ projectId, onImportComplete, onClose, existingCategories }: BoqImportProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ImportRow[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [importing, setImporting] = useState(false);
    const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
    const [bulkCategory, setBulkCategory] = useState<string>('');
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
            console.log('Parsing file:', file.name);
            const data = await file.arrayBuffer();
            let jsonData: any[][] = [];

            if (file.name.endsWith('.docx')) {
                console.log('Converting DOCX to HTML...');
                const result = await mammoth.convertToHtml({ arrayBuffer: data });
                const html = result.value;
                console.log('DOCX converted. Extracting tables...');

                // Use DOMParser to extract tables from HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const tables = doc.querySelectorAll('table');

                if (tables.length === 0) {
                    setErrors(['No tables found in the Word document. BOQ items must be in a table.']);
                    return;
                }

                // Convert tables to 2D array (jsonData)
                // We'll combine all tables if there are multiple
                tables.forEach(table => {
                    const rows = table.querySelectorAll('tr');
                    rows.forEach(tr => {
                        const cells = tr.querySelectorAll('td, th');
                        const rowData = Array.from(cells).map(cell => cell.textContent?.trim() || '');
                        if (rowData.some(c => !!c)) {
                            jsonData.push(rowData);
                        }
                    });
                });
            } else {
                const wb = XLSX.read(data, { type: 'array' });

                if (wb.SheetNames.length === 0) {
                    setErrors(['Excel file appears to be empty (no sheets found)']);
                    return;
                }

                const ws = wb.Sheets[wb.SheetNames[0]];
                jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
            }

            console.log('Raw data found, rows:', jsonData.length);

            if (jsonData.length < 2) {
                setErrors(['File must have at least a header row and one data row']);
                return;
            }


            const headers = jsonData[0] as string[];
            const columnMap: Record<number, string> = {};

            console.log('Headers found:', headers);

            headers.forEach((h, idx) => {
                if (!h) return;
                const normalized = normalizeColumnName(String(h));
                if (normalized) {
                    columnMap[idx] = normalized;
                    console.log(`Mapped column "${h}" to "${normalized}"`);
                }
            });

            // Check required columns
            const foundColumns = Object.values(columnMap);
            const missingRequired = REQUIRED_COLUMNS.filter(r => !foundColumns.includes(r));
            if (missingRequired.length > 0) {
                console.warn('Missing columns:', missingRequired);
                setErrors([
                    `Missing required columns: ${missingRequired.join(', ')}.`,
                    `Found columns: ${headers.join(', ')}`
                ]);
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
                    if (key === 'quantity') {
                        const strVal = String(value || '').trim();
                        // Extract number (including fractions like 1/2)
                        const numMatch = strVal.match(/^(\d+(?:\.\d+)?|\d+\/\d+)/);
                        // Extract unit suffix (e.g., kg, nos)
                        const unitMatch = strVal.match(/([a-zA-Z]+)$/);

                        if (numMatch) {
                            let q = numMatch[1];
                            if (q.includes('/')) {
                                const [a, b] = q.split('/').map(Number);
                                (parsed as any).quantity = a / b;
                            } else {
                                (parsed as any).quantity = parseFloat(q);
                            }
                        } else {
                            (parsed as any).quantity = 0;
                        }

                        if (unitMatch && !parsed.unit) {
                            (parsed as any).unit = unitMatch[1];
                        }
                    } else if (key === 'rate') {
                        const stringVal = String(value || '').replace(/[^0-9.-]/g, '');
                        parsed.rate = parseFloat(stringVal) || 0;
                    } else {
                        (parsed as any)[key] = value?.toString() || '';
                    }
                });

                if (!parsed.item_name) {
                    // Skip empty rows silently often better, but warn if it looks like data
                    if (row.some(c => !!c)) {
                        rowErrors.push(`Row ${i + 1}: Skipped (Missing item name)`);
                    }
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
                setErrors(['No valid rows found in file. Please check column headers.']);
                return;
            }

            console.log('Successfully parsed rows:', rows.length);
            setPreview(rows);
            setErrors(rowErrors.length > 0 ? rowErrors.slice(0, 5) : []); // Show max 5 errors
            if (rowErrors.length > 5) {
                setErrors(prev => [...prev, `...and ${rowErrors.length - 5} more issues`]);
            }
            setStep('preview');
        } catch (err) {
            console.error('Parse error:', err);
            setErrors(['Failed to parse file. Please ensure it is a valid CSV, Excel, or Word file.']);
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
            const itemsWithBulkCategory = preview.map(item => ({
                ...item,
                category: bulkCategory.trim() || item.category
            }));

            const res = await fetch('/api/boq/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: projectId, items: itemsWithBulkCategory }),
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
                                Supports CSV, Excel, and Word files (.csv, .xlsx, .xls, .docx)
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls,.docx"
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
                                    <li>• <strong>Item Name</strong> (or Particular)</li>
                                    <li>• <strong>Quantity</strong> (or Qty - units like 'kg' can be included)</li>
                                </ul>
                                <p className="text-gray-500 mt-2">
                                    Optional: Unit, Rate, Category, Description
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
                                <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
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

                            {/* Bulk Category Assignment */}
                            <div className="mb-6 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                                <label className="block text-sm font-semibold text-yellow-900 mb-2">
                                    Set Category for all items
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={bulkCategory}
                                            onChange={(e) => setBulkCategory(e.target.value)}
                                            placeholder="Type or select a category..."
                                            className="w-full px-3 py-2 bg-white border border-yellow-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 outline-none"
                                        />
                                        {existingCategories && existingCategories.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {existingCategories.map(cat => (
                                                    <button
                                                        key={cat}
                                                        onClick={() => setBulkCategory(cat)}
                                                        className={`px-2 py-1 text-xs rounded-md border transition-colors ${bulkCategory === cat
                                                            ? 'bg-yellow-500 text-white border-yellow-600'
                                                            : 'bg-white text-gray-600 border-gray-200 hover:border-yellow-400'
                                                            }`}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-yellow-700 mt-2">
                                    This will apply "{bulkCategory || 'Uncategorized'}" to all {preview.length} items above.
                                </p>
                            </div>

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
                                                <td className="px-3 py-2">
                                                    <span className={bulkCategory ? 'text-yellow-600 font-medium' : ''}>
                                                        {bulkCategory || row.category}
                                                    </span>
                                                </td>
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
        </div >
    );
}

export default BoqImport;
