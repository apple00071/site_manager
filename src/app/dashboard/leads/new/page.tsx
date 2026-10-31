'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  FiUser,
  FiPhone,
  FiMapPin,
  FiHome,
  FiMaximize2,
  FiUploadCloud,
  FiFileText,
  FiCheckCircle,
  FiAlertTriangle,
  FiPlus,
  FiArrowRight,
  FiLoader,
  FiX,
  FiShare2,
  FiMessageSquare,
  FiMail,
  FiCheck,
  FiRotateCcw
} from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useBranch } from '@/contexts/BranchContext';
import { isSuperAdminUser } from '@/lib/branch-constants';

const PROPERTY_TYPES = [
  '3 BHK Apartment',
  '2 BHK Apartment',
  '4 BHK / Penthouse',
  'Independent Villa',
  'Commercial / Office',
  'Full Home Turnkey',
  'Modular Interior Only',
  'Renovation / Remodeling'
];

const LEAD_SOURCES = [
  'Meta / Instagram',
  'Google Ads / Search',
  'Website Form',
  'Walk-in / Experience Center',
  'Client Referral',
  'Architect / Channel Partner',
  'WhatsApp Campaign',
  'Other'
];

const SCOPE_OPTIONS = [
  'Modular Kitchen',
  'Wardrobes & Storage',
  'False Ceiling & Lights',
  'Civil & Demolition',
  'Wall Finishes & Paint',
  'Living / Dining Decor',
  'Full Turnkey Execution'
];

export default function NewLeadPage() {
  const { showToast } = useToast();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { hasPermission } = useUserPermissions();
  const { setTitle } = useHeaderTitle();
  const { currentBranch, userBranch } = useBranch();

  const isSuperAdmin = isSuperAdminUser(user);
  const canCreateLead = isAdmin || hasPermission('leads.create') || hasPermission('crm.manage');
  const canViewCrm = isAdmin || hasPermission('crm.view');

  useEffect(() => {
    setTitle('New Lead');
  }, [setTitle]);

  // Form Fields
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [email, setEmail] = useState('');
  const [siteProject, setSiteProject] = useState('');
  const [propertyType, setPropertyType] = useState('3 BHK Apartment');
  const [areaSqft, setAreaSqft] = useState('');
  const [leadSource, setLeadSource] = useState('Meta / Instagram');
  const [leadBranch, setLeadBranch] = useState<string>(() => {
    return currentBranch !== 'all' ? currentBranch : userBranch;
  });

  useEffect(() => {
    if (!isSuperAdmin) {
      setLeadBranch(userBranch);
    } else if (currentBranch !== 'all') {
      setLeadBranch(currentBranch);
    }
  }, [isSuperAdmin, userBranch, currentBranch]);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'Modular Kitchen',
    'Wardrobes & Storage'
  ]);
  const [notes, setNotes] = useState('');

  // Floor Plan Upload state (supports multiple files)
  const [floorPlanFiles, setFloorPlanFiles] = useState<File[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [createdLead, setCreatedLead] = useState<{
    id: string;
    ref_no: string;
    client_name: string;
    site_project: string;
  } | null>(null);

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (files: File[]) => {
    const validFiles: File[] = [];
    for (const f of files) {
      if (f.size > 25 * 1024 * 1024) {
        showToast('error', `File ${f.name} exceeds 25MB limit`);
      } else {
        validFiles.push(f);
      }
    }
    if (validFiles.length > 0) {
      setFloorPlanFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFloorPlanFiles(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = () => {
    setClientName('');
    setPhone('');
    setAlternatePhone('');
    setEmail('');
    setSiteProject('');
    setPropertyType('3 BHK Apartment');
    setAreaSqft('');
    setLeadSource('Meta / Instagram');
    setSelectedScopes(['Modular Kitchen', 'Wardrobes & Storage']);
    setNotes('');
    setFloorPlanFiles([]);
    setCreatedLead(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim()) {
      showToast('error', 'Client name is required');
      return;
    }

    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      showToast('error', 'Please enter a valid 10-digit phone number');
      return;
    }

    if (!siteProject.trim()) {
      showToast('error', 'Project / property name is required');
      return;
    }

    setSubmitting(true);

    try {
      let uploadedFloorPlanUrl: string | null = null;
      let uploadedFloorPlanName: string | null = null;

      // 1. Upload floor plan(s) if selected
      let uploadedAttachments: Array<{ url: string; name: string }> = [];
      if (floorPlanFiles.length > 0) {
        setUploadingFile(true);
        const uploadData = new FormData();
        for (const f of floorPlanFiles) {
          uploadData.append('files', f);
        }

        const uploadRes = await fetch('/api/crm/upload-floor-plan', {
          method: 'POST',
          body: uploadData,
        });

        if (uploadRes.ok) {
          const uploadJson = await uploadRes.json();
          uploadedFloorPlanUrl = uploadJson.url || null;
          uploadedFloorPlanName = uploadJson.name || floorPlanFiles[0]?.name || null;
          uploadedAttachments = uploadJson.attachments || uploadJson.files || [];
        } else {
          console.warn('Floor plan upload warning:', await uploadRes.text());
        }
        setUploadingFile(false);
      }

      // 2. Prepare metadata remarks (user notes first, metadata tags after)
      const remarksParts: string[] = [];
      if (notes.trim()) remarksParts.push(notes.trim());
      remarksParts.push(`[Source: ${leadSource}]`);
      if (propertyType) remarksParts.push(`[Type: ${propertyType}]`);
      if (email.trim()) remarksParts.push(`[Email: ${email.trim()}]`);
      if (alternatePhone.trim()) remarksParts.push(`[Alt Phone: ${alternatePhone.trim()}]`);
      if (selectedScopes.length > 0) remarksParts.push(`[Scope: ${selectedScopes.join(', ')}]`);
      if (uploadedAttachments.length > 0) remarksParts.push(`[Files: ${JSON.stringify(uploadedAttachments)}]`);

      const finalRemarks = remarksParts.join(' ');

      // 3. Post to CRM endpoint
      const recordedByName = user?.user_metadata?.full_name || user?.full_name || (user?.email ? user.email.split('@')[0] : 'Direct');

      const payload = {
        client_name: clientName.trim(),
        phone: cleanPhone,
        site_project: siteProject.trim(),
        area_sqft: areaSqft ? Number(areaSqft) : 0,
        status: 'Draft',
        assigned_by: recordedByName,
        branch: isSuperAdmin ? leadBranch : userBranch,
        remarks: finalRemarks,
        floor_plan_url: uploadedFloorPlanUrl,
        floor_plan_name: uploadedFloorPlanName,
      };

      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || 'Failed to submit lead');
      }

      const refNo = resData.data?.ref_no || 'Ref Created';
      showToast('success', `Lead ${refNo} created successfully!`);
      setCreatedLead({
        id: resData.data?.id,
        ref_no: refNo,
        client_name: clientName.trim(),
        site_project: siteProject.trim(),
      });
    } catch (err: any) {
      console.error('Lead submission error:', err);
      showToast('error', err.message || 'Error creating lead');
    } finally {
      setSubmitting(false);
      setUploadingFile(false);
    }
  };

  if (authLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-500 border-t-transparent" />
        <p className="text-xs font-semibold text-gray-400">Verifying permissions...</p>
      </div>
    );
  }

  if (!canCreateLead) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto px-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
          <FiAlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">Lead Creation Access Required</h2>
          <p className="text-xs text-gray-500 mt-1 font-medium leading-relaxed">
            Your current account role does not have permission to submit new leads. Please request the <code>leads.create</code> permission from an administrator.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="btn-primary py-2 px-4 text-xs font-medium"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // Success Confirmation Screen
  if (createdLead) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-md p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <FiCheckCircle className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
              Lead Successfully Registered
            </span>
            <h2 className="text-xl font-bold text-gray-900">
              {createdLead.client_name}
            </h2>
            <p className="text-xs text-gray-500">
              {createdLead.site_project}
            </p>
          </div>

          {/* Generated Reference Badge */}
          <div className="py-3 px-6 bg-yellow-50 border border-yellow-200/80 rounded-xl inline-flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold text-yellow-800 uppercase tracking-widest">
              Quotation Reference No.
            </span>
            <span className="text-base font-mono font-bold text-yellow-950 mt-0.5">
              {createdLead.ref_no}
            </span>
          </div>

          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            This lead is now visible in the CRM pipeline. Estimation and sales engineers can take over and prepare the scope of work.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleReset}
              className="btn-primary py-2 px-4 text-xs font-medium w-full sm:w-auto cursor-pointer"
            >
              <FiPlus className="w-4 h-4 text-white" />
              <span>Submit Another Lead</span>
            </button>

            {canViewCrm && (
              <Link
                href="/dashboard/crm"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg transition-colors w-full sm:w-auto"
              >
                <span>View CRM Pipeline</span>
                <FiArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            New Lead Intake
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Capture new customer inquiries and site requirements directly into the CRM pipeline.
          </p>
        </div>

        {canViewCrm && (
          <Link
            href="/dashboard/crm"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-yellow-600 transition-colors w-fit"
          >
            <span>Open CRM Pipeline</span>
            <FiArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* Main 2-Column Responsive Layout */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Column (8 cols): Primary Details */}
        <div className="lg:col-span-8 space-y-5">

          {/* Card 1: Customer Contact Information */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <FiUser className="w-4 h-4 text-yellow-600" />
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Customer Contact Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Client Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-gray-900 font-medium placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Primary Phone Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <FiPhone className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-gray-900 font-medium placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Alternate Phone / WhatsApp
                </label>
                <div className="relative">
                  <FiPhone className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                  <input
                    type="tel"
                    value={alternatePhone}
                    onChange={(e) => setAlternatePhone(e.target.value)}
                    placeholder="e.g. 9845012345 (optional)"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-gray-900 font-medium placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. rahul@example.com (optional)"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-gray-900 font-medium placeholder:text-gray-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Property & Site Specifications */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <FiHome className="w-4 h-4 text-yellow-600" />
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Site & Property Details
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Project / Apartment Name & Site Location <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <FiMapPin className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    required
                    value={siteProject}
                    onChange={(e) => setSiteProject(e.target.value)}
                    placeholder="e.g. Prestige Lakeside Habitat, Tower 3, Flat 804, Varthur"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-gray-900 font-medium placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Property Configuration
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-gray-800 font-medium"
                  >
                    {PROPERTY_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Carpet Area (Sq. Ft.)
                  </label>
                  <div className="relative">
                    <FiMaximize2 className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={areaSqft}
                      onChange={(e) => setAreaSqft(e.target.value)}
                      placeholder="e.g. 1650"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-gray-900 font-medium placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Scope of Work & Requirements */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <FiMessageSquare className="w-4 h-4 text-yellow-600" />
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Scope & Client Requirements
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Scope Items of Interest
                </label>
                <div className="flex flex-wrap gap-2">
                  {SCOPE_OPTIONS.map(scope => {
                    const isSelected = selectedScopes.includes(scope);
                    return (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => toggleScope(scope)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${isSelected
                          ? 'bg-yellow-50 text-yellow-900 border border-yellow-300 shadow-2xs font-semibold'
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                      >
                        {isSelected ? (
                          <FiCheck className="w-3.5 h-3.5 text-yellow-600" />
                        ) : (
                          <FiPlus className="w-3.5 h-3.5 text-gray-400" />
                        )}
                        <span>{scope}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Detailed Notes & Discussion Remarks
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Client looking for contemporary finish, handover in December, prefers modular kitchen with acrylic finish and master bedroom walk-in wardrobe."
                  className="w-full p-3 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-gray-900 font-medium placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right Column (4 cols): Marketing Attribution, File Upload & Actions */}
        <div className="lg:col-span-4 space-y-5">

          {/* Card: Source & Attribution */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <FiShare2 className="w-4 h-4 text-yellow-600" />
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Lead Source & Attribution
              </h2>
            </div>

            {isSuperAdmin && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Target Branch <span className="text-rose-500">*</span>
                </label>
                <select
                  value={leadBranch}
                  onChange={(e) => setLeadBranch(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-gray-800 font-semibold"
                >
                  <option value="Kukatpally">Kukatpally Branch</option>
                  <option value="AS Rao Nagar">AS Rao Nagar Branch</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Lead Source Channel
              </label>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-gray-800 font-semibold"
              >
                {LEAD_SOURCES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="text-[11px] text-gray-400 leading-relaxed bg-gray-50 p-2.5 rounded-lg border border-gray-100">
              Recorded By: <span className="font-semibold text-gray-700">{user?.user_metadata?.full_name || user?.full_name || (user?.email ? user.email.split('@')[0] : 'Direct')}</span>
            </div>
          </div>

          {/* Card: Floor Plan Upload Dropzone */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FiFileText className="w-4 h-4 text-yellow-600" />
                <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Floor Plan Drawing
                </h2>
              </div>
              <span className="text-[10px] text-gray-400 font-medium">Optional</span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              id="floor-plan-file-drop"
              multiple
            />

            {floorPlanFiles.length === 0 ? (
              <label
                htmlFor="floor-plan-file-drop"
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${isDragOver
                  ? 'border-yellow-500 bg-yellow-50/50'
                  : 'border-gray-200 hover:border-yellow-400 bg-gray-50/50 hover:bg-yellow-50/20'
                  }`}
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-gray-500 flex items-center justify-center mb-2 shadow-2xs">
                  <FiUploadCloud className="w-5 h-5 text-yellow-600" />
                </div>
                <span className="text-xs font-semibold text-gray-800">
                  Click or drag drawings here (Multiple)
                </span>
                <span className="text-[11px] text-gray-400 mt-0.5">
                  PDF, PNG, JPG (select multiple files)
                </span>
              </label>
            ) : (
              <div className="space-y-2">
                {floorPlanFiles.map((file, idx) => (
                  <div key={idx} className="p-2.5 bg-yellow-50/60 border border-yellow-200 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-7 h-7 rounded-lg bg-yellow-500/20 text-yellow-800 flex items-center justify-center shrink-0">
                        <FiFileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-semibold text-gray-900 block truncate">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="p-1 hover:bg-yellow-200 text-yellow-800 rounded-md transition-colors cursor-pointer"
                      title="Remove drawing"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <label
                  htmlFor="floor-plan-file-drop"
                  className="w-full py-2 px-3 border border-dashed border-gray-300 hover:border-yellow-500 rounded-lg text-xs font-semibold text-gray-600 hover:text-yellow-700 bg-gray-50 hover:bg-yellow-50/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  <span>+ Add More Files</span>
                </label>
              </div>
            )}
          </div>

          {/* Action & Submit Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-2.5 px-4 text-xs font-medium cursor-pointer disabled:opacity-50 justify-center"
            >
              {submitting ? (
                <>
                  <FiLoader className="w-4 h-4 animate-spin text-white" />
                  <span>{uploadingFile ? 'Uploading Drawing...' : 'Submitting to CRM...'}</span>
                </>
              ) : (
                <>
                  <FiCheckCircle className="w-4 h-4 text-white" />
                  <span>Submit Lead to CRM</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={submitting}
              className="w-full py-2 px-4 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <FiRotateCcw className="w-3.5 h-3.5 text-gray-400" />
              <span>Reset Form</span>
            </button>

            <p className="text-[11px] text-gray-400 text-center leading-relaxed pt-1">
              Creates a new quotation lead and assigns a tracking reference in the CRM pipeline.
            </p>
          </div>

        </div>

      </form>
    </div>
  );
}
