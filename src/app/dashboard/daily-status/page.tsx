'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
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
  FiFileText
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

export default function DailyStatusPage() {
  const { hasAnyPermission, isAdmin: permIsAdmin, isLoading: permLoading } = useUserPermissions();
  const { user, isAdmin: authIsAdmin } = useAuth();
  const isAdmin = Boolean(authIsAdmin || permIsAdmin || user?.role?.toLowerCase() === 'admin');
  const canAccess = Boolean(isAdmin || hasAnyPermission(['designs.daily_status', 'daily_status.view']));

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

      if (!res.ok) throw new Error('Update failed');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update');
      fetchProjects();
    } finally {
      setSavingId(null);
    }
  };

  // Toggle specific design task as Done
  // NOTE: Marking a daily task done does NOT close the overall project!
  const handleToggleComplete = async (p: ProjectStatusItem) => {
    const isDone = (p.unified_status || '').toLowerCase().trim() === 'done';
    if (isDone) {
      await handleUpdate(p.id, {
        unified_status: 'In Progress',
        status_color: '#FF3366',
      });
      showToast('info', `Task re-opened for "${p.title}"`);
    } else {
      await handleUpdate(p.id, {
        unified_status: 'Done',
        status_color: '#10B981',
      });
      showToast('success', `Task marked as Done for "${p.title}"`);
    }
  };

  // Filter projects by status: active vs closed projects
  const activeProjects = useMemo(() => {
    return safeProjects.filter(p => {
      const isProjectClosed = (p.status || '').toLowerCase() === 'completed';
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
          'Project ID': `Assigned Designer: ${group.designerName} (${group.count} projects)`,
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
            content: `Assigned Designer: ${group.designerName} (${group.count} projects)`,
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

  if (!permLoading && !canAccess) {
    return (
      <div className="p-8 max-w-md mx-auto mt-16 bg-white border border-gray-200 rounded-2xl shadow-xs text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
          <FiLayers className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-gray-900">Access Restricted</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          You do not have permission to view the Daily Design Status Sheet. Please contact your administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 lg:p-6 w-full max-w-full space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <FiLayers className="w-6 h-6 text-yellow-600" />
            <span>Daily Design Status Sheet</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isManagement 
              ? 'Spreadsheet-style daily design milestone tracker, live task completion & EOD exports' 
              : 'Personal daily design task tracker & live milestone updates'}
          </p>
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
      </div>

      {/* EXCEL SPREADSHEET GRID CONTAINER (Exact CRM Pattern) */}
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
                      {/* Designer Group Divider Banner Row (Clean light Excel outline style) */}
                      <tr 
                        onClick={() => toggleDesignerCollapse(group.designerName)}
                        className="bg-slate-100 hover:bg-slate-200/80 text-gray-800 font-bold select-none border-y border-gray-300 text-xs cursor-pointer transition-colors"
                      >
                        <td className="w-10 bg-slate-200/80 text-center py-1.5 align-middle select-none">
                          <FiChevronDown 
                            className={`w-3.5 h-3.5 mx-auto text-gray-600 transition-transform duration-150 ${
                              isCollapsed ? '-rotate-90 text-gray-400' : ''
                            }`} 
                          />
                        </td>
                        <td colSpan={SHEET_COLUMNS.length} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <FiUser className="w-3.5 h-3.5 text-yellow-600" />
                            <span className="font-bold text-gray-800 text-xs">
                              Assigned Designer: {group.designerName}
                            </span>
                            <span className="ml-2 bg-white border border-gray-300 text-gray-700 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-2xs">
                              {group.count} {group.count === 1 ? 'project' : 'projects'}
                            </span>
                          </div>
                        </td>
                      </tr>

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
                                href={`/dashboard/projects?search=${encodeURIComponent(displayCode)}`}
                                className="hover:underline flex items-center gap-1 group/code"
                                title={`Open ${displayCode}`}
                              >
                                <span>{displayCode}</span>
                                <FiExternalLink className="w-3 h-3 opacity-0 group-hover/code:opacity-100 transition-opacity text-gray-400" />
                              </Link>
                            </td>

                            {/* Column B: Project Name */}
                            <td 
                              className="py-1.5 px-2 font-medium text-gray-900 truncate align-middle"
                              style={{ width: columnWidths['title'] || 220 }}
                              title={p.title}
                            >
                              {p.title}
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
                                      className="flex items-center justify-between rounded px-2 py-1 shadow-2xs border border-black/10 transition-all"
                                      style={{
                                        backgroundColor: style.backgroundColor,
                                        color: style.color,
                                      }}
                                    >
                                      {/* Direct editable status text */}
                                      <input
                                        key={`${p.id}-${p.unified_status}`}
                                        type="text"
                                        defaultValue={p.unified_status || ''}
                                        onBlur={(e) => {
                                          if (e.target.value !== (p.unified_status || '')) {
                                            handleUpdate(p.id, { unified_status: e.target.value });
                                          }
                                        }}
                                        placeholder="Add status..."
                                        title={p.unified_status || 'Add status...'}
                                        style={{ color: style.color }}
                                        className="w-full bg-transparent border-none text-xs font-bold focus:outline-none placeholder-white/60 truncate mr-1"
                                      />

                                      {/* Color Picker trigger button */}
                                      <button
                                        type="button"
                                        onClick={() => setActiveColorPickerId(isOpen ? null : p.id)}
                                        title="Pick color"
                                        className="shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors opacity-70 hover:opacity-100 cursor-pointer"
                                      >
                                        <div 
                                          className="w-3 h-3 rounded-full border border-white/60 shadow-2xs" 
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
    </div>
  );
}
