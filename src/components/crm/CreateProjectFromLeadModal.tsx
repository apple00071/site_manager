'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FiX, 
  FiCheckCircle, 
  FiAlertCircle, 
  FiExternalLink, 
  FiCalendar, 
  FiUser, 
  FiHome, 
  FiPhone,
  FiRefreshCw,
  FiArrowRight
} from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';

interface Lead {
  id: string;
  ref_no: string;
  client_name: string;
  phone: string;
  site_project: string;
  area_sqft?: number;
  quote_value?: number;
  approved_value?: number;
  status: string;
  remarks?: string;
}

interface CreateProjectFromLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  existingProjects?: any[];
  onProjectCreated?: (project: any) => void;
}

export default function CreateProjectFromLeadModal({
  isOpen,
  onClose,
  lead,
  existingProjects = [],
  onProjectCreated,
}: CreateProjectFromLeadModalProps) {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [areaSqft, setAreaSqft] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');

  const [designers, setDesigners] = useState<any[]>([]);
  const [loadingDesigners, setLoadingDesigners] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successProject, setSuccessProject] = useState<any | null>(null);

  // Check if an existing project already matches this lead's client name
  const matchedProject = React.useMemo(() => {
    if (!lead?.client_name || !existingProjects?.length) return null;
    const lName = lead.client_name.toLowerCase().trim();
    return existingProjects.find((p: any) => {
      const cName = (p.customer_name || '').toLowerCase().trim();
      const pTitle = (p.title || '').toLowerCase().trim();
      return cName === lName || cName.includes(lName) || pTitle.includes(lName) || lName.includes(cName);
    });
  }, [lead, existingProjects]);

  // Fetch active designers when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      try {
        setLoadingDesigners(true);
        const res = await fetch('/api/admin/users');
        if (res.ok) {
          const data = await res.json();
          // Filter to active designers/employees
          const activeUsers = (data || []).filter((u: any) => u.is_active !== false);
          setDesigners(activeUsers);
          if (activeUsers.length > 0 && !assignedEmployeeId) {
            // Prefer user with designer role if found
            const defaultDesigner = activeUsers.find((u: any) => 
              (u.role || '').toLowerCase().includes('designer') || 
              (u.designation || '').toLowerCase().includes('designer')
            ) || activeUsers[0];
            setAssignedEmployeeId(defaultDesigner.id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch designers:', err);
      } finally {
        setLoadingDesigners(false);
      }
    };

    fetchUsers();
  }, [isOpen]);

  // Reset form with lead details
  useEffect(() => {
    if (lead && isOpen) {
      const defaultTitle = `${lead.client_name}_${lead.site_project || 'Project'}`.replace(/\s+/g, ' ').trim();
      setTitle(defaultTitle);
      setCustomerName(lead.client_name || '');
      setPhoneNumber(lead.phone || '');
      setAddress(lead.site_project || '');
      setAreaSqft(lead.area_sqft ? String(lead.area_sqft) : '');
      const finalBudget = lead.approved_value || lead.quote_value || 0;
      setBudget(finalBudget ? String(finalBudget) : '');

      const today = new Date();
      setStartDate(today.toISOString().split('T')[0]);
      const targetDate = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000);
      setCompletionDate(targetDate.toISOString().split('T')[0]);

      setError(null);
      setSuccessProject(null);
    }
  }, [lead, isOpen]);

  if (!isOpen || !lead) return null;

  const handleSyncExistingBudget = async () => {
    if (!matchedProject) return;
    const numBudget = parseFloat(budget);
    if (isNaN(numBudget) || numBudget <= 0) {
      setError('Please provide a valid budget number');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch(`/api/projects/${matchedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_budget: numBudget }),
      });

      if (res.ok) {
        setSuccessProject({
          ...matchedProject,
          project_budget: numBudget,
          isUpdated: true,
        });
        if (onProjectCreated) onProjectCreated(matchedProject);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update project budget');
      }
    } catch (err: any) {
      setError(err.message || 'Network error updating project budget');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Project title is required');
      return;
    }
    if (!customerName.trim()) {
      setError('Customer name is required');
      return;
    }
    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      setError('A valid 10-digit phone number is required');
      return;
    }
    if (!address.trim() || address.length < 3) {
      setError('Site address or apartment name is required');
      return;
    }
    if (!assignedEmployeeId) {
      setError('Please select a designer or project in-charge');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        title: title.trim(),
        customer_name: customerName.trim(),
        phone_number: phoneNumber.trim(),
        address: address.trim(),
        apartment_name: address.trim(),
        area_sqft: areaSqft ? areaSqft.trim() : null,
        project_budget: budget ? budget.trim() : null,
        start_date: startDate,
        estimated_completion_date: completionDate,
        assigned_employee_id: assignedEmployeeId,
        project_notes: `Created from CRM Quotation Ref #${lead.ref_no}`,
        status: 'pending',
      };

      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (!res.ok) {
        const msg = resData?.error?.message || resData?.message || 'Failed to create project';
        setError(msg);
        return;
      }

      const created = resData.project || resData.data || resData;
      setSuccessProject(created);
      if (onProjectCreated) {
        onProjectCreated(created);
      }
    } catch (err: any) {
      console.error('Error creating project from quote:', err);
      setError(err.message || 'An unexpected error occurred while creating project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenFullForm = () => {
    const params = new URLSearchParams({
      title: title.trim(),
      customer_name: customerName.trim(),
      phone_number: phoneNumber.trim(),
      address: address.trim(),
      apartment_name: address.trim(),
      area_sqft: areaSqft || '',
      budget: budget || '',
      notes: `Created from CRM Quotation Ref #${lead.ref_no}`,
    });
    onClose();
    router.push(`/dashboard/projects/new?${params.toString()}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-white">
          <h3 className="text-base font-bold text-gray-900">
            Add to Projects
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Success Banner */}
          {successProject && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex flex-col gap-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <FiCheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-emerald-900">
                    {successProject.isUpdated ? 'Project Budget Synced!' : 'Project Created Successfully!'}
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {successProject.isUpdated
                      ? `Updated budget to ₹${Number(budget).toLocaleString('en-IN')} for "${successProject.title}".`
                      : `"${successProject.title}" has been created with a budget of ₹${Number(budget).toLocaleString('en-IN')}.`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-emerald-200/60 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/dashboard/projects/${successProject.id}`);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>Go to Project</span>
                  <FiArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Matched Project Alert if existing */}
          {!successProject && matchedProject && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <FiAlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-amber-900">Existing project found for this client:</p>
                <p className="text-amber-800 font-medium mt-0.5 truncate">{matchedProject.title}</p>
                <p className="text-amber-700 mt-1">
                  Current budget: <span className="font-bold">₹{matchedProject.project_budget ? Number(matchedProject.project_budget).toLocaleString('en-IN') : '0 (Not set)'}</span>
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={handleSyncExistingBudget}
                    disabled={isSubmitting}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiCheckCircle className="w-3 h-3" />}
                    <span>Update Existing Project Budget</span>
                  </button>
                  <span className="text-gray-400 font-normal">or create new below</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <FiAlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!successProject && (
            <form id="create-project-quote-form" onSubmit={handleCreateProject} className="space-y-3.5">
              {/* Row 1: Title */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sunil_Primark Inspira_2BHK"
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Row 2: Customer Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="10-digit phone"
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Site Address & Area */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Site / Apartment <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FiHome className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Primark Inspira, Miyapur"
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Area (sq.ft)
                  </label>
                  <input
                    type="number"
                    value={areaSqft}
                    onChange={(e) => setAreaSqft(e.target.value)}
                    placeholder="e.g. 1450"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Row 4: Approved Contract Budget */}
              <div className="p-3.5 bg-yellow-50/70 border border-yellow-200/90 rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-yellow-900 flex items-center gap-1">
                    <TbCurrencyRupee className="w-4 h-4 text-yellow-600" />
                    <span>Project Contract Budget (₹)</span>
                  </label>
                  {budget && !isNaN(Number(budget)) && Number(budget) > 0 && (
                    <span className="text-xs font-black text-yellow-800">
                      ₹{(Number(budget) / 100000).toFixed(2)} Lakhs
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 1030000"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-gray-900"
                />
                <p className="text-[11px] text-yellow-800 mt-1">
                  Synced directly from the approved CRM quote amount. This becomes the project contract value in Finance.
                </p>
              </div>

              {/* Row 5: Timeline Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Target Completion Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <input
                      type="date"
                      value={completionDate}
                      onChange={(e) => setCompletionDate(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Row 6: Assigned Designer */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Assigned Designer / Project In-Charge <span className="text-red-500">*</span>
                </label>
                <select
                  value={assignedEmployeeId}
                  onChange={(e) => setAssignedEmployeeId(e.target.value)}
                  required
                  disabled={loadingDesigners}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="">Select a designer</option>
                  {designers.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name || d.name} ({d.designation || d.role || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleOpenFullForm}
            className="text-xs font-bold text-gray-600 hover:text-amber-600 flex items-center gap-1.5 transition-colors cursor-pointer py-1"
          >
            <span>Open Full Form</span>
            <FiExternalLink className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            {!successProject && (
              <button
                type="submit"
                form="create-project-quote-form"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="w-3.5 h-3.5" />
                    <span>Create Project</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
