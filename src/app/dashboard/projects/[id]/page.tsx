'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { formatDateIST } from '@/lib/dateUtils';
import { FiClock, FiLayers, FiImage, FiEdit2, FiTrash2, FiX, FiPlus, FiUpload, FiSend, FiColumns, FiCheckCircle, FiArrowLeft } from 'react-icons/fi';
import { EditProjectModal } from '@/components/projects/EditProjectModal';
import type { BOQTabHandle } from '@/components/projects/BOQTab';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { SnagTabHandle } from '@/components/projects/SnagTab';
import { createPortal } from 'react-dom';

// Helper for Portal
const ClientPortal = ({ children, selector }: { children: React.ReactNode; selector: string }) => {
  const [mounted, setMounted] = useState(false);
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setElement(document.querySelector(selector) as HTMLElement);
  }, [selector]);

  if (!mounted || !element) return null;
  return createPortal(children, element);
};

// Page runs as a client component to use interactive tabs/boards

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  workflow_stage: string | null;
  customer_name: string;
  phone_number: string;
  alt_phone_number: string | null;
  address: string;
  property_type: string | null;
  apartment_name: string | null;
  block_number: string | null;
  flat_number: string | null;
  floor_number: string | null;
  area_sqft: string | null;
  start_date: string;
  estimated_completion_date: string;
  actual_completion_date?: string | null;
  carpenter_name: string | null;
  carpenter_phone: string | null;
  electrician_name: string | null;
  electrician_phone: string | null;
  plumber_name: string | null;
  plumber_phone: string | null;
  painter_name: string | null;
  painter_phone: string | null;
  granite_worker_name: string | null;
  granite_worker_phone: string | null;
  glass_worker_name: string | null;
  glass_worker_phone: string | null;
  project_budget: number | null;
  project_notes: string | null;
  requirements_pdf_url: string | null;
  assigned_employee: {
    id: string;
    name: string;
    email: string;
    designation?: string;
  } | null;
  created_by: string;
};


const UpdatesTab = dynamic(() => import('@/components/projects/UpdatesTab').then(m => m.UpdatesTab), { ssr: false });
const InventoryTab = dynamic(() => import('@/components/projects/InventoryTab').then(m => m.InventoryTab), { ssr: false }) as any;
const DesignsTab = dynamic(() => import('@/components/projects/DesignsTab').then(m => m.DesignsTab), { ssr: false });
const BOQTab = dynamic(() => import('@/components/projects/BOQTab').then(m => m.BOQTab), { ssr: false });
const ProcurementTab = dynamic(() => import('@/components/projects/ProcurementTab').then(m => m.ProcurementTab), { ssr: false });
const SnagTab = dynamic(() => import('@/components/projects/SnagTab'), { ssr: false });
const SiteLogTab = dynamic(() => import('@/components/projects/SiteLogTab').then(m => m.SiteLogTab), { ssr: false }) as any;
const ProposalBuilder = dynamic(() => import('@/components/boq/ProposalBuilder').then(m => m.ProposalBuilder), { ssr: false });

// Removed ProjectHeader import
import { StageNavigator, StageId, ActionItem, StageStatus } from '@/components/projects/navigation/StageNavigator';
import { SubTabNav, STAGE_SUB_TABS, getDefaultSubTab } from '@/components/projects/navigation/SubTabNav';
import { ProjectUsersPanel } from '@/components/projects/ProjectUsersPanel';

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTitle, setSubtitle, clearHeader } = useHeaderTitle();

  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { hasPermission, isAdmin: permIsAdmin } = useUserPermissions();
  const canEditProject = hasPermission('projects.edit');

  const [activeStage, setActiveStage] = useState<StageId>('visit');
  const [activeSubTab, setActiveSubTab] = useState<string>('details');
  const [editSection, setEditSection] = useState<'info' | 'customer' | 'property' | 'workers' | null>(null);
  const [editingWorker, setEditingWorker] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const boqRef = useRef<BOQTabHandle>(null);
  const inventoryRef = useRef<any>(null);
  const siteLogRef = useRef<any>(null);
  const snagRef = useRef<SnagTabHandle>(null);



  // Calculate visible stages based on permissions
  const visibleStages = useMemo(() => {
    // Admin users see all stages
    if (permIsAdmin) {
      return ['visit', 'design', 'boq', 'orders', 'work_progress', 'snag', 'finance'] as StageId[];
    }

    // Build list of visible stages based on permissions
    const stages: StageId[] = ['visit']; // visit is always visible if user can view project

    if (hasPermission('designs.view')) stages.push('design');
    if (hasPermission('boq.view')) stages.push('boq');

    // Orders stage is visible if user has ANY relevant procurement/finance permission
    if (hasPermission('procurement.view') ||
      hasPermission('orders.view') ||
      hasPermission('proposals.view') ||
      hasPermission('invoices.view') ||
      hasPermission('payments.view')) {
      stages.push('orders');
    }

    if (hasPermission('inventory.view') || hasPermission('updates.view')) stages.push('work_progress');
    if (hasPermission('snags.view')) stages.push('snag');
    if (hasPermission('finance.view')) stages.push('finance');

    return stages;
  }, [permIsAdmin, hasPermission]);

  // Memoize filtered sub-tabs for the current stage
  const currentStageTabs = useMemo(() => {
    const allTabs = STAGE_SUB_TABS[activeStage] || [];
    if (permIsAdmin) return allTabs;
    return allTabs.filter(tab => !tab.permission || hasPermission(tab.permission));
  }, [activeStage, permIsAdmin, hasPermission]);



  // Header Context Logic
  useEffect(() => {
    if (project) {
      const getStatusColor = (s: string) => {
        switch (s?.toLowerCase()) {
          case 'completed': return 'bg-green-100 text-green-700';
          case 'in_progress': return 'bg-blue-100 text-blue-700';
          default: return 'bg-yellow-100 text-yellow-700';
        }
      };
      const status = project.status;
      const displayStatus = status?.replace(/_/g, ' ').toUpperCase() || 'UNKNOWN';
      const StatusBadge = (
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden sm:inline text-gray-500">Project Status:</span>
          <span className={`px-2 py-0.5 rounded-full font-medium text-xs flex items-center gap-1 ${getStatusColor(status)}`}>
            {displayStatus}
            {status === 'completed' ? <FiCheckCircle className="w-3 h-3" /> : <FiClock className="w-3 h-3" />}
          </span>
        </div>
      );

      const TitleComponent = (
        <div className="flex items-center gap-3">
          <div className="flex items-center text-gray-900 text-sm font-semibold">
            {project.title}
          </div>
        </div>
      );

      setTitle(TitleComponent);
      setSubtitle(StatusBadge);
    }

    return () => clearHeader();
  }, [project, setTitle, setSubtitle, clearHeader, router]);

  const stageActions = useMemo<ActionItem[]>(() => {
    if (activeStage === 'work_progress') {
      if (activeSubTab === 'inventory' && hasPermission('inventory.add')) {
        return [
          {
            label: 'Add Item',
            onClick: () => inventoryRef.current?.openAddItem(),
            icon: <FiPlus className="w-4 h-4" />
          }
        ];
      }
      if (activeSubTab === 'daily_logs' && hasPermission('site_logs.create')) {
        return [
          {
            label: 'Add Daily Log',
            onClick: () => siteLogRef.current?.openAddLog(),
            icon: <FiPlus className="w-4 h-4" />
          }
        ];
      }
    }
    if (activeStage === 'boq') {
      return [
        {
          label: 'Add Item',
          onClick: () => boqRef.current?.openAddItem(),
          icon: <FiPlus className="w-4 h-4" />
        },
        {
          label: 'Import Excel',
          onClick: () => boqRef.current?.openImport(),
          icon: <FiUpload className="w-4 h-4" />
        },
        {
          label: 'Create Proposal',
          onClick: () => boqRef.current?.openProposal(),
          icon: <FiSend className="w-4 h-4" />
        },
        {
          label: 'Compare BOQ vs Order',
          onClick: () => router.push(`/dashboard/projects/${id}/compare`),
          icon: <FiColumns className="w-4 h-4" />
        }
      ];
    }
    if (activeStage === 'snag' && hasPermission('snags.create')) {
      return [
        {
          label: 'Raise Snag',
          onClick: () => snagRef.current?.openAddSnag(),
          icon: <FiPlus className="w-4 h-4" />
        }
      ];
    }
    return [];
  }, [activeStage, activeSubTab, hasPermission, id, router]);


  const getStageStatus = (stage: StageId): StageStatus | undefined => {
    switch (stage) {
      case 'visit':
        return { label: 'Visit Status', value: 'Completed', color: 'green' };
      case 'design':
        return { label: 'Design Status', value: 'Design Review', color: 'orange' };
      case 'boq':
        return { label: 'BOQ Status', value: 'Draft', color: 'gray' };
      case 'orders':
        return { label: 'Order Status', value: 'Pending', color: 'blue' };
      default:
        return undefined;
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync Stage and Tab from URL query params
  useEffect(() => {
    const stageParam = searchParams?.get('stage');
    const tabParam = searchParams?.get('tab');

    if (stageParam && ['visit', 'design', 'boq', 'orders', 'work_progress', 'snag', 'finance'].includes(stageParam)) {
      if (stageParam !== activeStage) {
        setActiveStage(stageParam as StageId);
      }
    }

    if (tabParam && tabParam !== activeSubTab) {
      setActiveSubTab(tabParam);
    }
  }, [searchParams]);

  const handleStageChange = (stage: StageId) => {
    setActiveStage(stage);

    // Get permitted tabs for this stage
    const allTabsForStage = STAGE_SUB_TABS[stage] || [];
    const permittedTabs = allTabsForStage.filter(tab => !tab.permission || hasPermission(tab.permission));

    // Determine default sub-tab
    let newTab = getDefaultSubTab(stage);
    if (permittedTabs.length > 0) {
      newTab = permittedTabs[0].id;
    }

    setActiveSubTab(newTab);
    router.push(`/dashboard/projects/${id}?stage=${stage}&tab=${newTab}`, { scroll: false });
  };

  const handleTabChange = (tabId: string) => {
    setActiveSubTab(tabId);
    // Persist tab to URL
    const params = new URLSearchParams(searchParams?.toString());
    params.set('tab', tabId);
    // Ensure stage is also present
    if (!params.has('stage')) {
      params.set('stage', activeStage);
    }
    router.push(`/dashboard/projects/${id}?${params.toString()}`, { scroll: false });
  };

  // ... [Keep existing fetchProject logic] ...
  const fetchProject = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch the project using API route for better security and consistency
      console.log('Fetching project with ID:', id);
      const response = await fetch(`/api/admin/projects?id=${id}`, {
        // Add cache control to ensure we get fresh data
        cache: 'no-store',
        next: { tags: [`project-${id}`] }
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('You are not authorized to view this project');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to view this project');
        }

        let errorMessage = 'Failed to fetch project';
        try {
          const errorData = await response.json();
          console.log('Error response data:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          console.log('Could not parse error response as JSON');
        }

        throw new Error(errorMessage);
      }

      const projectsData = await response.json();
      console.log('Project data received:', projectsData);

      const projectData = Array.isArray(projectsData) ? projectsData[0] : projectsData;

      if (!projectData) {
        throw new Error('Project not found');
      }

      setProject(projectData as Project);
      // NOTE: We no longer set title/subtitle in context, the header consumes project data directly

    } catch (err: any) {
      console.error('Error fetching project:', err);
      setError(err.message || 'Failed to load project');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    fetchProject();
  }, [id, user, isAdmin, authLoading, router]);

  const onSaveProject = async (data: any) => {
    setIsSaving(true);
    try {
      const { ...updateData } = data;
      // ... same logic
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update project');
      }

      const { project: updatedProject } = await response.json();
      setProject(updatedProject);
      setEditSection(null);
      setEditingWorker(undefined); // Reset editing worker
    } catch (err: any) {
      console.error('Error updating project:', err);
      // alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditWorker = (worker: string) => {
    setEditingWorker(worker);
    setEditSection('workers');
  };

  const handleDeleteWorker = async (worker: string) => {
    if (!project) return;
    if (!confirm(`Are you sure you want to remove the ${worker.replace('_', ' ')}?`)) return;

    try {
      setIsSaving(true);
      const updateData = {
        [`${worker}_name`]: null,
        [`${worker}_phone`]: null
      };

      const response = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('Failed to delete worker');
      }

      const { project: updatedProject } = await response.json();
      setProject(updatedProject);
    } catch (err) {
      console.error('Error deleting worker:', err);
      alert('Failed to delete worker');
    } finally {
      setIsSaving(false);
    }
  };

  // [Keep visibility change logic]
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page is visible, refreshing project data...');
        fetchProject();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const handleRouteChange = () => {
      console.log('Route changed, refreshing project data...');
      fetchProject();
    };
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [id]);


  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error || 'Project not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-white overflow-x-hidden w-full max-w-full min-w-0">


      {/* 2. Pipeline Navigator & 3. Sub-Tab Navigation - MOVED TO HEADER VIA PORTAL */}
      <ClientPortal selector="#project-navigation-portal">
        <div className="w-full">
          <StageNavigator
            currentStage={activeStage}
            onStageSelect={handleStageChange}
            completedStages={[]}
            actions={stageActions}
            stageStatus={getStageStatus(activeStage)}
            visibleStages={visibleStages}
          />
          <SubTabNav
            tabs={currentStageTabs}
            activeTab={activeSubTab}
            onTabChange={handleTabChange}
          />
        </div>
      </ClientPortal>

      {/* 4. Content Area */}
      <div className="flex-1 flex flex-col relative px-4 pb-20 sm:pb-0 overflow-x-hidden">




        <div className="flex-1 overflow-y-auto bg-gray-50/50">
          {/* STAGE: VISIT */}
          {activeStage === 'visit' && (
            <div className="p-2 sm:p-4 md:p-6 w-full">
              <div className="flex flex-col lg:flex-row gap-4 md:gap-6 max-w-7xl mx-auto">
                {/* Left Column - Project Details */}
                <div className="flex-1 min-w-0 space-y-4 md:space-y-6">
                  {activeSubTab === 'details' && (
                    <>
                      {/* Basic Project Information */}
                      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">Project Information</h3>
                          {canEditProject && (
                            <button
                              onClick={() => setEditSection('info')}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                          <div>
                            <dt className="text-sm font-medium text-gray-500 mb-1">Description</dt>
                            <dd className="text-sm text-gray-900">{project.description || 'No description provided.'}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500 mb-1">Status</dt>
                            <dd className="text-sm">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.status === 'completed' ? 'bg-green-100 text-green-800' :
                                project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                  project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                {project.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                              </span>
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500 mb-1">Workflow Stage</dt>
                            <dd className="text-sm text-gray-900">{project.workflow_stage?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Not set'}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500 mb-1">Start Date</dt>
                            <dd className="text-sm text-gray-900">{formatDateIST(project.start_date)}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500 mb-1">Expected Completion</dt>
                            <dd className="text-sm text-gray-900">{formatDateIST(project.estimated_completion_date)}</dd>
                          </div>
                          {project.status === 'completed' && project.actual_completion_date && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Actual Completion</dt>
                              <dd className="text-sm text-gray-900">{formatDateIST(project.actual_completion_date)}</dd>
                            </div>
                          )}
                          {project.project_budget && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Project Budget</dt>
                              <dd className="text-sm text-gray-900 font-medium">₹{project.project_budget.toLocaleString('en-IN')}</dd>
                            </div>
                          )}
                        </div>
                        {project.project_notes && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <dt className="text-sm font-medium text-gray-500 mb-1">Project Notes</dt>
                            <dd className="text-sm text-gray-900 whitespace-pre-line">{project.project_notes}</dd>
                          </div>
                        )}
                      </div>

                      {/* Customer & Contact Details */}
                      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">Customer & Contact Details</h3>
                          {canEditProject && (
                            <button
                              onClick={() => setEditSection('customer')}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                          <div>
                            <dt className="text-sm font-medium text-gray-500 mb-1">Customer Name</dt>
                            <dd className="text-sm text-gray-900">{project.customer_name}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500 mb-1">Phone Number</dt>
                            <dd className="text-sm text-gray-900">
                              <a href={`tel:${project.phone_number}`} className="text-amber-600 hover:text-amber-700">
                                {project.phone_number}
                              </a>
                            </dd>
                          </div>
                          {project.alt_phone_number && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Alternate Phone</dt>
                              <dd className="text-sm text-gray-900">
                                <a href={`tel:${project.alt_phone_number}`} className="text-amber-600 hover:text-amber-700">
                                  {project.alt_phone_number}
                                </a>
                              </dd>
                            </div>
                          )}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <dt className="text-sm font-medium text-gray-500 mb-1">Address</dt>
                          <dd className="text-sm text-gray-900 whitespace-pre-line">{project.address}</dd>
                        </div>
                      </div>

                      {/* Property Details */}
                      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">Property Details</h3>
                          {canEditProject && (
                            <button
                              onClick={() => setEditSection('property')}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                          <div>
                            <dt className="text-sm font-medium text-gray-500 mb-1">Property Type</dt>
                            <dd className="text-sm text-gray-900">{project.property_type?.replace(/\b\w/g, l => l.toUpperCase()) || 'Not specified'}</dd>
                          </div>
                          {project.apartment_name && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Apartment/Building Name</dt>
                              <dd className="text-sm text-gray-900">{project.apartment_name}</dd>
                            </div>
                          )}
                          {project.block_number && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Block Number</dt>
                              <dd className="text-sm text-gray-900">{project.block_number}</dd>
                            </div>
                          )}
                          {project.flat_number && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Flat Number</dt>
                              <dd className="text-sm text-gray-900">{project.flat_number}</dd>
                            </div>
                          )}
                          {project.floor_number && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Floor Number</dt>
                              <dd className="text-sm text-gray-900">{project.floor_number}</dd>
                            </div>
                          )}
                          {project.area_sqft && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500 mb-1">Area (sq.ft)</dt>
                              <dd className="text-sm text-gray-900">{project.area_sqft}</dd>
                            </div>
                          )}
                        </div>
                      </div>





                      {/* Contractors / Workers */}
                    </>
                  )}
                  {activeSubTab === 'workers' && (
                    <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Contractors & Workers</h3>
                        {canEditProject && (
                          <button
                            onClick={() => setEditSection('workers')}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {(!project.carpenter_name && !project.electrician_name && !project.plumber_name &&
                          !project.painter_name && !project.granite_worker_name && !project.glass_worker_name) && (
                            <div className="col-span-full py-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                              <p className="text-gray-500 text-sm">No workers appointed yet.</p>
                              <p className="text-gray-400 text-xs mt-1">Click the edit button to add worker details.</p>
                            </div>
                          )}
                        {['carpenter', 'electrician', 'plumber', 'painter', 'granite_worker', 'glass_worker'].map((worker) => {
                          const workerNameKey = `${worker}_name` as keyof Project;
                          const workerPhoneKey = `${worker}_phone` as keyof Project;
                          const workerName = project[workerNameKey] as string | undefined;
                          const workerPhone = project[workerPhoneKey] as string | undefined;

                          if (!workerName) return null;

                          return (
                            <div key={worker} className="p-3 bg-gray-50 rounded-lg group relative">
                              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEditWorker(worker)}
                                  className="p-1 text-gray-400 hover:text-amber-600 bg-white rounded shadow-sm hover:shadow"
                                  title="Edit"
                                >
                                  <FiEdit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteWorker(worker)}
                                  className="p-1 text-gray-400 hover:text-red-600 bg-white rounded shadow-sm hover:shadow"
                                  title="Remove"
                                >
                                  <FiTrash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-2">
                                {worker.replace('_', ' ')}
                              </dt>
                              <dd className="text-sm text-gray-900 font-medium">{workerName}</dd>
                              {workerPhone && (
                                <dd className="text-sm">
                                  <a href={`tel:${workerPhone}`} className="text-amber-600 hover:text-amber-700">
                                    {workerPhone}
                                  </a>
                                </dd>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Project Users Panel */}
                <div className="w-full lg:w-80 flex-shrink-0">
                  <ProjectUsersPanel
                    projectId={project.id}
                    assignedEmployee={project.assigned_employee}
                    createdBy={project.created_by}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STAGE: DESIGN */}
          {activeStage === 'design' && (
            <DesignsTab projectId={project.id} />
          )}

          {/* STAGE: BOQ */}
          {activeStage === 'boq' && (
            <div className="h-full flex flex-col">
              <BOQTab projectId={project.id} ref={boqRef} />
            </div>
          )}

          {/* STAGE: ORDERS */}
          {activeStage === 'orders' && (
            <div className="h-full flex flex-col">
              <ProcurementTab
                projectId={project.id}
                projectAddress={project.address}
                activeSubTab={activeSubTab}
              />
            </div>
          )}

          {/* STAGE: WORK PROGRESS */}
          {activeStage === 'work_progress' && (
            <div className="h-full">
              {activeSubTab === 'updates' ? (
                <div className="p-4 sm:p-6 max-w-7xl mx-auto">
                  <UpdatesTab projectId={project.id} />
                </div>
              ) : activeSubTab === 'daily_logs' ? (
                <div className="h-full">
                  <SiteLogTab projectId={project.id} ref={siteLogRef} />
                </div>
              ) : (
                <InventoryTab projectId={project.id} ref={inventoryRef} />
              )}
            </div>
          )}

          {/* STAGE: SNAG (Placeholder) */}
          {activeStage === 'snag' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[600px]">
              <SnagTab projectId={project.id} userId={user?.id || ''} userRole={isAdmin ? 'admin' : 'user'} ref={snagRef} />
            </div>
          )}

          {/* STAGE: FINANCE (Placeholder) */}
          {activeStage === 'finance' && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FiLayers className="w-12 h-12 mb-2 text-gray-300" />
              <p>Finance Module Coming Soon</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <EditProjectModal
        isOpen={!!editSection}
        onClose={() => setEditSection(null)}
        onSave={onSaveProject}
        section={editSection}
        initialData={project}
        isSaving={isSaving}
        initialWorker={editingWorker}
      />
    </div>
  );
}