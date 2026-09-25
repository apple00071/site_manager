'use client';

import { useState, useEffect } from 'react';
import { 
  FiX, 
  FiUpload, 
  FiCheck, 
  FiLoader, 
  FiCalendar, 
  FiTag,
  FiFileText,
  FiShoppingBag
} from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';
import { useToast } from '@/components/ui/Toast';
import BottomSheet from '@/components/ui/BottomSheet';
import { uploadFile } from '@/lib/uploadUtils';

export interface ProjectOption {
  id: string;
  title: string;
  customer_name?: string | null;
}

interface RecordExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultProjectId?: string;
  projectsList?: ProjectOption[];
}

export default function RecordExpenseModal({
  isOpen,
  onClose,
  onSuccess,
  defaultProjectId,
  projectsList = [],
}: RecordExpenseModalProps) {
  const { showToast } = useToast();

  const [projects, setProjects] = useState<ProjectOption[]>(projectsList);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [projectId, setProjectId] = useState<string>(defaultProjectId || '');
  const [itemName, setItemName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [datePurchased, setDatePurchased] = useState<string>(new Date().toISOString().split('T')[0]);
  const [billUrls, setBillUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');

  const [uploadingBill, setUploadingBill] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Responsive device check
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync defaultProjectId when opened
  useEffect(() => {
    if (!isOpen) return;

    setProjectId(defaultProjectId || (projectsList.length > 0 ? projectsList[0].id : ''));
    setItemName('');
    setAmount('');
    setDatePurchased(new Date().toISOString().split('T')[0]);
    setBillUrls([]);
    setNotes('');

    if (projectsList.length === 0) {
      fetchProjects();
    } else {
      setProjects(projectsList);
    }
  }, [isOpen, defaultProjectId, projectsList]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const res = await fetch('/api/admin/projects');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.projects || [];
        setProjects(list.map((p: any) => ({
          id: p.id,
          title: p.title,
          customer_name: p.customer_name,
        })));
      }
    } catch (err) {
      console.error('Failed to load projects for expense modal:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingBill(true);
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadedUrl = await uploadFile(file, 'inventory-bills', 'bills');
        if (uploadedUrl) {
          newUrls.push(uploadedUrl);
        }
      }
      setBillUrls(prev => [...prev, ...newUrls]);
      showToast('success', 'Bill / receipt uploaded');
    } catch (err: any) {
      console.error('Bill upload failed:', err);
      showToast('error', err.message || 'Failed to upload bill');
    } finally {
      setUploadingBill(false);
      e.target.value = '';
    }
  };

  const removeBill = (urlToRemove: string) => {
    setBillUrls(prev => prev.filter(u => u !== urlToRemove));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!projectId) {
      showToast('error', 'Please select a project');
      return;
    }

    if (!itemName.trim()) {
      showToast('error', 'Please enter an expense description / item name');
      return;
    }

    const parsedAmt = parseFloat(amount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      showToast('error', 'Please enter a valid expense amount');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/inventory-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          item_name: itemName.trim(),
          total_cost: parsedAmt,
          date_purchased: datePurchased || undefined,
          bill_urls: billUrls,
          is_expense: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record expense');
      }

      showToast('success', 'Site expense recorded successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving expense:', err);
      showToast('error', err.message || 'Failed to record expense');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedProj = projects.find(p => p.id === projectId);
  const parsedAmount = parseFloat(amount);
  const isLakhs = !isNaN(parsedAmount) && parsedAmount >= 100000;

  // Form Fields
  const renderFields = () => (
    <div className="space-y-4">
      {/* Project Selector */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
          <span>Project <span className="text-red-500">*</span></span>
        </label>
        {defaultProjectId && selectedProj ? (
          <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl text-sm">
            <span className="font-bold text-gray-900 block truncate">{selectedProj.title}</span>
            {selectedProj.customer_name && (
              <span className="text-xs text-purple-700 block mt-0.5">Client: {selectedProj.customer_name}</span>
            )}
          </div>
        ) : (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            disabled={loadingProjects}
            className="w-full px-3.5 py-2.5 bg-gray-50 hover:bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium"
          >
            <option value="">-- Select Project --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} {p.customer_name ? `(${p.customer_name})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Expense Name & Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5">
            Expense / Item Description <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. 18mm Marine Plywood, Hardware, Labor advance"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-gray-50 hover:bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
            <span>Amount (₹) <span className="text-red-500">*</span></span>
            {isLakhs && (
              <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                ₹{(parsedAmount / 100000).toFixed(2)}L
              </span>
            )}
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
            <input
              type="number"
              step="any"
              min="0"
              required
              placeholder="e.g. 15000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-8 pr-3.5 py-2.5 bg-gray-50 hover:bg-white border border-gray-300 rounded-xl text-sm font-black text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Date Incurred */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5">
          Date Incurred <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          required
          value={datePurchased}
          onChange={(e) => setDatePurchased(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-gray-50 hover:bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
        />
      </div>

      {/* Bill / Invoice Receipt Upload */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5">
          Bill / Invoice Photo / PDF (Optional)
        </label>
        {billUrls.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {billUrls.map((url, idx) => (
              <div key={idx} className="relative group bg-gray-50 border border-gray-200 rounded-lg p-1.5 flex items-center gap-2 text-xs">
                <FiFileText className="w-4 h-4 text-purple-600" />
                <a href={url} target="_blank" rel="noreferrer" className="text-purple-700 hover:underline max-w-[140px] truncate">
                  Bill #{idx + 1}
                </a>
                <button
                  type="button"
                  onClick={() => removeBill(url)}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 hover:border-purple-500 rounded-xl cursor-pointer bg-gray-50/70 hover:bg-purple-50/30 transition-all text-gray-600">
          {uploadingBill ? (
            <>
              <FiLoader className="w-4 h-4 animate-spin text-purple-600" />
              <span className="text-xs font-bold text-purple-700">Uploading bill...</span>
            </>
          ) : (
            <>
              <FiUpload className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium">Upload bill / invoice receipt</span>
            </>
          )}
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={handleFileUpload}
            disabled={uploadingBill}
            className="hidden"
          />
        </label>
      </div>

      {/* Notes / Remarks */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5">
          Notes / Remarks (Optional)
        </label>
        <textarea
          rows={2}
          placeholder="Any additional remarks..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3.5 py-2 bg-gray-50 hover:bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
        />
      </div>
    </div>
  );

  // Mobile Bottom Sheet
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title="Add Site Expense"
        maxHeight="90vh"
        footer={
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={submitting || uploadingBill}
              className="flex-2 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {submitting && <FiLoader className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Expense</span>
            </button>
          </div>
        }
      >
        <div className="pb-4">
          {renderFields()}
        </div>
      </BottomSheet>
    );
  }

  // Desktop Centered Modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <FiShoppingBag className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-gray-900">
              Add Site Expense
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form id="record-expense-desktop-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          {renderFields()}
        </form>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs text-gray-500">
            {amount && parsedAmount > 0 ? (
              <span className="flex items-center gap-1.5">
                <span>Expense amount:</span>
                <strong className="text-purple-700 font-bold text-sm">₹{parsedAmount.toLocaleString('en-IN')}</strong>
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="record-expense-desktop-form"
              disabled={submitting || uploadingBill}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors disabled:opacity-60 cursor-pointer shadow-xs"
            >
              {submitting && <FiLoader className="w-4 h-4 animate-spin" />}
              <span>Save Expense</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
