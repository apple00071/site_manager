'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ContractWorker } from './WorkerRegistrationModal';
import {
  FiUser,
  FiPhone,
  FiTool,
  FiBriefcase,
  FiMapPin,
  FiCreditCard,
  FiShield,
  FiCheckCircle,
  FiXCircle,
  FiEdit2,
  FiTrash2,
  FiCopy,
  FiCheck,
  FiExternalLink,
  FiMessageCircle,
} from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';

interface WorkerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  worker: ContractWorker | null;
  onEdit: (worker: ContractWorker) => void;
  onDelete: (workerId: string) => void;
  onToggleStatus: (worker: ContractWorker) => void;
}

export function WorkerDetailsModal({
  isOpen,
  onClose,
  worker,
  onEdit,
  onDelete,
  onToggleStatus,
}: WorkerDetailsModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!worker) return null;

  // Parse multiple wage rates and real user notes stored in notes field
  const WAGE_TAG = '__wage_rates__:';
  const NOTES_TAG = '\n__notes__:';
  const wageEntries: { type: string; rate: string }[] = (() => {
    const n = worker.notes || '';
    if (n.startsWith(WAGE_TAG)) {
      try {
        const notesTagIdx = n.indexOf(NOTES_TAG);
        const wagePart = notesTagIdx >= 0 ? n.slice(WAGE_TAG.length, notesTagIdx) : n.slice(WAGE_TAG.length);
        return JSON.parse(wagePart);
      } catch (_) {}
    }
    return [{ type: worker.wage_type || '', rate: String(worker.daily_wage || 0) }];
  })();
  const visibleNotes = (() => {
    const n = worker.notes || '';
    if (!n.startsWith(WAGE_TAG)) return n;
    const idx = n.indexOf(NOTES_TAG);
    return idx >= 0 ? n.slice(idx + NOTES_TAG.length) : '';
  })();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getCleanPhone = (phone?: string | null) => {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Contract Worker Profile"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Worker Header Card */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent border border-yellow-200/70">
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-yellow-500 bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
            {worker.photo_url ? (
              <img
                src={worker.photo_url}
                alt={worker.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <FiUser className="text-yellow-600 text-3xl" />
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-lg font-bold text-gray-900">{worker.full_name}</h2>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  worker.is_active
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                {worker.is_active ? (
                  <>
                    <FiCheckCircle className="text-xs" /> Active
                  </>
                ) : (
                  <>
                    <FiXCircle className="text-xs" /> Inactive
                  </>
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1.5 text-xs text-gray-600">
              <span className="bg-yellow-100 text-yellow-800 font-medium px-2 py-0.5 rounded-md border border-yellow-200">
                {worker.trade}
              </span>
              <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                {worker.skill_level}
              </span>
              {wageEntries.map((w, i) => (
                <span key={i} className="font-semibold text-gray-800 flex items-center gap-0.5 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">
                  <TbCurrencyRupee className="inline shrink-0" />
                  {w.rate || '0'}
                  {w.type && <span className="text-gray-500 font-normal">/{w.type}</span>}
                </span>
              ))}
            </div>

            {/* Quick Contact Buttons */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
              <a
                href={`tel:${getCleanPhone(worker.phone)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs font-semibold hover:bg-yellow-600 active:bg-yellow-700 shadow-sm transition"
              >
                <FiPhone className="text-xs" /> Call {worker.phone}
              </a>
              <a
                href={`https://wa.me/91${getCleanPhone(worker.phone)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-sm transition"
              >
                <FiMessageCircle className="text-xs" /> WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* 2-Column Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vendor Linkage */}
          <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-1.5">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
              Contractor / Vendor
            </span>
            <div className="flex items-center gap-2">
              <FiBriefcase className="text-yellow-600" />
              <span className="text-sm font-semibold text-gray-900">
                {worker.vendor ? worker.vendor.name : 'Independent Worker (Direct)'}
              </span>
            </div>
            {worker.vendor?.trade_category && (
              <p className="text-xs text-gray-500 pl-6">
                Specialty: {worker.vendor.trade_category}
              </p>
            )}
          </div>

          {/* Site Allocation */}
          <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-1.5">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
              Current Assigned Site
            </span>
            <div className="flex items-center gap-2">
              <FiMapPin className="text-yellow-600" />
              <span className="text-sm font-semibold text-gray-900">
                {worker.assigned_project ? worker.assigned_project.title : 'Unassigned (Worker Pool)'}
              </span>
            </div>
            {worker.assigned_project && (
              <p className="text-xs text-emerald-600 font-medium pl-6">
                Status: {worker.assigned_project.status || 'Active'}
              </p>
            )}
          </div>

          {/* Identity & Aadhaar */}
          <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <FiShield className="text-yellow-600" /> Identity Verification
            </span>
            <div className="text-sm text-gray-800 flex items-center justify-between">
              <span>Aadhaar / ID:</span>
              <span className="font-mono font-semibold">
                {worker.aadhaar_number || 'Not Provided'}
              </span>
            </div>
            {worker.id_proof_url && (
              <a
                href={worker.id_proof_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-yellow-700 hover:text-yellow-800 font-medium underline"
              >
                <FiExternalLink /> View Uploaded ID Document
              </a>
            )}
          </div>

          {/* Emergency Contact */}
          <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <FiPhone className="text-yellow-600" /> Emergency Contact
            </span>
            <div className="text-sm font-medium text-gray-900">
              {worker.emergency_contact_name || 'No contact recorded'}
            </div>
            {worker.emergency_contact_phone && (
              <a
                href={`tel:${getCleanPhone(worker.emergency_contact_phone)}`}
                className="text-xs text-yellow-700 hover:text-yellow-800 font-semibold underline flex items-center gap-1"
              >
                <FiPhone className="text-xs" /> {worker.emergency_contact_phone}
              </a>
            )}
          </div>

          {/* Banking / UPI Payout Info */}
          <div className="md:col-span-2 p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <FiCreditCard className="text-yellow-600" /> Bank & Payout Information
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-gray-500 block">Bank Name</span>
                <span className="font-semibold text-gray-800">{worker.bank_name || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Account Number</span>
                <span className="font-mono font-semibold text-gray-800">
                  {worker.bank_account_number || '—'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">IFSC Code</span>
                <span className="font-mono font-semibold text-gray-800">
                  {worker.bank_ifsc || '—'}
                </span>
              </div>
            </div>

            {worker.upi_id && (
              <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-gray-500">UPI ID: </span>
                  <span className="font-semibold text-gray-900">{worker.upi_id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(worker.upi_id!, 'UPI ID')}
                  className="text-xs text-yellow-700 hover:text-yellow-800 flex items-center gap-1 font-medium"
                >
                  {copiedField === 'UPI ID' ? (
                    <>
                      <FiCheck className="text-emerald-600" /> Copied!
                    </>
                  ) : (
                    <>
                      <FiCopy /> Copy UPI
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Wage Rates */}
          <div className="md:col-span-2 p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <TbCurrencyRupee className="text-yellow-600" /> Wage Rates
            </span>
            <div className="divide-y divide-gray-100">
              {wageEntries.map((w, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-gray-600">{w.type || '—'}</span>
                  <span className="font-semibold text-gray-900 flex items-center gap-0.5">
                    <TbCurrencyRupee className="text-gray-500" />{w.rate || '0'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Address & Notes (real notes only, not the wage JSON) */}
          {(worker.address || visibleNotes) && (
            <div className="md:col-span-2 p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2 text-xs">
              {worker.address && (
                <div>
                  <span className="text-gray-500 font-semibold block">Native / Local Address:</span>
                  <span className="text-gray-800">{worker.address}</span>
                </div>
              )}
              {visibleNotes && (
                <div>
                  <span className="text-gray-500 font-semibold block">Notes:</span>
                  <span className="text-gray-800">{visibleNotes}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => onToggleStatus(worker)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              worker.is_active
                ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {worker.is_active ? 'Mark Worker as Inactive' : 'Activate Worker'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (confirm(`Are you sure you want to delete ${worker.full_name}?`)) {
                  onDelete(worker.id!);
                  onClose();
                }
              }}
              className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1 transition"
            >
              <FiTrash2 /> Delete
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(worker);
              }}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 rounded-lg shadow-sm flex items-center gap-1 transition"
            >
              <FiEdit2 /> Edit Profile
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
