'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/styles/calendar-custom.css';
import { FiCheck, FiFilter, FiPlus, FiUser, FiAlertTriangle, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

type CalendarViewType = 'month' | 'week' | 'work_week' | 'day' | 'agenda';

type CalendarTask = {
  id: string;
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string | null;
  project_id?: string | null;
};

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

function isOverdue(t: CalendarTask) {
  return t.status !== 'done' && new Date(t.end_at).getTime() < Date.now();
}

function extractRange(range: any): { start: Date; end: Date } | null {
  if (!range) return null;
  if (Array.isArray(range)) {
    if (range.length === 0) return null;
    const start = new Date(range[0]);
    const end = new Date(range[range.length - 1]);
    return { start, end };
  }
  if ((range as any).start && (range as any).end) {
    return { start: new Date((range as any).start), end: new Date((range as any).end) };
  }
  if (range instanceof Date) {
    return { start: range, end: range };
  }
  return null;
}

export default function TasksPage() {
  const { user } = useAuth();
  const [view, setView] = useState<CalendarViewType>('month');
  const [date, setDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<{ id: string; name: string }[]>([]);

  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'todo' | 'in_progress' | 'blocked' | 'done'>('all');
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date } | null>(null);

  useEffect(() => {
    // Persist filters across navigation
    const saved = localStorage.getItem('tasks_filters');
    if (saved) {
      const obj = JSON.parse(saved);
      setFilterAssignee(obj.assignee ?? 'all');
      setFilterStatus(obj.status ?? 'all');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tasks_filters', JSON.stringify({ assignee: filterAssignee, status: filterStatus }));
  }, [filterAssignee, filterStatus]);

  const fetchAssignees = async () => {
    try {
      // Try to fetch minimal user list; fall back to current user
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase.from('users').select('id, full_name').limit(50);
      if (!error && Array.isArray(data)) {
        setAssignees(data.map(u => ({ id: u.id as string, name: (u as any).full_name || 'User' })));
      } else if (user) {
        setAssignees([{ id: user.id, name: (user as any).full_name || user.email?.split('@')[0] || 'Me' }]);
      }
    } catch {
      if (user) setAssignees([{ id: user.id, name: (user as any).full_name || 'Me' }]);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const rangeStart = new Date(date);
      rangeStart.setDate(1);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(rangeStart);
      rangeEnd.setMonth(rangeEnd.getMonth() + 1);
      rangeEnd.setDate(0);
      rangeEnd.setHours(23, 59, 59, 999);

      console.log('Fetching tasks for range:', rangeStart.toISOString(), 'to', rangeEnd.toISOString());

      const params = new URLSearchParams();
      params.set('start', rangeStart.toISOString());
      params.set('end', rangeEnd.toISOString());
      if (filterAssignee && filterAssignee !== 'all') params.set('assigned_to', filterAssignee);

      const res = await fetch(`/api/calendar-tasks?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const json = await res.json();
      console.log('Fetched tasks:', json.tasks);
      setTasks((json.tasks || []) as CalendarTask[]);
    } catch (e: any) {
      setError(e.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignees();
  }, []);

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, filterAssignee]);

  const events = useMemo(() => {
    const base = tasks.filter(t => (filterStatus === 'all' ? true : t.status === filterStatus));
    const mapped = base.map(t => {
      const start = new Date(t.start_at);
      const endCandidate = new Date(t.end_at);
      const invalid = Number.isNaN(start.getTime()) || Number.isNaN(endCandidate.getTime());
      const end = invalid || endCandidate.getTime() <= start.getTime()
        ? new Date(start.getTime() + 60 * 60 * 1000)
        : endCandidate;
      return {
        id: t.id,
        title: t.title,
        start,
        end,
        resource: t,
        allDay: false,
      };
    }).filter(e => !Number.isNaN((e.start as Date).getTime()) && !Number.isNaN((e.end as Date).getTime()));
    console.log('Processed events for calendar:', mapped);
    return mapped;
  }, [tasks, filterStatus]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, number>();
    events.forEach(e => {
      const key = format(e.start as Date, 'yyyy-MM-dd');
      m.set(key, (m.get(key) || 0) + 1);
    });
    return m;
  }, [events]);

  const maxEventsPerDay = useMemo(() => {
    let max = 0;
    eventsByDay.forEach((count) => { if (count > max) max = count; });
    return max;
  }, [eventsByDay]);

  const hasVisibleEvents = useMemo(() => {
    if (!visibleRange) {
      return events.length > 0;
    }
    const { start, end } = visibleRange;
    return events.some((ev) => {
      const evStart = ev.start as Date;
      const evEnd = ev.end as Date;
      return evEnd >= start && evStart <= end;
    });
  }, [events, visibleRange]);

  const calendarMinHeight = useMemo(() => {
    if (view === 'week' || view === 'work_week' || view === 'day') {
      if (!hasVisibleEvents) {
        return 80;
      }
      return 220;
    }

    const base = 320;
    const perEvent = 24;
    const computed = base + Math.min(maxEventsPerDay, 8) * perEvent;
    return Math.max(300, Math.min(700, computed));
  }, [maxEventsPerDay, view, hasVisibleEvents]);

  const EventComp = ({ event }: any) => {
    const task: CalendarTask = event.resource;
    const overdue = isOverdue(task);
    const highPriority = task.priority === 'high' || task.priority === 'urgent';
    console.log('Rendering event:', event.title, task);
    const start = event.start as Date;
    const end = event.end as Date;
    const timeRange = `${formatISTTime(start)} - ${formatISTTime(end)}`;
    const tooltipParts: string[] = [timeRange];
    if (task.priority) {
      tooltipParts.push(`Priority: ${task.priority}`);
    }
    tooltipParts.push(`Status: ${task.status}`);
    const tooltip = tooltipParts.join(' • ');
    return (
      <div
        className={`flex items-center gap-1 ${overdue ? 'text-red-700' : highPriority ? 'text-yellow-700' : 'text-gray-900'}`}
        title={tooltip}
      >
        {task.status === 'done' && <FiCheck className="h-3 w-3 text-green-600" />}
        {overdue && <FiAlertTriangle className="h-3 w-3 text-red-600" />}
        <span className="truncate">{event.title}</span>
      </div>
    );
  };

  const minTime = useMemo(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  }, []);

  const maxTime = useMemo(() => {
    const d = new Date();
    d.setHours(19, 0, 0, 0);
    return d;
  }, []);

  const TasksToolbar: React.FC<any> = (toolbar: any) => {
    const goToBack = () => toolbar.onNavigate('PREV');
    const goToNext = () => toolbar.onNavigate('NEXT');

    const viewButtons: { key: CalendarViewType; label: string; hideOnMobile?: boolean }[] = [
      { key: 'month', label: 'Month' },
      { key: 'week', label: 'Week', hideOnMobile: true },
      { key: 'day', label: 'Day' },
      { key: 'agenda', label: 'Agenda' },
    ];

    return (
      <div className="flex flex-col gap-2 px-3 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={goToBack}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700"
            aria-label="Previous period"
          >
            <FiChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => toolbar.onNavigate('TODAY')}
            className="flex-1 px-3 text-center text-sm font-medium text-gray-900 truncate bg-transparent"
            aria-label="Go to today"
          >
            {toolbar.label}
          </button>
          <button
            type="button"
            onClick={goToNext}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700"
            aria-label="Next period"
          >
            <FiChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pt-1 text-xs sm:text-sm">
          {viewButtons.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => toolbar.onView(v.key)}
              className={`px-2 py-1 rounded-full border text-xs sm:text-sm whitespace-nowrap ${
                toolbar.view === v.key
                  ? 'bg-yellow-500 text-gray-900 border-yellow-500'
                  : 'bg-white text-gray-700 border-gray-300'
              }${v.hideOnMobile ? ' hidden sm:inline-flex' : ''}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    project_id: '' as string,
    start_date_picker: '',
    start_hour: '10',
    start_minute: '00',
    start_ampm: 'AM',
    end_hour: '11',
    end_minute: '00',
    end_ampm: 'AM',
    end_date_picker: '',
    assigned_to: '' as string,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
  });

  const [editingTask, setEditingTask] = useState<CalendarTask | null>(null);
  const isEditing = !!editingTask;

  const [viewTask, setViewTask] = useState<CalendarTask | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  const titleSuggestions = [
    'Site Visit',
    'Client Meeting',
    'Material Delivery',
    'Electrical Fitting',
    'Carpentry Work',
    'Painting',
    'Granite Installation',
    'Glass Fitting',
    'Final Cleanup',
  ];

  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);

  const timeOptions = useMemo(() => {
    const options: string[] = [];
    const periods: Array<'AM' | 'PM'> = ['AM', 'PM'];
    for (let hour = 1; hour <= 12; hour += 1) {
      for (let minute = 0; minute < 60; minute += 15) {
        const hh = hour.toString().padStart(2, '0');
        const mm = minute.toString().padStart(2, '0');
        periods.forEach((ampm) => {
          options.push(`${hh}:${mm} ${ampm}`);
        });
      }
    }
    return options;
  }, []);

  function formatISTDate(d: Date) {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata' }).format(d);
  }
  function formatISTTime(d: Date) {
    return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(d);
  }
  function parseISTToISO(dateStr: string, timeStr: string) {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [dd, mm, yyyy] = parts.map(p => parseInt(p, 10));
    if (!dd || !mm || !yyyy) return null;
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const ms = Date.UTC(yyyy, mm - 1, dd, hour, minute);
    const offsetMs = 5.5 * 60 * 60 * 1000; // IST offset
    return new Date(ms - offsetMs).toISOString();
  }

  function partsToTimeString(h: string, m: string, ap: string) {
    const hh = h.padStart(2, '0');
    const mm = m.padStart(2, '0');
    return `${hh}:${mm} ${ap}`;
  }

  function toDDMMYYYYFromPicker(yyyyMmDd: string) {
    const [y, m, d] = yyyyMmDd.split('-');
    if (!y || !m || !d) return '';
    return `${d}/${m}/${y}`;
  }

  const openCreateAt = (dateArg: Date) => {
    const start = new Date(dateArg);
    const end = new Date(dateArg);
    end.setHours(end.getHours() + 1);

    const startHour = format(start, 'hh');
    const startMinute = format(start, 'mm');
    const startAmPm = format(start, 'a');

    const endHour = format(end, 'hh');
    const endMinute = format(end, 'mm');
    const endAmPm = format(end, 'a');

    setForm(prev => ({
      ...prev,
      start_date_picker: format(start, 'yyyy-MM-dd'),
      start_hour: startHour,
      start_minute: startMinute,
      start_ampm: startAmPm,
      end_hour: endHour,
      end_minute: endMinute,
      end_ampm: endAmPm,
      end_date_picker: format(end, 'yyyy-MM-dd'),
    }));
    setEditingTask(null);
    setModalOpen(true);
  };

  const openViewTask = (task: CalendarTask) => {
    setViewTask(task);
    setViewModalOpen(true);
  };

  const openEditTask = (task: CalendarTask) => {
    const start = new Date(task.start_at);
    const end = new Date(task.end_at);

    setForm({
      title: task.title || '',
      description: task.description || '',
      project_id: task.project_id || '',
      start_date_picker: format(start, 'yyyy-MM-dd'),
      start_hour: format(start, 'hh'),
      start_minute: format(start, 'mm'),
      start_ampm: format(start, 'a'),
      end_hour: format(end, 'hh'),
      end_minute: format(end, 'mm'),
      end_ampm: format(end, 'a'),
      end_date_picker: format(end, 'yyyy-MM-dd'),
      assigned_to: task.assigned_to || '',
      priority: task.priority || 'medium',
    });
    setEditingTask(task);
    setViewModalOpen(false);
    setModalOpen(true);
  };

  const saveTask = async () => {
    try {
      const dateForCalc = toDDMMYYYYFromPicker(form.start_date_picker);
      const startTimeForCalc = partsToTimeString(form.start_hour, form.start_minute, form.start_ampm);
      const endDateForCalc = toDDMMYYYYFromPicker(form.end_date_picker) || dateForCalc;
      const endTimeForCalc = partsToTimeString(form.end_hour, form.end_minute, form.end_ampm);
      const startIso = parseISTToISO(dateForCalc, startTimeForCalc);
      const endIso = parseISTToISO(endDateForCalc, endTimeForCalc);
      if (!form.title.trim()) throw new Error('Title is required');
      if (!startIso || !endIso) throw new Error('Invalid date or time');
      if (new Date(endIso).getTime() <= new Date(startIso).getTime()) throw new Error('End time must be after start time');

      const basePayload: any = {
        title: form.title,
        description: form.description || undefined,
        start_at: startIso,
        end_at: endIso,
        assigned_to: form.project_id ? (form.assigned_to || null) : null,
        project_id: form.project_id || null,
        priority: form.priority,
      };
      let res: Response;

      if (editingTask) {
        const updatePayload = { id: editingTask.id, ...basePayload };
        res = await fetch('/api/calendar-tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        });
      } else {
        const createPayload = { ...basePayload, status: 'todo' as const };
        res = await fetch('/api/calendar-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || (editingTask ? 'Failed to update task' : 'Failed to create task'));
      }
      setModalOpen(false);
      setEditingTask(null);
      setForm({
        title: '',
        description: '',
        project_id: '',
        start_date_picker: '',
        start_hour: '10',
        start_minute: '00',
        start_ampm: 'AM',
        end_hour: '11',
        end_minute: '00',
        end_ampm: 'AM',
        end_date_picker: '',
        assigned_to: '',
        priority: 'medium'
      });
      fetchTasks();
    } catch (e: any) {
      setError(e.message || (editingTask ? 'Failed to update task' : 'Failed to create task'));
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('projects')
          .select('id,title,status')
          .neq('status', 'completed')
          .order('title', { ascending: true })
          .limit(100);
        if (!error && Array.isArray(data)) {
          setProjects(data.map(p => ({ id: p.id as string, title: (p as any).title as string })));
        }
      } catch {}
    };
    fetchProjects();
  }, []);

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-3 sm:px-0">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto p-3 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{isEditing ? 'Edit Task' : 'Create Task'}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Title *</label>
            <input list="task-title-templates" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" aria-required="true" />
            <datalist id="task-title-templates">
              {titleSuggestions.map((s, i) => (
                <option key={i} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Project (optional)</label>
            <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="">No Project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                <input type="date" value={form.start_date_picker} onChange={e => setForm({ ...form, start_date_picker: e.target.value, end_date_picker: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" aria-label="Calendar start date picker" />

              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                <select
                  value={partsToTimeString(form.start_hour, form.start_minute, form.start_ampm)}
                  onChange={e => {
                    const value = e.target.value;
                    const [time, ap] = value.split(' ');
                    const [hh, mm] = time.split(':');
                    setForm(prev => ({
                      ...prev,
                      start_hour: hh,
                      start_minute: mm,
                      start_ampm: ap as 'AM' | 'PM',
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  aria-label="Start time"
                >
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">End Date</label>
                <input type="date" value={form.end_date_picker} onChange={e => setForm({ ...form, end_date_picker: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" aria-label="Calendar end date picker" />

              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">End Time</label>
                <select
                  value={partsToTimeString(form.end_hour, form.end_minute, form.end_ampm)}
                  onChange={e => {
                    const value = e.target.value;
                    const [time, ap] = value.split(' ');
                    const [hh, mm] = time.split(':');
                    setForm(prev => ({
                      ...prev,
                      end_hour: hh,
                      end_minute: mm,
                      end_ampm: ap as 'AM' | 'PM',
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  aria-label="End time"
                >
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent' })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Assign to</label>
                <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="">Unassigned</option>
                  {assignees.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setModalOpen(false); setEditingTask(null); }} className="px-4 py-2 text-gray-700 rounded-md bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button onClick={saveTask} className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 font-medium">{isEditing ? 'Save Changes' : 'Create Task'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const viewModal = viewTask && viewModalOpen && (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Task Details</h2>
        <div className="space-y-3 text-sm text-gray-700">
          <div>
            <p className="text-xs text-gray-500 mb-1">Title</p>
            <p className="font-medium text-gray-900">{viewTask.title}</p>
          </div>
          {viewTask.description && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Description</p>
              <p className="whitespace-pre-line">{viewTask.description}</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Start</p>
              <p className="text-gray-900">
                {formatISTDate(new Date(viewTask.start_at))}, {formatISTTime(new Date(viewTask.start_at))}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">End</p>
              <p className="text-gray-900">
                {formatISTDate(new Date(viewTask.end_at))}, {formatISTTime(new Date(viewTask.end_at))}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <p className="capitalize text-gray-900">{viewTask.status.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Priority</p>
              <p className="capitalize text-gray-900">{viewTask.priority}</p>
            </div>
          </div>
          {viewTask.assigned_to && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Assigned To</p>
              <p className="text-gray-900">
                {assignees.find(a => a.id === viewTask.assigned_to)?.name || 'Unassigned'}
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={() => { setViewModalOpen(false); setViewTask(null); }}
            className="px-4 py-2 text-gray-700 rounded-md bg-gray-100 hover:bg-gray-200"
          >
            Close
          </button>
          <button
            onClick={() => { if (viewTask) { openEditTask(viewTask); } }}
            className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 font-medium"
          >
            Edit Task
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center px-3 py-2 rounded-md bg-yellow-500 text-gray-900 font-medium hover:bg-yellow-600"
          >
            <FiPlus className="h-4 w-4 mr-1" />
            New Task
          </button>
        </div>
      </div>

      <div className="tasks-calendar-card bg-white border border-gray-200 rounded-lg p-3 shadow-sm" role="region" aria-label="Tasks calendar" aria-live="polite">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="inline-flex items-center gap-2">
            <FiFilter className="h-4 w-4 text-gray-600" />
            <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="px-2 py-1 border border-gray-300 rounded-md text-sm">
              <option value="all">All assignees</option>
              {assignees.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="inline-flex items-center gap-2">
            <FiUser className="h-4 w-4 text-gray-600" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-2 py-1 border border-gray-300 rounded-md text-sm">
              <option value="all">All status</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Completed</option>
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            view={view}
            date={date}
            min={minTime}
            max={maxTime}
            step={60}
            timeslots={1}
            onView={(v: CalendarViewType) => setView(v)}
            onNavigate={(d: Date) => setDate(d)}
            selectable
            onSelectSlot={(slotInfo: any) => openCreateAt(slotInfo.start)}
            onSelectEvent={(event: any) => {
              const task: CalendarTask | undefined = event.resource;
              if (task) {
                openViewTask(task);
              }
            }}
            components={{
              event: EventComp,
              toolbar: TasksToolbar,
              month: {
                dateHeader: ({ label, date }: any) => {
                  const key = format(date as Date, 'yyyy-MM-dd');
                  const count = eventsByDay.get(key) || 0;
                  return (
                    <div className="flex items-center justify-end pr-2 gap-1" aria-label={`Date ${label}${count ? `, ${count} tasks` : ''}`}>
                      <span>{label}</span>
                      {count > 0 && <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />}
                    </div>
                  );
                },
              },
            }}
            popup
            messages={{ showMore: (count: number) => `+${count} more`, noEvents: loading ? 'Loading…' : 'No tasks' }}
            className="tasks-calendar"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="fixed bottom-20 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500 text-gray-900 shadow-lg hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 sm:hidden"
        aria-label="Add new task"
      >
        <FiPlus className="h-6 w-6" />
      </button>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">{error}</div>
      )}

      {viewModalOpen && viewModal}
      {modalOpen && modal}
    </div>
  );
}
