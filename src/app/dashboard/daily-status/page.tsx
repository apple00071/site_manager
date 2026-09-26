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
  FiClock,
  FiAlertTriangle,
  FiArrowRight,
  FiRotateCcw,
  FiPlus,
  FiEdit2,
  FiTrash2
} from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import { formatDateIST, getTodayDateString } from '@/lib/dateUtils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/contexts/AuthContext';
import {
  DailyTaskItem,
  ProjectTasksData,
  parseProjectTasks,
  serializeProjectTasks,
  getReadableProjectNotes,
  addTaskToProject,
  updateTaskInProject
} from '@/lib/designTaskUtils';

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
  designer_id?: string | null;
  designer?: {
    id: string;
    email: string;
    username?: string;
    full_name?: string;
  } | null;
  assigned_employee?: {
    id: string;
    email: string;
    name?: string;
    full_name?: string;
    designation?: string;
  } | null;
}

const getProjectDesignerName = (p: ProjectStatusItem): string => {
  return (
    p.assigned_employee?.full_name?.trim() ||
    p.assigned_employee?.name?.trim() ||
    p.designer?.full_name?.trim() ||
    p.designer?.username?.trim() ||
    '(Unassigned)'
  );
};

export type { DailyTaskItem, ProjectTasksData };
export { parseProjectTasks, serializeProjectTasks, getReadableProjectNotes };

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
  { id: 'notes', letter: 'I', label: 'Notes', defaultWidth: 250 },
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
  { name: 'To Do', color: '#64748B', desc: 'Queued' },
  { name: 'In Progress', color: '#FF3366', desc: 'In progress' },
  { name: 'Under Review', color: '#8B5CF6', desc: 'Under review' },
  { name: 'Done', color: '#10B981', desc: 'Milestone done' },
  { name: 'Design Completed', color: '#0D9488', desc: 'All designs finished' },
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

export type TimelineFilter = 'all' | 'overdue' | 'today' | 'upcoming' | 'completed';

export interface TaskTimelineInfo {
  type: 'overdue' | 'today' | 'upcoming' | 'completed' | 'no_date';
  label: string;
  badgeClass: string;
  isOverdue: boolean;
  daysDiff: number;
}

export const getTaskTimelineInfo = (p: ProjectStatusItem, today: string): TaskTimelineInfo => {
  const isDone = (p.unified_status || '').toLowerCase().trim() === 'done' ||
                 (p.unified_status || '').toLowerCase().trim() === 'design completed' ||
                 (p.status || '').toLowerCase() === 'completed';

  if (isDone) {
    return {
      type: 'completed',
      label: 'Done',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      isOverdue: false,
      daysDiff: 0,
    };
  }

  const dateVal = p.deadline ? p.deadline.split('T')[0] : null;

  if (!dateVal) {
    return {
      type: 'no_date',
      label: 'No target set',
      badgeClass: 'bg-gray-100 text-gray-500 border-gray-200',
      isOverdue: false,
      daysDiff: 0,
    };
  }

  if (dateVal === today) {
    return {
      type: 'today',
      label: "Today's Focus",
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 font-bold',
      isOverdue: false,
      daysDiff: 0,
    };
  }

  if (dateVal < today) {
    const dTarget = new Date(dateVal);
    const dToday = new Date(today);
    const diffDays = Math.max(1, Math.round((dToday.getTime() - dTarget.getTime()) / (1000 * 60 * 60 * 24)));
    const label = diffDays === 1 ? 'Due Yesterday (Rolled Over)' : `Overdue (${diffDays}d ago)`;
    return {
      type: 'overdue',
      label,
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
      isOverdue: true,
      daysDiff: diffDays,
    };
  }

  return {
    type: 'upcoming',
    label: `Target: ${formatDateIST(dateVal)}`,
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
    isOverdue: false,
    daysDiff: 0,
  };
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
  initialMode?: 'update' | 'add_new';
  taskId?: string | null;
  onClose: () => void;
  onSave: (data: {
    statusName: string;
    colorHex: string;
    deadline: string;
    notes: string;
    mode: 'update' | 'add_new';
    taskId?: string | null;
  }) => Promise<void> | void;
  isSaving?: boolean;
}

function StatusUpdaterModal({
  project,
  initialMode = 'update',
  taskId = null,
  onClose,
  onSave,
  isSaving = false,
}: StatusUpdaterModalProps) {
  const [mode, setMode] = useState<'update' | 'add_new'>(initialMode);
  const [statusName, setStatusName] = useState<string>('In Progress');
  const [colorHex, setColorHex] = useState<string>('#FF3366');
  const [deadline, setDeadline] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (!project) return;
    setMode(initialMode);

    const tasksData = parseProjectTasks(project.project_notes, project);

    if (initialMode === 'add_new') {
      setStatusName('In Progress');
      setColorHex('#FF3366');
      setDeadline(getTodayDateString());
      setNotes('');
      return;
    }

    // Update mode: check taskId or first task
    let targetTask: DailyTaskItem | undefined;
    if (taskId) {
      targetTask = tasksData.tasks.find(t => t.id === taskId);
    }
    if (!targetTask && tasksData.tasks.length > 0) {
      targetTask = tasksData.tasks[0];
    }

    if (targetTask) {
      setStatusName(targetTask.status);
      setColorHex(targetTask.status_color || '#FF3366');
      setDeadline(targetTask.deadline ? targetTask.deadline.split('T')[0] : '');
      setNotes(targetTask.title);
    } else {
      const rawStatus = project.unified_status || 'In Progress';
      let matched = PREPOPULATED_STATUSES.find(
        (s) => s.name.toLowerCase() === rawStatus.toLowerCase()
      );
      setStatusName(matched ? matched.name : rawStatus);
      setColorHex(project.status_color || matched?.color || '#FF3366');
      setDeadline(project.deadline ? project.deadline.split('T')[0] : '');
      setNotes(project.project_notes || '');
    }
  }, [project, initialMode, taskId]);

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

  const handleSelectStatus = (opt: { name: string; color: string }) => {
    setStatusName(opt.name);
    setColorHex(opt.color);
  };

  const handleSwitchMode = (newMode: 'update' | 'add_new') => {
    setMode(newMode);
    if (newMode === 'add_new') {
      setStatusName('In Progress');
      setColorHex('#FF3366');
      setDeadline(getTodayDateString());
      setNotes('');
    } else {
      const tasksData = parseProjectTasks(project.project_notes, project);
      const targetTask = taskId ? tasksData.tasks.find(t => t.id === taskId) : tasksData.tasks[0];
      if (targetTask) {
        setStatusName(targetTask.status);
        setColorHex(targetTask.status_color || '#FF3366');
        setDeadline(targetTask.deadline ? targetTask.deadline.split('T')[0] : '');
        setNotes(targetTask.title);
      }
    }
  };

  const handleSave = () => {
    onSave({
      statusName,
      colorHex,
      deadline,
      notes: notes.trim(),
      mode,
      taskId: mode === 'update' ? taskId : null,
    });
  };

  const codeDisplay = (project.project_code || project.ref_no || '')
    .replace('AI/PRJ/', 'AI/')
    .replace('PRJ/', '');

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grab Handle */}
        <div className="flex sm:hidden justify-center pt-3 pb-1 shrink-0 bg-white">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0 bg-white">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2">
              {codeDisplay && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[11px] font-bold rounded">
                  {codeDisplay}
                </span>
              )}
              <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                {mode === 'add_new' ? 'Add Another Task' : 'Update Task'}
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

        {/* Modal Body (Clean & Compact) */}
        <div className="p-4 sm:p-5 space-y-3.5 max-h-[70vh] overflow-y-auto">
          {/* Mode Switcher Toggle: Update Current Task vs Add New Task */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => handleSwitchMode('update')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'update'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <FiEdit2 className="w-3.5 h-3.5" />
              <span>Update Task</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('add_new')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'add_new'
                  ? 'bg-yellow-500 text-gray-950 shadow-2xs font-black'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FiPlus className="w-3.5 h-3.5" />
              <span>Add Another Task</span>
            </button>
          </div>

          {mode === 'update' && statusName.toLowerCase() === 'done' && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 font-medium flex items-center gap-1.5">
              <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Marking this task Done will archive it safely into Task History.</span>
            </div>
          )}
          {/* Status Selection (Compact 2-col Grid) */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Select Design Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PREPOPULATED_STATUSES.map((opt) => {
                const isSelected = statusName.toLowerCase() === opt.name.toLowerCase();
                const isFullWidth = opt.name === 'Design Completed';
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => handleSelectStatus(opt)}
                    className={`${isFullWidth ? 'col-span-2' : 'col-span-1'} p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-yellow-500 bg-yellow-50/70 shadow-xs ring-1 ring-yellow-400' 
                        : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: isSelected ? colorHex : opt.color }} 
                      />
                      <span className="text-xs font-bold text-gray-900 truncate">{opt.name}</span>
                    </div>
                    {isSelected && (
                      <FiCheck className="w-4 h-4 text-yellow-600 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Status Color Options (Compact, sleek mobile row) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-gray-500">
                  Status Tag Color
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const matched = PREPOPULATED_STATUSES.find(s => s.name.toLowerCase() === statusName.toLowerCase());
                    if (matched) setColorHex(matched.color);
                  }}
                  className="no-touch-target min-w-0 text-gray-400 hover:text-gray-700 underline text-[10px] cursor-pointer"
                >
                  Reset Default
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-2 bg-gray-50 border border-gray-100 rounded-xl">
                {STATUS_PALETTE.map((col) => {
                  const isSelected = colorHex.toLowerCase() === col.hex.toLowerCase();
                  return (
                    <button
                      key={col.hex}
                      type="button"
                      onClick={() => setColorHex(col.hex)}
                      title={col.name}
                      className={`no-touch-target min-w-0 rounded-full shrink-0 flex items-center justify-center border border-black/15 transition-transform cursor-pointer ${
                        isSelected ? 'scale-110 ring-2 ring-yellow-500 ring-offset-1 z-10' : 'hover:scale-105 opacity-90'
                      }`}
                      style={{ backgroundColor: col.hex, width: '24px', height: '24px', minWidth: '24px', minHeight: '24px' }}
                    >
                      {isSelected && (
                        <FiCheck className={`w-3 h-3 ${col.hex === '#E2E8F0' ? 'text-gray-800' : 'text-white'}`} />
                      )}
                    </button>
                  );
                })}

                <div className="h-4 w-px bg-gray-300 mx-0.5 shrink-0" />

                {/* Custom color input */}
                <label 
                  className="no-touch-target min-w-0 rounded-full border border-gray-300 shrink-0 flex items-center justify-center cursor-pointer hover:scale-105 transition relative bg-gradient-to-tr from-indigo-500 via-rose-500 to-amber-400"
                  title="Pick custom color"
                  style={{ width: '24px', height: '24px', minWidth: '24px', minHeight: '24px' }}
                >
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="opacity-0 absolute inset-0 cursor-pointer w-full h-full no-touch-target"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Target Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Target Date</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setDeadline(getTodayDateString())}
                className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition cursor-pointer shrink-0 border border-blue-200"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  setDeadline(d.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition cursor-pointer shrink-0"
              >
                Tomorrow
              </button>
              {deadline && (
                <button
                  type="button"
                  onClick={() => setDeadline('')}
                  className="px-2 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer shrink-0 font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Daily Notes / Task Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {mode === 'add_new' ? 'Task Description / Notes' : 'Task Description / Notes'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={mode === 'add_new' ? 'e.g. Living room 3D revision, kitchen elevations...' : 'Task details, client comments, or scope...'}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white resize-none"
            />
          </div>
        </div>

        {/* Modal Sticky Footer */}
        <div className="shrink-0 bg-gray-50 border-t border-gray-100 px-4 sm:px-5 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 pl-10 sm:pl-0">
            <span
              style={getStatusStyle(colorHex, statusName)}
              className="px-2.5 py-1 rounded-md text-xs font-bold shadow-xs truncate max-w-[120px] sm:max-w-[180px]"
            >
              {statusName}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 active:scale-95 text-gray-950 font-bold rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FiCheck className="w-3.5 h-3.5" />
                  {mode === 'add_new' ? 'Add Task' : 'Save Status'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface ReopenProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReopen: (p: ProjectStatusItem, options?: { customNotes?: string; targetDate?: string }) => Promise<boolean>;
  todayStr: string;
}

function ReopenProjectModal({
  isOpen,
  onClose,
  onReopen,
  todayStr,
}: ReopenProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [completedProjects, setCompletedProjects] = useState<ProjectStatusItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<ProjectStatusItem | null>(null);
  const [targetDate, setTargetDate] = useState(todayStr);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSelectedProject(null);
      setSearch('');
      setRevisionNotes('');
      setTargetDate(todayStr);
      return;
    }

    let isMounted = true;
    const fetchCompleted = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/daily-status?include_completed=true', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load completed projects');
        const data = await res.json();
        const list: ProjectStatusItem[] = Array.isArray(data?.projects) ? data.projects : Array.isArray(data) ? data : [];
        if (isMounted) {
          // Strictly show projects where design is marked completed AND overall project is not closed
          const completedOnly = list.filter(p => {
            const isDesignCompleted = (p.unified_status || '').toLowerCase().trim() === 'design completed';
            const isProjectClosed = (p.status || '').toLowerCase() === 'completed';
            return isDesignCompleted && !isProjectClosed;
          });
          setCompletedProjects(completedOnly);
        }
      } catch (err) {
        console.error('Error fetching completed projects:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCompleted();
    return () => {
      isMounted = false;
    };
  }, [isOpen, todayStr]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const filtered = completedProjects.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const code = (p.project_code || p.ref_no || '').replace('AI/PRJ/', 'AI/').replace('PRJ/', '').toLowerCase();
    const title = (p.title || '').toLowerCase();
    const client = (p.customer_name || '').toLowerCase();
    const designer = getProjectDesignerName(p).toLowerCase();
    return code.includes(q) || title.includes(q) || client.includes(q) || designer.includes(q);
  });

  const handleConfirm = async () => {
    if (!selectedProject) return;
    setIsSubmitting(true);
    try {
      const ok = await onReopen(selectedProject, {
        targetDate,
        customNotes: revisionNotes.trim() || undefined,
      });
      if (ok) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-all duration-200 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grab Handle */}
        <div className="flex sm:hidden justify-center pt-3 pb-1 shrink-0 bg-white">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0 bg-white">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FiRotateCcw className="w-4 h-4 text-yellow-600" />
              <span>Re-open Completed Project</span>
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Select a finished project to bring back into active daily design status
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

        {/* Search */}
        <div className="p-3 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by project name, code, client, or designer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 transition-all"
            />
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-60 sm:max-h-72">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
              <span className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading design completed projects...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-400">
              {search.trim() ? 'No matching design completed projects found' : 'No design completed projects found'}
            </div>
          ) : (
            filtered.map((p) => {
              const rawCode = p.project_code || p.ref_no || `AI-${p.id.slice(0, 4)}`;
              const displayCode = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');
              const isSelected = selectedProject?.id === p.id;
              const designer = getProjectDesignerName(p);
              const phase = formatPhaseDisplay(p.workflow_stage, p.status);

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProject(p)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-yellow-500 bg-yellow-50/80 shadow-xs ring-1 ring-yellow-400'
                      : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded">
                        {displayCode}
                      </span>
                      <span className="text-xs font-bold text-gray-900 truncate">
                        {p.title || 'Untitled'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span>Client: <strong className="text-gray-700">{p.customer_name || '-'}</strong></span>
                      <span>•</span>
                      <span>Designer: <strong className="text-gray-700">{designer}</strong></span>
                      <span>•</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-gray-100 text-gray-600 font-semibold">
                        Phase: {phase}
                      </span>
                    </div>
                  </div>
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-yellow-500 text-gray-950 flex items-center justify-center shrink-0">
                      <FiCheck className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                      Design Completed
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Selected Project Revision Options */}
        {selectedProject && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-3 shrink-0 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">
                Re-opening: <span className="text-yellow-700">{selectedProject.title}</span>
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                New Target Date
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                />
                <button
                  type="button"
                  onClick={() => setTargetDate(todayStr)}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer shrink-0 ${
                    targetDate === todayStr ? 'bg-yellow-500 text-gray-950 border-yellow-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setTargetDate(tomorrowStr)}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer shrink-0 ${
                    targetDate === tomorrowStr ? 'bg-yellow-500 text-gray-950 border-yellow-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  Tomorrow
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Revision Notes / Reason (Optional)
              </label>
              <input
                type="text"
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                placeholder="e.g. Client requested 3D revisions on master bedroom"
                className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500"
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedProject || isSubmitting}
            onClick={handleConfirm}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 active:scale-95 text-gray-950 font-bold rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                <span>Re-opening...</span>
              </>
            ) : (
              <>
                <FiRotateCcw className="w-3.5 h-3.5" />
                <span>Add Back to Active Design Status</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function DailyStatusPage() {
  const { hasPermission, hasAnyPermission, isAdmin, roleName, designation: permDesignation, isLoading: permLoading } = useUserPermissions();
  const { user } = useAuth();
  const router = useRouter();
  const canAccess = hasAnyPermission(['designs.daily_status', 'daily_status.view', 'designs.view_all']);
  const canViewAll = hasPermission('designs.view_all');
  const userDesig = (user?.designation || permDesignation || '').toLowerCase();
  const userRole = (roleName || user?.role || '').toLowerCase();
  const isLead = userDesig.includes('lead') || userRole.includes('lead');
  const canExport = Boolean(isAdmin || isLead || canViewAll || hasPermission('designs.export'));

  const [isServerManagement, setIsServerManagement] = useState<boolean | null>(null);
  const isManagement = isServerManagement !== null 
    ? isServerManagement 
    : Boolean(isAdmin || isLead || canViewAll);

  const [projects, setProjects] = useState<ProjectStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDesigner, setSelectedDesigner] = useState<string>('all');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('all');
  const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null);
  const [collapsedDesigners, setCollapsedDesigners] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [activeBottomSheetProject, setActiveBottomSheetProject] = useState<ProjectStatusItem | null>(null);
  const [modalInitialMode, setModalInitialMode] = useState<'update' | 'add_new'>('update');
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const [expandedHistories, setExpandedHistories] = useState<Record<string, boolean>>({});
  const [showReopenModal, setShowReopenModal] = useState(false);
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
  const handleReopenDesign = async (
    p: ProjectStatusItem,
    options?: { customNotes?: string; targetDate?: string }
  ): Promise<boolean> => {
    const payload: Partial<ProjectStatusItem> = {
      unified_status: 'In Progress',
      status_color: '#FF3366',
      deadline: options?.targetDate || todayStr,
      ...(options?.customNotes ? { project_notes: options.customNotes } : {}),
      ...(p.status === 'completed' ? { status: 'in_progress', workflow_stage: 'in_progress' } : {})
    };
    const ok = await handleUpdate(p.id, payload);
    if (ok) {
      showToast('success', `"${p.title}" re-opened and added back to Active Design Status`);
    }
    return Boolean(ok);
  };

  // Bottom Sheet Handlers & Multi-Task Management
  const openBottomSheet = (p: ProjectStatusItem) => {
    setActiveBottomSheetProject(p);
    setModalInitialMode('update');
    setModalTaskId(null);
  };

  const openUpdateModal = (p: ProjectStatusItem, taskId?: string | null) => {
    setActiveBottomSheetProject(p);
    setModalInitialMode('update');
    setModalTaskId(taskId || null);
  };

  const openAddTaskModal = (p: ProjectStatusItem) => {
    setActiveBottomSheetProject(p);
    setModalInitialMode('add_new');
    setModalTaskId(null);
  };

  const toggleHistory = (projectId: string) => {
    setExpandedHistories(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const handleSaveStatusModal = async (data: {
    statusName: string;
    colorHex: string;
    deadline: string;
    notes: string;
    mode: 'update' | 'add_new';
    taskId?: string | null;
  }) => {
    if (!activeBottomSheetProject) return;
    const p = safeProjects.find(item => item.id === activeBottomSheetProject.id) || activeBottomSheetProject;

    const isDesignCompleted = data.statusName === 'Design Completed';
    let tasksData = parseProjectTasks(p.project_notes, p);

    if (data.mode === 'add_new') {
      tasksData = addTaskToProject(tasksData, {
        title: data.notes || 'Design Task',
        status: data.statusName,
        status_color: data.colorHex,
        deadline: data.deadline || null,
      });
    } else {
      tasksData = updateTaskInProject(tasksData, data.taskId, {
        title: data.notes || undefined,
        status: data.statusName,
        status_color: data.colorHex,
        deadline: data.deadline || null,
      });
    }

    const serializedNotes = serializeProjectTasks(tasksData);
    const primaryTask = tasksData.tasks[0];

    const payload: Partial<ProjectStatusItem> = {
      project_notes: serializedNotes,
    };

    if (isDesignCompleted) {
      payload.unified_status = 'Design Completed';
      payload.status_color = data.colorHex;
      if (formatPhaseDisplay(p.workflow_stage, p.status) === 'Designing') {
        payload.workflow_stage = 'Execution';
      }
    } else if (primaryTask) {
      payload.unified_status = primaryTask.status;
      payload.status_color = primaryTask.status_color;
      payload.deadline = primaryTask.deadline || null;
    } else if (tasksData.history.length > 0) {
      payload.unified_status = 'Done';
      payload.status_color = '#10B981';
      payload.deadline = null;
    } else {
      payload.unified_status = data.statusName;
      payload.status_color = data.colorHex;
      payload.deadline = data.deadline || null;
    }

    const ok = await handleUpdate(p.id, payload);
    if (ok) {
      setActiveBottomSheetProject(null);
      setModalTaskId(null);
      showToast(
        'success',
        data.mode === 'add_new'
          ? `Added new task to "${p.title}"`
          : isDesignCompleted && formatPhaseDisplay(p.workflow_stage, p.status) === 'Designing'
          ? `Design completed for "${p.title}" (moved to Execution)`
          : `Updated task for "${p.title}"`
      );
    }
  };

  // Quick complete a specific task and archive to history
  const handleCompleteSpecificTask = async (p: ProjectStatusItem, taskId: string) => {
    let tasksData = parseProjectTasks(p.project_notes, p);
    tasksData = updateTaskInProject(tasksData, taskId, {
      status: 'Done',
      status_color: '#10B981',
    });

    const serializedNotes = serializeProjectTasks(tasksData);
    const primaryTask = tasksData.tasks[0];

    const payload: Partial<ProjectStatusItem> = {
      project_notes: serializedNotes,
      unified_status: primaryTask ? primaryTask.status : 'Done',
      status_color: primaryTask ? primaryTask.status_color : '#10B981',
      deadline: primaryTask ? primaryTask.deadline || null : null,
    };

    const ok = await handleUpdate(p.id, payload);
    if (ok) {
      showToast('success', 'Task completed and archived to history');
    }
  };

  // Re-open a task from history
  const handleReopenSpecificTask = async (p: ProjectStatusItem, historyTaskId: string) => {
    const tasksData = parseProjectTasks(p.project_notes, p);
    const targetIdx = tasksData.history.findIndex(h => h.id === historyTaskId);
    if (targetIdx === -1) return;

    const [reopenedTask] = tasksData.history.splice(targetIdx, 1);
    reopenedTask.status = 'In Progress';
    reopenedTask.status_color = '#FF3366';
    reopenedTask.deadline = todayStr;
    delete reopenedTask.completed_at;
    tasksData.tasks.push(reopenedTask);

    const serializedNotes = serializeProjectTasks(tasksData);
    const payload: Partial<ProjectStatusItem> = {
      project_notes: serializedNotes,
      unified_status: 'In Progress',
      status_color: '#FF3366',
      deadline: todayStr,
    };

    const ok = await handleUpdate(p.id, payload);
    if (ok) {
      showToast('success', `Re-opened "${reopenedTask.title}" as active task`);
    }
  };

  // Delete a specific task
  const handleDeleteSpecificTask = async (p: ProjectStatusItem, taskId: string, isHistory = false) => {
    const tasksData = parseProjectTasks(p.project_notes, p);
    if (isHistory) {
      tasksData.history = tasksData.history.filter(h => h.id !== taskId);
    } else {
      tasksData.tasks = tasksData.tasks.filter(t => t.id !== taskId);
    }

    const serializedNotes = serializeProjectTasks(tasksData);
    const primaryTask = tasksData.tasks[0];

    const payload: Partial<ProjectStatusItem> = {
      project_notes: serializedNotes,
      unified_status: primaryTask ? primaryTask.status : (tasksData.history.length > 0 ? 'Done' : 'In Progress'),
      status_color: primaryTask ? primaryTask.status_color : (tasksData.history.length > 0 ? '#10B981' : '#FF3366'),
      deadline: primaryTask ? primaryTask.deadline || null : null,
    };

    const ok = await handleUpdate(p.id, payload);
    if (ok) {
      showToast('success', 'Task removed');
    }
  };

  // Filter projects by status: active vs design completed
  const activeProjects = useMemo(() => {
    return safeProjects.filter(p => {
      const isDesignCompleted = (p.unified_status || '').toLowerCase().trim() === 'design completed';
      const isProjectClosed = (p.status || '').toLowerCase() === 'completed';
      // Completely exclude closed site projects from Daily Design Status
      if (isProjectClosed) return false;
      if (statusFilter === 'active') return !isDesignCompleted;
      if (statusFilter === 'completed') return isDesignCompleted;
      return true;
    });
  }, [safeProjects, statusFilter]);

  // Unique designers list for filter dropdown
  const designersList = useMemo(() => {
    const set = new Set<string>();
    activeProjects.forEach(p => {
      const name = getProjectDesignerName(p);
      if (name && name !== '(Unassigned)') set.add(name);
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
  const todayStr = useMemo(() => getTodayDateString(), []);

  // Quick actions: One-click rollover to today or mark done
  const handleRolloverToToday = async (p: ProjectStatusItem) => {
    const tasksData = parseProjectTasks(p.project_notes, p);
    if (tasksData.tasks.length > 0) {
      tasksData.tasks[0].deadline = todayStr;
      if (tasksData.tasks[0].status.toLowerCase() === 'done') {
        tasksData.tasks[0].status = 'In Progress';
        tasksData.tasks[0].status_color = '#FF3366';
      }
    }
    const ok = await handleUpdate(p.id, {
      deadline: todayStr,
      unified_status: p.unified_status === 'Done' ? 'In Progress' : (p.unified_status || 'In Progress'),
      status_color: p.status_color || '#FF3366',
      project_notes: serializeProjectTasks(tasksData),
    });
    if (ok) {
      showToast('success', `Moved "${p.title}" to Today's Tasks`);
    }
  };

  const handleQuickMarkDone = async (p: ProjectStatusItem) => {
    const tasksData = parseProjectTasks(p.project_notes, p);
    if (tasksData.tasks.length > 0) {
      while (tasksData.tasks.length > 0) {
        const t = tasksData.tasks.shift()!;
        t.status = 'Done';
        t.status_color = '#10B981';
        t.completed_at = new Date().toISOString();
        tasksData.history.unshift(t);
      }
    }
    const ok = await handleUpdate(p.id, {
      unified_status: 'Done',
      status_color: '#10B981',
      project_notes: serializeProjectTasks(tasksData),
    });
    if (ok) {
      showToast('success', `Marked "${p.title}" as Done`);
    }
  };

  const filteredProjects = useMemo(() => {
    return activeProjects.filter(p => {
      const q = searchQuery.toLowerCase();
      const code = (p.project_code || p.ref_no || '').replace('AI/PRJ/', 'AI/').replace('PRJ/', '').toLowerCase();
      const title = (p.title || '').toLowerCase();
      const client = (p.customer_name || '').toLowerCase();
      const designer = getProjectDesignerName(p).toLowerCase();

      const matchesSearch = !searchQuery || code.includes(q) || title.includes(q) || client.includes(q) || designer.includes(q);
      const dName = getProjectDesignerName(p);
      const matchesDesigner = selectedDesigner === 'all' || dName === selectedDesigner;
      const phase = formatPhaseDisplay(p.workflow_stage, p.status);
      const matchesPhase = selectedPhase === 'all' || phase.toLowerCase() === selectedPhase.toLowerCase();

      // Timeline filter (Overdue rollover vs Today vs Upcoming vs Done)
      if (timelineFilter !== 'all') {
        const info = getTaskTimelineInfo(p, todayStr);
        if (timelineFilter === 'overdue' && info.type !== 'overdue') return false;
        if (timelineFilter === 'today' && info.type !== 'today') return false;
        if (timelineFilter === 'upcoming' && info.type !== 'upcoming' && info.type !== 'no_date') return false;
        if (timelineFilter === 'completed' && info.type !== 'completed') return false;
      }

      return matchesSearch && matchesDesigner && matchesPhase;
    });
  }, [activeProjects, searchQuery, selectedDesigner, selectedPhase, timelineFilter, todayStr]);

  // Group filtered projects by Designer (matching CRM month-group pattern)
  const groupedProjects = useMemo(() => {
    const map = new Map<string, ProjectStatusItem[]>();
    filteredProjects.forEach(p => {
      const dName = getProjectDesignerName(p);
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
  const overdueCount = useMemo(() => {
    return activeProjects.filter(p => getTaskTimelineInfo(p, todayStr).type === 'overdue').length;
  }, [activeProjects, todayStr]);

  const todayCount = useMemo(() => {
    return activeProjects.filter(p => getTaskTimelineInfo(p, todayStr).type === 'today').length;
  }, [activeProjects, todayStr]);

  const upcomingCount = useMemo(() => {
    return activeProjects.filter(p => {
      const t = getTaskTimelineInfo(p, todayStr).type;
      return t === 'upcoming' || t === 'no_date';
    }).length;
  }, [activeProjects, todayStr]);

  const tasksDoneCount = useMemo(() => {
    return activeProjects.filter(p => (p.unified_status || '').toLowerCase().trim() === 'done').length;
  }, [activeProjects]);
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
    if (!canExport) {
      showToast('error', 'You do not have permission to export daily status reports');
      return;
    }
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
          const tData = parseProjectTasks(p.project_notes, p);
          const effectiveDl = tData.tasks[0]?.deadline !== undefined && tData.tasks[0]?.deadline !== null
            ? tData.tasks[0]?.deadline
            : (p.deadline || null);

          rows.push({
            'Project ID': code,
            'Project Name': p.title || '-',
            'Client': p.customer_name || '-',
            'Designer': group.designerName,
            'Phase': formatPhaseDisplay(p.workflow_stage, p.status),
            'Task Status': p.unified_status || 'Pending',
            'Start Date': p.start_date ? formatDateIST(p.start_date) : '-',
            'Target Date': effectiveDl ? formatDateIST(effectiveDl) : '-',
            'Notes': getReadableProjectNotes(p.project_notes, p)
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
    if (!canExport) {
      showToast('error', 'You do not have permission to export daily status reports');
      return;
    }
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
          const tData = parseProjectTasks(p.project_notes, p);
          const effectiveDl = tData.tasks[0]?.deadline !== undefined && tData.tasks[0]?.deadline !== null
            ? tData.tasks[0]?.deadline
            : (p.deadline || null);
          const targetDateStr = effectiveDl ? formatDateIST(effectiveDl) : '-';

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
            getReadableProjectNotes(p.project_notes, p)
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

  const renderProjectCard = (p: ProjectStatusItem) => {
    const rawCode = p.project_code || p.ref_no || `AI-${p.id.slice(0, 4)}`;
    const displayCode = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');
    const phase = formatPhaseDisplay(p.workflow_stage, p.status);
    const statusStyle = getStatusStyle(p.status_color, p.unified_status);
    const tasksData = parseProjectTasks(p.project_notes, p);
    const activeTasks = tasksData.tasks;
    const historyTasks = tasksData.history;
    const isHistoryOpen = Boolean(expandedHistories[p.id]);

    const primaryTask = activeTasks[0];
    const effectiveDeadline = primaryTask?.deadline !== undefined && primaryTask.deadline !== null ? primaryTask.deadline : (p.deadline || null);
    const effectiveStatus = primaryTask?.status || p.unified_status;

    const timelineInfo = getTaskTimelineInfo({
      ...p,
      deadline: effectiveDeadline,
      unified_status: effectiveStatus,
    }, todayStr);

    return (
      <div
        key={p.id}
        className={`compact-card bg-white rounded-xl p-2 sm:p-2.5 shadow-2xs hover:shadow-xs transition-all flex flex-col gap-1 sm:gap-1.5 ${
          timelineInfo.isOverdue
            ? 'border-2 border-rose-300 bg-rose-50/15'
            : timelineInfo.type === 'today'
            ? 'border-2 border-blue-300 bg-blue-50/15'
            : 'border border-gray-200 hover:border-gray-300'
        }`}
      >
        {/* Card Header: Project ID, Phase & Timeline Indicator */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              href={`/dashboard/projects/${p.id}`}
              className="no-touch-target min-w-0 font-mono font-bold text-blue-600 hover:underline text-xs flex items-center gap-0.5 shrink-0"
              title={`Open project ${displayCode}`}
            >
              <span>{displayCode}</span>
              <FiExternalLink className="w-2.5 h-2.5 text-gray-400 shrink-0" />
            </Link>

            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${
              phase === 'Designing' ? 'bg-amber-100 text-amber-800' :
              phase === 'Execution' ? 'bg-blue-100 text-blue-800' :
              phase === 'Handover' ? 'bg-purple-100 text-purple-800' :
              'bg-emerald-100 text-emerald-800'
            }`}>
              {phase}
            </span>
          </div>

          {/* Timeline Badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${timelineInfo.badgeClass}`}>
            {timelineInfo.isOverdue && <FiAlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />}
            {timelineInfo.type === 'today' && <FiClock className="w-2.5 h-2.5 text-blue-600 shrink-0" />}
            {timelineInfo.type === 'completed' && <FiCheck className="w-2.5 h-2.5 text-emerald-600 flex-shrink-0" />}
            <span>{timelineInfo.label}</span>
          </span>
        </div>

        {/* Project Title & Customer */}
        <div>
          <Link
            href={`/dashboard/projects/${p.id}`}
            className="no-touch-target min-w-0 font-bold text-gray-900 hover:text-blue-600 text-xs sm:text-sm line-clamp-1 block transition-colors leading-tight"
          >
            {p.title || 'Untitled Project'}
          </Link>
          <div className="text-[11px] text-gray-500 flex items-center gap-1 truncate leading-tight mt-0.5">
            <span>Client:</span>
            <span className="font-medium text-gray-700 truncate">{p.customer_name || '-'}</span>
            {p.phone_number && (
              <a
                href={`tel:${p.phone_number}`}
                className="no-touch-target min-w-0 w-4 h-4 inline-flex items-center justify-center text-gray-400 hover:text-yellow-600 hover:bg-gray-100 rounded ml-0.5 shrink-0 transition"
                title={p.phone_number}
              >
                <FiPhone className="w-2.5 h-2.5 shrink-0" />
              </a>
            )}
          </div>
        </div>

        {/* Multi-Task Section: Active Tasks List + Add Task Button */}
        <div className="space-y-1 pt-1 border-t border-gray-100 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-600 uppercase tracking-wider">
              <span>Active Tasks</span>
              <span className="px-1.5 py-0.2 bg-gray-100 text-gray-700 text-[10px] rounded-full font-bold">
                {activeTasks.length}
              </span>
            </span>
            <button
              type="button"
              onClick={() => openAddTaskModal(p)}
              className="no-touch-target min-w-0 px-2 py-0.5 bg-yellow-500 hover:bg-yellow-600 active:scale-95 text-gray-950 font-bold text-[10px] rounded shadow-2xs transition flex items-center gap-1 cursor-pointer shrink-0"
              title="Add another task to this project"
            >
              <FiPlus className="w-2.5 h-2.5 shrink-0" />
              <span>Add Task</span>
            </button>
          </div>

          {activeTasks.length > 0 ? (
            <div className="space-y-1">
              {activeTasks.map((t, idx) => {
                const taskTimeline = getTaskTimelineInfo({ ...p, deadline: t.deadline, unified_status: t.status }, todayStr);
                const taskStatusStyle = getStatusStyle(t.status_color, t.status);
                return (
                  <div
                    key={t.id || idx}
                    className="p-1 px-1.5 rounded-lg bg-gray-50/90 border border-gray-200/90 hover:bg-white hover:border-gray-300 transition-all text-xs flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span
                          style={taskStatusStyle}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 shadow-2xs"
                        >
                          {t.status}
                        </span>
                        <span className="font-semibold text-gray-900 truncate text-[11px]" title={t.title}>
                          {t.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openUpdateModal(p, t.id)}
                          className="no-touch-target min-w-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded cursor-pointer transition shrink-0"
                          title="Edit task"
                        >
                          <FiEdit2 className="w-2.5 h-2.5 shrink-0" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompleteSpecificTask(p, t.id)}
                          className="no-touch-target min-w-0 px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-bold text-[10px] flex items-center gap-0.5 cursor-pointer transition shrink-0"
                          title="Mark task done (archives to history)"
                        >
                          <FiCheck className="w-2.5 h-2.5 shrink-0" />
                          <span>Done</span>
                        </button>
                        {activeTasks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSpecificTask(p, t.id)}
                            className="no-touch-target min-w-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition shrink-0"
                            title="Delete task"
                          >
                            <FiTrash2 className="w-2.5 h-2.5 shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Task Target Date */}
                    <div className="flex items-center justify-between text-[10px] text-gray-500 leading-none">
                      <button
                        type="button"
                        onClick={() => openUpdateModal(p, t.id)}
                        className="no-touch-target min-w-0 flex items-center gap-1 hover:text-blue-600 cursor-pointer transition text-left"
                        title="Click to set or change target date"
                      >
                        <FiCalendar className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                        <span className={t.deadline ? 'font-medium text-gray-700' : 'text-gray-400 italic hover:underline'}>
                          {t.deadline ? formatDateIST(t.deadline) : 'No target date (click to set)'}
                        </span>
                      </button>
                      {taskTimeline.isOverdue && (
                        <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5 shrink-0">
                          <FiAlertTriangle className="w-2.5 h-2.5 shrink-0" />
                          Overdue
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/60 text-center">
              <p className="text-[11px] text-emerald-800 font-medium">All active tasks completed!</p>
              <button
                type="button"
                onClick={() => openAddTaskModal(p)}
                className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500 hover:bg-yellow-600 text-gray-950 font-bold text-[10px] rounded-md shadow-2xs cursor-pointer transition"
              >
                <FiPlus className="w-2.5 h-2.5 shrink-0" />
                <span>Add Next Task</span>
              </button>
            </div>
          )}

          {/* Collapsible Task History Section */}
          {historyTasks.length > 0 && (
            <div className="border-t border-gray-100 pt-1">
              <button
                type="button"
                onClick={() => toggleHistory(p.id)}
                className="no-touch-target min-w-0 w-full flex items-center justify-between py-0.5 text-[11px] text-gray-500 hover:text-gray-800 font-medium transition cursor-pointer"
              >
                <span className="flex items-center gap-1">
                  <FiCheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Task History ({historyTasks.length})</span>
                </span>
                {isHistoryOpen ? <FiChevronDown className="w-3 h-3 shrink-0" /> : <FiChevronRight className="w-3 h-3 shrink-0" />}
              </button>

              {isHistoryOpen && (
                <div className="mt-1 space-y-0.5 bg-gray-50/70 p-1.5 rounded-lg border border-gray-100 animate-in fade-in duration-150">
                  {historyTasks.map((h, hIdx) => (
                    <div key={h.id || hIdx} className="flex items-center justify-between text-[11px] py-0.5 border-b border-gray-200/50 last:border-none">
                      <div className="flex items-center gap-1 min-w-0">
                        <FiCheck className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                        <span className="line-through text-gray-500 truncate" title={h.title}>
                          {h.title}
                        </span>
                        {h.completed_at && (
                          <span className="text-[9px] text-gray-400 shrink-0">
                            ({formatDateIST(h.completed_at)})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={() => handleReopenSpecificTask(p, h.id)}
                          className="no-touch-target min-w-0 text-[9px] text-blue-600 hover:underline font-bold cursor-pointer"
                          title="Re-open this completed task"
                        >
                          Re-open
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSpecificTask(p, h.id, true)}
                          className="no-touch-target min-w-0 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-rose-500 rounded cursor-pointer shrink-0"
                          title="Delete from history"
                        >
                          <FiTrash2 className="w-2.5 h-2.5 shrink-0" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Footer: Interactive Status Pill Button + Quick Actions (Single Sleek Row, Identical Height) */}
        <div className="pt-1 border-t border-gray-100 flex items-center gap-1.5">
          {/* If the project is Design Completed or closed, show direct Re-open button */}
          {(p.unified_status?.toLowerCase().trim() === 'design completed' || p.status?.toLowerCase() === 'completed') ? (
            <button
              type="button"
              onClick={() => handleReopenDesign(p)}
              className="no-touch-target min-w-0 w-full h-8 px-2.5 bg-yellow-500 hover:bg-yellow-600 text-gray-950 font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
              title="Add this project back into the active daily design status sheet"
            >
              <FiRotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Re-open Design (Add Back)</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openUpdateModal(p, activeTasks[0]?.id)}
                className="no-touch-target min-w-0 flex-1 h-8 px-2.5 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center justify-between cursor-pointer border border-black/5 hover:opacity-90"
                style={{
                  backgroundColor: statusStyle.backgroundColor,
                  color: statusStyle.color,
                }}
              >
                <span className="truncate">{p.unified_status || 'Select Status'}</span>
                <FiChevronDown className="w-3.5 h-3.5 ml-1 shrink-0 opacity-80" />
              </button>

              {/* Quick Action for Today tasks - side by side */}
              {timelineInfo.type === 'today' && (p.unified_status || '').toLowerCase() !== 'done' && (
                <button
                  type="button"
                  onClick={() => handleQuickMarkDone(p)}
                  className="no-touch-target min-w-0 shrink-0 h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title="Mark completed today"
                >
                  <FiCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Done Today</span>
                </button>
              )}

              {/* Quick Actions for Overdue tasks - side by side */}
              {timelineInfo.isOverdue && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRolloverToToday(p)}
                    className="no-touch-target min-w-0 h-8 px-2.5 bg-yellow-500 hover:bg-yellow-600 text-gray-950 font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="Roll over to Today's Tasks"
                  >
                    <FiArrowRight className="w-3 h-3 shrink-0" />
                    <span>Roll</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickMarkDone(p)}
                    className="no-touch-target min-w-0 h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="Mark all tasks done"
                  >
                    <FiCheck className="w-3 h-3 shrink-0" />
                    <span>Done</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
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
            className="w-9 h-9 inline-flex items-center justify-center p-0 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-700 shadow-2xs transition-colors cursor-pointer shrink-0"
            title="Refresh Status"
          >
            <FiRefreshCw className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin text-yellow-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowReopenModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-yellow-50 text-gray-800 border border-gray-200 hover:border-yellow-400 font-bold rounded-lg text-xs shadow-2xs transition-all cursor-pointer"
            title="Add a completed project back into active design status"
          >
            <FiPlus className="w-3.5 h-3.5 text-yellow-600" />
            <span>Re-open Completed Project</span>
          </button>

          {canExport && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* KPI Cards Row (Role-tailored & Interactive: Click any card to filter) */}
      <div className={`grid gap-3 ${isManagement ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
        <button
          type="button"
          onClick={() => setTimelineFilter('all')}
          className={`p-3.5 bg-white border rounded-xl shadow-2xs text-left transition-all cursor-pointer ${
            timelineFilter === 'all' ? 'ring-2 ring-yellow-500 border-yellow-500' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
            {isManagement ? 'Active Projects' : 'My Active Projects'}
          </span>
          <span className="text-2xl font-black text-gray-900 mt-0.5 block">{totalActiveCount}</span>
        </button>

        {isManagement && (
          <div className="p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Active Designers</span>
            <span className="text-2xl font-black text-yellow-600 mt-0.5 block">{designersList.length}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setTimelineFilter('overdue')}
          className={`p-3.5 bg-white border rounded-xl shadow-2xs text-left transition-all cursor-pointer ${
            timelineFilter === 'overdue'
              ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/40'
              : overdueCount > 0
              ? 'border-rose-300 bg-rose-50/20 hover:border-rose-400'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
            <FiAlertTriangle className="w-3 h-3 text-rose-500 flex-shrink-0" />
            <span className="truncate">Carried Over</span>
          </span>
          <span className="text-2xl font-black text-rose-600 mt-0.5 block">{overdueCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setTimelineFilter('today')}
          className={`p-3.5 bg-white border rounded-xl shadow-2xs text-left transition-all cursor-pointer ${
            timelineFilter === 'today'
              ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/40'
              : todayCount > 0
              ? 'border-blue-300 bg-blue-50/20 hover:border-blue-400'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
            <FiClock className="w-3 h-3 text-blue-500 flex-shrink-0" />
            <span className="truncate">Today's Focus</span>
          </span>
          <span className="text-2xl font-black text-blue-600 mt-0.5 block">{todayCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setTimelineFilter('completed')}
          className={`p-3.5 bg-white border rounded-xl shadow-2xs text-left transition-all cursor-pointer ${
            timelineFilter === 'completed'
              ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/40'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <FiCheck className="w-3 h-3 text-emerald-500 flex-shrink-0" />
            <span className="truncate">Tasks Done</span>
          </span>
          <span className="text-2xl font-black text-emerald-600 mt-0.5 block">{tasksDoneCount}</span>
        </button>
      </div>

      {/* Task Timeline Segmented Tabs: Overdue Rollover vs Today vs Upcoming vs Done */}
      <div className="flex items-center gap-1.5 p-1 bg-gray-100/90 rounded-xl border border-gray-200 overflow-x-auto no-scrollbar scroll-smooth">
        <button
          type="button"
          onClick={() => setTimelineFilter('all')}
          className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            timelineFilter === 'all'
              ? 'bg-white text-gray-900 shadow-2xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
          }`}
        >
          <span>All Tasks</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
            timelineFilter === 'all' ? 'bg-gray-100 text-gray-800' : 'bg-gray-200 text-gray-600'
          }`}>
            {totalActiveCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTimelineFilter('overdue')}
          className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            timelineFilter === 'overdue'
              ? 'bg-rose-600 text-white shadow-xs'
              : overdueCount > 0
              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100/80 border border-rose-200/80'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
          }`}
        >
          <FiAlertTriangle className={`w-3.5 h-3.5 shrink-0 ${timelineFilter === 'overdue' ? 'text-white' : 'text-rose-600'}`} />
          <span>Carried Over / Overdue</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
            timelineFilter === 'overdue'
              ? 'bg-white/20 text-white'
              : overdueCount > 0
              ? 'bg-rose-200 text-rose-900'
              : 'bg-gray-200 text-gray-600'
          }`}>
            {overdueCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTimelineFilter('today')}
          className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            timelineFilter === 'today'
              ? 'bg-blue-600 text-white shadow-xs'
              : todayCount > 0
              ? 'bg-blue-50 text-blue-700 hover:bg-blue-100/80 border border-blue-200/80'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
          }`}
        >
          <FiClock className={`w-3.5 h-3.5 shrink-0 ${timelineFilter === 'today' ? 'text-white' : 'text-blue-600'}`} />
          <span>Today's Focus</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
            timelineFilter === 'today'
              ? 'bg-white/20 text-white'
              : todayCount > 0
              ? 'bg-blue-200 text-blue-900'
              : 'bg-gray-200 text-gray-600'
          }`}>
            {todayCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTimelineFilter('upcoming')}
          className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            timelineFilter === 'upcoming'
              ? 'bg-white text-gray-900 shadow-2xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
          }`}
        >
          <span>Upcoming / Queue</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
            timelineFilter === 'upcoming' ? 'bg-gray-100 text-gray-800' : 'bg-gray-200 text-gray-600'
          }`}>
            {upcomingCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTimelineFilter('completed')}
          className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            timelineFilter === 'completed'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
          }`}
        >
          <FiCheck className={`w-3.5 h-3.5 shrink-0 ${timelineFilter === 'completed' ? 'text-white' : 'text-emerald-600'}`} />
          <span>Completed</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
            timelineFilter === 'completed' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            {tasksDoneCount}
          </span>
        </button>
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
            <option value="completed">Design Completed</option>
            <option value="all">All (Active & Design Completed)</option>
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
              const isCollapsed = Boolean(collapsedDesigners[group.designerName]);

              // If individual designer, render the cards directly without redundant group headers
              if (!isManagement) {
                return (
                  <div key={group.designerName} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 items-start">
                    {group.items.map(renderProjectCard)}
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
                    <div className="p-2.5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 items-start">
                      {group.items.map(renderProjectCard)}
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
                        const tData = parseProjectTasks(p.project_notes, p);
                        const effectiveDeadline = tData.tasks[0]?.deadline !== undefined && tData.tasks[0]?.deadline !== null
                          ? tData.tasks[0]?.deadline
                          : (p.deadline || null);
                        const isTaskDone = (p.unified_status || '').toLowerCase().trim() === 'done';
                        const timelineInfo = getTaskTimelineInfo({ ...p, deadline: effectiveDeadline }, todayStr);

                        return (
                          <tr 
                            key={p.id}
                            className={`divide-x divide-gray-200 transition-colors ${
                              isTaskDone
                                ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                                : timelineInfo.isOverdue
                                ? 'bg-rose-50/30 hover:bg-rose-50/50'
                                : timelineInfo.type === 'today'
                                ? 'bg-blue-50/20 hover:bg-blue-50/40'
                                : 'hover:bg-gray-50/60'
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

                                    {/* If completed, show quick Re-open button */}
                                    {(p.unified_status?.toLowerCase().trim() === 'design completed' || p.status?.toLowerCase() === 'completed') && (
                                      <button
                                        type="button"
                                        onClick={() => handleReopenDesign(p)}
                                        className="mt-1 w-full py-0.5 px-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border border-yellow-300 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                                        title="Re-open Design (Moves back to active daily sheet)"
                                      >
                                        <FiRotateCcw className="w-2.5 h-2.5" />
                                        <span>Re-open</span>
                                      </button>
                                    )}

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

                            {/* Column H: Target Date Inline Picker + Rollover Quick-Action */}
                            <td 
                              className="py-1 px-1.5 align-middle"
                              style={{ width: columnWidths['deadline'] || 145 }}
                            >
                              <div className="space-y-1">
                                <input
                                  type="date"
                                  value={effectiveDeadline ? effectiveDeadline.split('T')[0] : ''}
                                  onChange={(e) => {
                                    const newVal = e.target.value || null;
                                    if (tData.tasks.length > 0) {
                                      tData.tasks[0].deadline = newVal;
                                      handleUpdate(p.id, {
                                        deadline: newVal,
                                        project_notes: serializeProjectTasks(tData),
                                      });
                                    } else {
                                      handleUpdate(p.id, { deadline: newVal });
                                    }
                                  }}
                                  title="Target date for this design milestone"
                                  className={`w-full px-1.5 py-1 bg-white border rounded text-xs focus:ring-1 focus:ring-yellow-500 focus:outline-none ${
                                    timelineInfo.isOverdue ? 'border-rose-300 text-rose-700 font-semibold bg-rose-50/30' : 'border-gray-200 text-gray-700'
                                  }`}
                                />
                                {timelineInfo.isOverdue && (
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-bold text-rose-600 truncate" title={timelineInfo.label}>
                                      {timelineInfo.daysDiff === 1 ? 'Yesterday' : `Overdue ${timelineInfo.daysDiff}d`}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleRolloverToToday(p)}
                                      className="px-1.5 py-0.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 rounded text-[10px] font-bold flex-shrink-0 cursor-pointer"
                                      title="Roll over target date to Today"
                                    >
                                      → Today
                                    </button>
                                  </div>
                                )}
                                {timelineInfo.type === 'today' && !isTaskDone && (
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5">
                                      <FiClock className="w-2.5 h-2.5" />
                                      Today
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickMarkDone(p)}
                                      className="px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded text-[10px] font-bold flex-shrink-0 cursor-pointer"
                                      title="Mark Done"
                                    >
                                      ✓ Done
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Column I: Notes / Tasks Cell */}
                            <td 
                              className="py-1 px-1.5 align-middle"
                              style={{ width: columnWidths['notes'] || 230 }}
                            >
                              {(() => {
                                const tData = parseProjectTasks(p.project_notes, p);
                                const isStructured = tData.tasks.length > 1 || tData.history.length > 0;
                                if (isStructured) {
                                  return (
                                    <div className="flex items-center justify-between gap-1 w-full">
                                      <button
                                        type="button"
                                        onClick={() => openUpdateModal(p, tData.tasks[0]?.id)}
                                        className="text-left text-xs text-gray-800 hover:text-blue-600 truncate flex-1 flex items-center gap-1 cursor-pointer"
                                        title={getReadableProjectNotes(p.project_notes, p)}
                                      >
                                        <span className="px-1.5 py-0.2 bg-yellow-100 text-yellow-900 font-bold rounded text-[10px] shrink-0">
                                          {tData.tasks.length} tasks
                                        </span>
                                        <span className="truncate">{tData.tasks[0]?.title || 'Tasks'}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openAddTaskModal(p)}
                                        className="p-1 text-gray-400 hover:text-yellow-700 hover:bg-yellow-50 rounded shrink-0 cursor-pointer"
                                        title="Add another task"
                                      >
                                        <FiPlus className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                }
                                return (
                                  <div className="flex items-center gap-1 w-full">
                                    <input
                                      type="text"
                                      defaultValue={tData.tasks[0]?.title || p.project_notes || ''}
                                      onBlur={(e) => {
                                        const val = e.target.value.trim();
                                        if (val !== (tData.tasks[0]?.title || '')) {
                                          if (tData.tasks.length > 0) {
                                            tData.tasks[0].title = val;
                                            handleUpdate(p.id, { project_notes: serializeProjectTasks(tData) });
                                          } else {
                                            handleUpdate(p.id, { project_notes: val });
                                          }
                                        }
                                      }}
                                      placeholder="Add daily notes..."
                                      title={tData.tasks[0]?.title || p.project_notes || 'Add daily notes...'}
                                      className="w-full px-2 py-1 bg-gray-50/60 hover:bg-white focus:bg-white border border-transparent hover:border-gray-200 focus:border-yellow-400 rounded text-xs text-gray-800 placeholder-gray-400 focus:outline-none transition-all"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => openAddTaskModal(p)}
                                      className="p-1 text-gray-400 hover:text-yellow-700 hover:bg-yellow-50 rounded shrink-0 cursor-pointer"
                                      title="Add another task"
                                    >
                                      <FiPlus className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })()}
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

      {/* Quick Status Modal */}
      <StatusUpdaterModal
        project={activeBottomSheetProject}
        initialMode={modalInitialMode}
        taskId={modalTaskId}
        onClose={() => {
          setActiveBottomSheetProject(null);
          setModalTaskId(null);
        }}
        onSave={handleSaveStatusModal}
        isSaving={savingId === activeBottomSheetProject?.id}
      />

      {/* Re-open Completed Project Modal */}
      <ReopenProjectModal
        isOpen={showReopenModal}
        onClose={() => setShowReopenModal(false)}
        onReopen={handleReopenDesign}
        todayStr={todayStr}
      />
    </div>
  );
}
