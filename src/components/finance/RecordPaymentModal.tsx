'use client';

import { useState, useEffect } from 'react';
import { 
  FiX, 
  FiUpload, 
  FiCheck, 
  FiLoader, 
  FiCalendar, 
  FiFileText, 
  FiTag,
  FiCreditCard,
  FiHash,
  FiEdit3
} from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';
import { useToast } from '@/components/ui/Toast';
import { uploadFile } from '@/lib/uploadUtils';
import BottomSheet from '@/components/ui/BottomSheet';
import { downloadPaymentReceiptPDF } from '@/lib/reports/paymentReceiptPdfGenerator';

interface ProjectOption {
  id: string;
  title: string;
  customer_name?: string | null;
  project_budget?: number | null;
}

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultProjectId?: string;
  editingPayment?: any | null;
  projectsList?: ProjectOption[];
}


const PAYMENT_MODES = [
  'Bank Transfer',
  'UPI',
  'Cheque',
  'Cash',
  'Credit / Debit Card',
];

const COMMON_MILESTONES = [
  'Booking Advance',
  '2D/3D Design Approval',
  'Material at Site',
  'Carpentry Stage',
  'Final Finishing / Handover',
];

export default function RecordPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  defaultProjectId,
  editingPayment,
  projectsList,
}: RecordPaymentModalProps) {
  const { showToast } = useToast();

  const [projects, setProjects] = useState<ProjectOption[]>(projectsList || []);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [projectId, setProjectId] = useState<string>(defaultProjectId || '');
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [milestoneName, setMilestoneName] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Responsive device check: Mobile uses BottomSheet, Desktop uses 2-column modal
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch projects list if not provided and not inside a specific project
  useEffect(() => {
    if (!isOpen) return;

    if (editingPayment) {
      setProjectId(editingPayment.project_id || '');
      setAmount(editingPayment.amount?.toString() || '');
      setPaymentDate(editingPayment.payment_date || new Date().toISOString().split('T')[0]);
      setMilestoneName(editingPayment.milestone_name || '');
      setPaymentMode(editingPayment.payment_mode || 'Bank Transfer');
      setReferenceNumber(editingPayment.reference_number || '');
      setInvoiceNumber(editingPayment.invoice_number || '');
      setReceiptUrl(editingPayment.receipt_url || '');
      setNotes(editingPayment.notes || '');
    } else {
      setProjectId(defaultProjectId || '');
      setAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setMilestoneName('');
      setPaymentMode('Bank Transfer');
      setReferenceNumber('');
      setInvoiceNumber('');
      setReceiptUrl('');
      setNotes('');
    }

    if (!projectsList || projectsList.length === 0) {
      fetchProjects();
    } else {
      setProjects(projectsList);
    }
  }, [isOpen, editingPayment, defaultProjectId, projectsList]);

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
          project_budget: p.project_budget,
        })));
      }
    } catch (err) {
      console.error('Failed to load projects for payment modal:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingReceipt(true);
      const publicUrl = await uploadFile(file, 'inventory-bills', 'client-payments');
      setReceiptUrl(publicUrl);
      showToast('success', 'Receipt uploaded successfully');
    } catch (err: any) {
      console.error('Receipt upload failed:', err);
      showToast('error', err.message || 'Failed to upload receipt');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!projectId) {
      showToast('error', 'Please select a project');
      return;
    }
    if (!milestoneName.trim()) {
      showToast('error', 'Please enter or select a milestone / purpose');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      showToast('error', 'Please enter a valid payment amount');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        project_id: projectId,
        amount: numAmount,
        payment_date: paymentDate,
        milestone_name: milestoneName.trim(),
        payment_mode: paymentMode,
        reference_number: referenceNumber.trim() || null,
        invoice_number: invoiceNumber.trim() || null,
        receipt_url: receiptUrl || null,
        notes: notes.trim() || null,
      };

      const url = editingPayment
        ? `/api/finance/payments/${editingPayment.id}`
        : '/api/finance/payments';
      const method = editingPayment ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Failed to save payment');
        return;
      }

      const createdPayment = data.payment || {
        ...payload,
        id: data.id,
        project: selectedProj ? { title: selectedProj.title, customer_name: selectedProj.customer_name } : undefined,
      };

      if (!editingPayment) {
        try {
          downloadPaymentReceiptPDF(createdPayment);
        } catch (pdfErr) {
          console.error('Error auto-generating receipt PDF:', pdfErr);
        }
      }

      showToast('success', editingPayment ? 'Payment updated successfully' : 'Payment recorded & official receipt downloaded!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving payment:', err);
      showToast('error', 'Network error while saving payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedProj = projects.find(p => p.id === projectId);
  const parsedAmount = parseFloat(amount);
  const isLakhs = !isNaN(parsedAmount) && parsedAmount >= 100000;

  // --- SHARED FORM FIELDS ---

  // Project selector component
  const renderProjectField = () => (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
        <span>Project <span className="text-red-500">*</span></span>
        {Number(selectedProj?.project_budget) > 0 ? (
          <span className="text-[11px] font-semibold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-md border border-yellow-200">
            Contract: ₹{selectedProj!.project_budget!.toLocaleString('en-IN')}
          </span>
        ) : null}
      </label>
      {defaultProjectId && selectedProj ? (
        <div className="p-3 bg-yellow-50/70 border border-yellow-200/80 rounded-xl text-sm">
          <span className="font-bold text-gray-900 block truncate">{selectedProj.title}</span>
          {selectedProj.customer_name && (
            <span className="text-xs text-gray-500 block mt-0.5">Client: {selectedProj.customer_name}</span>
          )}
        </div>
      ) : (
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          required
          disabled={Boolean(editingPayment) || loadingProjects}
          className="w-full px-3.5 py-2.5 bg-gray-50 hover:bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-medium"
        >
          <option value="">-- Select Project --</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} {p.customer_name ? `(${p.customer_name})` : ''} {p.project_budget ? `— ₹${p.project_budget.toLocaleString('en-IN')}` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  // Milestone / Purpose selector & custom input
  const renderMilestoneField = () => (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
        <span>Milestone / Purpose <span className="text-red-500">*</span></span>
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {COMMON_MILESTONES.map((m) => (
          <button
            type="button"
            key={m}
            onClick={() => setMilestoneName(m)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
              milestoneName === m
                ? 'bg-yellow-500 text-gray-950 font-bold border-yellow-600 shadow-xs'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 font-medium'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <input
        type="text"
        required
        placeholder="Or type custom purpose (e.g. Booking Advance)"
        value={milestoneName}
        onChange={(e) => setMilestoneName(e.target.value)}
        className="w-full px-3.5 py-2.5 bg-gray-50 hover:bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-medium"
      />
    </div>
  );

  // Amount & Date fields
  const renderAmountAndDateField = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
          <span>Amount Received (₹) <span className="text-red-500">*</span></span>
          {isLakhs && (
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
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
            placeholder="e.g. 150000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full pl-8 pr-3.5 py-2.5 bg-gray-50 hover:bg-white border border-gray-300 rounded-xl text-sm font-black text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5">
          Payment Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          required
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-gray-50 hover:bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
        />
      </div>
    </div>
  );

  // Payment Mode & UTR fields
  const renderModeAndRefField = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5">
          Payment Mode
        </label>
        <select
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-gray-50 hover:bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
        >
          {PAYMENT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5">
          Ref / UTR / Cheque #
        </label>
        <input
          type="text"
          placeholder="e.g. UTR12345678"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-gray-50 hover:bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
        />
      </div>
    </div>
  );

  // Invoice Number field
  const renderInvoiceField = () => (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1.5">
        Invoice # (Optional)
      </label>
      <input
        type="text"
        placeholder="e.g. INV-2026-001"
        value={invoiceNumber}
        onChange={(e) => setInvoiceNumber(e.target.value)}
        className="w-full px-3.5 py-2.5 bg-gray-50 hover:bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
      />
    </div>
  );

  // Receipt / Proof upload field
  const renderReceiptField = () => (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1.5">
        Payment Receipt / Screenshot
      </label>
      {receiptUrl ? (
        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-center gap-2 truncate">
            <FiCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <a
              href={receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-700 underline truncate hover:text-emerald-800 font-semibold"
            >
              View uploaded receipt
            </a>
          </div>
          <button
            type="button"
            onClick={() => setReceiptUrl('')}
            className="text-xs text-red-600 hover:text-red-700 font-bold shrink-0 ml-2 cursor-pointer"
          >
            Remove
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 hover:border-yellow-500 rounded-xl cursor-pointer bg-gray-50/70 hover:bg-yellow-50/30 transition-all text-gray-600">
          {uploadingReceipt ? (
            <>
              <FiLoader className="w-4 h-4 animate-spin text-yellow-600" />
              <span className="text-xs font-bold text-yellow-700">Uploading receipt...</span>
            </>
          ) : (
            <>
              <FiUpload className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium">Upload receipt / bank screenshot</span>
            </>
          )}
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileUpload}
            disabled={uploadingReceipt}
            className="hidden"
          />
        </label>
      )}
    </div>
  );

  // Notes field
  const renderNotesField = () => (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1.5">
        Notes / Remarks
      </label>
      <textarea
        rows={2}
        placeholder="Any additional remarks..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full px-3.5 py-2 bg-gray-50 hover:bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
      />
    </div>
  );

  // --- MOBILE VIEW (BOTTOM SHEET) ---
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={editingPayment ? 'Edit Client Payment' : 'Record Client Payment'}
        maxHeight="92vh"
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
              disabled={submitting || uploadingReceipt}
              className="flex-2 py-2.5 text-xs font-bold text-white bg-yellow-500 hover:bg-yellow-600 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {submitting && <FiLoader className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingPayment ? 'Save Changes' : 'Record Payment'}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4 pb-4">
          {renderProjectField()}
          {renderMilestoneField()}
          {renderAmountAndDateField()}
          {renderModeAndRefField()}
          {renderInvoiceField()}
          {renderReceiptField()}
          {renderNotesField()}
        </div>
      </BottomSheet>
    );
  }

  // --- DESKTOP VIEW (SPACIOUS 2-COLUMN MODAL) ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl lg:max-w-4xl overflow-hidden border border-gray-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            {editingPayment ? 'Edit Client Payment' : 'Record Client Payment'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Form Body */}
        <form id="record-payment-desktop-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left Column: Financials & Identifiers */}
            <div className="space-y-4">
              {renderProjectField()}
              {renderMilestoneField()}
              {renderAmountAndDateField()}
              {renderModeAndRefField()}
            </div>

            {/* Right Column: Invoice, Receipt, Notes */}
            <div className="space-y-4">
              {renderInvoiceField()}
              {renderReceiptField()}
              {renderNotesField()}
            </div>
          </div>
        </form>

        {/* Fixed Footer Bar (Zero scroll needed to reach actions) */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs text-gray-500">
            {amount && parsedAmount > 0 ? (
              <span className="flex items-center gap-1.5">
                <span>Recording collection:</span>
                <strong className="text-gray-900 font-bold text-sm">₹{parsedAmount.toLocaleString('en-IN')}</strong>
                {isLakhs && (
                  <span className="text-[11px] font-bold text-gray-700 bg-gray-200/80 px-1.5 py-0.5 rounded">
                    ₹{(parsedAmount / 100000).toFixed(2)} Lakhs
                  </span>
                )}
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
              form="record-payment-desktop-form"
              disabled={submitting || uploadingReceipt}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-yellow-500 hover:bg-yellow-600 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
            >
              {submitting && <FiLoader className="w-4 h-4 animate-spin" />}
              {editingPayment ? 'Save Changes' : 'Record Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
