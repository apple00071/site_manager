'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { formatDateIST } from '@/lib/dateUtils';
import { FiClock, FiLayers, FiImage, FiEdit2, FiTrash2, FiX, FiPlus, FiUpload, FiSend, FiColumns, FiCheckCircle, FiArrowLeft, FiFileText } from 'react-icons/fi';
import type { BOQTabHandle } from '@/components/projects/BOQTab';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { SnagTabHandle } from '@/components/projects/SnagTab';
import { createPortal } from 'react-dom';
import { TabSkeleton } from './ProjectSkeleton';

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

export type Project = {
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

const UpdatesTab = dynamic(() => import('@/components/projects/UpdatesTab').then(m => m.UpdatesTab), { ssr: false, loading: () => <div className="p-6 space-y-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/4"></div><div className="h-32 bg-gray-100 rounded w-full"></div></div> });
const ExpensesTab = dynamic(() => import('@/components/projects/ExpensesTab').then(m => m.ExpensesTab), { ssr: false, loading: () => <div className="p-6 space-y-4 animate-pulse"><div className="h-8 bg-gray-200 rounded w-full"></div><div className="h-64 bg-gray-100 rounded w-full"></div></div> }) as any;
const DesignsTab = dynamic(() => import('@/components/projects/DesignsTab').then(m => m.DesignsTab), { ssr: false, loading: () => <div className="p-6 grid grid-cols-2 gap-4 animate-pulse"><div className="aspect-video bg-gray-200 rounded"></div><div className="aspect-video bg-gray-200 rounded"></div></div> });
const BOQTab = dynamic(() => import('@/components/projects/BOQTab').then(m => m.BOQTab), { ssr: false, loading: () => <div className="p-6 space-y-2 animate-pulse"><div className="h-10 bg-gray-200 rounded w-full"></div>{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-gray-50 rounded w-full"></div>)}</div> });
const ProcurementTab = dynamic(() => import('@/components/projects/ProcurementTab').then(m => m.ProcurementTab), { ssr: false, loading: () => <div className="p-6 space-y-6 animate-pulse"><div className="h-8 bg-gray-200 rounded w-1/3"></div><div className="grid grid-cols-3 gap-4"><div className="h-24 bg-gray-100 rounded"></div><div className="h-24 bg-gray-100 rounded"></div><div className="h-24 bg-gray-100 rounded"></div></div></div> });
const SnagTab = dynamic(() => import('@/components/projects/SnagTab'), { ssr: false, loading: () => <div className="p-6 space-y-4 animate-pulse"><div className="h-10 bg-gray-200 rounded w-full"></div><div className="grid grid-cols-1 gap-3"><div className="h-20 bg-gray-50 rounded"></div><div className="h-20 bg-gray-50 rounded"></div></div></div> });
const SiteLogTab = dynamic(() => import('@/components/projects/SiteLogTab').then(m => m.SiteLogTab), { ssr: false, loading: () => <TabSkeleton /> }) as any;
const ProgressReportTab = dynamic(() => import('@/components/projects/ProgressReportTab').then(m => m.ProgressReportTab), { ssr: false, loading: () => <TabSkeleton /> }) as any;
const HandoverTab = dynamic(() => import('@/components/projects/HandoverTab').then(m => m.HandoverTab), { ssr: false, loading: () => <TabSkeleton /> });
const VisitTab = dynamic(() => import('@/components/projects/tabs/VisitTab').then(m => m.VisitTab), { ssr: false, loading: () => <TabSkeleton /> });

// Lazy load Modals
const EditProjectModal = dynamic(() => import('@/components/projects/EditProjectModal').then(m => m.EditProjectModal), { ssr: false });
const ShareLinkModal = dynamic(() => import('@/components/projects/ShareLinkModal').then(m => m.ShareLinkModal), { ssr: false });

import { StageNavigator, StageId, ActionItem, StageStatus } from '@/components/projects/navigation/StageNavigator';
import { SubTabNav, STAGE_SUB_TABS, getDefaultSubTab } from '@/components/projects/navigation/SubTabNav';
import { ProjectUsersPanel } from '@/components/projects/ProjectUsersPanel';

interface ProjectDetailsClientProps {
  initialProject: Project;
}

export function ProjectDetailsClient({ initialProject }: ProjectDetailsClientProps) {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTitle, setSubtitle, clearHeader } = useHeaderTitle();

  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { hasPermission, isAdmin: permIsAdmin } = useUserPermissions();
  const canEditProject = hasPermission('projects.edit');

  const [activeStage, setActiveStage] = useState<StageId>((searchParams?.get('stage') as StageId) || 'visit');
  const [activeSubTab, setActiveSubTab] = useState<string>(searchParams?.get('tab') || 'details');
  const [editSection, setEditSection] = useState<'info' | 'customer' | 'property' | 'workers' | null>(null);
  const [editingWorker, setEditingWorker] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [project, setProject] = useState<Project>(initialProject);
  const [isLoading, setIsLoading] = useState(false); // Start as not loading because we have initialData
  const [error, setError] = useState<string | null>(null);

  const boqRef = useRef<BOQTabHandle>(null);
  const expensesRef = useRef<any>(null);
  const siteLogRef = useRef<any>(null);
  const snagRef = useRef<SnagTabHandle>(null);
  const reportRef = useRef<any>(null);
  const shareModalOverlayRef = useRef<HTMLDivElement>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Isolation for Share Modal
  useEffect(() => {
    if (!showShareModal) return;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehaviorY = 'none';

    const handleTouch = (e: TouchEvent) => {
      e.stopPropagation();
    };

    const overlay = shareModalOverlayRef.current;
    if (overlay) {
      overlay.addEventListener('touchstart', handleTouch, { passive: true });
      overlay.addEventListener('touchmove', handleTouch, { passive: false });
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.overscrollBehaviorY = '';
      if (overlay) {
        overlay.removeEventListener('touchstart', handleTouch);
        overlay.removeEventListener('touchmove', handleTouch);
      }
    };
  }, [showShareModal]);

  // Calculate visible stages based on permissions - simplified for performance
  const visibleStages = useMemo<StageId[]>(() => {
    if (!project) return ['visit'];
    
    if (permIsAdmin) {
      return ['visit', 'design', 'boq', 'work_progress', 'snag', 'finance', 'handover'];
    }

    const stages: StageId[] = ['visit'];
    if (hasPermission('designs.view')) stages.push('design');
    if (hasPermission('boq.view')) stages.push('boq');
    if (hasPermission('updates.view') || hasPermission('site_logs.view')) stages.push('work_progress');
    if (hasPermission('snags.view')) stages.push('snag');
    if (hasPermission('finance.view') || hasPermission('inventory.view')) stages.push('finance');
    
    if (project.status === 'handover' || project.status === 'completed') {
      stages.push('handover');
    }

    return stages;
  }, [hasPermission, permIsAdmin, project?.status]);

  const currentStageTabs = useMemo(() => {
    const allTabs = STAGE_SUB_TABS[activeStage] || [];
    if (permIsAdmin) return allTabs;
    return allTabs.filter(tab => !tab.permission || hasPermission(tab.permission));
  }, [activeStage, permIsAdmin, hasPermission]);

  useEffect(() => {
    if (searchParams.get('share') === '1' && project) {
      setShowShareModal(true);
    }
  }, [searchParams, project]);

  // Header Context Logic - Simplified for performance
  useEffect(() => {
    if (!project) return;

    const StatusBadge = (
      <div className="flex items-center gap-1 sm:gap-2 text-sm">
        <span className="hidden lg:inline text-gray-500">Project Status:</span>
        <span className={`hidden sm:flex px-2 py-0.5 rounded-full font-medium text-xs items-center gap-1 ${
          project.status === 'completed' ? 'bg-green-100 text-green-700' : 
          project.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 
          project.status === 'handover' ? 'bg-purple-100 text-purple-700' : 
          'bg-yellow-100 text-yellow-700'
        }`}>
          {project.status === 'pending' ? 'DESIGN PHASE' : 
           project.status === 'in_progress' ? 'EXECUTION PHASE' : 
           project.status === 'handover' ? 'HANDOVER PHASE' : 
           project.status?.toUpperCase() || 'UNKNOWN'}
          {project.status === 'completed' ? <FiCheckCircle className="w-3 h-3" /> : <FiClock className="w-3 h-3" />}
        </span>
      </div>
    );

    const TitleComponent = (
      <div className="flex items-center gap-3">
        <span className="text-gray-900 text-sm font-semibold truncate max-w-[200px] sm:max-w-none">
          {project.title}
        </span>
        {permIsAdmin && (
          <button
            onClick={() => setShowShareModal(true)}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-full transition-colors"
            title="Portal Access"
          >
            <FiSend className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );

    setTitle(TitleComponent);
    setSubtitle(StatusBadge);
    
    return () => clearHeader();
  }, [project, setTitle, setSubtitle, clearHeader]);

  const stageActions = useMemo<ActionItem[]>(() => {
    if (activeStage === 'work_progress') {
      if (activeSubTab === 'daily_logs' && hasPermission('site_logs.create')) {
        return [{ label: 'Add Work Entry', onClick: () => siteLogRef.current?.openAddLog(), icon: <FiPlus className="w-4 h-4" /> }];
      }
      if (activeSubTab === 'progress_reports' && (hasPermission('site_logs.create') || hasPermission('projects.edit'))) {
        return [
          { label: 'Generate DPR', onClick: () => reportRef.current?.openGenerator(), icon: <FiPlus className="w-4 h-4" /> },
          { label: 'Report Settings', onClick: () => reportRef.current?.openSettings(), icon: <FiLayers className="w-4 h-4" /> }
        ];
      }
    }
    if (activeStage === 'boq') {
      return [
        { label: 'Add Item', onClick: () => boqRef.current?.openAddItem(), icon: <FiPlus className="w-4 h-4" /> },
        { label: 'Import Excel', onClick: () => boqRef.current?.openImport(), icon: <FiUpload className="w-4 h-4" /> },
        { label: 'Create Proposal', onClick: () => boqRef.current?.openProposal(), icon: <FiSend className="w-4 h-4" /> },
        { label: 'Compare BOQ vs Order', onClick: () => router.push(`/dashboard/projects/${id}/compare`), icon: <FiColumns className="w-4 h-4" /> }
      ];
    }
    if (activeStage === 'snag' && hasPermission('snags.create')) {
      return [
        { label: 'Raise Snag', onClick: () => snagRef.current?.openAddSnag(), icon: <FiPlus className="w-4 h-4" /> },
        { label: 'Export Snag Report', onClick: () => snagRef.current?.exportSnagReport(), icon: <FiFileText className="w-4 h-4" /> }
      ];
    }
    if (activeStage === 'finance') {
      if (activeSubTab === 'expenses' && hasPermission('inventory.add')) {
        return [{ label: 'Add Expense', onClick: () => expensesRef.current?.openAddItem(), icon: <FiPlus className="w-4 h-4" /> }];
      }
    }
    return [];
  }, [activeStage, activeSubTab, hasPermission, id, router]);

  const getStageStatus = (stage: StageId): StageStatus | undefined => {
    switch (stage) {
      case 'visit': return { label: 'Visit Status', value: 'Completed', color: 'green' };
      case 'design': return { label: 'Design Status', value: 'Design Review', color: 'orange' };
      case 'boq': return { label: 'BOQ Status', value: 'Draft', color: 'gray' };
      case 'orders': return { label: 'Order Status', value: 'Pending', color: 'blue' };
      default: return undefined;
    }
  };

  useEffect(() => {
    const stageParam = searchParams?.get('stage');
    const tabParam = searchParams?.get('tab');

    if (stageParam && ['visit', 'design', 'boq', 'orders', 'work_progress', 'snag', 'finance'].includes(stageParam)) {
      if (stageParam !== activeStage) setActiveStage(stageParam as StageId);
    }
    if (tabParam && tabParam !== activeSubTab) setActiveSubTab(tabParam);
  }, [searchParams]);

  const handleStageChange = (stage: StageId) => {
    setActiveStage(stage);
    const allTabsForStage = STAGE_SUB_TABS[stage] || [];
    const permittedTabs = allTabsForStage.filter(tab => !tab.permission || hasPermission(tab.permission));
    let newTab = getDefaultSubTab(stage);
    if (permittedTabs.length > 0) newTab = permittedTabs[0].id;
    setActiveSubTab(newTab);
    router.push(`/dashboard/projects/${id}?stage=${stage}&tab=${newTab}`, { scroll: false });
  };

  const handleTabChange = (tabId: string) => {
    setActiveSubTab(tabId);
    const params = new URLSearchParams(searchParams?.toString());
    params.set('tab', tabId);
    if (!params.has('stage')) params.set('stage', activeStage);
    router.push(`/dashboard/projects/${id}?${params.toString()}`, { scroll: false });
  };

  const fetchProject = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/projects?id=${id}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load project');
      const projectsData = await response.json();
      const projectData = Array.isArray(projectsData) ? projectsData[0] : projectsData;
      if (!projectData) throw new Error('Project not found');
      setProject(projectData as Project);
    } catch (err: any) {
      console.error('Error refreshing project:', err);
      if (!silent) setError(err.message || 'Failed to load project');
    } finally {
      setIsLoading(false);
    }
  };

  const onSaveProject = async (data: any) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update project');
      await fetchProject(true);
      setEditSection(null);
      setEditingWorker(undefined);
    } catch (err: any) {
      alert(err.message || 'Failed to update project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditWorker = (worker: string) => {
    setEditingWorker(worker);
    setEditSection('workers');
  };

  const handleDeleteWorker = async (worker: string) => {
    if (!project || !confirm(`Are you sure?`)) return;
    try {
      setIsSaving(true);
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [`${worker}_name`]: null, [`${worker}_phone`]: null }),
      });
      if (!response.ok) throw new Error('Failed');
      await fetchProject(true);
    } catch (err) {
      alert('Failed to delete worker');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div></div>;
  if (isLoading && !project) return <div className="p-6">Loading...</div>;
  if (error || !project) return <div className="p-6 underline text-red-500">{error || 'Project not found'}</div>;

  return (
    <div className="flex flex-col min-h-full bg-white overflow-x-hidden w-full max-w-full min-w-0">
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

      <div className="flex-1 flex flex-col relative px-4 pb-20 sm:pb-0 overflow-x-hidden">
        <div className="flex-1 overflow-y-auto bg-gray-50/50">
          {activeStage === 'visit' && (
            <VisitTab 
              project={project}
              canEditProject={canEditProject}
              isAdmin={isAdmin}
              onEdit={setEditSection}
              activeSubTab={activeSubTab}
            />
          )}

          {activeStage === 'design' && <DesignsTab projectId={project.id} />}
          {activeStage === 'boq' && <BOQTab projectId={project.id} ref={boqRef} />}
          {activeStage === 'orders' && <ProcurementTab projectId={project.id} projectAddress={project.address} activeSubTab={activeSubTab} />}
          {activeStage === 'work_progress' && (
            <>
              {activeSubTab === 'updates' && <UpdatesTab projectId={project.id} />}
              {activeSubTab === 'daily_logs' && <SiteLogTab projectId={project.id} ref={siteLogRef} />}
              {activeSubTab === 'progress_reports' && <ProgressReportTab projectId={project.id} ref={reportRef} />}
            </>
          )}
          {activeStage === 'snag' && <SnagTab projectId={project.id} userId={user?.id || ''} userRole={isAdmin ? 'admin' : 'user'} ref={snagRef} />}
          {activeStage === 'finance' && (activeSubTab === 'expenses' && <ExpensesTab projectId={project.id} ref={expensesRef} />)}
          {activeStage === 'handover' && (activeSubTab === 'checklist' && <HandoverTab projectId={project.id} />)}
        </div>
      </div>

      {editSection && (
        <EditProjectModal
          isOpen={!!editSection}
          onClose={() => setEditSection(null)}
          onSave={onSaveProject}
          section={editSection}
          initialData={project}
          isSaving={isSaving}
          initialWorker={editingWorker}
        />
      )}

      {showShareModal && createPortal(
        <div ref={shareModalOverlayRef} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl"><ShareLinkModal projectId={id as string} customerName={project.customer_name} onClose={() => setShowShareModal(false)} /></div>
        </div>,
        document.body
      )}
    </div>
  );
}
