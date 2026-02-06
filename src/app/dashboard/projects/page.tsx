'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiMoreVertical, FiSearch, FiX, FiSend } from 'react-icons/fi';
import { formatDateIST } from '@/lib/dateUtils';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';

export default function ProjectsPage() {
  const { user, isAdmin } = useAuth();
  const { hasPermission } = useUserPermissions();
  const canCreateProject = hasPermission('projects.create');
  const canEditProject = hasPermission('projects.edit');
  const canDeleteProject = hasPermission('projects.delete');
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchParams = useSearchParams();
  const { setTitle, setSubtitle } = useHeaderTitle();

  // Handle status filter from URL
  useEffect(() => {
    const status = searchParams.get('status');
    if (status) {
      setActiveTab(status);
    }
  }, [searchParams]);

  // Set header title
  useEffect(() => {
    setTitle('Projects');
    setSubtitle(null);
  }, [setTitle, setSubtitle]);

  useEffect(() => {
    // ... code remains same
    const fetchProjects = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const response = await fetch('/api/admin/projects');

        if (!response.ok) {
          if (response.status === 401) {
            window.location.href = '/login';
            return;
          }
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to fetch projects');
        }

        const projectsData = await response.json();

        if (!Array.isArray(projectsData) || (projectsData.length === 0 && !isAdmin)) {
          setProjects([]);
          return;
        }
        setProjects(projectsData);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProjects();
    }
  }, [user, isAdmin]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    if (activeDropdown) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeDropdown]);

  const handleDeleteProject = async (projectId: string) => {
    if (!canDeleteProject) return;

    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', projectId);

        if (error) throw error;

        setProjects(projects.filter(p => p.id !== projectId));
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };

  // Status tabs configuration with counts - based on actual project status
  const statusTabs = useMemo(() => {
    const tabs = [
      { key: 'all', label: 'All Projects', count: projects.length },
      { key: 'pending', label: 'Design Phase', count: projects.filter(p => p.status === 'pending' || !p.status).length },
      { key: 'in_progress', label: 'Execution Phase', count: projects.filter(p => p.status === 'in_progress').length },
      { key: 'on_hold', label: 'On Hold', count: projects.filter(p => p.status === 'on_hold').length },
      { key: 'completed', label: 'Completed', count: projects.filter(p => p.status === 'completed').length },
      { key: 'cancelled', label: 'Cancelled', count: projects.filter(p => p.status === 'cancelled').length },
    ];
    return tabs.filter(tab => tab.count > 0 || tab.key === 'all');
  }, [projects]);

  // Filter projects by active tab and search query
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p =>
        p.title?.toLowerCase().includes(query) ||
        p.customer_name?.toLowerCase().includes(query) ||
        p.flat_number?.toLowerCase().includes(query) ||
        p.phone_number?.includes(query)
      );
    }

    // Apply tab filter
    if (activeTab !== 'all') {
      filtered = filtered.filter(p => {
        const projectStatus = p.status || 'pending';
        return projectStatus === activeTab;
      });
    }

    return filtered;
  }, [projects, activeTab, searchQuery]);

  // Get status configuration for badges - shows actual project status
  const getStatusConfig = (project: any) => {
    const status = project.status || 'pending';

    const configs: Record<string, { bg: string; text: string; label: string }> = {
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Design Phase' },
      'in_progress': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Execution Phase' },
      'on_hold': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'On Hold' },
      'completed': { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
      'cancelled': { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
    };

    return configs[status] || configs['pending'];
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse-mobile">
        {/* Header skeleton */}
        <div className="bg-white border-b border-gray-200 h-16 w-full mb-6"></div>

        {/* Projects skeleton */}
        <div className="bg-white shadow-card overflow-hidden rounded-2xl border border-gray-100">
          {/* Skeleton content... */}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      {/* Mobile Only: Search and Add Button above tabs */}
      <div className="flex sm:hidden items-center gap-2 mb-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 py-2.5 w-full text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white shadow-sm transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FiX className="h-4 w-4" />
            </button>
          )}
        </div>
        {canCreateProject && (
          <Link
            href="/dashboard/projects/new"
            className="btn-primary whitespace-nowrap flex-shrink-0"
          >
            <FiPlus className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Tab Navigation Bar - with search & add on desktop */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-2">
          {/* Tabs */}
          <div className="flex overflow-x-auto">
            {statusTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.key
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
              >
                {tab.label}
                <span className={`ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === tab.key
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-600'
                  }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Desktop Only: Search and Add in tab bar */}
          <div className="hidden sm:flex items-center gap-3 py-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 py-2 w-48 md:w-64 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-gray-50 focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FiX className="h-4 w-4" />
                </button>
              )}
            </div>
            {canCreateProject && (
              <Link
                href="/dashboard/projects/new"
                className="btn-primary whitespace-nowrap"
              >
                <FiPlus className="mr-1 h-4 w-4" />
                Add Project
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white shadow-card overflow-visible rounded-xl border border-gray-100">
        {/* Mobile view - cards */}
        <div className="lg:hidden">
          {filteredProjects.map((project, index) => (
            <div
              key={project.id}
              className="relative border-b border-gray-100 last:border-b-0 animate-fade-in group hover:bg-gray-50 active:bg-gray-50/80 transition-all duration-200"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Main card link (covers entire card) */}
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="block p-4 sm:p-5 pr-16" // Right padding for absolute buttons
              >
                <div className="flex flex-col gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate leading-tight">
                      {project.title}
                    </h3>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                      <div>
                        <span className="text-gray-500">Customer:</span>
                        <span className="ml-1 text-gray-900 font-medium">{project.customer_name || 'N/A'}</span>
                      </div>
                      {project.flat_number && (
                        <div>
                          <span className="text-gray-500">Flat No:</span>
                          <span className="ml-1 text-gray-900 font-medium">{project.flat_number}</span>
                        </div>
                      )}
                      {project.phone_number && (
                        <div>
                          <span className="text-gray-500">Phone:</span>
                          <span className="ml-1 text-blue-600 font-medium">{project.phone_number}</span>
                        </div>
                      )}
                      {project.property_type && (
                        <div>
                          <span className="text-gray-500">Type:</span>
                          <span className="ml-1 text-gray-900 font-medium capitalize">{project.property_type.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {project.area_sqft && (
                        <div>
                          <span className="text-gray-500">Area:</span>
                          <span className="ml-1 text-gray-900 font-medium">{project.area_sqft} sq ft</span>
                        </div>
                      )}
                      {project.estimated_completion_date && (
                        <div>
                          <span className="text-gray-500">Est. Completion:</span>
                          <span className="ml-1 text-gray-900 font-medium">
                            {formatDateIST(project.estimated_completion_date)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const statusConfig = getStatusConfig(project);
                      return (
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full whitespace-nowrap ${statusConfig.bg} ${statusConfig.text}`}>
                          {statusConfig.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </Link>

              {/* Action buttons (Absolute positioned on top of the card link) */}
              {(canEditProject || canDeleteProject || isAdmin) && (
                <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                  {isAdmin && (
                    <Link
                      href={`/dashboard/projects/${project.id}?share=1`}
                      className="flex items-center justify-center w-10 h-10 text-yellow-600 hover:bg-yellow-100/50 rounded-xl transition-colors"
                      title="Share Live Link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FiSend className="h-4 w-4" />
                    </Link>
                  )}
                  {canEditProject && (
                    <Link
                      href={`/dashboard/projects/${project.id}/edit`}
                      className="flex items-center justify-center w-10 h-10 text-yellow-600 hover:bg-yellow-100/50 rounded-xl transition-colors"
                      title="Edit project"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </Link>
                  )}
                  {canDeleteProject && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="flex items-center justify-center w-10 h-10 text-red-600 hover:bg-red-100/50 rounded-xl transition-colors"
                      title="Delete project"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {projects.length === 0 && (
          <div className="p-8 sm:p-12 text-center text-gray-500">
            <FiPlus className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm sm:text-base font-medium">No projects found</p>
            <p className="text-xs sm:text-sm mt-1">Create your first project to get started</p>
          </div>
        )}
      </div>

      {/* Desktop view - table */}
      <div className="hidden lg:block overflow-visible">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                #
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Project Name
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Flat No
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Start Date
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Est. Completion
              </th>
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredProjects.map((project, index) => (
              <tr key={project.id} className="hover:bg-gray-50 transition-colors cursor-pointer group">
                {/* Row number */}
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                  {index + 1}
                </td>

                <td onClick={() => window.location.href = `/dashboard/projects/${project.id}`} className="px-4 py-4">
                  <div className="text-sm font-semibold text-gray-900">{project.title}</div>
                </td>
                <td onClick={() => window.location.href = `/dashboard/projects/${project.id}`} className="px-3 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{project.customer_name || 'N/A'}</div>
                </td>
                <td onClick={() => window.location.href = `/dashboard/projects/${project.id}`} className="px-3 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{project.flat_number || '-'}</div>
                </td>
                <td onClick={() => window.location.href = `/dashboard/projects/${project.id}`} className="px-3 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{project.phone_number || '-'}</div>
                </td>
                <td onClick={() => window.location.href = `/dashboard/projects/${project.id}`} className="px-3 py-3 whitespace-nowrap">
                  {(() => {
                    const statusConfig = getStatusConfig(project);
                    return (
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                        {statusConfig.label}
                      </span>
                    );
                  })()}
                </td>
                <td onClick={() => window.location.href = `/dashboard/projects/${project.id}`} className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                  {project.start_date ? formatDateIST(project.start_date) : '-'}
                </td>
                <td onClick={() => window.location.href = `/dashboard/projects/${project.id}`} className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                  {project.estimated_completion_date ? formatDateIST(project.estimated_completion_date) : '-'}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === project.id ? null : project.id);
                      }}
                      className="flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      <FiMoreVertical className="w-5 h-5" />
                    </button>

                    {/* Dropdown Menu */}
                    {activeDropdown === project.id && (
                      <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <FiEye className="w-4 h-4" />
                          View Details
                        </Link>
                        {isAdmin && (
                          <Link
                            href={`/dashboard/projects/${project.id}?share=1`}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50"
                          >
                            <FiSend className="w-4 h-4" />
                            Share Live Link
                          </Link>
                        )}
                        {(canEditProject || canDeleteProject) && (
                          <>
                            {canEditProject && (
                              <Link
                                href={`/dashboard/projects/${project.id}/edit`}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <FiEdit2 className="w-4 h-4" />
                                Edit Project
                              </Link>
                            )}
                            {canDeleteProject && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProject(project.id);
                                  setActiveDropdown(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <FiTrash2 className="w-4 h-4" />
                                Delete Project
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  <p className="text-base">No projects found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
