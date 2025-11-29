'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateIST } from '@/lib/dateUtils';

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
};

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'workflow' | 'board' | 'updates' | 'inventory' | 'designs'>('details');
  const [showTabWidget, setShowTabWidget] = useState(false);
  const [mounted, setMounted] = useState(false);

  const WorkflowTab = dynamic(() => import('@/components/projects/WorkflowTab').then(m => m.WorkflowTab), { ssr: false });
  const KanbanBoard = dynamic(() => import('@/components/projects/KanbanBoard').then(m => m.KanbanBoard), { ssr: false });
  const UpdatesTab = dynamic(() => import('@/components/projects/UpdatesTab').then(m => m.UpdatesTab), { ssr: false });
  const InventoryTab = dynamic(() => import('@/components/projects/InventoryTab').then(m => m.InventoryTab), { ssr: false });
  const DesignsTab = dynamic(() => import('@/components/projects/DesignsTab').then(m => m.DesignsTab), { ssr: false });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize active tab from ?tab= query param if present
  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (!tab) return;
    const validTabs = ['details', 'workflow', 'board', 'updates', 'inventory', 'designs'] as const;
    if (validTabs.includes(tab as any)) {
      setActiveTab(tab as typeof validTabs[number]);
    }
  }, [searchParams]);

  // Function to fetch project data
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
    
    // Redirect to login if not authenticated
    if (!user) {
      router.push('/login');
      return;
    }

    fetchProject();
  }, [id, user, isAdmin, authLoading, router]);

  // Set up event listener for page focus to refresh data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page is visible, refreshing project data...');
        fetchProject();
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also refresh when the route changes (e.g., coming back from edit)
    const handleRouteChange = () => {
      console.log('Route changed, refreshing project data...');
      fetchProject();
    };
    
    window.addEventListener('popstate', handleRouteChange);

    // Cleanup
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
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Project Not Found</h1>
        <p className="text-gray-600">The requested project could not be found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 safe-area-inset-bottom lg:pt-0 h-full flex flex-col min-h-0 overflow-hidden">

      {/* Mobile-friendly header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">{project.title}</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">{project.customer_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold ${
            project.status === 'completed' 
              ? 'bg-green-100 text-green-700' 
              : project.status === 'in_progress' 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {project.status.replace('_', ' ').charAt(0).toUpperCase() + project.status.replace('_', ' ').slice(1)}
          </span>
        </div>
      </div>

      {/* Mobile Tab Widget - Floating Action Button */}
      {mounted && (
        <div className="lg:hidden fixed right-6 bottom-24 z-50">
        <div className="relative">
          <button
            onClick={() => setShowTabWidget(!showTabWidget)}
            className="w-14 h-14 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 touch-target"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          {showTabWidget && (
            <div className="absolute bottom-16 right-0 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 min-w-48">
              <div className="space-y-1">
                <button
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === 'details' 
                      ? 'bg-yellow-100 text-yellow-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setActiveTab('details');
                    setShowTabWidget(false);
                  }}
                >
                  📋 Project Details
                </button>
                <button
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === 'board' 
                      ? 'bg-yellow-100 text-yellow-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setActiveTab('board');
                    setShowTabWidget(false);
                  }}
                >
                  📊 Stage Board
                </button>
                <button
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === 'updates' 
                      ? 'bg-yellow-100 text-yellow-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setActiveTab('updates');
                    setShowTabWidget(false);
                  }}
                >
                  📝 Updates
                </button>
                <button
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === 'inventory' 
                      ? 'bg-yellow-100 text-yellow-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setActiveTab('inventory');
                    setShowTabWidget(false);
                  }}
                >
                  📦 Inventory
                </button>
                <button
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === 'designs' 
                      ? 'bg-yellow-100 text-yellow-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setActiveTab('designs');
                    setShowTabWidget(false);
                  }}
                >
                  🎨 Designs
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Desktop FAB Navigation */}
      {mounted && (
        <div className="fixed right-6 bottom-6 z-50 hidden lg:block">
          <div className="relative">
            <button
              onClick={() => setShowTabWidget(!showTabWidget)}
              className="w-14 h-14 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 touch-target"
              aria-label="Navigation menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {showTabWidget && (
              <div className="absolute bottom-16 right-0 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 min-w-48">
                <div className="space-y-1">
                  <button
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeTab === 'details' 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setActiveTab('details');
                      setShowTabWidget(false);
                    }}
                  >
                    📋 Project Details
                  </button>
                                    <button
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeTab === 'board' 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setActiveTab('board');
                      setShowTabWidget(false);
                    }}
                  >
                    📊 Stage Board
                  </button>
                  <button
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeTab === 'updates' 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setActiveTab('updates');
                      setShowTabWidget(false);
                    }}
                  >
                    📝 Updates
                  </button>
                  <button
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeTab === 'inventory' 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setActiveTab('inventory');
                      setShowTabWidget(false);
                    }}
                  >
                    📦 Inventory
                  </button>
                  <button
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeTab === 'designs' 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setActiveTab('designs');
                      setShowTabWidget(false);
                    }}
                  >
                    🎨 Designs
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="pt-4 sm:pt-6 flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Project Information */}
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
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Phone Number</dt>
                      <dd className="text-sm text-gray-900">
                        <a href={`tel:${project.phone_number}`} className="text-blue-600 hover:text-blue-800">
                          {project.phone_number}
                        </a>
                        {project.alt_phone_number && (
                          <div className="text-gray-500 text-sm mt-1">
                            Alt: <a href={`tel:${project.alt_phone_number}`} className="text-blue-600 hover:text-blue-800">
                              {project.alt_phone_number}
                            </a>
                          </div>
                        )}
                      </dd>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Start Date</dt>
                      <dd className="text-sm text-gray-900">{formatDateIST(project.start_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Estimated Completion</dt>
                      <dd className="text-sm text-gray-900">{formatDateIST(project.estimated_completion_date)}</dd>
                    </div>
                    {isAdmin && project.project_budget != null && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 mb-1">Project Budget</dt>
                        <dd className="text-sm text-gray-900">₹{project.project_budget.toLocaleString()}</dd>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4">
                  <dt className="text-sm font-medium text-gray-500 mb-1">Address</dt>
                  <dd className="text-sm text-gray-900 whitespace-pre-line">{project.address}</dd>
                </div>

                {/* Property Details */}
                {(project.property_type || project.apartment_name || project.area_sqft) && (
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Property Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {project.property_type && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 mb-1">Property Type</dt>
                          <dd className="text-sm text-gray-900 capitalize">{project.property_type.replace(/_/g, ' ')}</dd>
                        </div>
                      )}
                      {project.apartment_name && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 mb-1">Apartment/Building</dt>
                          <dd className="text-sm text-gray-900">{project.apartment_name}</dd>
                        </div>
                      )}
                      {project.area_sqft && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 mb-1">Area</dt>
                          <dd className="text-sm text-gray-900">{project.area_sqft} sq ft</dd>
                        </div>
                      )}
                      {project.block_number && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 mb-1">Block</dt>
                          <dd className="text-sm text-gray-900">{project.block_number}</dd>
                        </div>
                      )}
                      {project.flat_number && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 mb-1">Flat</dt>
                          <dd className="text-sm text-gray-900">{project.flat_number}</dd>
                        </div>
                      )}
                      {project.floor_number && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 mb-1">Floor</dt>
                          <dd className="text-sm text-gray-900">{project.floor_number}</dd>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Requirements PDF */}
                {project.requirements_pdf_url && (
                  <div className="mt-4">
                    <dt className="text-sm font-medium text-gray-500 mb-1">Requirements Document</dt>
                    <dd className="text-sm">
                      <a 
                        href={project.requirements_pdf_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-800"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        View Requirements PDF
                      </a>
                    </dd>
                  </div>
                )}

                {project.project_notes && (
                  <div className="mt-4">
                    <dt className="text-sm font-medium text-gray-500 mb-1">Project Notes</dt>
                    <dd className="text-sm text-gray-900 whitespace-pre-line">{project.project_notes}</dd>
                  </div>
                )}
              </div>

              {/* Team Details */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {project.assigned_employee && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Assigned Designer</dt>
                      <dd className="text-sm text-gray-900">
                        {project.assigned_employee.name}
                        <div className="text-gray-500 text-sm">{project.assigned_employee.email}</div>
                        {project.assigned_employee.designation && (
                          <div className="text-gray-500 text-xs">{project.assigned_employee.designation}</div>
                        )}
                      </dd>
                    </div>
                  )}

                  {project.carpenter_name && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Carpenter</dt>
                      <dd className="text-sm text-gray-900">
                        {project.carpenter_name}
                        {project.carpenter_phone && (
                          <div className="text-gray-500 text-sm">
                            <a href={`tel:${project.carpenter_phone}`} className="text-blue-600 hover:text-blue-800">
                              {project.carpenter_phone}
                            </a>
                          </div>
                        )}
                      </dd>
                    </div>
                  )}

                  {project.electrician_name && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Electrician</dt>
                      <dd className="text-sm text-gray-900">
                        {project.electrician_name}
                        {project.electrician_phone && (
                          <div className="text-gray-500 text-sm">
                            <a href={`tel:${project.electrician_phone}`} className="text-blue-600 hover:text-blue-800">
                              {project.electrician_phone}
                            </a>
                          </div>
                        )}
                      </dd>
                    </div>
                  )}

                  {project.plumber_name && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Plumber</dt>
                      <dd className="text-sm text-gray-900">
                        {project.plumber_name}
                        {project.plumber_phone && (
                          <div className="text-gray-500 text-sm">
                            <a href={`tel:${project.plumber_phone}`} className="text-blue-600 hover:text-blue-800">
                              {project.plumber_phone}
                            </a>
                          </div>
                        )}
                      </dd>
                    </div>
                  )}

                  {project.painter_name && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Painter</dt>
                      <dd className="text-sm text-gray-900">
                        {project.painter_name}
                        {project.painter_phone && (
                          <div className="text-gray-500 text-sm">
                            <a href={`tel:${project.painter_phone}`} className="text-blue-600 hover:text-blue-800">
                              {project.painter_phone}
                            </a>
                          </div>
                        )}
                      </dd>
                    </div>
                  )}

                  {project.granite_worker_name && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Granite Worker</dt>
                      <dd className="text-sm text-gray-900">
                        {project.granite_worker_name}
                        {project.granite_worker_phone && (
                          <div className="text-gray-500 text-sm">
                            <a href={`tel:${project.granite_worker_phone}`} className="text-blue-600 hover:text-blue-800">
                              {project.granite_worker_phone}
                            </a>
                          </div>
                        )}
                      </dd>
                    </div>
                  )}

                  {project.glass_worker_name && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Glass Worker</dt>
                      <dd className="text-sm text-gray-900">
                        {project.glass_worker_name}
                        {project.glass_worker_phone && (
                          <div className="text-gray-500 text-sm">
                            <a href={`tel:${project.glass_worker_phone}`} className="text-blue-600 hover:text-blue-800">
                              {project.glass_worker_phone}
                            </a>
                          </div>
                        )}
                      </dd>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'board' && (
            <KanbanBoard projectId={project.id} />
          )}

          {activeTab === 'updates' && user && (
            <UpdatesTab projectId={project.id} />
          )}

          {activeTab === 'inventory' && (
            <InventoryTab projectId={project.id} />
          )}

          {activeTab === 'designs' && (
            <DesignsTab projectId={project.id} />
          )}
        </div>
      </div>
    </div>
  );
}