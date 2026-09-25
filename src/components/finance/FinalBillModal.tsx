'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/ui/Toast';
import {
  FiX,
  FiPlus,
  FiTrash2,
  FiDownload,
  FiSave,
  FiFileText,
  FiAlertCircle,
  FiCheckCircle,
  FiRefreshCw
} from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';
import {
  FinalBillItem,
  downloadFinalBillPDF
} from '@/lib/reports/finalBillPdfGenerator';

interface FinalBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle?: string;
  customerName?: string | null;
  onSuccess?: () => void;
}

export default function FinalBillModal({
  isOpen,
  onClose,
  projectId,
  projectTitle = '',
  customerName = null,
  onSuccess,
}: FinalBillModalProps) {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [quotationId, setQuotationId] = useState<string | null>(null);

  // Bill items state
  const [items, setItems] = useState<FinalBillItem[]>([]);
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'flat'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [gstRate, setGstRate] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Financial baseline
  const [baselineBudget, setBaselineBudget] = useState<number>(0);
  const [totalCollected, setTotalCollected] = useState<number>(0);

  useEffect(() => {
    if (isOpen && projectId) {
      loadFinalBillData();
    }
  }, [isOpen, projectId]);

  const loadFinalBillData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/final-bill`);
      if (!res.ok) {
        throw new Error('Failed to load final bill data');
      }
      const data = await res.json();

      setLeadId(data.lead?.id || null);
      setQuotationId(data.quotation?.id || null);
      setBaselineBudget(Number(data.financials?.budget) || 0);
      setTotalCollected(Number(data.financials?.collected) || 0);

      if (data.quotation) {
        setDiscountType(data.quotation.discount_type || 'none');
        setDiscountValue(Number(data.quotation.discount_value) || 0);
        setGstRate(Number(data.quotation.gst_rate) || 0);
        setNotes(data.quotation.notes || '');
      }

      if (data.items && data.items.length > 0) {
        setItems(data.items);
      } else {
        // Start with an initial blank line item if no quote items exist
        setItems([
          {
            section: 'General',
            item_name: 'Interior Works as per agreed scope',
            is_lumpsum: true,
            area_sqft: 1,
            unit: 'lumpsum',
            rate: Number(data.financials?.budget) || 0,
            amount: Number(data.financials?.budget) || 0,
          },
        ]);
      }
    } catch (err: any) {
      console.error('Error fetching final bill info:', err);
      showToast('error', 'Could not load quotation items for this project');
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return (subtotal * (Number(discountValue) || 0)) / 100;
    }
    if (discountType === 'flat') {
      return Number(discountValue) || 0;
    }
    return 0;
  }, [subtotal, discountType, discountValue]);

  const taxableAmount = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const gstAmount = useMemo(() => {
    return gstRate > 0 ? Math.round((taxableAmount * gstRate) / 100) : 0;
  }, [taxableAmount, gstRate]);

  const grandTotal = useMemo(() => {
    return Math.max(0, taxableAmount + gstAmount);
  }, [taxableAmount, gstAmount]);

  const netBalanceDue = useMemo(() => {
    return Math.max(0, grandTotal - totalCollected);
  }, [grandTotal, totalCollected]);

  // Item handlers
  const handleItemChange = (index: number, field: keyof FinalBillItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };

      if (field === 'length_ft' || field === 'width_ft' || field === 'is_lumpsum') {
        if (!item.is_lumpsum && item.length_ft && item.width_ft) {
          item.area_sqft = parseFloat((item.length_ft * item.width_ft).toFixed(2));
          if (item.rate) {
            item.amount = Math.round(item.area_sqft * item.rate);
          }
        }
      } else if (field === 'area_sqft') {
        if (item.rate) {
          item.amount = Math.round((Number(value) || 0) * item.rate);
        }
      } else if (field === 'rate') {
        const qty = item.is_lumpsum ? 1 : Number(item.area_sqft || 0);
        item.amount = Math.round(qty * (Number(value) || 0));
      }

      next[index] = item;
      return next;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        section: 'Extra Work',
        item_name: '',
        is_lumpsum: false,
        length_ft: null,
        width_ft: null,
        area_sqft: 0,
        unit: 'sqft',
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const handleDeleteItem = (index: number) => {
    if (items.length <= 1) {
      showToast('error', 'Bill must have at least one line item');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Save handler
  const handleSaveFinalBill = async () => {
    try {
      setSaving(true);
      const payload = {
        items,
        discount_type: discountType,
        discount_value: discountValue,
        gst_rate: gstRate,
        gst_amount: gstAmount,
        final_amount: grandTotal,
        notes,
        lead_id: leadId,
        update_project_budget: true,
      };

      const res = await fetch(`/api/projects/${projectId}/final-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save final bill');
      }

      showToast('success', 'Final bill saved & project contract budget updated!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving final bill:', err);
      showToast('error', err.message || 'Error saving final bill');
    } finally {
      setSaving(false);
    }
  };

  // Download PDF handler
  const handleDownloadPDF = () => {
    downloadFinalBillPDF({
      projectTitle,
      customerName,
      items,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      taxableAmount,
      gstRate,
      gstAmount,
      grandTotal,
      totalCollected,
      netBalanceDue,
      notes,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-gray-100 overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-between border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30">
                <FiFileText className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-bold">
                Final Bill & Settlement
              </h2>
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              Project: <span className="font-semibold text-white">{projectTitle}</span>
              {customerName ? ` (${customerName})` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex-1 p-12 text-center text-gray-500 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-yellow-500 mb-3" />
            <p className="text-sm font-medium">Fetching quotation and items from CRM...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Top 4 KPI Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Baseline Contract</span>
                <span className="text-sm sm:text-base font-black text-gray-900 block mt-0.5">
                  ₹{baselineBudget.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-800 block">Final Bill Total</span>
                <span className="text-sm sm:text-base font-black text-amber-700 block mt-0.5">
                  ₹{grandTotal.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Received</span>
                <span className="text-sm sm:text-base font-black text-emerald-600 block mt-0.5">
                  ₹{totalCollected.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-200">
                <span className="text-[10px] uppercase font-bold text-purple-800 block">Net Balance Due</span>
                <span className="text-sm sm:text-base font-black text-purple-700 block mt-0.5">
                  ₹{netBalanceDue.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Editable Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wider">
                  Bill Line Items ({items.length})
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  <span>Add Extra Work / Item</span>
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full text-left text-xs text-gray-700 min-w-[700px]">
                  <thead className="bg-gray-100/80 text-gray-700 uppercase font-bold border-b border-gray-200 text-[11px]">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-center">#</th>
                      <th className="px-3 py-2.5 w-32">Section</th>
                      <th className="px-3 py-2.5 min-w-[200px]">Description of Work</th>
                      <th className="px-2 py-2.5 w-20 text-center">L (ft)</th>
                      <th className="px-2 py-2.5 w-20 text-center">W (ft)</th>
                      <th className="px-2 py-2.5 w-24 text-center">Area/Qty</th>
                      <th className="px-3 py-2.5 w-24 text-right">Rate (₹)</th>
                      <th className="px-3 py-2.5 w-28 text-right">Amount (₹)</th>
                      <th className="px-2 py-2.5 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-yellow-50/20 transition-colors">
                        <td className="px-3 py-2 text-center text-gray-400 font-bold">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={it.section || ''}
                            placeholder="Section"
                            onChange={(e) => handleItemChange(idx, 'section', e.target.value)}
                            className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-yellow-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={it.item_name}
                            required
                            placeholder="Item description"
                            onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                            className="w-full px-2.5 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-medium focus:ring-1 focus:ring-yellow-500"
                          />
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <input
                            type="number"
                            step="any"
                            value={it.length_ft ?? ''}
                            placeholder="L"
                            disabled={it.is_lumpsum}
                            onChange={(e) => handleItemChange(idx, 'length_ft', e.target.value === '' ? null : parseFloat(e.target.value))}
                            className="w-full text-center px-1 py-1 bg-gray-50 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-yellow-500 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <input
                            type="number"
                            step="any"
                            value={it.width_ft ?? ''}
                            placeholder="W"
                            disabled={it.is_lumpsum}
                            onChange={(e) => handleItemChange(idx, 'width_ft', e.target.value === '' ? null : parseFloat(e.target.value))}
                            className="w-full text-center px-1 py-1 bg-gray-50 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-yellow-500 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <input
                            type="number"
                            step="any"
                            value={it.area_sqft || ''}
                            placeholder="Area"
                            onChange={(e) => handleItemChange(idx, 'area_sqft', parseFloat(e.target.value) || 0)}
                            className="w-full text-center px-1.5 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-semibold focus:ring-1 focus:ring-yellow-500"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            step="any"
                            value={it.rate || ''}
                            placeholder="Rate"
                            onChange={(e) => handleItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                            className="w-full text-right px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-semibold focus:ring-1 focus:ring-yellow-500"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            step="any"
                            value={it.amount || ''}
                            onChange={(e) => handleItemChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                            className="w-full text-right px-2 py-1 bg-yellow-50/70 border border-yellow-300 rounded text-xs font-bold text-gray-900 focus:ring-1 focus:ring-yellow-500"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Item"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50/70 border-t border-gray-200">
                    <tr>
                      <td colSpan={9} className="p-2.5">
                        <button
                          type="button"
                          onClick={handleAddItem}
                          className="w-full py-2.5 px-4 border-2 border-dashed border-yellow-400 hover:border-yellow-600 bg-yellow-50/70 hover:bg-yellow-100 text-yellow-950 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                        >
                          <FiPlus className="w-4 h-4 text-yellow-700" />
                          <span>+ Add Extra Work / Variation Item to Bottom</span>
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Discounts, Taxes & Final Settlement Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/80 p-4 rounded-xl border border-gray-200">
              {/* Left Column: Adjustments & Notes */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Discount Type
                    </label>
                    <select
                      value={discountType}
                      onChange={(e: any) => setDiscountType(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                    >
                      <option value="none">No Discount</option>
                      <option value="flat">Flat Amount (₹)</option>
                      <option value="percent">Percentage (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Discount Value
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      disabled={discountType === 'none'}
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      placeholder={discountType === 'percent' ? 'e.g. 5' : 'e.g. 25000'}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    GST Rate
                  </label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                  >
                    <option value="0">0% (Exclusive / None)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Remarks / Final Settlement Notes
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Includes extra wardrobe and balcony ceiling variations"
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Right Column: Calculated Totals */}
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex flex-col justify-between space-y-2">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Items Subtotal:</span>
                    <span className="font-semibold text-gray-800">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount ({discountType === 'percent' ? `${discountValue}%` : 'Flat'}):</span>
                      <span className="font-semibold">- ₹{Math.round(discountAmount).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {gstAmount > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>GST ({gstRate}%):</span>
                      <span className="font-semibold text-gray-800">+ ₹{gstAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-sm font-black text-gray-900">GRAND TOTAL:</span>
                    <span className="text-base font-black text-yellow-600">
                      ₹{grandTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-dashed border-gray-200 text-xs space-y-1">
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Payments Received:</span>
                    <span>₹{totalCollected.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-amber-700 font-bold text-sm pt-1">
                    <span>Net Balance to Pay:</span>
                    <span>₹{netBalanceDue.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={loading || items.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <FiDownload className="w-3.5 h-3.5 text-yellow-600" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={handleSaveFinalBill}
              disabled={loading || saving || items.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-950 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <FiSave className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save & Update Contract Budget'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
