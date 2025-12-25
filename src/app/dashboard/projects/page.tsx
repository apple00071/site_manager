'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiMoreVertical, FiSearch, FiX } from 'react-icons/fi';
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
  const { setTitle, setSubtitle } = useHeaderTitle();

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

  // Status tabs configuration with counts
  const statusTabs = useMemo(() => {
    const tabs = [
      { key: 'all', label: 'All Projects', count: projects.length },
      { key: 'requirements_upload', label: 'Requirements Upload', count: projects.filter(p => p.unified_status === 'requirements_upload' || (!p.unified_status && !p.workflow_stage)).length },
      { key: 'design_in_progress', label: 'Design In Progress', count: projects.filter(p => p.unified_status === 'design_in_progress' || p.workflow_stage === 'design_in_progress').length },
      { key: 'design_completed', label: 'Design Completed', count: projects.filter(p => p.unified_status === 'design_completed' || p.workflow_stage === 'design_completed').length },
      { key: 'execution_in_progress', label: 'Execution In Progress', count: projects.filter(p => p.unified_status === 'execution_in_progress' || p.status === 'in_progress').length },
      { key: 'completed', label: 'Completed', count: projects.filter(p => p.unified_status === 'completed' || p.status === 'completed').length },
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
        const status = p.unified_status || (p.workflow_stage === 'design_in_progress' ? 'design_in_progress'
          : p.workflow_stage === 'design_completed' ? 'design_completed'
            : p.status === 'completed' ? 'completed'
              : p.status === 'in_progress' ? 'execution_in_progress'
                : 'requirements_upload');

        return status === activeTab;
      });
    }

    return filtered;
  }, [projects, activeTab, searchQuery]);

  // Get status configuration for badges
  const getStatusConfig = (project: any) => {
    const status = project.unified_status || (
      project.workflow_stage === 'design_in_progress' ? 'design_in_progress'
        : project.workflow_stage === 'design_completed' ? 'design_completed'
          : project.status === 'completed' ? 'completed'
            : project.status === 'in_progress' ? 'execution_in_progress'
              : 'requirements_upload'
    );

    const configs: Record<string, { bg: string; text: string; label: string }> = {
      'requirements_upload': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Requirements Upload' },
      'design_in_progress': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Design In Progress' },
      'design_completed': { bg: 'bg-green-100', text: 'text-green-700', label: 'Design Completed' },
      'execution_in_progress': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Execution In Progress' },
      'completed': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Completed' },
    };

    return configs[status] || configs['requirements_upload'];
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
      {/* Tab Navigation Bar with Add Button */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-2">
          {/* Tabs */}
          <div className="flex overflow-x-auto">
            {statusTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.key
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
              >
                {tab.label}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === tab.key
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-600'
                  }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search and Add Project */}
          <div className="flex items-center gap-3 py-2">
            {/* Search Input */}
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

            {/* Add Project Button */}
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
              className="border-b border-gray-100 last:border-b-0 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="block p-4 sm:p-5 hover:bg-gray-50 active:bg-gray-100 transition-all duration-200 touch-target"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                          <a href={`tel:${project.phone_number}`} className="ml-1 text-blue-600 hover:text-blue-800 font-medium">
                            {project.phone_number}
                          </a>
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
                  <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2 ml-2">
                    {(() => {
                      const statusConfig = getStatusConfig(project);
                      return (
                        <span className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${statusConfig.bg} ${statusConfig.text}`}>
                          {statusConfig.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </Link>

              {/* Action buttons for mobile */}
              {(canEditProject || canDeleteProject) && (
                <div className="px-4 sm:px-5 pb-4 flex justify-end gap-2">
                  {canEditProject && (
                    <Link
                      href={`/dashboard/projects/${project.id}/edit`}
                      className="p-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 active:bg-yellow-100 rounded-xl transition-all duration-200 touch-target"
                      title="Edit project"
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </Link>
                  )}
                  {canDeleteProject && (
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 active:bg-red-100 rounded-xl transition-all duration-200 touch-target"
                      title="Delete project"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
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
                    {project.estimated_completion_date ? formatDateIST(project.estimated_completion_date) : '-'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === project.id ? null : project.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      >
                        <FiMoreVertical className="w-5 h-5" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeDropdown === project.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                          <Link
                            href={`/dashboard/projects/${project.id}`}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <FiEye className="w-4 h-4" />
                            View Details
                          </Link>
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
    </div>
  );
}
