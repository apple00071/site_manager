'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { FiBriefcase, FiUser, FiPhone, FiMail, FiMapPin, FiCreditCard, FiCheck, FiLoader, FiTag, FiPlus, FiTrash2, FiUpload, FiFileText, FiX } from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';

export interface VendorDocument {
  name: string;
  url: string;
}

export interface Vendor {
  id?: string;
  name: string;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  vendor_type?: string | null;
  trade_category?: string | null;
  wage_type?: string | null;
  daily_wage?: number | null;
  upi_id?: string | null;
  rating?: number | null;
  gst_number?: string | null;
  pan_number?: string | null;
  id_proof_url?: string | null;
  documents?: VendorDocument[] | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

interface VendorRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (vendor: Vendor) => void;
  initialData?: Vendor | null;
}

const TRADE_CATEGORIES = [
  'Carpentry & Woodwork',
  'Civil & Masonry',
  'Electrical',
  'Plumbing & Sanitary',
  'Painting & Polishing',
  'False Ceiling & POP',
  'Tile & Marble',
  'Glass & Aluminum',
  'Fabrication & Metalwork',
  'HVAC & Air Conditioning',
  'Modular Kitchen & Wardrobes',
  'Deep Cleaning',
  'Material Supply',
  'General Contracting',
  'Other Services',
];

const VENDOR_TYPES = [
  { value: 'subcontractor', label: 'Subcontractor / Contractor' },
  { value: 'material_supplier', label: 'Material Supplier / Vendor' },
  { value: 'service_partner', label: 'Service Partner / Specialist' },
];

const WAGE_TAG = '__wage_rates__:';
const NOTES_TAG = '\n__notes__:';

function parseWageAndNotes(raw: string | null | undefined): {
  entries: { type: string; rate: string }[];
  userNotes: string;
} {
  const str = raw || '';
  if (!str.startsWith(WAGE_TAG)) return { entries: [], userNotes: str };
  const notesIdx = str.indexOf(NOTES_TAG);
  const wagePart = notesIdx >= 0 ? str.slice(WAGE_TAG.length, notesIdx) : str.slice(WAGE_TAG.length);
  const userNotes = notesIdx >= 0 ? str.slice(notesIdx + NOTES_TAG.length) : '';
  try {
    const parsed = JSON.parse(wagePart);
    if (Array.isArray(parsed) && parsed.length > 0) return { entries: parsed, userNotes };
  } catch (_) {}
  return { entries: [], userNotes };
}

export function VendorRegistrationModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: VendorRegistrationModalProps) {
  const isEditing = !!initialData?.id;

  const [formData, setFormData] = useState<Vendor>({
    name: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    vendor_type: 'subcontractor',
    trade_category: 'Carpentry & Woodwork',
    upi_id: '',
    gst_number: '',
    pan_number: '',
    id_proof_url: '',
    address: '',
    city: '',
    state: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    notes: '',
    is_active: true,
  });

  const [wageEntries, setWageEntries] = useState<{ type: string; rate: string }[]>([
    { type: '', rate: '' },
  ]);

  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const docInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingDoc(true);
    setError(null);

    const newDocs: VendorDocument[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const data = new FormData();
        data.append('file', file);
        data.append('bucket', 'project-update-photos');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: data,
        });

        const json = await res.json();
        if (!res.ok || !json.url) {
          throw new Error(json.error || `Failed to upload ${file.name}`);
        }

        newDocs.push({
          name: file.name.replace(/\.[^/.]+$/, ''),
          url: json.url,
        });
      }

      setDocuments(prev => [...prev, ...newDocs]);
    } catch (err: any) {
      console.error('Document upload error:', err);
      setError(err.message || 'Document upload failed');
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const removeDoc = (idx: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== idx));
  };

  const updateDocName = (idx: number, name: string) => {
    setDocuments(prev => prev.map((d, i) => (i === idx ? { ...d, name } : d)));
  };

  useEffect(() => {
    if (initialData) {
      const { entries, userNotes } = parseWageAndNotes(initialData.notes);
      setWageEntries(
        entries.length > 0
          ? entries
          : initialData.wage_type
          ? [{ type: initialData.wage_type, rate: String(initialData.daily_wage || '') }]
          : [{ type: '', rate: '' }]
      );
      if (initialData.documents && Array.isArray(initialData.documents) && initialData.documents.length > 0) {
        setDocuments(initialData.documents);
      } else if (initialData.id_proof_url) {
        setDocuments([{ name: 'Document / ID Proof', url: initialData.id_proof_url }]);
      } else {
        setDocuments([]);
      }
      setFormData({
        ...initialData,
        vendor_type: initialData.vendor_type || 'subcontractor',
        trade_category: initialData.trade_category || 'Carpentry & Woodwork',
        id_proof_url: initialData.id_proof_url || '',
        is_active: initialData.is_active !== undefined ? initialData.is_active : true,
        notes: userNotes,
      });
    } else {
      setWageEntries([{ type: '', rate: '' }]);
      setDocuments([]);
      setFormData({
        name: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        vendor_type: 'subcontractor',
        trade_category: 'Carpentry & Woodwork',
        upi_id: '',
        gst_number: '',
        pan_number: '',
        id_proof_url: '',
        address: '',
        city: '',
        state: '',
        bank_name: '',
        bank_account_number: '',
        bank_ifsc: '',
        notes: '',
        is_active: true,
      });
    }
    setError(null);
  }, [initialData, isOpen]);

  const handleChange = (field: keyof Vendor, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateEntry = (i: number, field: 'type' | 'rate', val: string) => {
    setWageEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  };

  const addEntry = () => setWageEntries(prev => [...prev, { type: '', rate: '' }]);
  const removeEntry = (i: number) => setWageEntries(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setError('Company / Vendor Name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = '/api/suppliers';
      const method = isEditing ? 'PATCH' : 'POST';

      const validEntries = wageEntries.filter(e => e.type.trim());
      const primary = validEntries[0] || { type: '', rate: '' };
      const userNotes = formData.notes?.trim() || '';
      const notesStr = validEntries.length > 0
        ? `${WAGE_TAG}${JSON.stringify(validEntries)}${userNotes ? `${NOTES_TAG}${userNotes}` : ''}`
        : userNotes;

      const payload = {
        ...(isEditing ? { ...formData, id: initialData?.id } : formData),
        wage_type: primary.type || null,
        daily_wage: Number(primary.rate) || 0,
        notes: notesStr,
        id_proof_url: documents[0]?.url || null,
        documents: documents,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to save vendor');
      }

      onSuccess(data.supplier || formData);
      onClose();
    } catch (err: any) {
      console.error('Error saving vendor:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Vendor / Subcontractor' : 'Register Vendor / Subcontractor'}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Section 1: Business & Category */}
        <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <FiBriefcase className="text-yellow-600" /> Business Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Vendor / Agency / Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Royal Woodworks & Interiors"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Vendor Type</label>
              <select
                value={formData.vendor_type || 'subcontractor'}
                onChange={(e) => handleChange('vendor_type', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                {VENDOR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Primary Trade / Specialty</label>
              <select
                value={formData.trade_category || 'Carpentry & Woodwork'}
                onChange={(e) => handleChange('trade_category', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                {TRADE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Contact Information */}
        <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <FiUser className="text-yellow-600" /> Key Contact Person
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contact_name || ''}
                onChange={(e) => handleChange('contact_name', e.target.value)}
                placeholder="e.g. Ramesh Sharma"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={formData.contact_phone || ''}
                onChange={(e) => handleChange('contact_phone', e.target.value)}
                placeholder="e.g. +91 9876543210"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.contact_email || ''}
                onChange={(e) => handleChange('contact_email', e.target.value)}
                placeholder="e.g. vendor@example.com"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Wage Rates (multi-rate, same as Worker form) */}
        <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <TbCurrencyRupee className="text-yellow-600 text-sm" /> Wage Rates
            </h3>
            <button
              type="button"
              onClick={addEntry}
              className="flex items-center gap-1 text-xs font-semibold text-yellow-700 hover:text-yellow-900 bg-yellow-50 hover:bg-yellow-100 px-2.5 py-1 rounded-lg transition"
            >
              <FiPlus className="w-3.5 h-3.5" /> Add Rate
            </button>
          </div>

          <div className="space-y-2">
            {wageEntries.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={entry.type}
                  onChange={e => updateEntry(i, 'type', e.target.value)}
                  placeholder="e.g. 2BHK, Per Sqft, Daily…"
                  className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <div className="relative w-36">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-sm pointer-events-none">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={entry.rate}
                    onChange={e => updateEntry(i, 'rate', e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                {wageEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEntry(i)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* UPI ID kept in this section */}
          <div className="pt-1">
            <label className="block text-xs font-semibold text-gray-700 mb-1">UPI ID (VPA)</label>
            <input
              type="text"
              value={formData.upi_id || ''}
              onChange={(e) => handleChange('upi_id', e.target.value)}
              placeholder="e.g. 9876543210@upi"
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
        </div>

        {/* Section 4: Compliance & Tax */}
        <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <FiTag className="text-yellow-600" /> Tax & Identification
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">GSTIN Number</label>
              <input
                type="text"
                value={formData.gst_number || ''}
                onChange={(e) => handleChange('gst_number', e.target.value.toUpperCase())}
                placeholder="29ABCDE1234F1Z5"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">PAN Number</label>
              <input
                type="text"
                value={formData.pan_number || ''}
                onChange={(e) => handleChange('pan_number', e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 uppercase"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Street address, Industrial area, etc."
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="e.g. Bangalore"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={formData.state || ''}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="e.g. Karnataka"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div className="md:col-span-2 pt-2 border-t border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-700">
                  Documents & ID Proofs ({documents.length})
                </label>
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  disabled={uploadingDoc}
                  className="px-2.5 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 hover:bg-yellow-200 rounded-md flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                >
                  {uploadingDoc ? <FiLoader className="animate-spin text-yellow-700" /> : <FiPlus />}
                  Add Document
                </button>
              </div>

              <input
                type="file"
                ref={docInputRef}
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFilesSelected}
              />

              {documents.length === 0 ? (
                <div
                  onClick={() => docInputRef.current?.click()}
                  className="p-3.5 border border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:bg-gray-50 hover:border-yellow-400 transition"
                >
                  <FiUpload className="mx-auto text-gray-400 mb-1 text-base" />
                  <span className="text-xs text-gray-500 block">
                    Click to upload documents (GST, PAN, Trade License, Agreement, etc. - PDF or Images)
                  </span>
                  <span className="text-[11px] text-gray-400 block mt-0.5">
                    You can select multiple files at once
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg text-xs hover:border-gray-300 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                        <FiFileText className="text-yellow-600 flex-shrink-0" />
                        <input
                          type="text"
                          value={doc.name}
                          onChange={(e) => updateDocName(idx, e.target.value)}
                          placeholder="Document title"
                          className="font-medium text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-yellow-500 focus:outline-none flex-1 truncate py-0.5"
                          title="Click to rename document"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-yellow-700 hover:text-yellow-800 underline flex items-center gap-1 font-medium"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => removeDoc(idx)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded transition cursor-pointer"
                          title="Remove document"
                        >
                          <FiX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 5: Bank Details */}
        <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <FiCreditCard className="text-yellow-600" /> Banking & Payout Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={formData.bank_name || ''}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                placeholder="e.g. HDFC Bank"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Account Number</label>
              <input
                type="text"
                value={formData.bank_account_number || ''}
                onChange={(e) => handleChange('bank_account_number', e.target.value)}
                placeholder="Account number"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">IFSC Code</label>
              <input
                type="text"
                value={formData.bank_ifsc || ''}
                onChange={(e) => handleChange('bank_ifsc', e.target.value.toUpperCase())}
                placeholder="HDFC0001234"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 uppercase"
              />
            </div>
          </div>
        </div>

        {/* Section 6: Notes & Status */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notes / Terms</label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes, payment terms, or specialty notes..."
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="vendor_is_active"
              checked={formData.is_active}
              onChange={(e) => handleChange('is_active', e.target.checked)}
              className="h-4 w-4 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500"
            />
            <label htmlFor="vendor_is_active" className="text-sm font-medium text-gray-700">
              Active Vendor (Can be assigned to new projects and contract workers)
            </label>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || uploadingDoc}
            className="px-5 py-2 text-sm font-semibold text-white bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            {loading && <FiLoader className="animate-spin h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Register Vendor'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
