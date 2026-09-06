'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  FiUsers,
  FiBriefcase,
  FiPlus,
  FiSearch,
  FiFilter,
  FiPhone,
  FiMapPin,
  FiDownload,
  FiCheckCircle,
  FiXCircle,
  FiEdit2,
  FiEye,
  FiGrid,
  FiList,
  FiMessageCircle,
  FiActivity,
  FiRefreshCw,
  FiX,
  FiSliders,
} from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';

import {
  WorkerRegistrationModal,
  ContractWorker,
} from '@/components/vendors-workers/WorkerRegistrationModal';
import {
  VendorRegistrationModal,
  Vendor,
} from '@/components/vendors-workers/VendorRegistrationModal';
import { WorkerDetailsModal } from '@/components/vendors-workers/WorkerDetailsModal';
import { VendorDetailsModal } from '@/components/vendors-workers/VendorDetailsModal';

const TRADE_FILTERS = [
  'All',
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
  'General Labor',
];

export default function VendorsWorkersPage() {
  const { setTitle, setSubtitle } = useHeaderTitle();
  const { user } = useAuth();

  // Tab State: 'workers' | 'vendors'
  const [activeTab, setActiveTab] = useState<'workers' | 'vendors'>('workers');

  // View state: 'grid' | 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Data states
  const [workers, setWorkers] = useState<ContractWorker[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('All');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Modal States
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [selectedWorkerForDetails, setSelectedWorkerForDetails] = useState<ContractWorker | null>(null);
  const [selectedVendorForDetails, setSelectedVendorForDetails] = useState<Vendor | null>(null);
  const [editingWorker, setEditingWorker] = useState<ContractWorker | null>(null);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Set Page Title
  useEffect(() => {
    setTitle('Vendors & Contract Workers');
    setSubtitle(null);
  }, [setTitle, setSubtitle]);

  // Fetch Data
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch Workers
      const workersRes = await fetch('/api/contract-workers');
      const workersData = await workersRes.json();
      if (workersRes.ok && workersData.workers) {
        setWorkers(workersData.workers);
      }

      // 2. Fetch Vendors (Suppliers)
      const vendorsRes = await fetch('/api/suppliers');
      const vendorsData = await vendorsRes.json();
      if (vendorsRes.ok && vendorsData.suppliers) {
        setVendors(vendorsData.suppliers);
      }

      // 3. Fetch Projects for allocation options
      const projectsRes = await fetch('/api/admin/projects');
      if (projectsRes.ok) {
        const projData = await projectsRes.json();
        if (Array.isArray(projData)) {
          setProjects(projData.map((p: any) => ({ id: p.id, title: p.title })));
        }
      }
    } catch (err) {
      console.error('Error fetching vendors and workers:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Statistics computations
  const stats = useMemo(() => {
    const totalWorkers = workers.length;
    const activeWorkers = workers.filter((w) => w.is_active).length;
    const assignedOnSite = workers.filter((w) => w.is_active && w.assigned_project_id).length;
    const totalVendors = vendors.length;
    const activeVendors = vendors.filter((v) => v.is_active !== false).length;

    return {
      totalWorkers,
      activeWorkers,
      assignedOnSite,
      totalVendors,
      activeVendors,
    };
  }, [workers, vendors]);

  // Filtered Workers
  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      // Search query (name, phone, trade, aadhaar)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = w.full_name?.toLowerCase().includes(q);
        const matchPhone = w.phone?.includes(q);
        const matchTrade = w.trade?.toLowerCase().includes(q);
        const matchVendor = w.vendor?.name?.toLowerCase().includes(q);
        const matchProject = w.assigned_project?.title?.toLowerCase().includes(q);
        const matchAadhaar = w.aadhaar_number?.includes(q);
        if (!matchName && !matchPhone && !matchTrade && !matchVendor && !matchProject && !matchAadhaar) {
          return false;
        }
      }

      // Trade filter
      if (selectedTrade !== 'All') {
        if (!w.trade?.toLowerCase().includes(selectedTrade.toLowerCase())) {
          return false;
        }
      }

      // Vendor filter
      if (selectedVendorFilter !== 'all') {
        if (selectedVendorFilter === 'independent') {
          if (w.vendor_id) return false;
        } else if (w.vendor_id !== selectedVendorFilter) {
          return false;
        }
      }

      // Project filter
      if (selectedProjectFilter !== 'all') {
        if (selectedProjectFilter === 'unassigned') {
          if (w.assigned_project_id) return false;
        } else if (w.assigned_project_id !== selectedProjectFilter) {
          return false;
        }
      }

      // Status filter
      if (selectedStatusFilter === 'active' && !w.is_active) return false;
      if (selectedStatusFilter === 'inactive' && w.is_active) return false;

      return true;
    });
  }, [workers, searchQuery, selectedTrade, selectedVendorFilter, selectedProjectFilter, selectedStatusFilter]);

  // Filtered Vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = v.name?.toLowerCase().includes(q);
        const matchPerson = v.contact_name?.toLowerCase().includes(q);
        const matchPhone = v.contact_phone?.includes(q);
        const matchCategory = v.trade_category?.toLowerCase().includes(q);
        const matchCity = v.city?.toLowerCase().includes(q);
        if (!matchName && !matchPerson && !matchPhone && !matchCategory && !matchCity) {
          return false;
        }
      }

      if (selectedStatusFilter === 'active' && v.is_active === false) return false;
      if (selectedStatusFilter === 'inactive' && v.is_active !== false) return false;

      return true;
    });
  }, [vendors, searchQuery, selectedStatusFilter]);

  // Handlers for Worker Status Toggle
  const handleToggleWorkerStatus = async (worker: ContractWorker) => {
    try {
      const newStatus = !worker.is_active;
      const res = await fetch('/api/contract-workers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: worker.id, is_active: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.worker) {
        setWorkers((prev) => prev.map((w) => (w.id === worker.id ? data.worker : w)));
        if (selectedWorkerForDetails?.id === worker.id) {
          setSelectedWorkerForDetails(data.worker);
        }
      }
    } catch (err) {
      console.error('Error toggling worker status:', err);
    }
  };

  // Handlers for Worker Deletion
  const handleDeleteWorker = async (workerId: string) => {
    try {
      const res = await fetch(`/api/contract-workers?id=${workerId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setWorkers((prev) => prev.filter((w) => w.id !== workerId));
        if (selectedWorkerForDetails?.id === workerId) {
          setSelectedWorkerForDetails(null);
        }
      }
    } catch (err) {
      console.error('Error deleting worker:', err);
    }
  };

  // Handlers for Vendor Deletion
  const handleDeleteVendor = async (vendorId: string) => {
    try {
      const res = await fetch(`/api/suppliers?id=${vendorId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setVendors((prev) => prev.filter((v) => v.id !== vendorId));
        if (selectedVendorForDetails?.id === vendorId) {
          setSelectedVendorForDetails(null);
        }
      }
    } catch (err) {
      console.error('Error deleting vendor:', err);
    }
  };

  // Worker saved callback
  const handleWorkerSaved = (savedWorker: ContractWorker) => {
    setWorkers((prev) => {
      const exists = prev.some((w) => w.id === savedWorker.id);
      if (exists) {
        return prev.map((w) => (w.id === savedWorker.id ? savedWorker : w));
      }
      return [savedWorker, ...prev];
    });
  };

  // Vendor saved callback
  const handleVendorSaved = (savedVendor: Vendor) => {
    setVendors((prev) => {
      const exists = prev.some((v) => v.id === savedVendor.id);
      if (exists) {
        return prev.map((v) => (v.id === savedVendor.id ? savedVendor : v));
      }
      return [savedVendor, ...prev];
    });
  };

  // CSV Export
  const handleExportCSV = () => {
    if (activeTab === 'workers') {
      const headers = [
        'Full Name',
        'Phone',
        'Trade',
        'Skill Level',
        'Contractor / Vendor',
        'Assigned Site',
        'Wage Type',
        'Daily Wage (INR)',
        'Aadhaar Number',
        'Emergency Contact',
        'Emergency Phone',
        'Status',
      ];
      const rows = filteredWorkers.map((w) => [
        `"${w.full_name || ''}"`,
        `"${w.phone || ''}"`,
        `"${w.trade || ''}"`,
        `"${w.skill_level || ''}"`,
        `"${w.vendor ? w.vendor.name : 'Independent Worker'}"`,
        `"${w.assigned_project ? w.assigned_project.title : 'Unassigned'}"`,
        `"${w.wage_type || 'Daily'}"`,
        w.daily_wage || 0,
        `"${w.aadhaar_number || ''}"`,
        `"${w.emergency_contact_name || ''}"`,
        `"${w.emergency_contact_phone || ''}"`,
        w.is_active ? 'Active' : 'Inactive',
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `contract_workers_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = [
        'Company Name',
        'Vendor Type',
        'Trade Category',
        'Contact Person',
        'Phone',
        'Email',
        'GSTIN',
        'PAN',
        'City',
        'State',
        'Status',
      ];
      const rows = filteredVendors.map((v) => [
        `"${v.name || ''}"`,
        `"${v.vendor_type || 'Subcontractor'}"`,
        `"${v.trade_category || ''}"`,
        `"${v.contact_name || ''}"`,
        `"${v.contact_phone || ''}"`,
        `"${v.contact_email || ''}"`,
        `"${v.gst_number || ''}"`,
        `"${v.pan_number || ''}"`,
        `"${v.city || ''}"`,
        `"${v.state || ''}"`,
        v.is_active !== false ? 'Active' : 'Inactive',
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `vendors_subcontractors_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getCleanPhone = (phone?: string | null) => {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  };

  const activeFiltersCount = (selectedVendorFilter !== 'all' ? 1 : 0) + 
    (selectedProjectFilter !== 'all' ? 1 : 0) + 
    (selectedStatusFilter !== 'all' ? 1 : 0);

  return (
    <div className="space-y-3.5 sm:space-y-4 pb-24 sm:pb-0 px-2 sm:px-4 lg:px-6 pt-2">
      {/* Mobile Only Search & Add Bar */}
      <div className="flex sm:hidden items-center gap-2">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === 'workers' ? 'Search workers...' : 'Search vendors...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 py-2.5 w-full text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white shadow-sm transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <FiX className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className={`w-10 h-10 flex items-center justify-center rounded-xl border shadow-sm transition-all flex-shrink-0 relative ${
            showMobileFilters || activeFiltersCount > 0
              ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
              : 'bg-white border-gray-200 text-gray-600'
          }`}
          title="Filter Options"
        >
          <FiSliders className="h-4 w-4" />
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            if (activeTab === 'workers') {
              setEditingWorker(null);
              setWorkerModalOpen(true);
            } else {
              setEditingVendor(null);
              setVendorModalOpen(true);
            }
          }}
          className="w-10 h-10 flex items-center justify-center bg-yellow-500 text-white rounded-xl shadow-sm hover:bg-yellow-600 active:scale-95 transition-all flex-shrink-0"
          title={activeTab === 'workers' ? 'Register Worker' : 'Register Vendor'}
        >
          <FiPlus className="h-5 w-5" />
        </button>
      </div>

      {/* 1. Compact 3-Column Telemetry Row (Single row on mobile & desktop) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="p-2.5 sm:p-3.5 rounded-xl bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
            Workers
          </span>
          <div className="mt-1 flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
            <span className="text-base sm:text-xl font-black text-gray-900 leading-none">
              {stats.totalWorkers}
            </span>
            <span className="text-[10px] sm:text-xs text-emerald-600 font-medium truncate">
              {stats.activeWorkers} active
            </span>
          </div>
        </div>

        <div className="p-2.5 sm:p-3.5 rounded-xl bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
            On Site
          </span>
          <div className="mt-1 flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
            <span className="text-base sm:text-xl font-black text-gray-900 leading-none">
              {stats.assignedOnSite}
            </span>
            <span className="text-[10px] sm:text-xs text-gray-500 truncate">
              deployed
            </span>
          </div>
        </div>

        <div className="p-2.5 sm:p-3.5 rounded-xl bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
            Vendors
          </span>
          <div className="mt-1 flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
            <span className="text-base sm:text-xl font-black text-gray-900 leading-none">
              {stats.totalVendors}
            </span>
            <span className="text-[10px] sm:text-xs text-emerald-600 font-medium truncate">
              {stats.activeVendors} active
            </span>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs Bar (Consistent with Projects page) */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-2 sm:px-3">
          {/* Tabs */}
          <div className="flex flex-1 min-w-0 overflow-x-auto no-scrollbar scroll-smooth">
            <div className="flex flex-nowrap space-x-1 sm:space-x-2">
              <button
                type="button"
                onClick={() => setActiveTab('workers')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200 flex-shrink-0 ${
                  activeTab === 'workers'
                    ? 'border-yellow-500 text-yellow-600 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>Contract Workers</span>
                <span
                  className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold leading-tight ${
                    activeTab === 'workers'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {workers.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('vendors')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200 flex-shrink-0 ${
                  activeTab === 'vendors'
                    ? 'border-yellow-500 text-yellow-600 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>Vendors & Contractors</span>
                <span
                  className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold leading-tight ${
                    activeTab === 'vendors'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {vendors.length}
                </span>
              </button>
            </div>
          </div>

          {/* Desktop Search & Actions */}
          <div className="hidden sm:flex items-center gap-2.5 py-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={activeTab === 'workers' ? 'Search workers...' : 'Search vendors...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 py-2 w-48 md:w-56 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-gray-50 focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                  <FiX className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1 shadow-xs transition"
            >
              <FiDownload className="text-xs" /> Export CSV
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab === 'workers') {
                  setEditingWorker(null);
                  setWorkerModalOpen(true);
                } else {
                  setEditingVendor(null);
                  setVendorModalOpen(true);
                }
              }}
              className="px-3.5 py-2 text-xs font-bold text-white bg-yellow-500 hover:bg-yellow-600 active:scale-95 rounded-lg shadow-sm flex items-center gap-1 transition"
            >
              <FiPlus className="text-sm" />
              <span>{activeTab === 'workers' ? 'Register Worker' : 'Register Vendor'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Trade Category Horizontal Chips (for Workers) */}
      {activeTab === 'workers' && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {TRADE_FILTERS.map((trade) => {
            const isSelected = selectedTrade === trade;
            return (
              <button
                key={trade}
                type="button"
                onClick={() => setSelectedTrade(trade)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs whitespace-nowrap transition flex-shrink-0 ${
                  isSelected
                    ? 'bg-yellow-500 text-white font-semibold shadow-xs'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {trade}
              </button>
            );
          })}
        </div>
      )}

      {/* Secondary Filters (Desktop always, Mobile collapsible) */}
      <div className={`bg-white p-2.5 sm:p-3 rounded-xl border border-gray-200 shadow-sm ${showMobileFilters ? 'block' : 'hidden sm:block'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {activeTab === 'workers' && (
            <>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Vendor / Contractor</label>
                <select
                  value={selectedVendorFilter}
                  onChange={(e) => setSelectedVendorFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="all">All Vendors</option>
                  <option value="independent">Independent Workers</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Project Site Allocation</label>
                <select
                  value={selectedProjectFilter}
                  onChange={(e) => setSelectedProjectFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="all">All Sites</option>
                  <option value="unassigned">Unassigned (Pool)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Status</label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-yellow-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Content Area: Workers Tab */}
      {activeTab === 'workers' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium px-1">
            <span>
              Showing <strong className="text-gray-900">{filteredWorkers.length}</strong> contract workers
            </span>

            <div className="flex items-center space-x-1 border border-gray-200 bg-white rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition ${
                  viewMode === 'grid' ? 'bg-yellow-50 text-yellow-600 shadow-xs' : 'text-gray-400'
                }`}
                title="Grid View"
              >
                <FiGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition ${
                  viewMode === 'table' ? 'bg-yellow-50 text-yellow-600 shadow-xs' : 'text-gray-400'
                }`}
                title="Table View"
              >
                <FiList className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200 p-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center mx-auto text-xl font-bold">
                <FiUsers />
              </div>
              <h3 className="text-sm font-bold text-gray-900">No Contract Workers Found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {searchQuery || selectedTrade !== 'All'
                  ? 'No workers match current filters. Try resetting search.'
                  : 'Start registering site laborers, carpenters, electricians, and painters.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingWorker(null);
                  setWorkerModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg shadow-sm inline-flex items-center gap-1"
              >
                <FiPlus /> Register Worker
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {filteredWorkers.map((worker) => (
                <div
                  key={worker.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-yellow-400 transition-all p-3 sm:p-3.5 space-y-2.5 flex flex-col justify-between"
                >
                  {/* Card Top */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-yellow-300 bg-yellow-50 flex items-center justify-center flex-shrink-0">
                          {worker.photo_url ? (
                            <img
                              src={worker.photo_url}
                              alt={worker.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-yellow-800 font-bold text-xs sm:text-sm">
                              {worker.full_name.charAt(0)}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h4
                            onClick={() => setSelectedWorkerForDetails(worker)}
                            className="text-xs sm:text-sm font-bold text-gray-900 hover:text-yellow-600 cursor-pointer transition truncate"
                          >
                            {worker.full_name}
                          </h4>
                          <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                            <FiPhone className="text-[10px] text-gray-400" /> {worker.phone}
                          </p>
                        </div>
                      </div>

                      {/* Status badge */}
                      <button
                        type="button"
                        onClick={() => handleToggleWorkerStatus(worker)}
                        title={worker.is_active ? 'Click to deactivate' : 'Click to activate'}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold transition ${
                          worker.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {worker.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </div>

                    {/* Trade & Rate Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
                      <span className="bg-yellow-50 text-yellow-800 border border-yellow-200 font-medium px-2 py-0.5 rounded text-[11px]">
                        {worker.trade}
                      </span>
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                        {worker.skill_level}
                      </span>
                      <span className="font-bold text-gray-900 ml-auto flex items-center text-xs">
                        <TbCurrencyRupee className="inline text-xs" />
                        {worker.daily_wage || 0}/{worker.wage_type?.toLowerCase() || 'day'}
                      </span>
                    </div>

                    {/* Vendor & Project Meta */}
                    <div className="mt-2 pt-1.5 border-t border-gray-100 space-y-0.5 text-[11px] text-gray-600">
                      <div className="flex items-center gap-1.5 truncate">
                        <FiBriefcase className="text-gray-400 text-xs flex-shrink-0" />
                        <span className="truncate">
                          {worker.vendor ? (
                            <strong className="text-gray-800">{worker.vendor.name}</strong>
                          ) : (
                            <span className="text-gray-500 italic">Independent Worker</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 truncate">
                        <FiMapPin className="text-gray-400 text-xs flex-shrink-0" />
                        <span className="truncate">
                          {worker.assigned_project ? (
                            <span className="text-emerald-700 font-medium">
                              Site: {worker.assigned_project.title}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Pool / Unassigned</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Quick Actions */}
                  <div className="pt-1.5 flex items-center justify-between border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      <a
                        href={`tel:${getCleanPhone(worker.phone)}`}
                        className="p-1.5 rounded-md text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 transition"
                        title="Call Worker"
                      >
                        <FiPhone className="h-3.5 w-3.5" />
                      </a>
                      <a
                        href={`https://wa.me/91${getCleanPhone(worker.phone)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-md text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 transition"
                        title="Message on WhatsApp"
                      >
                        <FiMessageCircle className="h-3.5 w-3.5" />
                      </a>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWorker(worker);
                          setWorkerModalOpen(true);
                        }}
                        className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
                        title="Edit Worker"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedWorkerForDetails(worker)}
                        className="px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-50 hover:bg-yellow-100 rounded-md transition"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Table View */
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                    <tr>
                      <th className="px-3 sm:px-4 py-3">Worker Name</th>
                      <th className="px-3 sm:px-4 py-3">Trade / Skill</th>
                      <th className="px-3 sm:px-4 py-3">Vendor</th>
                      <th className="px-3 sm:px-4 py-3">Assigned Site</th>
                      <th className="px-3 sm:px-4 py-3">Wage</th>
                      <th className="px-3 sm:px-4 py-3">Status</th>
                      <th className="px-3 sm:px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredWorkers.map((worker) => (
                      <tr key={worker.id} className="hover:bg-yellow-50/30 transition">
                        <td className="px-3 sm:px-4 py-2.5 font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-yellow-100 text-yellow-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {worker.full_name.charAt(0)}
                            </div>
                            <div>
                              <div
                                onClick={() => setSelectedWorkerForDetails(worker)}
                                className="cursor-pointer hover:underline"
                              >
                                {worker.full_name}
                              </div>
                              <span className="text-[10px] text-gray-400 font-normal">
                                {worker.phone}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5">
                          <span className="bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded text-[11px] font-medium">
                            {worker.trade}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-gray-700">
                          {worker.vendor ? worker.vendor.name : <span className="text-gray-400 italic">Independent</span>}
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-gray-700">
                          {worker.assigned_project ? (
                            <span className="text-emerald-700 font-medium">
                              {worker.assigned_project.title}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Pool</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 font-semibold text-gray-900">
                          ₹{worker.daily_wage || 0} / {worker.wage_type?.toLowerCase() || 'day'}
                        </td>
                        <td className="px-3 sm:px-4 py-2.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              worker.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {worker.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedWorkerForDetails(worker)}
                              className="p-1 text-yellow-700 hover:text-yellow-800"
                              title="View details"
                            >
                              <FiEye />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingWorker(worker);
                                setWorkerModalOpen(true);
                              }}
                              className="p-1 text-gray-600 hover:text-gray-900"
                              title="Edit"
                            >
                              <FiEdit2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Content Area: Vendors Tab */}
      {activeTab === 'vendors' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500 font-medium px-1">
            Showing <strong className="text-gray-900">{filteredVendors.length}</strong> registered vendors & subcontractors
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200 p-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center mx-auto text-xl font-bold">
                <FiBriefcase />
              </div>
              <h3 className="text-sm font-bold text-gray-900">No Vendors Found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Register agencies, suppliers, and trade subcontractors to link with your workforce.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingVendor(null);
                  setVendorModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg shadow-sm inline-flex items-center gap-1"
              >
                <FiPlus /> Register Vendor
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {filteredVendors.map((vendor) => {
                const linkedWorkersCount = workers.filter((w) => w.vendor_id === vendor.id).length;
                return (
                  <div
                    key={vendor.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-yellow-400 transition-all p-3 sm:p-3.5 space-y-2.5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4
                            onClick={() => setSelectedVendorForDetails(vendor)}
                            className="text-xs sm:text-sm font-bold text-gray-900 hover:text-yellow-600 cursor-pointer transition"
                          >
                            {vendor.name}
                          </h4>
                          <span className="text-[10px] text-gray-500 capitalize">
                            {vendor.vendor_type?.replace('_', ' ') || 'Subcontractor'}
                          </span>
                        </div>

                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            vendor.is_active !== false
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {vendor.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* Trade Badge */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="bg-yellow-50 text-yellow-800 border border-yellow-200 font-medium px-2 py-0.5 rounded text-[11px]">
                          {vendor.trade_category || 'General'}
                        </span>
                        {!!vendor.daily_wage && (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium px-2 py-0.5 rounded text-[11px]">
                            ₹{vendor.daily_wage}/{vendor.wage_type?.toLowerCase() || 'day'}
                          </span>
                        )}
                        <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                          <FiUsers className="text-[10px]" /> {linkedWorkersCount} workers
                        </span>
                      </div>

                      {/* Representative & Contact Info */}
                      <div className="mt-2 pt-1.5 border-t border-gray-100 space-y-0.5 text-[11px] text-gray-600">
                        {vendor.contact_name && (
                          <div className="text-gray-800 font-medium">
                            Contact: {vendor.contact_name}
                          </div>
                        )}
                        {vendor.contact_phone && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <FiPhone className="text-[10px]" /> {vendor.contact_phone}
                          </div>
                        )}
                        {(vendor.city || vendor.state) && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <FiMapPin className="text-[10px]" />
                            {vendor.city ? `${vendor.city}, ` : ''}{vendor.state}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-1.5 flex items-center justify-between border-t border-gray-100">
                      {vendor.contact_phone ? (
                        <a
                          href={`tel:${getCleanPhone(vendor.contact_phone)}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-50 text-yellow-800 hover:bg-yellow-100 rounded-md text-xs font-semibold transition"
                        >
                          <FiPhone className="text-xs" /> Call
                        </a>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">No phone</span>
                      )}

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVendor(vendor);
                            setVendorModalOpen(true);
                          }}
                          className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
                          title="Edit Vendor"
                        >
                          <FiEdit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedVendorForDetails(vendor)}
                          className="px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-50 hover:bg-yellow-100 rounded-md transition"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals & Drawers */}
      <WorkerRegistrationModal
        isOpen={workerModalOpen}
        onClose={() => {
          setWorkerModalOpen(false);
          setEditingWorker(null);
        }}
        onSuccess={handleWorkerSaved}
        initialData={editingWorker}
        vendors={vendors}
        projects={projects}
      />

      <VendorRegistrationModal
        isOpen={vendorModalOpen}
        onClose={() => {
          setVendorModalOpen(false);
          setEditingVendor(null);
        }}
        onSuccess={handleVendorSaved}
        initialData={editingVendor}
      />

      <WorkerDetailsModal
        isOpen={!!selectedWorkerForDetails}
        onClose={() => setSelectedWorkerForDetails(null)}
        worker={selectedWorkerForDetails}
        onEdit={(w) => {
          setEditingWorker(w);
          setWorkerModalOpen(true);
        }}
        onDelete={handleDeleteWorker}
        onToggleStatus={handleToggleWorkerStatus}
      />

      <VendorDetailsModal
        isOpen={!!selectedVendorForDetails}
        onClose={() => setSelectedVendorForDetails(null)}
        vendor={selectedVendorForDetails}
        workers={workers}
        onEdit={(v) => {
          setEditingVendor(v);
          setVendorModalOpen(true);
        }}
        onDelete={handleDeleteVendor}
        onAddWorkerForVendor={(v) => {
          setEditingWorker({
            vendor_id: v.id,
            full_name: '',
            phone: '',
            trade: v.trade_category || 'Carpentry',
            skill_level: 'Skilled',
            wage_type: v.wage_type || 'Daily',
            daily_wage: v.daily_wage || 800,
            is_active: true,
          } as any);
          setWorkerModalOpen(true);
        }}
        onSelectWorker={(w) => setSelectedWorkerForDetails(w)}
      />
    </div>
  );
}
