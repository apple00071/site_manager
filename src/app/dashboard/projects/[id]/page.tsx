'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { formatDateIST } from '@/lib/dateUtils';
import { FiClock, FiLayers, FiImage } from 'react-icons/fi';

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

const KanbanBoard = dynamic(() => import('@/components/projects/KanbanBoard').then(m => m.KanbanBoard), { ssr: false });
const UpdatesTab = dynamic(() => import('@/components/projects/UpdatesTab').then(m => m.UpdatesTab), { ssr: false });
const InventoryTab = dynamic(() => import('@/components/projects/InventoryTab').then(m => m.InventoryTab), { ssr: false });
const DesignsTab = dynamic(() => import('@/components/projects/DesignsTab').then(m => m.DesignsTab), { ssr: false });
const BOQTab = dynamic(() => import('@/components/projects/BOQTab').then(m => m.BOQTab), { ssr: false });
const ProcurementTab = dynamic(() => import('@/components/projects/ProcurementTab').then(m => m.ProcurementTab), { ssr: false });

import { ProjectHeader } from '@/components/projects/navigation/ProjectHeader';
import { StageNavigator, StageId } from '@/components/projects/navigation/StageNavigator';

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Removed internal HeaderTitleContext usage as we are using a custom header now

  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation State
  const [activeStage, setActiveStage] = useState<StageId>('visit');
  const [activeSubTab, setActiveSubTab] = useState<string>('details');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync Stage from URL query param ?stage=
  useEffect(() => {
    const stageParam = searchParams?.get('stage');
    if (stageParam && ['visit', 'design', 'boq', 'orders', 'work_progress', 'snag', 'finance'].includes(stageParam)) {
      setActiveStage(stageParam as StageId);
    }
  }, [searchParams]);

  const handleStageChange = (stage: StageId) => {
    setActiveStage(stage);
    // Set default sub-tab for the stage
    const defaultTabs: Record<StageId, string> = {
      'visit': 'details',
      'design': 'designs',
      'boq': 'boq',
      'orders': 'procurement',
      'work_progress': 'board',
      'snag': 'snag_list',
      'finance': 'finance_overview'
    };
    setActiveSubTab(defaultTabs[stage]);
    router.push(`/dashboard/projects/${id}?stage=${stage}`, { scroll: false });
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
    <div className="flex flex-col h-full bg-white">
      {/* 1. New Project Header */}
      <ProjectHeader
        title={project.title}
        status={project.status}
        customerName={project.customer_name}
        user={user ? { name: user.full_name || user.email?.split('@')[0] || 'User', email: user.email } : null}
      />

      {/* 2. Pipeline Navigator */}
      <StageNavigator
        currentStage={activeStage}
        onStageSelect={handleStageChange}
        completedStages={[]} // TODO: Logic to calculate completed stages based on workflow
      />

      {/* 3. Sub-Tab Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-6 lg:px-8">
        {/* Optional: Secondary Tab Bar for stages with multiple views (e.g. Visit -> Details | Updates) */}
        {activeStage === 'visit' && (
          <div className="flex border-b border-gray-100 px-4">
            {['details', 'updates'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeSubTab === tab ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab === 'details' ? 'Project Details' : 'Updates & Timeline'}
              </button>
            ))}
          </div>
        )}

        {['work_progress'].includes(activeStage) && (
          <div className="flex border-b border-gray-100 px-4">
            {['board', 'inventory'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeSubTab === tab ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab === 'board' ? 'Stage Board' : 'Inventory'}
              </button>
            ))}
          </div>
        )}


        <div className="flex-1 overflow-y-auto bg-gray-50/50">
          {/* STAGE: VISIT */}
          {activeStage === 'visit' && (
            <div className="p-4 sm:p-6 max-w-7xl mx-auto">
              {activeSubTab === 'details' ? (
                <div className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  {/* Reusing existing Details UI */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-4">
                        <div>
                          <dt className="text-sm font-medium text-gray-500 mb-1">Description</dt>
                          <dd className="text-sm text-gray-900">{project.description || 'No description provided.'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500 mb-1">Customer</dt>
                          <dd className="text-sm text-gray-900">{project.customer_name}</dd>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <dt className="text-sm font-medium text-gray-500 mb-1">Start Date</dt>
                          <dd className="text-sm text-gray-900">{formatDateIST(project.start_date)}</dd>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <dt className="text-sm font-medium text-gray-500 mb-1">Address</dt>
                      <dd className="text-sm text-gray-900 whitespace-pre-line">{project.address}</dd>
                    </div>
                  </div>
                </div>
              ) : (
                <UpdatesTab projectId={project.id} />
              )}
            </div>
          )}

          {/* STAGE: DESIGN */}
          {activeStage === 'design' && (
            <DesignsTab projectId={project.id} />
          )}

          {/* STAGE: BOQ */}
          {activeStage === 'boq' && (
            <div className="h-full flex flex-col">
              <BOQTab projectId={project.id} />
            </div>
          )}

          {/* STAGE: ORDERS */}
          {activeStage === 'orders' && (
            <div className="h-full flex flex-col">
              <ProcurementTab projectId={project.id} />
            </div>
          )}

          {/* STAGE: WORK PROGRESS */}
          {activeStage === 'work_progress' && (
            <div className="h-full">
              {activeSubTab === 'board' ? <KanbanBoard projectId={project.id} /> : <InventoryTab projectId={project.id} />}
            </div>
          )}

          {/* STAGE: SNAG (Placeholder) */}
          {activeStage === 'snag' && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FiLayers className="w-12 h-12 mb-2 text-gray-300" />
              <p>Snag List Module Coming Soon</p>
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
    </div>
  );
}