'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import {
  FiUser,
  FiPhone,
  FiTool,
  FiBriefcase,
  FiCreditCard,
  FiShield,
  FiUpload,
  FiLoader,
  FiCheck,
  FiImage,
  FiFileText,
  FiX,
  FiAlertCircle,
} from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';

export interface ContractWorker {
  id?: string;
  vendor_id?: string | null;
  full_name: string;
  phone: string;
  secondary_phone?: string | null;
  trade: string;
  skill_level: 'Helper' | 'Semi-Skilled' | 'Skilled' | 'Master / Foreman';
  wage_type: string;
  daily_wage: number;
  aadhaar_number?: string | null;
  id_proof_url?: string | null;
  photo_url?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  upi_id?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  assigned_project_id?: string | null;
  is_active?: boolean;
  notes?: string | null;
  vendor?: {
    id: string;
    name: string;
    contact_phone?: string | null;
    trade_category?: string | null;
  } | null;
  assigned_project?: {
    id: string;
    title: string;
    status?: string | null;
  } | null;
}

interface WorkerRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (worker: ContractWorker) => void;
  initialData?: ContractWorker | null;
  vendors: Array<{ id?: string; name: string; trade_category?: string | null }>;
  projects: Array<{ id: string; title: string }>;
}

const TRADE_PRESETS = [
  'Carpentry',
  'Electrical',
  'Plumbing',
  'Painting & Polish',
  'Civil & Masonry',
  'Tile & Marble',
  'False Ceiling / POP',
  'Glass & Aluminum',
  'HVAC & AC',
  'Fabrication',
  'Modular Assembly',
  'Deep Cleaning',
  'General Labor',
  'Site Supervisor',
];

const SKILL_LEVELS = ['Helper', 'Semi-Skilled', 'Skilled', 'Master / Foreman'] as const;
const WAGE_TYPE_PRESETS = ['Daily Basis', 'Hourly Basis', 'Monthly Salary', 'Piece Rate', 'Weekly', 'Contract Lump Sum'];

export function WorkerRegistrationModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  vendors,
  projects,
}: WorkerRegistrationModalProps) {
  const isEditing = !!initialData?.id;

  const [formData, setFormData] = useState<Partial<ContractWorker>>({
    vendor_id: null,
    full_name: '',
    phone: '',
    secondary_phone: '',
    trade: 'Carpentry',
    skill_level: 'Skilled',
    wage_type: 'Daily Basis',
    daily_wage: 0,
    aadhaar_number: '',
    id_proof_url: '',
    photo_url: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    upi_id: '',
    address: '',
    assigned_project_id: null,
    is_active: true,
    notes: '',
  });

  // Multiple wage rates state
  const [wageEntries, setWageEntries] = useState<{ type: string; rate: string }[]>([{ type: 'Daily Basis', rate: '' }]);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      // Parse wage rates and real user notes out of the combined notes string
      let parsedEntries: { type: string; rate: string }[] | null = null;
      const notesStr = initialData.notes || '';
      const WAGE_TAG = '__wage_rates__:';
      const NOTES_TAG = '\n__notes__:';
      let cleanNotes = notesStr;
      if (notesStr.startsWith(WAGE_TAG)) {
        const notesTagIdx = notesStr.indexOf(NOTES_TAG);
        const wagePart = notesTagIdx >= 0 ? notesStr.slice(WAGE_TAG.length, notesTagIdx) : notesStr.slice(WAGE_TAG.length);
        cleanNotes = notesTagIdx >= 0 ? notesStr.slice(notesTagIdx + NOTES_TAG.length) : '';
        try { parsedEntries = JSON.parse(wagePart); } catch (_) {}
      }
      setWageEntries(
        parsedEntries?.length
          ? parsedEntries
          : [{ type: initialData.wage_type || 'Daily Basis', rate: String(initialData.daily_wage || '') }]
      );
      setFormData({
        ...initialData,
        vendor_id: initialData.vendor_id || null,
        assigned_project_id: initialData.assigned_project_id || null,
        skill_level: initialData.skill_level || 'Skilled',
        wage_type: initialData.wage_type || 'Daily Basis',
        daily_wage: initialData.daily_wage || 0,
        is_active: initialData.is_active !== undefined ? initialData.is_active : true,
        notes: cleanNotes,
      });
    } else {
      setWageEntries([{ type: 'Daily Basis', rate: '' }]);
      setFormData({
        vendor_id: null,
        full_name: '',
        phone: '',
        secondary_phone: '',
        trade: 'Carpentry',
        skill_level: 'Skilled',
        wage_type: 'Daily Basis',
        daily_wage: 0,
        aadhaar_number: '',
        id_proof_url: '',
        photo_url: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        bank_name: '',
        bank_account_number: '',
        bank_ifsc: '',
        upi_id: '',
        address: '',
        assigned_project_id: null,
        is_active: true,
        notes: '',
      });
    }
    setError(null);
  }, [initialData, isOpen]);

  const handleChange = (field: keyof ContractWorker, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (file: File, type: 'photo' | 'doc') => {
    const isPhoto = type === 'photo';
    if (isPhoto) setUploadingPhoto(true);
    else setUploadingDoc(true);

    try {
      const data = new FormData();
      data.append('file', file);
      data.append('bucket', 'project-update-photos');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: data,
      });

      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error || 'Failed to upload file');
      }

      if (isPhoto) {
        handleChange('photo_url', json.url);
      } else {
        handleChange('id_proof_url', json.url);
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      setError(err.message || 'File upload failed');
    } finally {
      if (isPhoto) setUploadingPhoto(false);
      else setUploadingDoc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name?.trim()) {
      setError('Worker full name is required');
      return;
    }
    if (!formData.phone?.trim() || formData.phone.trim().length < 10) {
      setError('A valid 10-digit phone number is required');
      return;
    }
    if (!formData.trade?.trim()) {
      setError('Trade category is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = '/api/contract-workers';
      const method = isEditing ? 'PATCH' : 'POST';

      // Serialize wage entries + preserve real user notes
      const validEntries = wageEntries.filter(e => e.type.trim());
      const primary = validEntries[0] || { type: 'Daily Basis', rate: '' };
      const userNotes = formData.notes?.trim() || '';
      const notesStr = validEntries.length > 0
        ? `__wage_rates__:${JSON.stringify(validEntries)}${userNotes ? `\n__notes__:${userNotes}` : ''}`
        : userNotes;

      const payload = {
        ...(isEditing ? { ...formData, id: initialData?.id } : formData),
        wage_type: primary.type,
        daily_wage: Number(primary.rate) || 0,
        notes: notesStr,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to save worker registration');
      }

      onSuccess(data.worker);
      onClose();
    } catch (err: any) {
      console.error('Error saving contract worker:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Contract Worker Details' : 'Register Contract Worker'}
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
            <FiAlertCircle className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Basic Profile & Skill */}
        <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <FiUser className="text-yellow-600" /> Basic Worker Profile
            </h3>

            {/* Photo Avatar Upload */}
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-yellow-500/50 bg-yellow-50 flex items-center justify-center">
                {formData.photo_url ? (
                  <img
                    src={formData.photo_url}
                    alt="Worker"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FiUser className="text-gray-400 text-xl" />
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <FiLoader className="animate-spin text-white text-sm" />
                  </div>
                )}
              </div>
              <div>
                <input
                  type="file"
                  ref={photoInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'photo');
                  }}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="text-xs font-semibold text-yellow-700 hover:text-yellow-800 underline flex items-center gap-1"
                >
                  <FiImage className="text-xs" /> {formData.photo_url ? 'Change Photo' : 'Upload Photo'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.full_name || ''}
                onChange={(e) => handleChange('full_name', e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Primary Phone (10 digits) <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Secondary / Alt Phone</label>
              <input
                type="tel"
                value={formData.secondary_phone || ''}
                onChange={(e) => handleChange('secondary_phone', e.target.value)}
                placeholder="e.g. 9123456780"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Trade / Skill Specialization <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.trade || 'Carpentry'}
                onChange={(e) => handleChange('trade', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                {TRADE_PRESETS.map((trade) => (
                  <option key={trade} value={trade}>
                    {trade}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Skill Level</label>
              <select
                value={formData.skill_level || 'Skilled'}
                onChange={(e) => handleChange('skill_level', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                {SKILL_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Vendor Hierarchy & Project Site Allocation */}
        <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <FiBriefcase className="text-yellow-600" /> Vendor Linkage & Site Allocation
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Contractor / Vendor Agency
              </label>
              <select
                value={formData.vendor_id || ''}
                onChange={(e) => handleChange('vendor_id', e.target.value || null)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 font-medium"
              >
                <option value="">Direct / Independent Worker (No Vendor)</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.trade_category ? `(${v.trade_category})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Link to a registered vendor or leave as Independent Worker.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Assigned Project Site
              </label>
              <select
                value={formData.assigned_project_id || ''}
                onChange={(e) => handleChange('assigned_project_id', e.target.value || null)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option value="">Unassigned (General Worker Pool)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Assign worker to an active project site for immediate deployment.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Wage */}
        <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <TbCurrencyRupee className="text-yellow-600 text-sm" /> Wage Rates
            </h3>
            <button
              type="button"
              onClick={() => setWageEntries(prev => [...prev, { type: '', rate: '' }])}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg transition"
            >
              <FiCreditCard className="w-3 h-3" /> Add Rate
            </button>
          </div>

          <datalist id="wage-type-presets">
            {WAGE_TYPE_PRESETS.map((t) => <option key={t} value={t} />)}
          </datalist>

          <div className="space-y-2">
            {wageEntries.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  list="wage-type-presets"
                  type="text"
                  value={entry.type}
                  onChange={(e) => setWageEntries(prev => prev.map((w, i) => i === idx ? { ...w, type: e.target.value } : w))}
                  placeholder="Wage type (e.g. Daily Basis)"
                  className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <div className="relative w-36 shrink-0">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={entry.rate}
                    onChange={(e) => setWageEntries(prev => prev.map((w, i) => i === idx ? { ...w, rate: e.target.value } : w))}
                    placeholder="Rate"
                    className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                {wageEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setWageEntries(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
                    title="Remove this rate"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {wageEntries.length === 0 && (
            <p className="text-xs text-gray-400 italic">No rates added yet. Click "Add Rate" above.</p>
          )}
        </div>

        {/* Section 4: Identity & Compliance */}
        <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <FiShield className="text-yellow-600" /> Identity, Verification & Emergency Contact
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Aadhaar / National ID Number
              </label>
              <input
                type="text"
                value={formData.aadhaar_number || ''}
                onChange={(e) => handleChange('aadhaar_number', e.target.value)}
                placeholder="e.g. 1234 5678 9012"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ID Proof Document (Aadhaar / Voter ID)
              </label>
              <input
                type="file"
                ref={docInputRef}
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'doc');
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  disabled={uploadingDoc}
                  className="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 shadow-sm"
                >
                  {uploadingDoc ? (
                    <FiLoader className="animate-spin text-yellow-600" />
                  ) : (
                    <FiUpload />
                  )}
                  {formData.id_proof_url ? 'Replace Document' : 'Upload ID Proof'}
                </button>
                {formData.id_proof_url && (
                  <a
                    href={formData.id_proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-yellow-700 hover:text-yellow-800 underline flex items-center gap-1"
                  >
                    <FiFileText /> View
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Emergency Contact Name
              </label>
              <input
                type="text"
                value={formData.emergency_contact_name || ''}
                onChange={(e) => handleChange('emergency_contact_name', e.target.value)}
                placeholder="e.g. Sunita Devi (Wife / Brother)"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Emergency Contact Phone
              </label>
              <input
                type="tel"
                value={formData.emergency_contact_phone || ''}
                onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
                placeholder="e.g. 9876501234"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Address / Native Place</label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Address, village, city, state..."
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Status & Notes */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Remarks & Notes</label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any specific notes, tools provided, health observations..."
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="worker_is_active"
              checked={formData.is_active}
              onChange={(e) => handleChange('is_active', e.target.checked)}
              className="h-4 w-4 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500"
            />
            <label htmlFor="worker_is_active" className="text-sm font-medium text-gray-700">
              Active Worker (Available for site assignment and attendance)
            </label>
          </div>
        </div>

        {/* Actions */}
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
            disabled={loading || uploadingPhoto || uploadingDoc}
            className="px-5 py-2 text-sm font-semibold text-white bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            {loading && <FiLoader className="animate-spin h-4 w-4" />}
            {isEditing ? 'Save Worker Changes' : 'Register Worker'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
