import { formatDateIST } from './dateUtils';

export interface DailyTaskItem {
  id: string;
  title: string;
  status: string;
  status_color?: string;
  deadline?: string | null;
  created_at: string;
  completed_at?: string | null;
  assigned_designer?: string | null;
  updated_at?: string | null;
}

export interface ProjectTasksData {
  tasks: DailyTaskItem[];
  history: DailyTaskItem[];
}

export const STATUS_PALETTE = [
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

export const PREPOPULATED_STATUSES = [
  { name: 'To Do', color: '#64748B', desc: 'Queued' },
  { name: 'In Progress', color: '#FF3366', desc: 'In progress' },
  { name: 'Under Review', color: '#8B5CF6', desc: 'Under review' },
  { name: 'Done', color: '#10B981', desc: 'Milestone done' },
  { name: 'Design Completed', color: '#0D9488', desc: 'All designs finished' },
];

export const getStatusStyle = (colorHex?: string | null, statusText?: string | null) => {
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

export function parseProjectTasks(notes: string | null | undefined, project?: any): ProjectTasksData {
  if (notes && typeof notes === 'string' && (notes.trim().startsWith('{') || notes.trim().startsWith('['))) {
    try {
      const parsed = JSON.parse(notes.trim());
      if (parsed && Array.isArray(parsed.tasks)) {
        return {
          tasks: parsed.tasks.map((t: any) => ({
            ...t,
            deadline: t.deadline !== undefined && t.deadline !== null ? t.deadline : (project?.deadline || null),
          })),
          history: Array.isArray(parsed.history) ? parsed.history : []
        };
      }
      if (Array.isArray(parsed)) {
        return {
          tasks: parsed.map((t: any) => ({
            ...t,
            deadline: t.deadline !== undefined && t.deadline !== null ? t.deadline : (project?.deadline || null),
          })),
          history: []
        };
      }
    } catch (_) {}
  }

  const title = (notes || '').trim();
  if (!title && !project?.deadline && !project?.unified_status) {
    return { tasks: [], history: [] };
  }

  return {
    tasks: [{
      id: `task-${project?.id || 'init'}-init`,
      title: title || project?.unified_status || 'Design Task',
      status: project?.unified_status || 'In Progress',
      status_color: project?.status_color || project?.special_requirements || '#FF3366',
      deadline: project?.deadline || null,
      created_at: project?.created_at || new Date().toISOString()
    }],
    history: []
  };
}

export function serializeProjectTasks(data: ProjectTasksData): string {
  return JSON.stringify(data);
}

export function getReadableProjectNotes(notes: string | null | undefined, project?: any): string {
  const data = parseProjectTasks(notes, project);
  if (data.tasks.length === 0 && data.history.length === 0) {
    return notes || '-';
  }
  const lines: string[] = [];
  data.tasks.forEach((t, i) => {
    const dueStr = t.deadline ? ` (Due: ${formatDateIST(t.deadline)})` : '';
    lines.push(`${i + 1}. [${t.status}] ${t.title}${dueStr}`);
  });
  if (data.history.length > 0) {
    lines.push(`-- Task History (${data.history.length}) --`);
    data.history.slice(0, 3).forEach(h => {
      lines.push(`✓ [${h.status || 'Done'}] ${h.title}`);
    });
  }
  return lines.join('\n');
}

export function addTaskToProject(
  tasksData: ProjectTasksData,
  newTask: {
    title: string;
    status: string;
    status_color?: string;
    deadline?: string | null;
    id?: string;
  }
): ProjectTasksData {
  const item: DailyTaskItem = {
    id: newTask.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: newTask.title || 'Design Task',
    status: newTask.status || 'In Progress',
    status_color: newTask.status_color || '#FF3366',
    deadline: newTask.deadline || null,
    created_at: new Date().toISOString(),
  };

  return {
    ...tasksData,
    tasks: [item, ...tasksData.tasks]
  };
}

export function updateTaskInProject(
  tasksData: ProjectTasksData,
  taskId: string | null | undefined,
  updates: {
    title?: string;
    status: string;
    status_color?: string;
    deadline?: string | null;
  }
): ProjectTasksData {
  const tasks = [...tasksData.tasks];
  const history = [...tasksData.history];

  let idx = taskId ? tasks.findIndex(t => t.id === taskId) : 0;
  if (idx === -1 && tasks.length > 0) idx = 0;

  if (idx === -1 || tasks.length === 0) {
    return addTaskToProject(tasksData, updates as any);
  }

  const currentTask = tasks[idx];

  // If marked Done, archive to history!
  if (updates.status.toLowerCase() === 'done') {
    const [doneTask] = tasks.splice(idx, 1);
    doneTask.status = 'Done';
    doneTask.status_color = '#10B981';
    doneTask.completed_at = new Date().toISOString();
    if (updates.title) doneTask.title = updates.title;
    history.unshift(doneTask);
    return { tasks, history };
  }

  // If the title changed to a new task description, keep the old task in history so it's NEVER lost!
  const oldTitle = (currentTask.title || '').trim().toLowerCase();
  const newTitle = (updates.title || '').trim().toLowerCase();
  if (oldTitle && newTitle && oldTitle !== newTitle) {
    const archivedOldTask: DailyTaskItem = {
      ...currentTask,
      completed_at: new Date().toISOString()
    };
    history.unshift(archivedOldTask);

    tasks[idx] = {
      ...currentTask,
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: updates.title || currentTask.title,
      status: updates.status,
      status_color: updates.status_color || currentTask.status_color,
      deadline: updates.deadline !== undefined ? updates.deadline : currentTask.deadline,
      created_at: new Date().toISOString(),
    };
    return { tasks, history };
  }

  // Same task title update (e.g. status or target date update)
  tasks[idx] = {
    ...currentTask,
    title: updates.title !== undefined ? updates.title : currentTask.title,
    status: updates.status,
    status_color: updates.status_color || currentTask.status_color,
    deadline: updates.deadline !== undefined ? updates.deadline : currentTask.deadline,
    updated_at: new Date().toISOString(),
  };

  return { tasks, history };
}
