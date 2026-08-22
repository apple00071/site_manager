'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Vendor } from './VendorRegistrationModal';
import { ContractWorker } from './WorkerRegistrationModal';
import {
  FiBriefcase,
  FiUser,
  FiPhone,
  FiMail,
  FiMapPin,
  FiCreditCard,
  FiTag,
  FiCheckCircle,
  FiXCircle,
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiUsers,
} from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';

interface VendorDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor | null;
  workers: ContractWorker[];
  onEdit: (vendor: Vendor) => void;
  onDelete: (vendorId: string) => void;
  onAddWorkerForVendor: (vendor: Vendor) => void;
  onSelectWorker: (worker: ContractWorker) => void;
}

export function VendorDetailsModal({
  isOpen,
  onClose,
  vendor,
  workers,
  onEdit,
  onDelete,
  onAddWorkerForVendor,
  onSelectWorker,
}: VendorDetailsModalProps) {
  if (!vendor) return null;

  const linkedWorkers = workers.filter((w) => w.vendor_id === vendor.id);

  const getCleanPhone = (phone?: string | null) => {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Vendor / Subcontractor Profile"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Header Card */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent border border-yellow-200/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{vendor.name}</h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    vendor.is_active !== false
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  {vendor.is_active !== false ? (
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
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-600">
                <span className="bg-yellow-100 text-yellow-800 font-medium px-2 py-0.5 rounded-md border border-yellow-200">
                  {vendor.trade_category || 'General Services'}
                </span>
                <span className="capitalize text-gray-500">
                  {vendor.vendor_type?.replace('_', ' ') || 'Subcontractor'}
                </span>
              </div>
            </div>

            {/* Quick Call */}
            {vendor.contact_phone && (
              <a
                href={`tel:${getCleanPhone(vendor.contact_phone)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs font-semibold hover:bg-yellow-600 active:bg-yellow-700 shadow-sm transition"
              >
                <FiPhone className="text-xs" /> Call {vendor.contact_phone}
              </a>
            )}
          </div>
        </div>

        {/* Contact & Business Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <FiUser className="text-yellow-600" /> Contact Representative
            </span>
            <div className="text-sm font-medium text-gray-900">
              {vendor.contact_name || 'No representative name'}
            </div>
            {vendor.contact_phone && (
              <div className="text-xs text-gray-600 flex items-center gap-1">
                <FiPhone className="text-gray-400" /> {vendor.contact_phone}
              </div>
            )}
            {vendor.contact_email && (
              <div className="text-xs text-gray-600 flex items-center gap-1">
                <FiMail className="text-gray-400" /> {vendor.contact_email}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <FiTag className="text-yellow-600" /> Tax & Identification
            </span>
            <div className="text-xs text-gray-700 flex justify-between">
              <span>GSTIN:</span>
              <span className="font-mono font-semibold">{vendor.gst_number || 'N/A'}</span>
            </div>
            <div className="text-xs text-gray-700 flex justify-between">
              <span>PAN:</span>
              <span className="font-mono font-semibold">{vendor.pan_number || 'N/A'}</span>
            </div>
            {(vendor.city || vendor.state) && (
              <div className="text-xs text-gray-600 flex items-center gap-1 pt-1">
                <FiMapPin className="text-gray-400" /> {vendor.city ? `${vendor.city}, ` : ''}{vendor.state}
              </div>
            )}
          </div>

          {/* Banking details */}
          {(vendor.bank_name || vendor.bank_account_number) && (
            <div className="md:col-span-2 p-3.5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2 text-xs">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <FiCreditCard className="text-yellow-600" /> Bank Account Details
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-gray-500 block">Bank:</span>
                  <span className="font-semibold text-gray-800">{vendor.bank_name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Account No:</span>
                  <span className="font-mono font-semibold text-gray-800">
                    {vendor.bank_account_number || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">IFSC:</span>
                  <span className="font-mono font-semibold text-gray-800">{vendor.bank_ifsc || '—'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Linked Contract Workers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <FiUsers className="text-yellow-600" /> Registered Contract Workers ({linkedWorkers.length})
            </h3>
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddWorkerForVendor(vendor);
              }}
              className="text-xs font-semibold text-yellow-700 hover:text-yellow-800 flex items-center gap-1"
            >
              <FiPlus /> Register Worker under this Vendor
            </button>
          </div>

          {linkedWorkers.length === 0 ? (
            <div className="p-4 text-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50 text-xs text-gray-500">
              No workers registered under this contractor yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {linkedWorkers.map((worker) => (
                <div
                  key={worker.id}
                  onClick={() => {
                    onClose();
                    onSelectWorker(worker);
                  }}
                  className="p-2.5 rounded-lg border border-gray-200 bg-white hover:border-yellow-400 hover:shadow-xs transition cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-yellow-50 text-yellow-700 flex items-center justify-center flex-shrink-0 font-bold text-xs border border-yellow-200">
                      {worker.full_name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{worker.full_name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{worker.trade} • {worker.phone}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-700 flex-shrink-0">
                    ₹{worker.daily_wage || 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => {
              if (confirm(`Are you sure you want to delete ${vendor.name}?`)) {
                onDelete(vendor.id!);
                onClose();
              }
            }}
            className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1 transition"
          >
            <FiTrash2 /> Delete Vendor
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(vendor);
              }}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 rounded-lg shadow-sm flex items-center gap-1 transition"
            >
              <FiEdit2 /> Edit Vendor
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
