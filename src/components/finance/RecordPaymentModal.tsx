'use client';

import { useState, useEffect, useRef } from 'react';
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
import { uploadFile } from '@/lib/uploadUtils';
import { useToast } from '@/components/ui/Toast';
import BottomSheet from '@/components/ui/BottomSheet';
import { formatDateIST } from '@/lib/dateUtils';
import FinalBillModal from './FinalBillModal';

export interface ProjectOption {
  id: string;
  title: string;
  customer_name?: string | null;
  project_budget?: number | null;
  collected?: number | null;
  pending?: number | null;
}

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultProjectId?: string;
  editingPayment?: any | null;
  projectsList?: ProjectOption[];
  nextSeqNumber?: number;
}


const PAYMENT_MODES = [
  'Bank Transfer',
  'UPI',
  'Cheque',
  'Cash',
  'Credit / Debit Card',
  'Third Party',
];

const COMMON_MILESTONES = [
  { stage: 'Stage 1', name: 'Token Advance', value: 'Stage 1: Token Advance' },
  { stage: 'Stage 2', name: 'Before Start of Work', value: 'Stage 2: Before Start of Work' },
  { stage: 'Stage 3', name: 'Completion of Boxes & Inside Laminate', value: 'Stage 3: Completion of Boxes & Inside Laminate' },
  { stage: 'Stage 4', name: 'Completion of Outside Laminate', value: 'Stage 4: Completion of Outside Laminate' },
  { stage: 'Stage 5', name: 'At Handover', value: 'Stage 5: At Handover' },
];

export default function RecordPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  defaultProjectId,
  editingPayment,
  projectsList,
  nextSeqNumber,
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
  const [isDragging, setIsDragging] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  // Financial balance state for selected project
  const [projectFinancials, setProjectFinancials] = useState<{
    budget: number;
    collected: number;
    pending: number;
    loading: boolean;
  } | null>(null);

  // Final bill modal state
  const [isFinalBillModalOpen, setIsFinalBillModalOpen] = useState(false);

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

  // Sync project financials when projectId changes
  useEffect(() => {
    if (!projectId) {
      setProjectFinancials(null);
      return;
    }

    const proj = projects.find((p) => p.id === projectId);
    if (
      proj &&
      Number(proj.project_budget) > 0 &&
      proj.collected !== undefined &&
      proj.collected !== null &&
      proj.pending !== undefined &&
      proj.pending !== null
    ) {
      setProjectFinancials({
        budget: Number(proj.project_budget) || 0,
        collected: Number(proj.collected) || 0,
        pending: Number(proj.pending) || 0,
        loading: false,
      });
      return;
    }

    let isMounted = true;
    setProjectFinancials((prev) =>
      prev
        ? { ...prev, loading: true }
        : { budget: Number(proj?.project_budget) || 0, collected: 0, pending: 0, loading: true }
    );

    Promise.all([
      fetch(`/api/projects/${projectId}/final-bill`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/projects/${projectId}`).then((r) => (r.ok ? r.json() : { project: null })),
    ])
      .then(([fbData, projData]) => {
        if (!isMounted) return;
        const pList = fbData?.payments || [];
        const totalPaid =
          fbData?.financials?.collected ??
          pList.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        let b = Number(
          fbData?.financials?.budget ||
          projData?.project?.project_budget ||
          proj?.project_budget ||
          0
        );
        const pend = b > 0 ? Math.max(0, b - totalPaid) : 0;
        setProjectFinancials({
          budget: b,
          collected: totalPaid,
          pending: pend,
          loading: false,
        });
      })
      .catch((err) => {
        console.error('Failed to load project financials in modal:', err);
        if (isMounted) {
          setProjectFinancials((prev) => (prev ? { ...prev, loading: false } : null));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [projectId, projects]);

  // Initialize form state when opened or editingPayment changes
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
  }, [isOpen, editingPayment, defaultProjectId]);

  // Keep projects list in sync without resetting form fields
  useEffect(() => {
    if (!isOpen) return;

    if (!projectsList || projectsList.length === 0) {
      fetchProjects();
    } else {
      setProjects(projectsList);
    }
  }, [isOpen, projectsList]);

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

  // Clipboard paste listener to upload screenshots directly (Ctrl+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processAndUploadReceipt(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const processAndUploadReceipt = async (file: File) => {
    try {
      setUploadingReceipt(true);
      const publicUrl = await uploadFile(file, 'inventory-bills', 'client-payments');
      setReceiptUrl(publicUrl);
      showToast('success', 'Receipt uploaded successfully');
    } catch (err: any) {
      console.error('Receipt upload failed:', err);
      showToast('error', err?.message || 'Failed to upload receipt');
    } finally {
      setUploadingReceipt(false);
      if (receiptInputRef.current) {
        receiptInputRef.current.value = '';
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processAndUploadReceipt(file);
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

      showToast('success', editingPayment ? 'Payment updated successfully' : 'Payment recorded successfully');
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
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
          <span>Project</span>
          <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          {projectFinancials && projectFinancials.budget > 0 ? (
            <span className="text-xs font-semibold text-yellow-800 bg-yellow-50 px-2.5 py-1 rounded-lg border border-yellow-200">
              Contract: ₹{projectFinancials.budget.toLocaleString('en-IN')}
            </span>
          ) : null}
          {projectId && (
            <button
              type="button"
              onClick={() => setIsFinalBillModalOpen(true)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              title="Open Final Bill & Adjust Quotation Items"
            >
              <FiFileText className="w-4 h-4 text-yellow-300" />
              <span>Final Bill & Variations</span>
            </button>
          )}
        </div>
      </div>
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

      {/* Project Financial Balance Card */}
      {projectId && projectFinancials && (
        <div className="mt-2.5 p-3.5 bg-gradient-to-br from-gray-50 via-amber-50/20 to-purple-50/30 border border-gray-200 rounded-xl shadow-2xs">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white p-2 rounded-lg border border-gray-200/80 shadow-2xs">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Contract Total</span>
              <span className="text-xs sm:text-sm font-black text-gray-900 block truncate mt-0.5">
                ₹{projectFinancials.budget.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-emerald-200/80 shadow-2xs">
              <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold block">Received</span>
              <span className="text-xs sm:text-sm font-black text-emerald-600 block truncate mt-0.5">
                ₹{projectFinancials.collected.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-amber-300 shadow-2xs bg-amber-50/20">
              <span className="text-[10px] uppercase tracking-wider text-amber-900 font-bold block">Balance to Pay</span>
              <span className="text-xs sm:text-sm font-black text-amber-700 block truncate mt-0.5">
                ₹{projectFinancials.pending.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {parsedAmount > 0 && (
            <div className="mt-2.5 pt-2 border-t border-gray-200/80 flex items-center justify-between py-1.5 px-2 bg-white rounded-lg border border-gray-200 text-xs">
              <span className="font-semibold text-gray-600">Remaining balance after this:</span>
              <span className={`font-black ${projectFinancials.pending - parsedAmount <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                ₹{Math.max(0, projectFinancials.pending - parsedAmount).toLocaleString('en-IN')}
                {projectFinancials.pending - parsedAmount <= 0 && ' (Fully Paid 🎉)'}
              </span>
            </div>
          )}
        </div>
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
        {COMMON_MILESTONES.map((m) => {
          const isSelected =
            milestoneName === m.value ||
            milestoneName === m.name ||
            milestoneName.toLowerCase() === m.value.toLowerCase() ||
            milestoneName.toLowerCase() === m.name.toLowerCase();
          return (
            <button
              type="button"
              key={m.value}
              onClick={() => setMilestoneName(m.value)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-yellow-500 text-gray-950 font-bold border-yellow-600 shadow-xs'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 font-medium'
              }`}
            >
              <span className={`mr-1 text-[11px] ${isSelected ? 'text-gray-950 font-bold' : 'text-gray-500 font-semibold'}`}>
                {m.stage}:
              </span>
              {m.name}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        required
        placeholder="Or type custom purpose (e.g. Stage 1: Token Advance)"
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
      <input
        ref={receiptInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileUpload}
        disabled={uploadingReceipt}
        className="hidden"
      />
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
            onClick={() => {
              setReceiptUrl('');
              if (receiptInputRef.current) receiptInputRef.current.value = '';
            }}
            className="text-xs text-red-600 hover:text-red-700 font-bold shrink-0 ml-2 cursor-pointer"
          >
            Remove
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !uploadingReceipt && receiptInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              !uploadingReceipt && receiptInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) processAndUploadReceipt(file);
          }}
          className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-all select-none ${
            isDragging
              ? 'border-yellow-500 bg-yellow-50 text-yellow-800'
              : 'border-gray-300 hover:border-yellow-500 bg-gray-50/70 hover:bg-yellow-50/30 text-gray-600'
          }`}
        >
          {uploadingReceipt ? (
            <>
              <FiLoader className="w-4 h-4 animate-spin text-yellow-600" />
              <span className="text-xs font-bold text-yellow-700">Uploading receipt...</span>
            </>
          ) : (
            <>
              <FiUpload className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium">Upload receipt / bank screenshot (or paste Ctrl+V)</span>
            </>
          )}
        </div>
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

        {/* 2-Column Form Body (Balanced distribution) */}
        <form id="record-payment-desktop-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left Column: Project, Financial Balance, Amount, Mode & Ref */}
            <div className="space-y-4">
              {renderProjectField()}
              {renderAmountAndDateField()}
              {renderModeAndRefField()}
            </div>

            {/* Right Column: Milestone / Purpose, Invoice #, Receipt, Notes */}
            <div className="space-y-4">
              {renderMilestoneField()}
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

      {/* Final Bill Modal inside payment modal */}
      {selectedProj && isFinalBillModalOpen && (
        <FinalBillModal
          isOpen={isFinalBillModalOpen}
          onClose={() => setIsFinalBillModalOpen(false)}
          projectId={selectedProj.id}
          projectTitle={selectedProj.title}
          customerName={selectedProj.customer_name}
          onSuccess={() => {
            // Re-fetch project finances live
            Promise.all([
              fetch(`/api/finance/payments?projectId=${selectedProj.id}`).then((r) => (r.ok ? r.json() : { payments: [] })),
              fetch(`/api/projects/${selectedProj.id}`).then((r) => (r.ok ? r.json() : { project: null })),
            ]).then(([pData, prData]) => {
              const pList = pData.payments || [];
              const totalPaid = pList.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
              const b = Number(prData.project?.project_budget ?? 0);
              const pend = b > 0 ? Math.max(0, b - totalPaid) : 0;
              setProjectFinancials({
                budget: b,
                collected: totalPaid,
                pending: pend,
                loading: false,
              });
            });
            onSuccess();
          }}
        />
      )}
    </div>
  );
}
