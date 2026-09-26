'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiMoreVertical, FiSearch, FiX, FiSend, FiBriefcase, FiFilter, FiCheck, FiGrid, FiList, FiPhone, FiUser, FiArrowRight } from 'react-icons/fi';
import { formatDateIST } from '@/lib/dateUtils';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';

const getDesignerName = (project: any): string => {
  return (
    project.assigned_employee?.name ||
    project.assigned_employee?.full_name ||
    project.designer?.username ||
    project.designer?.full_name ||
    'Not Assigned'
  );
};
const getSupervisorName = (project: any): string => {
  if (project.site_supervisor?.username) {
    return project.site_supervisor.username;
  }
  if (project.site_supervisor?.full_name) {
    return project.site_supervisor.full_name;
  }
  if (Array.isArray(project.project_members)) {
    const supervisorMember = project.project_members.find((pm: any) => {
      const designation = pm.users?.designation?.toLowerCase() || '';
      return designation.includes('site') || designation.includes('supervisor') || designation.includes('engineer');
    });
    if (supervisorMember?.users?.username) {
      return supervisorMember.users.username;
    }
    if (supervisorMember?.users?.full_name) {
      return supervisorMember.users.full_name;
    }
  }
  return 'Not Assigned';
};

export default function ProjectsPage() {
  const { user } = useAuth();
  const { hasPermission, hasAnyPermission, isAdmin, roleName, designation: permDesignation, isLoading: permLoading } = useUserPermissions();
  const router = useRouter();
  const canViewProjects = hasAnyPermission(['projects.view', 'projects.view_all']);
  const canCreateProject = hasPermission('projects.create');
  const canEditProject = hasPermission('projects.edit');
  const canDeleteProject = hasPermission('projects.delete');
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [defaultTabApplied, setDefaultTabApplied] = useState(false);
  const [selectedDesigner, setSelectedDesigner] = useState<string>('');
  const [selectedSiteEngineer, setSelectedSiteEngineer] = useState<string>('');
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<'designer' | 'site_engineer' | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: 'start_date' | 'estimated_completion_date' | 'project_code' | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Load user preference for view mode from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('projects_view_mode');
      if (saved === 'cards' || saved === 'table') {
        setViewMode(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSetViewMode = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('projects_view_mode', mode);
    } catch {}
  };
  const searchParams = useSearchParams();
  const { setTitle, setSubtitle } = useHeaderTitle();

  // Handle status filter from URL
  useEffect(() => {
    const status = searchParams.get('status');
    if (status) {
      setActiveTab(status);
      setDefaultTabApplied(true);
    }
  }, [searchParams]);

  // Set default active tab based on user role/designation:
  // - Site Engineer: 'in_progress' (Execution Phase)
  // - Designer: 'pending' (Design Phase)
  useEffect(() => {
    if (defaultTabApplied) return;
    if (searchParams.get('status')) return;

    const desig = (user?.designation || (user as any)?.user_metadata?.designation || permDesignation || '').toLowerCase();
    const role = (roleName || user?.role || (user as any)?.user_metadata?.role || '').toLowerCase();
    const combined = `${role} ${desig}`;

    if (combined.includes('site') || combined.includes('engineer') || combined.includes('supervisor')) {
      setActiveTab('in_progress');
      setDefaultTabApplied(true);
    } else if (combined.includes('design')) {
      setActiveTab('pending');
      setDefaultTabApplied(true);
    } else if (user && !permLoading) {
      setActiveTab('pending');
      setDefaultTabApplied(true);
    }
  }, [user, roleName, permDesignation, permLoading, searchParams, defaultTabApplied]);

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
    const handleClickOutside = () => {
      setActiveDropdown(null);
      setActiveFilterDropdown(null);
    };
    if (activeDropdown || activeFilterDropdown) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeDropdown, activeFilterDropdown]);

  // Unique designers available across projects with counts
  const availableDesigners = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => {
      const name = getDesignerName(p);
      if (name && name !== 'Not Assigned') {
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [projects]);

  // Unique site engineers available across projects with counts
  const availableSiteEngineers = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => {
      const name = getSupervisorName(p);
      if (name && name !== 'Not Assigned') {
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [projects]);

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

  const handleSort = (key: 'start_date' | 'estimated_completion_date' | 'project_code') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Status tabs configuration with counts - based on actual project status
  const statusTabs = useMemo(() => {
    const tabs = [
      { key: 'pending', label: 'Design Phase', count: projects.filter(p => p.status === 'pending' || !p.status).length },
      { key: 'in_progress', label: 'Execution Phase', count: projects.filter(p => p.status === 'in_progress').length },
      { key: 'on_hold', label: 'On Hold', count: projects.filter(p => p.status === 'on_hold').length },
      { key: 'completed', label: 'Completed', count: projects.filter(p => p.status === 'completed').length },
      { key: 'handover', label: 'Handover Phase', count: projects.filter(p => p.status === 'handover').length },
      { key: 'cancelled', label: 'Cancelled', count: projects.filter(p => p.status === 'cancelled').length },
      { key: 'all', label: 'All Projects', count: projects.length },
    ];
    return tabs.filter(tab => tab.count > 0 || tab.key === 'all' || tab.key === activeTab);
  }, [projects, activeTab]);

  // Filter projects by active tab and search query
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p =>
        p.title?.toLowerCase().includes(query) ||
        p.project_code?.toLowerCase().includes(query) ||
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

    // Apply Designer filter
    if (selectedDesigner) {
      filtered = filtered.filter(p => getDesignerName(p).toLowerCase() === selectedDesigner.toLowerCase());
    }

    // Apply Site Engineer filter
    if (selectedSiteEngineer) {
      filtered = filtered.filter(p => getSupervisorName(p).toLowerCase() === selectedSiteEngineer.toLowerCase());
    }

    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        if (sortConfig.key === 'project_code') {
          const codeA = a.project_code || '';
          const codeB = b.project_code || '';
          const cmp = codeA.localeCompare(codeB, undefined, { numeric: true });
          return sortConfig.direction === 'asc' ? cmp : -cmp;
        }

        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        // Handle null/undefined values by pushing them to the end
        if (!aValue && !bValue) return 0;
        if (!aValue) return 1;
        if (!bValue) return -1;

        const dateA = new Date(aValue).getTime();
        const dateB = new Date(bValue).getTime();

        if (dateA < dateB) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (dateA > dateB) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [projects, activeTab, searchQuery, selectedDesigner, selectedSiteEngineer, sortConfig]);

  // Get status configuration for badges - shows actual project status
  const getStatusConfig = (project: any) => {
    const status = project.status || 'pending';

    const configs: Record<string, { bg: string; text: string; label: string }> = {
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Design Phase' },
      'in_progress': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Execution Phase' },
      'on_hold': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'On Hold' },
      'completed': { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
      'handover': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Handover Phase' },
      'cancelled': { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
    };

    return configs[status] || configs['pending'];
  };

  // ponytail: redirect unauthorized users silently — sidebar already hides the link
  useEffect(() => {
    if (!permLoading && !canViewProjects) router.replace('/dashboard');
  }, [permLoading, canViewProjects, router]);

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

  if (!permLoading && !canViewProjects) return null;

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
            className="w-10 h-10 flex items-center justify-center bg-yellow-500 text-white rounded-xl shadow-sm hover:bg-yellow-600 active:scale-95 transition-all flex-shrink-0"
          >
            <FiPlus className="h-5 w-5" />
          </Link>
        )}
      </div>

      {/* Tab Navigation Bar - with search & add on desktop */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-2">
          {/* Tabs - Added flex-1 and min-w-0 for proper flex behavior */}
          <div className="flex flex-1 min-w-0 overflow-x-auto no-scrollbar scroll-smooth">
            <div className="flex flex-nowrap">
              {statusTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200 flex-shrink-0 ${activeTab === tab.key
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-200'
                    }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold leading-tight transition-colors ${activeTab === tab.key
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                    }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
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

        {(selectedDesigner || selectedSiteEngineer) && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-50/70 border-t border-yellow-100 text-xs text-yellow-900 flex-wrap">
            <span className="font-semibold text-yellow-800 flex items-center gap-1">
              <FiFilter className="w-3.5 h-3.5" /> Filters:
            </span>
            {selectedDesigner && (
              <span className="inline-flex items-center gap-1.5 bg-white border border-yellow-200 shadow-2xs px-2.5 py-0.5 rounded-full text-gray-800">
                <span>Designer: <strong className="text-gray-900">{selectedDesigner}</strong></span>
                <button
                  type="button"
                  onClick={() => setSelectedDesigner('')}
                  className="hover:text-red-500 rounded-full p-0.5 transition-colors"
                  title="Remove designer filter"
                >
                  <FiX className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedSiteEngineer && (
              <span className="inline-flex items-center gap-1.5 bg-white border border-yellow-200 shadow-2xs px-2.5 py-0.5 rounded-full text-gray-800">
                <span>Site Engineer: <strong className="text-gray-900">{selectedSiteEngineer}</strong></span>
                <button
                  type="button"
                  onClick={() => setSelectedSiteEngineer('')}
                  className="hover:text-red-500 rounded-full p-0.5 transition-colors"
                  title="Remove site engineer filter"
                >
                  <FiX className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => { setSelectedDesigner(''); setSelectedSiteEngineer(''); }}
              className="text-yellow-700 hover:text-yellow-900 underline text-xs ml-1 font-medium cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* View & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Designer Filter */}
          <div className="relative">
            <select
              value={selectedDesigner}
              onChange={(e) => setSelectedDesigner(e.target.value)}
              className="text-xs bg-white border border-gray-200 text-gray-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 font-medium cursor-pointer shadow-2xs hover:border-gray-300"
            >
              <option value="">All Designers</option>
              {availableDesigners.map(([name, count]) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Site Engineer Filter */}
          <div className="relative">
            <select
              value={selectedSiteEngineer}
              onChange={(e) => setSelectedSiteEngineer(e.target.value)}
              className="text-xs bg-white border border-gray-200 text-gray-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 font-medium cursor-pointer shadow-2xs hover:border-gray-300"
            >
              <option value="">All Site Engineers</option>
              {availableSiteEngineers.map(([name, count]) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Clear all active filters if any */}
          {(selectedDesigner || selectedSiteEngineer) && (
            <button
              type="button"
              onClick={() => { setSelectedDesigner(''); setSelectedSiteEngineer(''); }}
              className="text-xs text-yellow-700 hover:text-yellow-900 font-medium underline px-1 cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Total count */}
          <span className="text-xs text-gray-500 font-medium hidden sm:inline">
            {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
          </span>

          {/* View Mode Toggle: Cards | Table (Desktop only) */}
          <div className="hidden lg:flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 shadow-2xs">
            <button
              type="button"
              onClick={() => handleSetViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Card View"
            >
              <FiGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Table View"
            >
              <FiList className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredProjects.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-card p-8 sm:p-12 text-center text-gray-500 mt-4">
          <div className="h-12 w-12 mx-auto mb-4 bg-gray-50 rounded-full flex items-center justify-center">
            {canCreateProject ? <FiPlus className="h-6 w-6 text-gray-400" /> : <FiSearch className="h-6 w-6 text-gray-400" />}
          </div>
          <p className="text-sm sm:text-base font-medium">No projects found</p>
          {canCreateProject ? (
            <p className="text-xs sm:text-sm mt-1 text-gray-400">Click the + button to create a new project</p>
          ) : (
            <p className="text-xs sm:text-sm mt-1 text-gray-400">No projects have been assigned to you yet</p>
          )}
        </div>
      )}

      {/* Mobile view - original card model */}
      {filteredProjects.length > 0 && (
        <div className="lg:hidden bg-white shadow-card overflow-visible rounded-xl border border-gray-100">
          {filteredProjects.map((project, index) => (
            <div
              key={project.id}
              className="relative border-b border-gray-100 last:border-b-0 animate-fade-in group hover:bg-gray-50 active:bg-gray-50/80 transition-all duration-200"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Main card link (covers entire card) */}
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="block p-4 sm:p-5 pr-16"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {(project.project_code || project.ref_no || project.id) && (
                        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/70" title="Project ID">
                          {project.project_code || project.ref_no || `AI-${project.id.slice(0, 5).toUpperCase()}`}
                        </span>
                      )}
                    </div>
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
                      <div>
                        <span className="text-gray-500">Designer:</span>
                        <span className="ml-1 text-gray-900 font-medium">{getDesignerName(project)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Site Engineer:</span>
                        <span className="ml-1 text-gray-900 font-medium">{getSupervisorName(project)}</span>
                      </div>
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
                      className="flex items-center justify-center w-10 h-10 text-yellow-600 bg-yellow-50/50 hover:bg-yellow-100 rounded-xl transition-colors"
                      title="Share Live Link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FiSend className="h-4 w-4" />
                    </Link>
                  )}
                  {canEditProject && (
                    <Link
                      href={`/dashboard/projects/${project.id}/edit`}
                      className="flex items-center justify-center w-10 h-10 text-yellow-600 bg-yellow-50/50 hover:bg-yellow-100 rounded-xl transition-colors"
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
                      className="flex items-center justify-center w-10 h-10 text-red-600 bg-red-50/50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer"
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
      )}

      {/* Desktop Card View */}
      {filteredProjects.length > 0 && viewMode === 'cards' && (
        <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((project, index) => {
            const statusConfig = getStatusConfig(project);
            return (
              <div
                key={project.id}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('button, a, select, input')) return;
                  router.push(`/dashboard/projects/${project.id}`);
                }}
                className="bg-white rounded-2xl border border-gray-200/80 hover:border-yellow-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between p-5 relative cursor-pointer group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Card Top: Badges & Action Menu */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(project.project_code || project.ref_no || project.id) && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/70" title="Project ID">
                        {project.project_code || project.ref_no || `AI-${project.id.slice(0, 5).toUpperCase()}`}
                      </span>
                    )}
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 ${statusConfig.bg} ${statusConfig.text}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Actions dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === project.id ? null : project.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                      title="Project Actions"
                    >
                      <FiMoreVertical className="w-4 h-4" />
                    </button>

                    {activeDropdown === project.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-40 text-xs animate-in fade-in zoom-in-95 duration-100"
                      >
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="flex items-center gap-2 px-3.5 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setActiveDropdown(null)}
                        >
                          <FiEye className="w-3.5 h-3.5 text-gray-500" />
                          <span>View Details</span>
                        </Link>
                        {isAdmin && (
                          <Link
                            href={`/dashboard/projects/${project.id}?share=1`}
                            className="flex items-center gap-2 px-3.5 py-2 text-yellow-700 hover:bg-yellow-50 transition-colors"
                            onClick={() => setActiveDropdown(null)}
                          >
                            <FiSend className="w-3.5 h-3.5 text-yellow-600" />
                            <span>Share Live Link</span>
                          </Link>
                        )}
                        {canEditProject && (
                          <Link
                            href={`/dashboard/projects/${project.id}/edit`}
                            className="flex items-center gap-2 px-3.5 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => setActiveDropdown(null)}
                          >
                            <FiEdit2 className="w-3.5 h-3.5 text-gray-500" />
                            <span>Edit Project</span>
                          </Link>
                        )}
                        {canDeleteProject && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(null);
                              handleDeleteProject(project.id);
                            }}
                            className="flex items-center gap-2 w-full px-3.5 py-2 text-red-600 hover:bg-red-50 text-left transition-colors cursor-pointer"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                            <span>Delete Project</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Project Title */}
                <div className="mb-2">
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="text-base font-bold text-gray-900 group-hover:text-yellow-600 transition-colors line-clamp-1 block leading-snug"
                    title={project.title}
                  >
                    {project.title}
                  </Link>
                </div>

                {/* Customer & Contact Row */}
                <div className="flex items-center justify-between gap-2 text-xs mb-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FiUser className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-700 truncate">{project.customer_name || 'N/A'}</span>
                  </div>
                  {project.phone_number ? (
                    <a
                      href={`tel:${project.phone_number}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium shrink-0"
                      title={`Call ${project.phone_number}`}
                    >
                      <FiPhone className="w-3 h-3" />
                      <span>{project.phone_number}</span>
                    </a>
                  ) : (
                    <span className="text-gray-400 text-[11px]">—</span>
                  )}
                </div>

                {/* Specs Grid: Designer, Site Engineer, Start Date, Est. Completion */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                  <div className="p-2.5 rounded-xl bg-gray-50/80 border border-gray-100 flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Designer</span>
                    <span className="font-semibold text-gray-800 truncate mt-0.5" title={getDesignerName(project)}>
                      {getDesignerName(project)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-50/80 border border-gray-100 flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Site Engineer</span>
                    <span className="font-semibold text-gray-800 truncate mt-0.5" title={getSupervisorName(project)}>
                      {getSupervisorName(project)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-50/80 border border-gray-100 flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Start Date</span>
                    <span className="font-semibold text-gray-800 truncate mt-0.5">
                      {project.start_date ? formatDateIST(project.start_date) : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-50/80 border border-gray-100 flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Est. Completion</span>
                    <span className="font-semibold text-gray-800 truncate mt-0.5">
                      {project.estimated_completion_date ? formatDateIST(project.estimated_completion_date) : '—'}
                    </span>
                  </div>
                </div>

                {/* Card Footer: Property info & View Project button */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
                  <div className="text-xs text-gray-500 font-medium truncate pr-2">
                    {project.flat_number && <span>Flat {project.flat_number}</span>}
                    {project.flat_number && (project.property_type || project.area_sqft) && <span className="mx-1">·</span>}
                    {project.property_type && (
                      <span className="capitalize">{project.property_type.replace(/_/g, ' ')}</span>
                    )}
                    {project.property_type && project.area_sqft && <span className="mx-1">·</span>}
                    {project.area_sqft && <span>{project.area_sqft} sq ft</span>}
                  </div>

                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-yellow-600 hover:text-yellow-700 group-hover:translate-x-0.5 transition-all shrink-0"
                  >
                    <span>View Project</span>
                    <FiArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop / Table View */}
      {filteredProjects.length > 0 && viewMode === 'table' && (
        <div className="hidden lg:block overflow-x-auto bg-white border border-gray-100 rounded-xl shadow-card">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  #
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-xs xl:max-w-sm">
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
                <th scope="col" className="relative px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <span>Designer</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFilterDropdown(prev => prev === 'designer' ? null : 'designer');
                      }}
                      className={`p-1 rounded-md transition-colors ${
                        selectedDesigner
                          ? 'text-yellow-700 bg-yellow-100 font-bold ring-1 ring-yellow-400'
                          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                      title="Filter by Designer"
                    >
                      <FiFilter className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {activeFilterDropdown === 'designer' && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-0 top-full mt-1.5 w-60 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1.5 text-xs normal-case font-normal animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="px-3 py-2 border-b border-gray-100 font-semibold text-gray-800 flex items-center justify-between">
                        <span>Filter by Designer</span>
                        {selectedDesigner && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDesigner('');
                              setActiveFilterDropdown(null);
                            }}
                            className="text-xs text-yellow-600 hover:text-yellow-700 font-medium"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1 divide-y divide-gray-50">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDesigner('');
                            setActiveFilterDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                            !selectedDesigner ? 'font-semibold text-yellow-600 bg-yellow-50/60' : 'text-gray-700'
                          }`}
                        >
                          <span>All Designers</span>
                          {!selectedDesigner && <FiCheck className="w-4 h-4 text-yellow-600" />}
                        </button>
                        {availableDesigners.map(([name, count]) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setSelectedDesigner(name);
                              setActiveFilterDropdown(null);
                            }}
                            className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                              selectedDesigner === name ? 'font-semibold text-yellow-600 bg-yellow-50/60' : 'text-gray-700'
                            }`}
                          >
                            <span className="truncate pr-2">{name}</span>
                            <span className="text-[10px] bg-gray-100 text-gray-500 font-medium rounded-full px-2 py-0.5">{count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </th>
                <th scope="col" className="relative px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <span>Site Engineer</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFilterDropdown(prev => prev === 'site_engineer' ? null : 'site_engineer');
                      }}
                      className={`p-1 rounded-md transition-colors ${
                        selectedSiteEngineer
                          ? 'text-yellow-700 bg-yellow-100 font-bold ring-1 ring-yellow-400'
                          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                      title="Filter by Site Engineer"
                    >
                      <FiFilter className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {activeFilterDropdown === 'site_engineer' && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-0 top-full mt-1.5 w-60 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1.5 text-xs normal-case font-normal animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="px-3 py-2 border-b border-gray-100 font-semibold text-gray-800 flex items-center justify-between">
                        <span>Filter by Site Engineer</span>
                        {selectedSiteEngineer && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSiteEngineer('');
                              setActiveFilterDropdown(null);
                            }}
                            className="text-xs text-yellow-600 hover:text-yellow-700 font-medium"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1 divide-y divide-gray-50">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSiteEngineer('');
                            setActiveFilterDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                            !selectedSiteEngineer ? 'font-semibold text-yellow-600 bg-yellow-50/60' : 'text-gray-700'
                          }`}
                        >
                          <span>All Site Engineers</span>
                          {!selectedSiteEngineer && <FiCheck className="w-4 h-4 text-yellow-600" />}
                        </button>
                        {availableSiteEngineers.map(([name, count]) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setSelectedSiteEngineer(name);
                              setActiveFilterDropdown(null);
                            }}
                            className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                              selectedSiteEngineer === name ? 'font-semibold text-yellow-600 bg-yellow-50/60' : 'text-gray-700'
                            }`}
                          >
                            <span className="truncate pr-2">{name}</span>
                            <span className="text-[10px] bg-gray-100 text-gray-500 font-medium rounded-full px-2 py-0.5">{count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hover:text-gray-700 transition-colors group"
                  onClick={() => handleSort('start_date')}
                >
                  <div className="flex items-center gap-1">
                    Start Date
                    <span className="flex flex-col text-[8px] leading-[4px] text-gray-300">
                      <span className={`${sortConfig.key === 'start_date' && sortConfig.direction === 'asc' ? 'text-gray-700' : 'group-hover:text-gray-400'}`}>▲</span>
                      <span className={`${sortConfig.key === 'start_date' && sortConfig.direction === 'desc' ? 'text-gray-700' : 'group-hover:text-gray-400'}`}>▼</span>
                    </span>
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hover:text-gray-700 transition-colors group"
                  onClick={() => handleSort('estimated_completion_date')}
                >
                  <div className="flex items-center gap-1">
                    Est. Completion
                    <span className="flex flex-col text-[8px] leading-[4px] text-gray-300">
                      <span className={`${sortConfig.key === 'estimated_completion_date' && sortConfig.direction === 'asc' ? 'text-gray-700' : 'group-hover:text-gray-400'}`}>▲</span>
                      <span className={`${sortConfig.key === 'estimated_completion_date' && sortConfig.direction === 'desc' ? 'text-gray-700' : 'group-hover:text-gray-400'}`}>▼</span>
                    </span>
                  </div>
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
 
                  <td onClick={() => window.location.href = `/dashboard/projects/${project.id}`} className="px-4 py-4 max-w-xs xl:max-w-sm whitespace-normal">
                    <div className="text-sm font-semibold text-gray-900 break-words">{project.title}</div>
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
                  <td onClick={() => window.location.href = `/dashboard/projects/${project.id}`} className="px-3 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{getDesignerName(project)}</div>
                  </td>
                  <td onClick={() => window.location.href = `/dashboard/projects/${project.id}`} className="px-3 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{getSupervisorName(project)}</div>
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
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
