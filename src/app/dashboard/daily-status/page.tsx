'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  FiSearch, 
  FiDownload, 
  FiRefreshCw, 
  FiLayers, 
  FiUser, 
  FiExternalLink, 
  FiCheckCircle, 
  FiFilter,
  FiCheck,
  FiX,
  FiChevronDown,
  FiChevronRight,
  FiFileText,
  FiGrid,
  FiList,
  FiCalendar,
  FiPhone,
  FiClock
} from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import { formatDateIST } from '@/lib/dateUtils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/contexts/AuthContext';

interface ProjectStatusItem {
  id: string;
  project_code?: string;
  ref_no?: string;
  title: string;
  customer_name: string;
  phone_number?: string;
  start_date: string | null;
  deadline?: string | null;
  estimated_completion_date: string | null;
  status: string;
  workflow_stage: string | null;
  unified_status: string | null;
  status_color?: string | null;
  project_notes: string | null;
  created_at: string;
  assigned_employee_id?: string | null;
  assigned_employee?: {
    id: string;
    email: string;
    name?: string;
    full_name?: string;
    designation?: string;
  } | null;
}

interface SheetColumn {
  id: string;
  letter: string;
  label: string;
  defaultWidth: number;
}

const SHEET_COLUMNS: SheetColumn[] = [
  { id: 'project_code', letter: 'A', label: 'Project ID', defaultWidth: 95 },
  { id: 'title', letter: 'B', label: 'Project Name', defaultWidth: 220 },
  { id: 'customer_name', letter: 'C', label: 'Client', defaultWidth: 130 },
  { id: 'designer', letter: 'D', label: 'Designer', defaultWidth: 105 },
  { id: 'phase', letter: 'E', label: 'Phase', defaultWidth: 110 },
  { id: 'status', letter: 'F', label: 'Task Status', defaultWidth: 165 },
  { id: 'start_date', letter: 'G', label: 'Start Date', defaultWidth: 95 },
  { id: 'deadline', letter: 'H', label: 'Target Date', defaultWidth: 115 },
  { id: 'notes', letter: 'I', label: 'Notes', defaultWidth: 230 },
  { id: 'action', letter: 'J', label: 'Action', defaultWidth: 100 },
];

const STATUS_PALETTE = [
  { name: 'Emerald Green (Done)', hex: '#10B981' },
  { name: 'Rose Red / Pink', hex: '#FF3366' },
  { name: 'Amber Orange', hex: '#F59E0B' },
  { name: 'Sky Blue', hex: '#0284C7' },
  { name: 'Classic Blue', hex: '#485696' },
  { name: 'Purple Violet', hex: '#8B5CF6' },
  { name: 'Deep Teal', hex: '#0D9488' },
  { name: 'Slate Gray', hex: '#E2E8F0' },
  { name: 'Dark Slate', hex: '#334155' },
];

const PREPOPULATED_PHASES = [
  'Designing',
  'Execution',
  'Handover',
  'Completed'
];

const PREPOPULATED_STATUSES = [
  { name: 'To Do', color: '#64748B', desc: 'Design task queued, not started yet' },
  { name: 'In Progress', color: '#FF3366', desc: 'Plans, 3D modeling, or working drawings actively in progress' },
  { name: 'Under Review', color: '#8B5CF6', desc: 'Shared with client or Lead Designer for review' },
  { name: 'Done', color: '#10B981', desc: 'Daily design milestone finished' },
  { name: 'Design Completed', color: '#0D9488', desc: 'Design section finished without changes; remove from active sheet' },
];

const formatPhaseDisplay = (stage?: string | null, status?: string | null): string => {
  if (status) {
    const st = status.toLowerCase();
    if (st === 'completed') return 'Completed';
    if (st === 'handover') return 'Handover';
    if (st === 'in_progress') return 'Execution';
    if (st === 'pending') return 'Designing';
  }
  if (!stage) return 'Designing';
  const s = stage.toLowerCase();
  if (s === 'completed' || s.includes('complet')) return 'Completed';
  if (s.includes('execut') || s === 'in_progress') return 'Execution';
  if (s.includes('handover')) return 'Handover';
  return 'Designing';
};

const getStatusStyle = (colorHex?: string | null, statusText?: string | null) => {
  if (colorHex) {
    const clean = colorHex.replace('#', '');
    if (clean.length === 6) {
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return {
        backgroundColor: colorHex,
        color: yiq >= 155 ? '#1f2937' : '#ffffff',
      };
    }
    return { backgroundColor: colorHex, color: '#ffffff' };
  }

  const s = (statusText || '').toLowerCase();
  if (s.includes('done') || s.includes('completed') || s.includes('approved')) {
    return { backgroundColor: '#10B981', color: '#ffffff' };
  }
  if (s.includes('start') || s.includes('3d changes') || s.includes('changes') || s.includes('designing started')) {
    return { backgroundColor: '#FF3366', color: '#ffffff' };
  }
  if (s.includes('process') || s.includes('review') || s.includes('drawings') || s.includes('submited') || s.includes('submitted')) {
    return { backgroundColor: '#F59E0B', color: '#ffffff' };
  }
  return { backgroundColor: '#E2E8F0', color: '#1E293B' };
};

const hexToRgb = (hex: string | null | undefined): [number, number, number] => {
  if (!hex) return [226, 232, 240];
  const clean = hex.replace('#', '').trim();
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
  }
  return [226, 232, 240];
};

interface StatusUpdaterModalProps {
  project: ProjectStatusItem | null;
  onClose: () => void;
  onSelectStatus: (statusName: string, colorHex: string) => void;
  sheetDeadline: string;
  setSheetDeadline: (val: string) => void;
  sheetNotes: string;
  setSheetNotes: (val: string) => void;
  onSaveDetails: () => void;
}

function StatusUpdaterModal({
  project,
  onClose,
  onSelectStatus,
  sheetDeadline,
  setSheetDeadline,
  sheetNotes,
  setSheetNotes,
  onSaveDetails,
}: StatusUpdaterModalProps) {
  useEffect(() => {
    if (!project) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [project, onClose]);

  if (!project || typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden transition-all duration-200 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grab Handle */}
        <div className="flex sm:hidden justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[11px] font-bold rounded">
                {(project.project_code || project.ref_no || '').replace('AI/PRJ/', 'AI/').replace('PRJ/', '')}
              </span>
              <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                Update Status
              </h3>
            </div>
            <p className="text-xs text-gray-500 font-medium truncate mt-0.5">
              {project.title} {project.customer_name ? `· Client: ${project.customer_name}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Quick Status Options */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Select Design Status
            </label>

            <div className="space-y-1.5">
              {PREPOPULATED_STATUSES.map((opt) => {
                const isSelected = (project.unified_status || '').toLowerCase() === opt.name.toLowerCase();
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => onSelectStatus(opt.name, opt.color)}
                    className={`w-full p-2.5 sm:p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-yellow-500 bg-yellow-50/60 shadow-xs ring-1 ring-yellow-400'
                        : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span 
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: opt.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900">{opt.name}</div>
                        <div className="text-[11px] text-gray-500 truncate">{opt.desc}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <FiCheck className="w-4 h-4 text-yellow-600 flex-shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Note & Deadline edit */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Target Date</label>
              <input
                type="date"
                value={sheetDeadline}
                onChange={(e) => setSheetDeadline(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Daily Notes</label>
              <textarea
                rows={2}
                value={sheetNotes}
                onChange={(e) => setSheetNotes(e.target.value)}
                placeholder="Add design notes, client comments, or scope..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white"
              />
            </div>

            <button
              type="button"
              onClick={onSaveDetails}
              className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-gray-950 font-bold rounded-lg text-xs shadow-xs transition-all cursor-pointer"
            >
              Save Notes & Date
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function DailyStatusPage() {
  const { hasAnyPermission, isAdmin, isLoading: permLoading } = useUserPermissions();
  const { user } = useAuth();
  const router = useRouter();
  const canAccess = hasAnyPermission(['designs.daily_status', 'daily_status.view']);

  const [isServerManagement, setIsServerManagement] = useState<boolean | null>(null);
  const isManagement = isServerManagement !== null 
    ? isServerManagement 
    : Boolean(isAdmin || user?.designation?.toLowerCase().includes('lead'));

  const [projects, setProjects] = useState<ProjectStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDesigner, setSelectedDesigner] = useState<string>('all');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null);
  const [collapsedDesigners, setCollapsedDesigners] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [activeBottomSheetProject, setActiveBottomSheetProject] = useState<ProjectStatusItem | null>(null);
  const [sheetNotes, setSheetNotes] = useState<string>('');
  const [sheetDeadline, setSheetDeadline] = useState<string>('');
  const { showToast } = useToast();


  // Excel-style column widths with persistence
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('daily_status_column_widths');
      if (saved) {
        try { return JSON.parse(saved); } catch (_) {}
      }
    }
    const initial: Record<string, number> = {};
    SHEET_COLUMNS.forEach(col => {
      initial[col.id] = col.defaultWidth;
    });
    return initial;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('daily_status_column_widths', JSON.stringify(columnWidths));
    }
  }, [columnWidths]);

  // Column Resizing logic
  const resizingColRef = useRef<{ id: string; startX: number; startWidth: number } | null>(null);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingColRef.current) return;
    const { id, startX, startWidth } = resizingColRef.current;
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(60, startWidth + deltaX);
    setColumnWidths(prev => ({
      ...prev,
      [id]: newWidth
    }));
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizingColRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove]);

  const handleResizeStart = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    resizingColRef.current = {
      id: colId,
      startX: e.clientX,
      startWidth: columnWidths[colId] || 100
    };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/daily-status${statusFilter !== 'active' ? '?include_completed=true' : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load projects');
      const data = await res.json();
      const list = Array.isArray(data?.projects) ? data.projects : Array.isArray(data) ? data : [];
      setProjects(list);
      if (typeof data?.isManagement === 'boolean') {
        setIsServerManagement(data.isManagement);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error loading projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showToast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const safeProjects = useMemo(() => Array.isArray(projects) ? projects : [], [projects]);

  // Handle live inline update
  const handleUpdate = async (projectId: string, fields: Partial<ProjectStatusItem>) => {
    setSavingId(projectId);
    // Optimistic local update
    setProjects(prev => (Array.isArray(prev) ? prev : []).map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        ...fields,
        unified_status: fields.unified_status !== undefined ? fields.unified_status : p.unified_status,
        status_color: fields.status_color !== undefined ? fields.status_color : p.status_color,
        workflow_stage: fields.workflow_stage !== undefined ? fields.workflow_stage : p.workflow_stage,
        status: fields.workflow_stage ? (
          fields.workflow_stage.toLowerCase().includes('execut') ? 'in_progress' :
          fields.workflow_stage.toLowerCase().includes('handover') ? 'handover' :
          fields.workflow_stage.toLowerCase().includes('complet') ? 'completed' : 'pending'
        ) : (fields.status !== undefined ? fields.status : p.status),
        project_notes: fields.project_notes !== undefined ? fields.project_notes : p.project_notes,
        deadline: fields.deadline !== undefined ? fields.deadline : p.deadline,
        estimated_completion_date: fields.estimated_completion_date !== undefined ? fields.estimated_completion_date : p.estimated_completion_date,
      };
    }));

    try {
      const res = await fetch('/api/daily-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          unified_status: fields.unified_status,
          status_color: fields.status_color,
          workflow_stage: fields.workflow_stage,
          project_notes: fields.project_notes,
          deadline: fields.deadline,
          estimated_completion_date: fields.estimated_completion_date,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Update failed');
      }
      return true;
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update');
      fetchProjects();
      return false;
    } finally {
      setSavingId(null);
    }
  };

  // 1. Toggle specific daily design task milestone as Done / In Progress
  const handleToggleComplete = async (p: ProjectStatusItem) => {
    const isDone = (p.unified_status || '').toLowerCase().trim() === 'done';
    if (isDone) {
      const ok = await handleUpdate(p.id, {
        unified_status: 'In Progress',
        status_color: '#FF3366',
      });
      if (ok) showToast('info', `Task re-opened for "${p.title}"`);
    } else {
      const ok = await handleUpdate(p.id, {
        unified_status: 'Done',
        status_color: '#10B981',
      });
      if (ok) showToast('success', `Task marked as Done for "${p.title}"`);
    }
  };

  // 2. Complete entire design phase and remove from active sheet
  const handleCompleteDesign = async (p: ProjectStatusItem) => {
    const ok = await handleUpdate(p.id, {
      unified_status: 'Design Completed',
      status_color: '#10B981',
      ...(formatPhaseDisplay(p.workflow_stage, p.status) === 'Designing' ? { workflow_stage: 'Execution' } : {})
    });
    if (ok) {
      showToast('success', `Design completed for "${p.title}" (removed from active sheet)`);
    }
  };

  // 3. Re-open design when a new task is assigned later
  const handleReopenDesign = async (p: ProjectStatusItem) => {
    const ok = await handleUpdate(p.id, {
      unified_status: 'In Progress',
      status_color: '#FF3366',
    });
    if (ok) {
      showToast('info', `Design task re-opened for "${p.title}" (moved to active sheet)`);
    }
  };

  // Bottom Sheet Handlers
  const openBottomSheet = (p: ProjectStatusItem) => {
    setActiveBottomSheetProject(p);
    setSheetNotes(p.project_notes || '');
    setSheetDeadline(p.deadline ? p.deadline.split('T')[0] : '');
  };

  const handleSelectStatusFromSheet = async (statusName: string, colorHex: string) => {
    if (!activeBottomSheetProject) return;
    const p = activeBottomSheetProject;
    setActiveBottomSheetProject(null);

    const isDesignCompleted = statusName === 'Design Completed';
    const payload: Partial<ProjectStatusItem> = {
      unified_status: statusName,
      status_color: colorHex,
    };

    if (sheetDeadline !== (p.deadline ? p.deadline.split('T')[0] : '')) {
      payload.deadline = sheetDeadline || null;
    }
    if (sheetNotes !== (p.project_notes || '')) {
      payload.project_notes = sheetNotes || null;
    }
    if (isDesignCompleted && formatPhaseDisplay(p.workflow_stage, p.status) === 'Designing') {
      payload.workflow_stage = 'Execution';
    }

    const ok = await handleUpdate(p.id, payload);
    if (ok) {
      showToast('success', isDesignCompleted 
        ? `Design completed for "${p.title}" (removed from active sheet)` 
        : `Status updated to "${statusName}" for "${p.title}"`);
    }
  };

  const handleSaveSheetDetails = async () => {
    if (!activeBottomSheetProject) return;
    const p = activeBottomSheetProject;
    setActiveBottomSheetProject(null);

    const payload: Partial<ProjectStatusItem> = {};
    if (sheetDeadline !== (p.deadline ? p.deadline.split('T')[0] : '')) {
      payload.deadline = sheetDeadline || null;
    }
    if (sheetNotes !== (p.project_notes || '')) {
      payload.project_notes = sheetNotes || null;
    }

    if (Object.keys(payload).length > 0) {
      const ok = await handleUpdate(p.id, payload);
      if (ok) {
        showToast('success', `Details updated for "${p.title}"`);
      }
    }
  };

  // Filter projects by status: active vs closed projects
  const activeProjects = useMemo(() => {
    return safeProjects.filter(p => {
      const isDesignCompleted = (p.unified_status || '').toLowerCase().trim() === 'design completed';
      const isProjectClosed = (p.status || '').toLowerCase() === 'completed' || isDesignCompleted;
      if (statusFilter === 'active') return !isProjectClosed;
      if (statusFilter === 'completed') return isProjectClosed;
      return true;
    });
  }, [safeProjects, statusFilter]);

  // Unique designers list for filter dropdown
  const designersList = useMemo(() => {
    const set = new Set<string>();
    activeProjects.forEach(p => {
      const name = p.assigned_employee?.full_name?.trim() || p.assigned_employee?.name?.trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [activeProjects]);

  // Smart Auto-Filter: If logged in as a designer, default view to their own assigned projects
  const [hasAutoFiltered, setHasAutoFiltered] = useState(false);

  useEffect(() => {
    if (!hasAutoFiltered && !isAdmin && designersList.length > 0 && user) {
      const uName = (user.full_name || (user as any).name || (user as any).username || '').trim().toLowerCase();
      if (uName) {
        const match = designersList.find(d => {
          const dLower = d.toLowerCase();
          return dLower === uName || dLower.includes(uName) || uName.includes(dLower);
        });
        if (match) {
          setSelectedDesigner(match);
          setHasAutoFiltered(true);
        }
      }
    }
  }, [hasAutoFiltered, isAdmin, designersList, user]);

  // Filtered projects by search, designer, and phase
  const filteredProjects = useMemo(() => {
    return activeProjects.filter(p => {
      const q = searchQuery.toLowerCase();
      const code = (p.project_code || p.ref_no || '').replace('AI/PRJ/', 'AI/').replace('PRJ/', '').toLowerCase();
      const title = (p.title || '').toLowerCase();
      const client = (p.customer_name || '').toLowerCase();
      const designer = (p.assigned_employee?.full_name || p.assigned_employee?.name || '').toLowerCase();

      const matchesSearch = !searchQuery || code.includes(q) || title.includes(q) || client.includes(q) || designer.includes(q);
      const dName = p.assigned_employee?.full_name?.trim() || p.assigned_employee?.name?.trim() || '(Unassigned)';
      const matchesDesigner = selectedDesigner === 'all' || dName === selectedDesigner;
      const phase = formatPhaseDisplay(p.workflow_stage, p.status);
      const matchesPhase = selectedPhase === 'all' || phase.toLowerCase() === selectedPhase.toLowerCase();

      return matchesSearch && matchesDesigner && matchesPhase;
    });
  }, [activeProjects, searchQuery, selectedDesigner, selectedPhase]);

  // Group filtered projects by Designer (matching CRM month-group pattern)
  const groupedProjects = useMemo(() => {
    const map = new Map<string, ProjectStatusItem[]>();
    filteredProjects.forEach(p => {
      const dName = p.assigned_employee?.full_name?.trim() || p.assigned_employee?.name?.trim() || '(Unassigned)';
      if (!map.has(dName)) map.set(dName, []);
      map.get(dName)!.push(p);
    });

    const groups: { designerName: string; count: number; items: ProjectStatusItem[] }[] = [];
    map.forEach((items, designerName) => {
      groups.push({
        designerName,
        count: items.length,
        items,
      });
    });

    return groups.sort((a, b) => a.designerName.localeCompare(b.designerName));
  }, [filteredProjects]);

  // Summary counts
  const totalActiveCount = activeProjects.length;
  const tasksDoneCount = activeProjects.filter(p => (p.unified_status || '').toLowerCase().trim() === 'done').length;
  const tasksInProgressCount = Math.max(0, totalActiveCount - tasksDoneCount);

  // Toggle Collapse Designer Group
  const toggleDesignerCollapse = (name: string) => {
    setCollapsedDesigners(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // Export to Excel (.xlsx) matching CRM
  const handleExportExcel = () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const rows: any[] = [];

      groupedProjects.forEach(group => {
        // Group Header banner row
        rows.push({
          'Project ID': `${group.designerName} (${group.count} projects)`,
          'Project Name': '',
          'Client': '',
          'Designer': '',
          'Phase': '',
          'Task Status': '',
          'Start Date': '',
          'Target Date': '',
          'Notes': ''
        });

        group.items.forEach(p => {
          const rawCode = p.project_code || p.ref_no || `AI-${p.id.slice(0, 4)}`;
          const code = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');
          rows.push({
            'Project ID': code,
            'Project Name': p.title || '-',
            'Client': p.customer_name || '-',
            'Designer': group.designerName,
            'Phase': formatPhaseDisplay(p.workflow_stage, p.status),
            'Task Status': p.unified_status || 'Pending',
            'Start Date': p.start_date ? formatDateIST(p.start_date) : '-',
            'Target Date': p.deadline ? formatDateIST(p.deadline) : (p.estimated_completion_date ? formatDateIST(p.estimated_completion_date) : '-'),
            'Notes': p.project_notes || ''
          });
        });
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Design Status');
      XLSX.writeFile(workbook, `Daily_Design_Status_${todayStr}.xlsx`);
      showToast('success', 'Excel sheet exported successfully!');
    } catch (err) {
      console.error('Error exporting Excel:', err);
      showToast('error', 'Failed to export Excel');
    }
  };

  // Export to Landscape PDF with exact status colors
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const todayStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      // Header Banner
      doc.setFillColor(72, 86, 150); // #485696
      doc.rect(0, 0, 297, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('APPLE INTERIORS — DAILY DESIGN STATUS REPORT', 14, 11);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on: ${todayStr} · Total Active Projects: ${totalActiveCount} · Tasks Done Today: ${tasksDoneCount}`, 14, 18);

      const tableRows: any[] = [];

      groupedProjects.forEach((group) => {
        tableRows.push([
          {
            content: `${group.designerName} (${group.count} projects)`,
            colSpan: 9,
            styles: {
              fillColor: [241, 245, 249],
              textColor: [30, 41, 59],
              fontStyle: 'bold',
              fontSize: 8.5,
              cellPadding: 2.5
            }
          }
        ]);

        group.items.forEach(p => {
          const startDateStr = p.start_date ? formatDateIST(p.start_date) : '-';
          const targetDateStr = p.deadline
            ? formatDateIST(p.deadline)
            : (p.estimated_completion_date ? formatDateIST(p.estimated_completion_date) : '-');

          const rawCode = p.project_code || p.ref_no || `AI-${p.id.slice(0, 4)}`;
          const code = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');

          const statusStyle = getStatusStyle(p.status_color, p.unified_status);
          const bgRgb = hexToRgb(statusStyle.backgroundColor);
          const textRgb = hexToRgb(statusStyle.color);

          const statusCell = {
            content: p.unified_status || 'Pending',
            styles: {
              fillColor: bgRgb,
              textColor: textRgb,
              fontStyle: 'bold',
              halign: 'center',
            }
          };

          tableRows.push([
            code,
            p.title || '-',
            p.customer_name || '-',
            group.designerName,
            formatPhaseDisplay(p.workflow_stage, p.status),
            statusCell,
            startDateStr,
            targetDateStr,
            p.project_notes || '-'
          ]);
        });
      });

      autoTable(doc, {
        startY: 28,
        head: [[
          'Project ID',
          'Project Name',
          'Client Name',
          'Designer',
          'Phase',
          'Status',
          'Start Date',
          'Target Date',
          'Notes'
        ]],
        body: tableRows,
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fillColor: [72, 86, 150],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 22, fontStyle: 'bold' },
          1: { cellWidth: 50 },
          2: { cellWidth: 32 },
          3: { cellWidth: 25 },
          4: { cellWidth: 22 },
          5: { cellWidth: 32 },
          6: { cellWidth: 22 },
          7: { cellWidth: 22 },
          8: { cellWidth: 'auto' },
        },
        alternateRowStyles: {
          fillColor: [250, 250, 252],
        },
        didDrawPage: (data: any) => {
          const pageCount = (doc as any).getNumberOfPages ? (doc as any).getNumberOfPages() : ((doc as any).internal?.pages?.length || 1);
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount} · Apple Interiors · Daily Design Status Report`,
            data.settings.margin.left,
            doc.internal.pageSize.height - 6
          );
        }
      });

      doc.save(`Daily_Status_EOD_${todayStr}.pdf`);
      showToast('success', 'EOD PDF report downloaded successfully!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToast('error', 'Failed to generate PDF report');
    }
  };

  let runningRowNumber = 1;

  // ponytail: redirect unauthorized users silently — sidebar already hides the link
  useEffect(() => {
    if (!permLoading && !canAccess) router.replace('/dashboard');
  }, [permLoading, canAccess, router]);

  if (!permLoading && !canAccess) return null;

  return (
    <div className="p-3 sm:p-5 lg:p-6 w-full max-w-full space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <FiLayers className="w-6 h-6 text-yellow-600" />
            <span>Design Status</span>
          </h1>
        </div>

        {/* Toolbar Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchProjects}
            disabled={loading}
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-700 shadow-2xs transition-colors cursor-pointer"
            title="Refresh Status"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-yellow-600' : ''}`} />
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-2xs transition-all cursor-pointer"
            title="Export to Excel Spreadsheet (.xlsx)"
          >
            <FiDownload className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-950 font-bold rounded-lg text-xs shadow-2xs transition-all cursor-pointer"
            title="Download Landscape EOD PDF"
          >
            <FiFileText className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row (Role-tailored: Executive 4-card for Management, Focused 3-card for Individual Designers) */}
      <div className={`grid gap-3 ${isManagement ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
        <div className="p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
            {isManagement ? 'Active Projects' : 'My Active Projects'}
          </span>
          <span className="text-2xl font-black text-gray-900 mt-0.5 block">{totalActiveCount}</span>
        </div>
        {isManagement && (
          <div className="p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Active Designers</span>
            <span className="text-2xl font-black text-yellow-600 mt-0.5 block">{designersList.length}</span>
          </div>
        )}
        <div className="p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
            {isManagement ? 'Tasks In Progress' : 'My Tasks In Progress'}
          </span>
          <span className="text-2xl font-black text-rose-600 mt-0.5 block">{tasksInProgressCount}</span>
        </div>
        <div className="p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
            {isManagement ? 'Tasks Done Today' : 'My Tasks Done Today'}
          </span>
          <span className="text-2xl font-black text-emerald-600 mt-0.5 block">{tasksDoneCount}</span>
        </div>
      </div>

      {/* Spreadsheet Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-white p-2.5 border border-gray-200 rounded-xl shadow-2xs">
        {/* Search */}
        <div className="relative flex-1">
          <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="Search projects, client, ID or designer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50/70 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white transition-all"
          />
        </div>

        {/* Designer Filter: Only visible to Management (Admins & Lead Designers) */}
        {isManagement ? (
          <div className="sm:w-52">
            <select
              value={selectedDesigner}
              onChange={(e) => setSelectedDesigner(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50/70 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white transition-all"
            >
              <option value="all">All Designers ({designersList.length})</option>
              {designersList.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center px-2.5 py-1.5 bg-yellow-50/80 border border-yellow-200/80 rounded-lg text-xs font-semibold text-yellow-900 select-none">
            <span>My Projects ({totalActiveCount})</span>
          </div>
        )}

        {/* Phase Filter */}
        <div className="sm:w-40">
          <select
            value={selectedPhase}
            onChange={(e) => setSelectedPhase(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-gray-50/70 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white transition-all"
          >
            <option value="all">All Phases</option>
            {PREPOPULATED_PHASES.map(phase => (
              <option key={phase} value={phase}>{phase}</option>
            ))}
          </select>
        </div>

        {/* Status Scope Filter */}
        <div className="sm:w-44">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-2.5 py-1.5 bg-gray-50/70 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white transition-all"
          >
            <option value="active">Active Projects ({totalActiveCount})</option>
            <option value="completed">Completed Projects</option>
            <option value="all">All Projects</option>
          </select>
        </div>

        {/* View Mode Toggle: Cards vs Table */}
        <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 flex-shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title="Card View (Mobile Optimized)"
          >
            <FiGrid className={`w-3.5 h-3.5 ${viewMode === 'cards' ? 'text-yellow-600' : ''}`} />
            <span>Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title="Table View (Spreadsheet)"
          >
            <FiList className={`w-3.5 h-3.5 ${viewMode === 'table' ? 'text-yellow-600' : ''}`} />
            <span>Table</span>
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        /* DESIGNER-SEGREGATED CARDS VIEW (Mobile-First) */
        <div className="space-y-4">
          {groupedProjects.length === 0 ? (
            <div className="p-8 text-center bg-white border border-gray-200 rounded-xl shadow-2xs">
              <p className="text-gray-500 text-sm">No projects found matching the filter.</p>
            </div>
          ) : (
            groupedProjects.map((group) => {
              const isCollapsed = collapsedDesigners[group.designerName];

              // If individual designer, render the cards directly without redundant group headers
              if (!isManagement) {
                return (
                  <div key={group.designerName} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {group.items.map((p) => {
                      const rawCode = p.project_code || p.ref_no || `AI-${p.id.slice(0, 4)}`;
                      const displayCode = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');
                      const isTaskDone = (p.unified_status || '').toLowerCase().trim() === 'done';
                      const phase = formatPhaseDisplay(p.workflow_stage, p.status);
                      const statusStyle = getStatusStyle(p.status_color, p.unified_status);

                      return (
                        <div
                          key={p.id}
                          className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-3"
                        >
                          {/* Card Header: Project ID & Phase */}
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              href={`/dashboard/projects/${p.id}`}
                              className="font-mono font-bold text-blue-600 hover:underline text-xs flex items-center gap-1"
                              title={`Open project ${displayCode}`}
                            >
                              <span>{displayCode}</span>
                              <FiExternalLink className="w-3 h-3 text-gray-400" />
                            </Link>

                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              phase === 'Designing' ? 'bg-amber-100 text-amber-800' :
                              phase === 'Execution' ? 'bg-blue-100 text-blue-800' :
                              phase === 'Handover' ? 'bg-purple-100 text-purple-800' :
                              'bg-emerald-100 text-emerald-800'
                            }`}>
                              {phase}
                            </span>
                          </div>

                          {/* Project Title & Customer */}
                          <div>
                            <Link
                              href={`/dashboard/projects/${p.id}`}
                              className="font-bold text-gray-900 hover:text-blue-600 text-sm line-clamp-1 block transition-colors"
                            >
                              {p.title || 'Untitled Project'}
                            </Link>
                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 truncate">
                              <span>Client:</span>
                              <span className="font-medium text-gray-700 truncate">{p.customer_name || '-'}</span>
                              {p.phone_number && (
                                <a
                                  href={`tel:${p.phone_number}`}
                                  className="text-gray-400 hover:text-yellow-600 ml-1 inline-flex items-center"
                                  title={p.phone_number}
                                >
                                  <FiPhone className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Target Date & Notes */}
                          <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs">
                            <div className="flex items-center justify-between text-gray-600">
                              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                <FiCalendar className="w-3 h-3" />
                                Target Date:
                              </span>
                              <span className="font-semibold text-gray-800 text-[11px]">
                                {p.deadline ? formatDateIST(p.deadline) : (p.estimated_completion_date ? formatDateIST(p.estimated_completion_date) : 'Not set')}
                              </span>
                            </div>

                            {p.project_notes ? (
                              <div className="bg-gray-50 p-2 rounded-lg text-xs text-gray-700 italic line-clamp-2 border border-gray-100">
                                "{p.project_notes}"
                              </div>
                            ) : (
                              <div className="text-[11px] text-gray-400 italic">No notes added</div>
                            )}
                          </div>

                          {/* Card Footer: Interactive Status Pill Button */}
                          <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openBottomSheet(p)}
                              className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center justify-between cursor-pointer border border-black/5 hover:opacity-90"
                              style={{
                                backgroundColor: statusStyle.backgroundColor,
                                color: statusStyle.color,
                              }}
                            >
                              <span className="truncate">{p.unified_status || 'Select Status'}</span>
                              <FiChevronDown className="w-3.5 h-3.5 ml-1 flex-shrink-0 opacity-80" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleComplete(p)}
                              disabled={savingId === p.id}
                              title={isTaskDone ? "Task is Done. Click to re-open." : "Mark today's task Done"}
                              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all border shadow-2xs flex items-center gap-1 flex-shrink-0 cursor-pointer ${
                                isTaskDone
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-white text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 border-gray-200'
                              }`}
                            >
                              <FiCheckCircle className={`w-3.5 h-3.5 ${isTaskDone ? 'text-emerald-600' : 'text-gray-400'}`} />
                              <span>{isTaskDone ? 'Done' : 'Mark Done'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div key={group.designerName} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                  {/* Group Header / Accordion for Management */}
                  <button
                    type="button"
                    onClick={() => toggleDesignerCollapse(group.designerName)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FiUser className="w-4 h-4 text-yellow-600" />
                      <span className="font-bold text-gray-900 text-sm">
                        {group.designerName}
                      </span>
                      <span className="ml-2 bg-white border border-gray-300 text-gray-700 px-2 py-0.5 rounded-full text-xs font-bold">
                        {group.count} {group.count === 1 ? 'project' : 'projects'}
                      </span>
                    </div>
                    <FiChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  </button>

                  {/* Cards Grid */}
                  {!isCollapsed && (
                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {group.items.map((p) => {
                        const rawCode = p.project_code || p.ref_no || `AI-${p.id.slice(0, 4)}`;
                        const displayCode = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');
                        const isTaskDone = (p.unified_status || '').toLowerCase().trim() === 'done';
                        const phase = formatPhaseDisplay(p.workflow_stage, p.status);
                        const statusStyle = getStatusStyle(p.status_color, p.unified_status);

                        return (
                          <div
                            key={p.id}
                            className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-3"
                          >
                            {/* Card Header: Project ID & Phase */}
                            <div className="flex items-center justify-between gap-2">
                              <Link
                                href={`/dashboard/projects/${p.id}`}
                                className="font-mono font-bold text-blue-600 hover:underline text-xs flex items-center gap-1"
                                title={`Open project ${displayCode}`}
                              >
                                <span>{displayCode}</span>
                                <FiExternalLink className="w-3 h-3 text-gray-400" />
                              </Link>

                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                phase === 'Designing' ? 'bg-amber-100 text-amber-800' :
                                phase === 'Execution' ? 'bg-blue-100 text-blue-800' :
                                phase === 'Handover' ? 'bg-purple-100 text-purple-800' :
                                'bg-emerald-100 text-emerald-800'
                              }`}>
                                {phase}
                              </span>
                            </div>

                            {/* Project Title & Customer */}
                            <div>
                              <Link
                                href={`/dashboard/projects/${p.id}`}
                                className="font-bold text-gray-900 hover:text-blue-600 text-sm line-clamp-1 block transition-colors"
                              >
                                {p.title || 'Untitled Project'}
                              </Link>
                              <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 truncate">
                                <span>Client:</span>
                                <span className="font-medium text-gray-700 truncate">{p.customer_name || '-'}</span>
                                {p.phone_number && (
                                  <a
                                    href={`tel:${p.phone_number}`}
                                    className="text-gray-400 hover:text-yellow-600 ml-1 inline-flex items-center"
                                    title={p.phone_number}
                                  >
                                    <FiPhone className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Target Date & Notes */}
                            <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs">
                              <div className="flex items-center justify-between text-gray-600">
                                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                  <FiCalendar className="w-3 h-3" />
                                  Target Date:
                                </span>
                                <span className="font-semibold text-gray-800 text-[11px]">
                                  {p.deadline ? formatDateIST(p.deadline) : (p.estimated_completion_date ? formatDateIST(p.estimated_completion_date) : 'Not set')}
                                </span>
                              </div>

                              {/* Notes snippet */}
                              {p.project_notes ? (
                                <div className="bg-gray-50 p-2 rounded-lg text-xs text-gray-700 italic line-clamp-2 border border-gray-100">
                                  "{p.project_notes}"
                                </div>
                              ) : (
                                <div className="text-[11px] text-gray-400 italic">No notes added</div>
                              )}
                            </div>

                            {/* Card Footer: Interactive Status Pill Button */}
                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => openBottomSheet(p)}
                                className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center justify-between cursor-pointer border border-black/5 hover:opacity-90"
                                style={{
                                  backgroundColor: statusStyle.backgroundColor,
                                  color: statusStyle.color,
                                }}
                              >
                                <span className="truncate">{p.unified_status || 'Select Status'}</span>
                                <FiChevronDown className="w-3.5 h-3.5 ml-1 flex-shrink-0 opacity-80" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleComplete(p)}
                                disabled={savingId === p.id}
                                title={isTaskDone ? "Task is Done. Click to re-open." : "Mark today's task Done"}
                                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all border shadow-2xs flex items-center gap-1 flex-shrink-0 cursor-pointer ${
                                  isTaskDone
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-white text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 border-gray-200'
                                }`}
                              >
                                <FiCheckCircle className={`w-3.5 h-3.5 ${isTaskDone ? 'text-emerald-600' : 'text-gray-400'}`} />
                                <span>{isTaskDone ? 'Done' : 'Mark Done'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* EXCEL SPREADSHEET GRID CONTAINER (Exact CRM Pattern) */
        <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden w-full">
        <div className="overflow-x-auto w-full max-w-full">
          <table 
            className="w-full text-left border-collapse border-spacing-0 text-xs select-none"
            style={{ tableLayout: 'fixed' }}
          >
            {/* Sticky Excel Header Row */}
            <thead>
              <tr className="bg-gray-100 text-gray-600 font-bold select-none text-center divide-x divide-gray-200 sticky top-0 z-20 border-b border-gray-300">
                {/* Row Index # Header Column */}
                <th className="w-10 bg-gray-200 border-b border-gray-300 text-center py-2 text-[10px] font-black text-gray-500 select-none">
                  #
                </th>

                {/* Columns with Letters (A, B, C...) + Labels */}
                {SHEET_COLUMNS.map((col) => (
                  <th 
                    key={col.id}
                    className="py-1.5 px-2 border-b border-gray-300 text-gray-700 text-[11px] font-black uppercase shadow-2xs relative group select-none text-left"
                    style={{ width: columnWidths[col.id] || col.defaultWidth }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 font-black">{col.letter}</span>
                    </div>
                    <span className="block text-[10px] text-gray-700 font-bold capitalize mt-0.5 truncate">
                      {col.label}
                    </span>

                    {/* Excel Column Resize Handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, col.id)}
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-yellow-400/80 active:bg-yellow-500 z-10 select-none transition-all"
                    />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 font-normal">
              {loading ? (
                <tr>
                  <td colSpan={SHEET_COLUMNS.length + 1} className="py-14 text-center text-gray-400">
                    <div className="w-6 h-6 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs font-semibold">Loading daily status spreadsheet...</span>
                  </td>
                </tr>
              ) : groupedProjects.length === 0 ? (
                <tr>
                  <td colSpan={SHEET_COLUMNS.length + 1} className="py-12 text-center text-gray-500 font-medium">
                    No matching projects found in daily status sheet.
                  </td>
                </tr>
              ) : (
                groupedProjects.map((group) => {
                  const isCollapsed = Boolean(collapsedDesigners[group.designerName]);

                  return (
                    <React.Fragment key={group.designerName}>
                      {/* Designer Group Subheader Row: Only shown if Management oversees multiple designers */}
                      {isManagement && (
                        <tr 
                          onClick={() => toggleDesignerCollapse(group.designerName)}
                          className="bg-gray-100/90 hover:bg-gray-200/90 transition-colors cursor-pointer border-y border-gray-300 select-none"
                        >
                          <td className="text-center py-2 bg-gray-200/80 border-r border-gray-300">
                            <FiChevronDown 
                              className={`w-3.5 h-3.5 text-gray-600 mx-auto transition-transform ${
                                isCollapsed ? '-rotate-90 text-gray-400' : ''
                              }`} 
                            />
                          </td>
                          <td colSpan={SHEET_COLUMNS.length} className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <FiUser className="w-3.5 h-3.5 text-yellow-600" />
                              <span className="font-bold text-gray-800 text-xs">
                                {group.designerName}
                              </span>
                              <span className="ml-2 bg-white border border-gray-300 text-gray-700 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-2xs">
                                {group.count} {group.count === 1 ? 'project' : 'projects'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Project Rows under this Designer */}
                      {!isCollapsed && group.items.map((p) => {
                        const rowNum = runningRowNumber++;
                        const rawCode = p.project_code || p.ref_no || `AI-${p.id.slice(0, 4)}`;
                        const displayCode = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');
                        const isTaskDone = (p.unified_status || '').toLowerCase().trim() === 'done';

                        return (
                          <tr 
                            key={p.id}
                            className={`divide-x divide-gray-200 transition-colors ${
                              isTaskDone ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'hover:bg-gray-50/60'
                            }`}
                          >
                            {/* Column #: Row index */}
                            <td className="w-10 text-center font-bold text-gray-400 bg-gray-50/80 border-r border-gray-200 py-1.5 select-none align-middle text-[11px]">
                              {rowNum}
                            </td>

                            {/* Column A: Project ID */}
                            <td 
                              className="py-1.5 px-2 font-bold text-blue-600 truncate align-middle"
                              style={{ width: columnWidths['project_code'] || 95 }}
                            >
                              <Link
                                href={`/dashboard/projects/${p.id}`}
                                className="hover:underline flex items-center gap-1 group/code"
                                title={`Open project ${displayCode}`}
                              >
                                <span>{displayCode}</span>
                                <FiExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/code:opacity-100 transition-opacity flex-shrink-0" />
                              </Link>
                            </td>

                            {/* Column B: Project Name */}
                            <td 
                              className="py-1.5 px-2 text-gray-900 truncate font-semibold align-middle"
                              style={{ width: columnWidths['project_name'] || 200 }}
                              title={p.title}
                            >
                              <Link
                                href={`/dashboard/projects/${p.id}`}
                                className="hover:underline text-gray-900 hover:text-blue-600 truncate block"
                                title={p.title}
                              >
                                {p.title}
                              </Link>
                            </td>

                            {/* Column C: Client */}
                            <td 
                              className="py-1.5 px-2 text-gray-700 truncate align-middle"
                              style={{ width: columnWidths['customer_name'] || 130 }}
                              title={p.customer_name}
                            >
                              {p.customer_name || '-'}
                            </td>

                            {/* Column D: Designer */}
                            <td 
                              className="py-1.5 px-2 text-gray-600 truncate align-middle text-xs"
                              style={{ width: columnWidths['designer'] || 105 }}
                              title={group.designerName}
                            >
                              {group.designerName}
                            </td>

                            {/* Column E: Phase Dropdown */}
                            <td 
                              className="py-1 px-1.5 align-middle"
                              style={{ width: columnWidths['phase'] || 110 }}
                            >
                              <select
                                value={formatPhaseDisplay(p.workflow_stage, p.status)}
                                onChange={(e) => handleUpdate(p.id, { workflow_stage: e.target.value })}
                                className="w-full px-2 py-1 bg-white border border-gray-200 hover:border-gray-300 rounded text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-yellow-500 font-medium cursor-pointer"
                              >
                                {PREPOPULATED_PHASES.map(ph => (
                                  <option key={ph} value={ph}>{ph}</option>
                                ))}
                              </select>
                            </td>

                            {/* Column F: Task Status (Color Badge + Inline Text + Palette Picker) */}
                            <td 
                              className="py-1 px-1.5 relative align-middle"
                              style={{ width: columnWidths['status'] || 165 }}
                            >
                              {(() => {
                                const style = getStatusStyle(p.status_color, p.unified_status);
                                const isOpen = activeColorPickerId === p.id;

                                return (
                                  <div className="relative">
                                    <div 
                                      className="flex items-center justify-between rounded px-2 py-1 shadow-2xs border border-black/10 transition-all gap-1"
                                      style={{
                                        backgroundColor: style.backgroundColor,
                                        color: style.color,
                                      }}
                                    >
                                      {/* Select dropdown for task status */}
                                      <select
                                        value={p.unified_status || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === '__custom__') {
                                            const custom = window.prompt('Enter custom status:', p.unified_status || '');
                                            if (custom && custom.trim()) {
                                              handleUpdate(p.id, { unified_status: custom.trim() });
                                            }
                                            return;
                                          }
                                          const matched = PREPOPULATED_STATUSES.find(o => o.name.toLowerCase() === val.toLowerCase());
                                          const isDesignCompleted = val === 'Design Completed';
                                          const payload: Partial<ProjectStatusItem> = {
                                            unified_status: val,
                                          };
                                          if (matched) {
                                            payload.status_color = matched.color;
                                          }
                                          if (isDesignCompleted && formatPhaseDisplay(p.workflow_stage, p.status) === 'Designing') {
                                            payload.workflow_stage = 'Execution';
                                          }
                                          handleUpdate(p.id, payload);
                                        }}
                                        title={`Status: ${p.unified_status || 'Select Status'}`}
                                        style={{
                                          color: style.color,
                                          backgroundColor: 'transparent',
                                        }}
                                        className="w-full bg-transparent border-none text-xs font-bold focus:outline-none cursor-pointer truncate mr-1"
                                      >
                                        <option value="" disabled className="text-gray-900 bg-white">Select Status...</option>
                                        {PREPOPULATED_STATUSES.map((opt) => (
                                          <option key={opt.name} value={opt.name} className="text-gray-900 bg-white font-semibold">
                                            {opt.name}
                                          </option>
                                        ))}
                                        {p.unified_status && !PREPOPULATED_STATUSES.some(o => o.name.toLowerCase() === p.unified_status?.toLowerCase()) && (
                                          <option value={p.unified_status} className="text-gray-900 bg-white font-semibold">
                                            {p.unified_status}
                                          </option>
                                        )}
                                        <option value="__custom__" className="text-gray-700 bg-gray-50 italic">
                                          ✏️ Custom status...
                                        </option>
                                      </select>

                                      {/* Color Picker trigger button */}
                                      <button
                                        type="button"
                                        onClick={() => setActiveColorPickerId(isOpen ? null : p.id)}
                                        title="Pick status color"
                                        className="shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors opacity-80 hover:opacity-100 cursor-pointer"
                                      >
                                        <div 
                                          className="w-3.5 h-3.5 rounded-full border border-white/80 shadow-2xs" 
                                          style={{ backgroundColor: style.backgroundColor }}
                                        />
                                      </button>
                                    </div>

                                    {/* Color Picker Dropdown Popover */}
                                    {isOpen && (
                                      <>
                                        <div 
                                          className="fixed inset-0 z-40" 
                                          onClick={() => setActiveColorPickerId(null)} 
                                        />
                                        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-60 text-gray-800 animate-in fade-in zoom-in-95 duration-100">
                                          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-gray-100">
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Select Status Color</span>
                                            <button
                                              type="button"
                                              onClick={() => setActiveColorPickerId(null)}
                                              className="text-gray-400 hover:text-gray-600 rounded"
                                            >
                                              <FiX className="w-3.5 h-3.5" />
                                            </button>
                                          </div>

                                          {/* Swatches Grid */}
                                          <div className="grid grid-cols-5 gap-1.5 mb-2.5">
                                            {STATUS_PALETTE.map((col) => {
                                              const isSelected = p.status_color === col.hex || (!p.status_color && style.backgroundColor === col.hex);
                                              return (
                                                <button
                                                  key={col.hex}
                                                  type="button"
                                                  onClick={() => {
                                                    handleUpdate(p.id, { status_color: col.hex });
                                                    setActiveColorPickerId(null);
                                                  }}
                                                  title={col.name}
                                                  className="w-7 h-7 rounded-md flex items-center justify-center border border-black/10 hover:scale-105 transition-transform cursor-pointer"
                                                  style={{ backgroundColor: col.hex }}
                                                >
                                                  {isSelected && (
                                                    <FiCheck className={`w-3.5 h-3.5 ${col.hex === '#E2E8F0' ? 'text-gray-800' : 'text-white'}`} />
                                                  )}
                                                </button>
                                              );
                                            })}
                                          </div>

                                          {/* Custom color input & reset */}
                                          <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 text-[11px]">
                                            <label className="flex items-center gap-1 text-gray-600 font-medium cursor-pointer">
                                              <input
                                                type="color"
                                                value={p.status_color || '#10B981'}
                                                onChange={(e) => handleUpdate(p.id, { status_color: e.target.value })}
                                                className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                                              />
                                              <span>Custom</span>
                                            </label>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                handleUpdate(p.id, { status_color: null });
                                                setActiveColorPickerId(null);
                                              }}
                                              className="text-gray-400 hover:text-gray-700 underline text-[10px]"
                                            >
                                              Reset
                                            </button>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Column G: Start Date */}
                            <td 
                              className="py-1.5 px-2 text-gray-600 whitespace-nowrap text-xs align-middle"
                              style={{ width: columnWidths['start_date'] || 95 }}
                            >
                              {p.start_date ? formatDateIST(p.start_date) : '-'}
                            </td>

                            {/* Column H: Target Date Inline Picker */}
                            <td 
                              className="py-1 px-1.5 align-middle"
                              style={{ width: columnWidths['deadline'] || 115 }}
                            >
                              <input
                                type="date"
                                value={p.deadline ? p.deadline.split('T')[0] : (p.estimated_completion_date ? p.estimated_completion_date.split('T')[0] : '')}
                                onChange={(e) => handleUpdate(p.id, { deadline: e.target.value || null })}
                                title="Target date for this design milestone"
                                className="w-full px-1.5 py-1 bg-white border border-gray-200 hover:border-gray-300 rounded text-xs text-gray-700 focus:ring-1 focus:ring-yellow-500 focus:outline-none"
                              />
                            </td>

                            {/* Column I: Notes Inline Input */}
                            <td 
                              className="py-1 px-1.5 align-middle"
                              style={{ width: columnWidths['notes'] || 230 }}
                            >
                              <input
                                type="text"
                                defaultValue={p.project_notes || ''}
                                onBlur={(e) => {
                                  if (e.target.value !== (p.project_notes || '')) {
                                    handleUpdate(p.id, { project_notes: e.target.value });
                                  }
                                }}
                                placeholder="Add daily notes..."
                                title={p.project_notes || 'Add daily notes...'}
                                className="w-full px-2 py-1 bg-gray-50/60 hover:bg-white focus:bg-white border border-transparent hover:border-gray-200 focus:border-yellow-400 rounded text-xs text-gray-800 placeholder-gray-400 focus:outline-none transition-all"
                              />
                            </td>

                            {/* Column J: Action Quick Done Checkmark Button */}
                            <td 
                              className="py-1 px-1.5 text-center align-middle"
                              style={{ width: columnWidths['action'] || 100 }}
                            >
                              {isTaskDone ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleComplete(p)}
                                  disabled={savingId === p.id}
                                  title="Task is Done. Click to re-open if needed."
                                  className="inline-flex items-center justify-center gap-1 w-full py-1 px-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 rounded text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                                >
                                  <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Done</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleComplete(p)}
                                  disabled={savingId === p.id}
                                  title="Mark this design milestone as Done"
                                  className="inline-flex items-center justify-center gap-1 w-full py-1 px-2 bg-white hover:bg-emerald-600 text-gray-700 hover:text-white border border-gray-200 hover:border-emerald-600 rounded text-[11px] font-medium transition-all shadow-2xs cursor-pointer group/btn"
                                >
                                  <FiCheckCircle className="w-3.5 h-3.5 text-gray-400 group-hover/btn:text-white transition-colors" />
                                  <span>Mark Done</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Quick Status Modal: Bottom Sheet on mobile, Centered Dialog on desktop */}
      <StatusUpdaterModal
        project={activeBottomSheetProject}
        onClose={() => setActiveBottomSheetProject(null)}
        onSelectStatus={handleSelectStatusFromSheet}
        sheetDeadline={sheetDeadline}
        setSheetDeadline={setSheetDeadline}
        sheetNotes={sheetNotes}
        setSheetNotes={setSheetNotes}
        onSaveDetails={handleSaveSheetDetails}
      />
    </div>
  );
}
