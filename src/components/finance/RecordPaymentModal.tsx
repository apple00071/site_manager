'use client';

import { useState, useEffect } from 'react';
import { FiX, FiUpload, FiCheck, FiLoader, FiDollarSign, FiCalendar, FiFileText, FiTag } from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import { uploadFile } from '@/lib/uploadUtils';

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

const COMMON_MILESTONES = [
  'Booking Advance',
  '2D/3D Design Approval',
  'Material at Site',
  'Carpentry Work 50%',
  'Finishing & Painting',
  'Final Handover',
];

const PAYMENT_MODES = [
  'Bank Transfer',
  'UPI',
  'Cheque',
  'Cash',
  'Credit / Debit Card',
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
  const [milestoneName, setMilestoneName] = useState<string>('Booking Advance');
  const [paymentMode, setPaymentMode] = useState<string>('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch projects list if not provided and not inside a specific project
  useEffect(() => {
    if (!isOpen) return;

    if (editingPayment) {
      setProjectId(editingPayment.project_id || '');
      setAmount(editingPayment.amount?.toString() || '');
      setPaymentDate(editingPayment.payment_date || new Date().toISOString().split('T')[0]);
      setMilestoneName(editingPayment.milestone_name || 'Booking Advance');
      setPaymentMode(editingPayment.payment_mode || 'Bank Transfer');
      setReferenceNumber(editingPayment.reference_number || '');
      setInvoiceNumber(editingPayment.invoice_number || '');
      setReceiptUrl(editingPayment.receipt_url || '');
      setNotes(editingPayment.notes || '');
    } else {
      setProjectId(defaultProjectId || '');
      setAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setMilestoneName('Booking Advance');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      showToast('error', 'Please select a project');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      showToast('error', 'Please enter a valid payment amount');
      return;
    }
    if (!milestoneName.trim()) {
      showToast('error', 'Please specify the milestone name');
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

      showToast('success', editingPayment ? 'Payment updated successfully' : 'Client payment recorded successfully');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {editingPayment ? 'Edit Client Payment' : 'Record Client Payment'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Log incoming milestone collections from the client
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Project Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Project <span className="text-red-500">*</span>
            </label>
            {defaultProjectId && selectedProj ? (
              <div className="p-3 bg-yellow-50/60 border border-yellow-200/60 rounded-xl text-sm">
                <span className="font-semibold text-gray-900">{selectedProj.title}</span>
                {selectedProj.customer_name && (
                  <span className="text-xs text-gray-500 block mt-0.5">Client: {selectedProj.customer_name}</span>
                )}
                {selectedProj.project_budget && (
                  <span className="text-xs font-medium text-yellow-700 block mt-0.5">
                    Budget: ₹{selectedProj.project_budget.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
            ) : (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
                disabled={Boolean(editingPayment) || loadingProjects}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
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

          {/* Amount & Date in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                Amount Received (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="e.g. 150000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
          </div>

          {/* Milestone Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Milestone / Stage <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_MILESTONES.map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMilestoneName(m)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    milestoneName === m
                      ? 'bg-yellow-500 text-white border-yellow-600 font-semibold shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              type="text"
              required
              placeholder="Or enter custom milestone / purpose"
              value={milestoneName}
              onChange={(e) => setMilestoneName(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
          </div>

          {/* Payment Mode & Reference Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              >
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                Ref / UTR / Cheque #
              </label>
              <input
                type="text"
                placeholder="e.g. UTR12345678"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
          </div>

          {/* Invoice # (Optional) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Invoice # (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. INV-2026-001"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
          </div>

          {/* Receipt / Proof Upload */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Payment Receipt / Screenshot
            </label>
            {receiptUrl ? (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-2 truncate">
                  <FiCheck className="w-4 h-4 text-green-600 shrink-0" />
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-green-700 underline truncate hover:text-green-800"
                  >
                    View uploaded receipt
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiptUrl('')}
                  className="text-xs text-red-600 hover:text-red-700 font-medium shrink-0 ml-2"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 hover:border-yellow-500 rounded-xl cursor-pointer bg-gray-50/50 hover:bg-yellow-50/30 transition-all text-gray-600">
                {uploadingReceipt ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-700">Uploading receipt...</span>
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

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Notes / Remarks
            </label>
            <textarea
              rows={2}
              placeholder="Any additional remarks..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingReceipt}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-yellow-600 hover:bg-yellow-700 rounded-xl shadow-md transition-all disabled:opacity-60"
            >
              {submitting && <FiLoader className="w-4 h-4 animate-spin" />}
              {editingPayment ? 'Save Changes' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
