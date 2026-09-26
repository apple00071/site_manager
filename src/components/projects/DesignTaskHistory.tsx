'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiClock,
  FiCheckCircle,
  FiCheck,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiRotateCcw,
  FiCalendar,
  FiAlertTriangle,
  FiUser,
  FiX,
  FiLayers
} from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import { formatDateIST, getTodayDateString } from '@/lib/dateUtils';
import {
  DailyTaskItem,
  ProjectTasksData,
  parseProjectTasks,
  serializeProjectTasks,
  getStatusStyle,
  PREPOPULATED_STATUSES,
  STATUS_PALETTE,
  addTaskToProject,
  updateTaskInProject
} from '@/lib/designTaskUtils';

interface DesignTaskHistoryProps {
  projectId: string;
  project?: any;
  onProjectUpdated?: () => void;
}

export function DesignTaskHistory({
  projectId,
  project: initialProject,
  onProjectUpdated,
}: DesignTaskHistoryProps) {
  const { showToast } = useToast();
  const [project, setProject] = useState<any>(initialProject || null);
  const [loading, setLoading] = useState(!initialProject);
  const [isSaving, setIsSaving] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DailyTaskItem | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskStatus, setTaskStatus] = useState('In Progress');
  const [taskColor, setTaskColor] = useState('#FF3366');
  const [taskDeadline, setTaskDeadline] = useState(getTodayDateString());

  const todayStr = useMemo(() => getTodayDateString(), []);

  // Fetch fresh project details
  const fetchProjectData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/projects?id=${projectId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load project');
      const data = await res.json();
      const p = Array.isArray(data) ? data[0] : data;
      setProject(p);
    } catch (err: any) {
      console.error('Error loading project for task history:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!initialProject) {
      fetchProjectData();
    } else {
      setProject(initialProject);
    }
  }, [initialProject, fetchProjectData]);

  // Parse tasks
  const tasksData = useMemo<ProjectTasksData>(() => {
    return parseProjectTasks(project?.project_notes, project);
  }, [project]);

  // Save changes to database
  const saveTasksData = async (
    newTasksData: ProjectTasksData,
    successMsg: string
  ) => {
    setIsSaving(true);
    const serialized = serializeProjectTasks(newTasksData);
    const primaryTask = newTasksData.tasks[0];

    const payload: Record<string, any> = {
      projectId,
      project_notes: serialized,
    };

    if (primaryTask) {
      payload.unified_status = primaryTask.status;
      payload.status_color = primaryTask.status_color;
      payload.deadline = primaryTask.deadline || null;
    } else if (newTasksData.history.length > 0) {
      payload.unified_status = 'Done';
      payload.status_color = '#10B981';
      payload.deadline = null;
    }

    try {
      const res = await fetch('/api/daily-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to update design tasks');
      }

      // Optimistic update
      setProject((prev: any) => ({
        ...prev,
        project_notes: serialized,
        unified_status: payload.unified_status !== undefined ? payload.unified_status : prev?.unified_status,
        special_requirements: payload.status_color !== undefined ? payload.status_color : prev?.special_requirements,
        deadline: payload.deadline !== undefined ? payload.deadline : prev?.deadline,
      }));

      showToast('success', successMsg);
      onProjectUpdated?.();
    } catch (err: any) {
      showToast('error', err.message || 'Error saving tasks');
      fetchProjectData();
    } finally {
      setIsSaving(false);
    }
  };

  // Open modal to add new task
  const handleOpenAddModal = () => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskStatus('In Progress');
    setTaskColor('#FF3366');
    setTaskDeadline(getTodayDateString());
    setIsModalOpen(true);
  };

  // Open modal to edit existing task
  const handleOpenEditModal = (t: DailyTaskItem) => {
    setEditingTask(t);
    setTaskTitle(t.title);
    setTaskStatus(t.status);
    setTaskColor(t.status_color || '#FF3366');
    setTaskDeadline(t.deadline ? t.deadline.split('T')[0] : '');
    setIsModalOpen(true);
  };

  // Submit Modal
  const handleSaveModal = async () => {
    if (!taskTitle.trim()) {
      showToast('error', 'Please enter a task description');
      return;
    }

    if (editingTask) {
      // Update existing task (if title changed, old task is preserved in history)
      const updated = updateTaskInProject(tasksData, editingTask.id, {
        title: taskTitle.trim(),
        status: taskStatus,
        status_color: taskColor,
        deadline: taskDeadline || null,
      });
      setIsModalOpen(false);
      await saveTasksData(updated, `Updated task "${taskTitle.trim()}"`);
    } else {
      // Add brand new task
      const updated = addTaskToProject(tasksData, {
        title: taskTitle.trim(),
        status: taskStatus,
        status_color: taskColor,
        deadline: taskDeadline || null,
      });
      setIsModalOpen(false);
      await saveTasksData(updated, `Added task "${taskTitle.trim()}"`);
    }
  };

  // Complete specific active task
  const handleCompleteTask = async (taskId: string) => {
    const updated = updateTaskInProject(tasksData, taskId, {
      status: 'Done',
      status_color: '#10B981',
    });
    await saveTasksData(updated, 'Task completed and moved to history');
  };

  // Re-open completed task from history
  const handleReopenTask = async (historyId: string) => {
    const history = [...tasksData.history];
    const tasks = [...tasksData.tasks];
    const idx = history.findIndex(h => h.id === historyId);
    if (idx === -1) return;

    const [item] = history.splice(idx, 1);
    item.status = 'In Progress';
    item.status_color = '#FF3366';
    item.deadline = todayStr;
    delete item.completed_at;
    tasks.unshift(item);

    await saveTasksData({ tasks, history }, `Re-opened "${item.title}"`);
  };

  // Delete task
  const handleDeleteTask = async (taskId: string, isHistory = false) => {
    let tasks = [...tasksData.tasks];
    let history = [...tasksData.history];

    if (isHistory) {
      history = history.filter(h => h.id !== taskId);
    } else {
      tasks = tasks.filter(t => t.id !== taskId);
    }

    await saveTasksData({ tasks, history }, 'Task removed');
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-600" />
      </div>
    );
  }

  const designerName = project?.designer?.full_name || project?.designer?.username || project?.assigned_employee?.name || '(Unassigned)';
  const currentStatusStyle = getStatusStyle(project?.special_requirements, project?.unified_status);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Overview Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">
              {(project?.project_code || project?.ref_no || '').replace('AI/PRJ/', 'AI/').replace('PRJ/', '') || 'Project'}
            </span>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              {project?.title || 'Design Task Tracker'}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
            <span className="flex items-center gap-1 font-medium text-gray-700">
              <FiUser className="w-3.5 h-3.5 text-gray-400" />
              Designer: {designerName}
            </span>
            {project?.customer_name && (
              <span>· Client: {project.customer_name}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-semibold">Status:</span>
            <span
              style={currentStatusStyle}
              className="px-2.5 py-1 rounded-md text-xs font-bold shadow-2xs"
            >
              {project?.unified_status || 'In Progress'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-3.5 py-2 bg-yellow-500 hover:bg-yellow-600 active:scale-95 text-gray-950 font-bold text-xs rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FiPlus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Active Tasks Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <FiLayers className="w-4 h-4 text-yellow-600" />
            <span>Active Design Tasks</span>
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">
              {tasksData.tasks.length}
            </span>
          </h3>
        </div>

        {tasksData.tasks.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-200 rounded-xl space-y-2">
            <FiCheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-gray-700">No active design tasks pending!</p>
            <p className="text-xs text-gray-400">All tasks have been finished or completed.</p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-gray-950 font-bold text-xs rounded-lg shadow-2xs cursor-pointer"
            >
              <FiPlus className="w-3.5 h-3.5" />
              <span>Add New Task</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tasksData.tasks.map((task, idx) => {
              const taskStyle = getStatusStyle(task.status_color, task.status);
              const isOverdue = task.deadline && task.deadline.split('T')[0] < todayStr;
              const isToday = task.deadline && task.deadline.split('T')[0] === todayStr;

              return (
                <div
                  key={task.id || idx}
                  className={`bg-white border rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-3 ${
                    isOverdue ? 'border-rose-300 bg-rose-50/15' : isToday ? 'border-blue-300 bg-blue-50/15' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          style={taskStyle}
                          className="px-2 py-0.5 rounded text-[11px] font-bold shadow-2xs"
                        >
                          {task.status}
                        </span>
                        {isOverdue && (
                          <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[10px] font-bold rounded flex items-center gap-0.5">
                            <FiAlertTriangle className="w-2.5 h-2.5" /> Overdue
                          </span>
                        )}
                        {isToday && (
                          <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] font-bold rounded flex items-center gap-0.5">
                            <FiClock className="w-2.5 h-2.5" /> Today
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-gray-900 leading-snug break-words">
                        {task.title}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(task)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer"
                        title="Edit task"
                      >
                        <FiEdit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Delete task"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1 font-medium">
                      <FiCalendar className="w-3 h-3 text-gray-400" />
                      Target: {task.deadline ? formatDateIST(task.deadline) : 'No date'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCompleteTask(task.id)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-md flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    >
                      <FiCheck className="w-3 h-3 text-emerald-600" />
                      <span>Mark Done</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task History Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <FiClock className="w-4 h-4 text-emerald-600" />
            <span>Design Task History & Audit Trail</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">
              {tasksData.history.length}
            </span>
          </h3>
        </div>

        {tasksData.history.length === 0 ? (
          <div className="p-6 text-center bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-400 italic">
            No completed tasks archived in history yet. When tasks are completed or updated, they will appear here.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs divide-y divide-gray-100">
            {tasksData.history.map((h, idx) => (
              <div
                key={h.id || idx}
                className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <FiCheck className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 break-words">
                      {h.title}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                      <span>Status: {h.status || 'Done'}</span>
                      {h.completed_at && (
                        <span>· Completed on {formatDateIST(h.completed_at)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleReopenTask(h.id)}
                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded transition flex items-center gap-1 cursor-pointer"
                    title="Re-open this task as active"
                  >
                    <FiRotateCcw className="w-3 h-3" />
                    <span className="hidden sm:inline">Re-open</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(h.id, true)}
                    className="p-1 text-gray-400 hover:text-rose-600 rounded cursor-pointer"
                    title="Delete from history"
                  >
                    <FiTrash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Task Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900">
                {editingTask ? 'Edit Design Task' : 'Add Design Task'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-200"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Task Description / Scope *
                </label>
                <textarea
                  rows={2}
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Master bedroom 3D views, kitchen elevations..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white resize-none"
                />
              </div>

              {/* Status Picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Design Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PREPOPULATED_STATUSES.map((opt) => {
                    const isSelected = taskStatus.toLowerCase() === opt.name.toLowerCase();
                    const isFull = opt.name === 'Design Completed';
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => {
                          setTaskStatus(opt.name);
                          setTaskColor(opt.color);
                        }}
                        className={`${isFull ? 'col-span-2' : 'col-span-1'} p-2 rounded-lg border text-left flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'border-yellow-500 bg-yellow-50/70 ring-1 ring-yellow-400'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: opt.color }}
                          />
                          <span className="text-xs font-bold text-gray-800 truncate">{opt.name}</span>
                        </div>
                        {isSelected && <FiCheck className="w-3.5 h-3.5 text-yellow-600" />}
                      </button>
                    );
                  })}
                </div>

                {/* Color Palette */}
                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto py-1">
                  {STATUS_PALETTE.map((col) => (
                    <button
                      key={col.hex}
                      type="button"
                      onClick={() => setTaskColor(col.hex)}
                      className={`w-5 h-5 rounded-full shrink-0 border border-black/15 transition-transform ${
                        taskColor === col.hex ? 'scale-125 ring-2 ring-yellow-500' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: col.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Target Date */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Target Completion Date
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  />
                  <button
                    type="button"
                    onClick={() => setTaskDeadline(getTodayDateString())}
                    className="px-2.5 py-2 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      setTaskDeadline(d.toISOString().split('T')[0]);
                    }}
                    className="px-2.5 py-2 bg-gray-100 text-gray-700 font-semibold text-xs rounded-lg cursor-pointer"
                  >
                    Tomorrow
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                disabled={isSaving}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-950 font-bold text-xs rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <FiCheck className="w-3.5 h-3.5" />
                <span>{editingTask ? 'Save Changes' : 'Add Task'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
