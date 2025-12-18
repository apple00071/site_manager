'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/styles/calendar-custom.css';
import { FiCheck, FiFilter, FiPlus, FiUser, FiAlertTriangle, FiChevronLeft, FiChevronRight, FiUserX, FiX, FiClock, FiList, FiFileText, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';

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
  assigned_to_id?: string | null;
  project_id?: string | null;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
};

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: CalendarTask;
};

// Custom date formatter for DD/MM/YYYY format
const formatDate = (date: Date, formatStr: string) => {
  // Validate Date object runtime validity
  if (Number.isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  if (formatStr === 'dd/MM/yyyy') {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }
  return format(date, formatStr, { locale: enUS });
};

const locales = { 'en-US': enUS };

// Check if we're on mobile (will be evaluated on client side)
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

const customFormats = {
  agendaDateFormat: 'dd/MM/yyyy',
  // agendaHeaderFormat is a range formatter - use a function to format the date range
  agendaHeaderFormat: ({ start, end }: { start: Date; end: Date }, culture?: string, localizer?: any) => {
    // Validate dates before formatting
    const safeStartStr = (start && !Number.isNaN(start.getTime()))
      ? (localizer?.format(start, 'dd/MM/yyyy') || format(start, 'dd/MM/yyyy'))
      : 'Invalid Date';

    const safeEndStr = (end && !Number.isNaN(end.getTime()))
      ? (localizer?.format(end, 'dd/MM/yyyy') || format(end, 'dd/MM/yyyy'))
      : 'Invalid Date';

    return `${safeStartStr} – ${safeEndStr}`;
  },
  // Short day names for mobile (S, M, T, W, T, F, S)
  dayFormat: (date: Date, culture?: string, localizer?: any) => {
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const fullDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const isMobileNow = typeof window !== 'undefined' && window.innerWidth < 640;
    return isMobileNow ? dayNames[date.getDay()] : fullDayNames[date.getDay()];
  },
  // Short weekday header for calendar
  weekdayFormat: (date: Date, culture?: string, localizer?: any) => {
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const fullDayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const isMobileNow = typeof window !== 'undefined' && window.innerWidth < 640;
    return isMobileNow ? dayNames[date.getDay()] : fullDayNames[date.getDay()];
  },
  // Short month format for toolbar (Dec 2025 instead of December 2025)
  monthHeaderFormat: (date: Date, culture?: string, localizer?: any) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  },
};

// Safe format wrapper that handles invalid dates
const safeFormat = (date: Date | number, formatStr: string, options?: any) => {
  try {
    // Handle number timestamps
    if (typeof date === 'number') {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) {
        return 'Invalid Date';
      }
      return format(d, formatStr, options);
    }

    // Handle Date objects
    if (date instanceof Date) {
      if (Number.isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return format(date, formatStr, options);
    }

    // If it's something else, try to convert it
    const parsed = new Date(date as any);
    if (Number.isNaN(parsed.getTime())) {
      return 'Invalid Date';
    }
    return format(parsed, formatStr, options);
  } catch (e) {
    console.warn('Date format error:', e, { date, formatStr });
    return 'Invalid Date';
  }
};

const localizer = dateFnsLocalizer({
  format: safeFormat,
  parse,
  startOfWeek,
  getDay,
  locales
});

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
  const [isMobile, setIsMobile] = useState(false);
  const { showToast } = useToast();
  const { setTitle, setSubtitle } = useHeaderTitle();

  // Sidebar category state
  const [activeCategory, setActiveCategory] = useState<'for-me' | 'by-me' | 'all' | 'proposals'>('for-me');
  const [showSidebar, setShowSidebar] = useState(true);

  // Set header title
  useEffect(() => {
    setTitle('Task Manager');
    setSubtitle(null);
  }, [setTitle, setSubtitle]);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    console.log('Starting to fetch assignees...');
    try {
      const { supabase } = await import('@/lib/supabase');
      console.log('Supabase client initialized');

      // First, verify the table exists and we can query it
      console.log('Checking users table...');

      // Fetch all users with pagination if needed
      let allUsers: any[] = [];
      let page = 0;
      const pageSize = 100; // Adjust based on your needs
      let hasMore = true;

      while (hasMore) {
        console.log(`Fetching users page ${page + 1}...`);
        const { data: users, error: fetchError } = await supabase
          .from('users')
          .select('id, full_name, email')
          .order('full_name', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (fetchError) {
          console.error('Error fetching users:', fetchError);
          throw fetchError;
        }

        if (!users || users.length === 0) {
          hasMore = false;
        } else {
          allUsers = [...allUsers, ...users];
          if (users.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      console.log(`Fetched ${allUsers.length} users from the database`);

      // If we have a task with an assignee but that user isn't in our list,
      // try to fetch that specific user
      if (viewTask?.assigned_to && !allUsers.some(u => u.id === viewTask.assigned_to)) {
        console.log(`User ${viewTask.assigned_to} not found in initial fetch, trying direct fetch...`);
        const { data: missingUser, error: missingUserError } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('id', viewTask.assigned_to)
          .single();

        if (!missingUserError && missingUser) {
          console.log('Found missing user via direct fetch:', missingUser);
          allUsers.push(missingUser);
        } else {
          console.warn('Could not find assigned user:', missingUserError || 'User not found');
        }
      }

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      if (allUsers.length > 0) {
        console.log(`Processing ${allUsers.length} users from the database`);
        console.log('Fetched assignees:', allUsers);
        const formattedAssignees = allUsers.map((user) => ({
          id: user.id,
          name: user.full_name || user.email?.split('@')[0] || 'User',
          email: user.email || ''
        }));
        console.log('Setting assignees:', formattedAssignees);
        setAssignees(formattedAssignees);
      } else {
        console.warn('No users found in the database');
        if (user) {
          setAssignees([{
            id: user.id,
            name: (user as any).full_name || user.email?.split('@')[0] || 'You'
          }]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch assignees:', error);
      if (user) {
        setAssignees([{
          id: user.id,
          name: (user as any).full_name || user.email?.split('@')[0] || 'You'
        }]);
      }
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const rangeStart = new Date(date);
      rangeStart.setDate(1); // Start of current month
      rangeStart.setMonth(rangeStart.getMonth() - 1); // Go back one month
      rangeStart.setHours(0, 0, 0, 0);

      const rangeEnd = new Date(date);
      rangeEnd.setDate(1); // Start of current month
      rangeEnd.setMonth(rangeEnd.getMonth() + 2); // Go forward two months (to end of next month)
      rangeEnd.setDate(0); // Last day of next month
      rangeEnd.setHours(23, 59, 59, 999);
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

  // Category counts for sidebar
  const categoryCounts = useMemo(() => {
    return {
      forMe: tasks.filter(t => t.assigned_to === user?.id || t.assigned_to_id === user?.id).length,
      byMe: tasks.filter(t => t.created_by === user?.id).length,
      all: tasks.length
    };
  }, [tasks, user]);

  // Proposals state
  const [proposals, setProposals] = useState<any[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

  const fetchProposals = async () => {
    try {
      setLoadingProposals(true);
      // Fetch all proposals (we'll filter to sent ones)
      const res = await fetch('/api/proposals?all=true');
      if (!res.ok) {
        // If 403, user is not admin - just don't show proposals section
        if (res.status === 403 || res.status === 401) {
          setProposals([]);
          return;
        }
        throw new Error('Failed to fetch proposals');
      }
      const data = await res.json();
      // Filter to only pending/sent proposals
      const pending = (data.proposals || []).filter((p: any) => p.status === 'sent');
      setProposals(pending);
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
      setProposals([]);
    } finally {
      setLoadingProposals(false);
    }
  };

  // Fetch proposals on mount and when category changes
  useEffect(() => {
    fetchProposals();
  }, []);

  useEffect(() => {
    if (activeCategory === 'proposals') {
      fetchProposals();
    }
  }, [activeCategory]);

  const handleApproveProposal = async (proposalId: string) => {
    try {
      const res = await fetch('/api/proposals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: proposalId, action: 'approve' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast('success', 'Proposal approved - items have been confirmed');
      fetchProposals();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    const reason = prompt('Enter rejection reason (optional):');
    try {
      const res = await fetch('/api/proposals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: proposalId, action: 'reject', reason }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast('success', 'Proposal rejected - items reverted to draft');
      fetchProposals();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  // Filter tasks by active category
  const filteredTasksByCategory = useMemo(() => {
    switch (activeCategory) {
      case 'for-me':
        return tasks.filter(t => t.assigned_to === user?.id || t.assigned_to_id === user?.id);
      case 'by-me':
        return tasks.filter(t => t.created_by === user?.id);
      case 'all':
      default:
        return tasks;
    }
  }, [activeCategory, tasks, user]);

  const events = useMemo(() => {
    const base = filteredTasksByCategory.filter(t => (filterStatus === 'all' ? true : t.status === filterStatus));
    const mapped = base.map(t => {
      // Validate that start_at and end_at exist and are valid strings
      if (!t.start_at || !t.end_at || typeof t.start_at !== 'string' || typeof t.end_at !== 'string') {
        console.warn('Task with missing or invalid date fields:', t.id, { start_at: t.start_at, end_at: t.end_at });
        return null;
      }

      const start = new Date(t.start_at);
      const endCandidate = new Date(t.end_at);
      const invalid = Number.isNaN(start.getTime()) || Number.isNaN(endCandidate.getTime());
      if (invalid) {
        console.warn('Task with invalid date values:', t.id, { start_at: t.start_at, end_at: t.end_at });
        return null; // Filter out invalid events
      }
      const end = endCandidate.getTime() <= start.getTime()
        ? new Date(start.getTime() + 60 * 60 * 1000)
        : endCandidate;

      return {
        id: t.id,
        title: t.title,
        start,
        end,
        allDay: false,
        resource: t,
      };
    }).filter(Boolean) as CalendarEvent[]; // Filter out nulls
    return mapped;
  }, [tasks, filterStatus]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, number>();
    events.forEach(e => {
      const key = format(e.start, 'yyyy-MM-dd');
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
      const evStart = ev.start;
      const evEnd = ev.end;
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

  const onSelectEvent = (event: any) => {
    setViewTask(event.resource);
    setViewModalOpen(true);
  };

  const EventComp = ({ event, view = 'month', onSelectEvent }: { event: any; view?: CalendarViewType; onSelectEvent: (event: any) => void }) => {
    const task: CalendarTask = event.resource;
    const overdue = isOverdue(task);
    const highPriority = task.priority === 'high' || task.priority === 'urgent';
    const isMonthView = view === 'month';
    const assignee = assignees.find(a => a.id === task.assigned_to);
    const assigneeInitial = assignee?.name?.charAt(0).toUpperCase() || '?';

    // Priority colors mapping
    const priorityColors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-green-100 text-green-800',
      high: 'bg-yellow-100 text-yellow-800',
      urgent: 'bg-red-100 text-red-800'
    };

    // Prepare tooltip with all details
    const start = event.start as Date;
    const end = event.end as Date;
    const timeRange = `${formatISTTime(start)} - ${formatISTTime(end)}`;
    const tooltipParts: string[] = [timeRange];
    if (task.priority) {
      tooltipParts.push(`Priority: ${task.priority}`);
    }
    if (assignee) {
      tooltipParts.push(`Assigned to: ${assignee.name}`);
    }
    tooltipParts.push(`Status: ${task.status}`);
    const tooltip = tooltipParts.join(' • ');

    return (
      <div
        className={`flex items-start gap-1 ${overdue ? 'text-red-700' : highPriority ? 'text-yellow-700' : 'text-gray-900'}`}
        title={tooltip}
        onClick={() => onSelectEvent(event)}
      >
        {!isMonthView && (
          <>
            {task.status === 'done' && <FiCheck className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />}
            {overdue && <FiAlertTriangle className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />}
          </>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {isMonthView ? (
              <>
                {task.status === 'done' && <FiCheck className="h-2.5 w-2.5 text-green-600 flex-shrink-0" />}
                {overdue && <FiAlertTriangle className="h-2.5 w-2.5 text-red-600 flex-shrink-0" />}
                <span className="truncate text-xs font-medium">{task.title}</span>
                {task.assigned_to && (
                  <span
                    className="flex-shrink-0 inline-flex items-center justify-center h-3 w-3 rounded-full bg-gray-200 text-gray-700 font-medium text-[8px]"
                    title={`Assigned to: ${assignee?.name || 'Unknown'}`}
                  >
                    {assigneeInitial}
                  </span>
                )}
              </>
            ) : (
              <div className="flex items-center w-full">
                <span className="truncate text-xs flex-1">{task.title}</span>
                {task.assigned_to && (
                  <span
                    className="flex-shrink-0 inline-flex items-center justify-center h-3 w-3 rounded-full bg-gray-200 text-gray-700 font-medium text-[8px] ml-1"
                    title={`Assigned to: ${assignee?.name || 'Unknown'}`}
                  >
                    {assigneeInitial}
                  </span>
                )}
                {task.status === 'done' && <FiCheck className="h-2.5 w-2.5 text-green-600 flex-shrink-0 ml-1" />}
                {overdue && <FiAlertTriangle className="h-2.5 w-2.5 text-red-600 flex-shrink-0 ml-1" />}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority as keyof typeof priorityColors] || 'bg-gray-100'
                  } ml-1`}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </span>
              </div>
            )}
          </div>
          {!isMonthView && task.description && (
            <div className="mt-1 text-xs text-gray-600 line-clamp-2">
              {task.description}
            </div>
          )}
        </div>
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
    d.setHours(20, 0, 0, 0); // Set to 8 PM so 7 PM slot is visible
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
      <div className="flex flex-col md:flex-row items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToBack}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
              aria-label="Previous period"
            >
              <FiChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goToNext}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
              aria-label="Next period"
            >
              <FiChevronRight className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => toolbar.onNavigate('TODAY')}
            className="text-base sm:text-lg font-semibold text-gray-900 hover:text-gray-700 transition-colors"
            aria-label="Go to today"
          >
            {toolbar.label}
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto no-scrollbar">
          <div className="flex p-1 bg-gray-100 rounded-lg">
            {viewButtons.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => toolbar.onView(v.key)}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${toolbar.view === v.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }${v.hideOnMobile ? ' hidden sm:inline-block' : ''}`}
              >
                {v.label}
              </button>
            ))}
          </div>
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

  // ESC key handler to close modals
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (modalOpen) {
          setModalOpen(false);
          setEditingTask(null);
        }
        if (viewModalOpen) {
          setViewModalOpen(false);
          setViewTask(null);
        }
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [modalOpen, viewModalOpen]);

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
    // Generate times for working hours only: 8:00 AM to 7:00 PM (19:00)
    for (let hour = 8; hour <= 19; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        // Don't add 7:30 PM - end at 7:00 PM
        if (hour === 19 && minute > 0) continue;

        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hh = hour12.toString().padStart(2, '0');
        const mm = minute.toString().padStart(2, '0');
        options.push(`${hh}:${mm} ${ampm}`);
      }
    }
    return options;
  }, []);

  function formatISTDate(d: Date) {
    if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return 'Invalid Date';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(d);
    } catch (e) {
      return 'Invalid Date';
    }
  }
  function formatISTTime(d: Date) {
    if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return 'Invalid Time';
    try {
      return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(d);
    } catch (e) {
      return 'Invalid Time';
    }
  }
  function parseISTToISO(dateStr: string, timeStr: string) {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return undefined;
    const [dd, mm, yyyy] = parts.map(p => parseInt(p, 10));
    if (!dd || !mm || !yyyy) return undefined;
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return undefined;
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const ms = Date.UTC(yyyy, mm - 1, dd, hour, minute);
    const offsetMs = 5.5 * 60 * 60 * 1000; // IST offset
    const finalDate = new Date(ms - offsetMs);
    if (Number.isNaN(finalDate.getTime())) return undefined;
    return finalDate.toISOString();
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
    console.log('openCreateAt called with:', dateArg, 'hours:', dateArg.getHours(), 'minutes:', dateArg.getMinutes());

    const start = new Date(dateArg);
    // Snap minutes to nearest 30-minute interval
    const snapMinutes = Math.round(start.getMinutes() / 30) * 30;
    start.setMinutes(snapMinutes === 60 ? 0 : snapMinutes);
    if (snapMinutes === 60) {
      start.setHours(start.getHours() + 1);
    }

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30); // Default duration: 30 minutes

    // Get hours in 12-hour format
    const startHours = start.getHours();
    const startHour12 = startHours === 0 ? 12 : startHours > 12 ? startHours - 12 : startHours;
    const startAmPm = startHours >= 12 ? 'PM' : 'AM';

    const endHours = end.getHours();
    const endHour12 = endHours === 0 ? 12 : endHours > 12 ? endHours - 12 : endHours;
    const endAmPm = endHours >= 12 ? 'PM' : 'AM';

    console.log('Setting form - start:', startHour12, ':', start.getMinutes(), startAmPm);
    console.log('Setting form - end:', endHour12, ':', end.getMinutes(), endAmPm);

    setForm(prev => ({
      ...prev,
      start_date_picker: format(start, 'yyyy-MM-dd'),
      start_hour: String(startHour12).padStart(2, '0'),
      start_minute: String(start.getMinutes()).padStart(2, '0'),
      start_ampm: startAmPm,
      end_hour: String(endHour12).padStart(2, '0'),
      end_minute: String(end.getMinutes()).padStart(2, '0'),
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
        assigned_to: form.assigned_to || null,
        assigned_to_id: form.assigned_to || null,
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
      showToast('error', e.message || (editingTask ? 'Failed to update task' : 'Failed to create task'));
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
      } catch { }
    };
    fetchProjects();
  }, []);

  // Task form content (used in both modal and bottom sheet)
  const TaskFormContent = () => (
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
  );

  // View task content (used in both modal and bottom sheet)
  const ViewTaskContent = () => viewTask ? (
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
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${viewTask.status === 'done' ? 'bg-green-100 text-green-800' :
            viewTask.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
              viewTask.status === 'blocked' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
            }`}>
            {viewTask.status.replace('_', ' ').charAt(0).toUpperCase() + viewTask.status.replace('_', ' ').slice(1)}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Project</p>
          <p className="text-gray-900">
            {viewTask.project_id ? (projects.find(p => p.id === viewTask.project_id)?.title || 'No project') : 'No project'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">Assigned To</p>
          {viewTask.assigned_to || viewTask.assigned_to_id ? (
            (() => {
              const assigneeId = viewTask.assigned_to || viewTask.assigned_to_id;
              const assignee = assignees.find(a => a.id === assigneeId);
              if (!assignee) {
                return (
                  <div className="flex items-center gap-2 text-yellow-700">
                    <FiUserX className="h-4 w-4 flex-shrink-0" />
                    <span>User not found</span>
                  </div>
                );
              }
              return (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-medium">
                    {assignee.name?.charAt(0).toUpperCase() || '?'}
                  </span>
                  <span className="text-gray-900">{assignee.name}</span>
                </div>
              );
            })()
          ) : (
            <span className="text-gray-500 italic">Unassigned</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Priority</p>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${viewTask.priority === 'high' ? 'bg-red-100 text-red-800' :
            viewTask.priority === 'urgent' ? 'bg-red-100 text-red-800 font-bold' :
              viewTask.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
            }`}>
            {viewTask.priority.charAt(0).toUpperCase() + viewTask.priority.slice(1)}
          </span>
        </div>
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
  ) : null;



  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar - Desktop Only */}
      {!isMobile && showSidebar && (
        <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Task Manager</h2>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            <button
              onClick={() => setActiveCategory('for-me')}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeCategory === 'for-me'
                ? 'bg-yellow-500 text-gray-900'
                : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              <div className="flex items-center gap-3">
                <FiUser className="w-5 h-5" />
                <span>Tasks for me</span>
              </div>
              <span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded ${activeCategory === 'for-me' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                {categoryCounts.forMe}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('by-me')}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeCategory === 'by-me'
                ? 'bg-yellow-500 text-gray-900'
                : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              <div className="flex items-center gap-3">
                <FiClock className="w-5 h-5" />
                <span>Tasks by me</span>
              </div>
              <span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded ${activeCategory === 'by-me' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                {categoryCounts.byMe}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('all')}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeCategory === 'all'
                ? 'bg-yellow-500 text-gray-900'
                : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              <div className="flex items-center gap-3">
                <FiList className="w-5 h-5" />
                <span>All Tasks</span>
              </div>
              <span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded ${activeCategory === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                {categoryCounts.all}
              </span>
            </button>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => setActiveCategory('proposals')}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeCategory === 'proposals'
                  ? 'bg-amber-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <FiFileText className="w-5 h-5" />
                  <span>Proposals</span>
                </div>
                {proposals.length > 0 && (
                  <span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded ${activeCategory === 'proposals' ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                    {proposals.length}
                  </span>
                )}
              </button>
            </div>
          </nav>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="space-y-4 p-4">
          {activeCategory === 'proposals' ? (
            <>
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Pending Proposals</h1>
              </div>

              {loadingProposals ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                </div>
              ) : proposals.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                  <FiFileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No pending proposals</p>
                  <p className="text-sm text-gray-400 mt-1">Proposals sent from BOQ will appear here for approval</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proposals.map((proposal: any) => (
                    <div key={proposal.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                      {/* Header */}
                      <div className="p-4 border-b border-gray-100">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {proposal.project?.title && (
                                <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                                  {proposal.project.title}
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-gray-900 text-lg">{proposal.title}</h3>
                            {proposal.description && (
                              <p className="text-sm text-gray-500 mt-1">{proposal.description}</p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-3 text-sm">
                              <span className="text-gray-600">
                                <span className="font-medium">Sent by:</span> {proposal.created_by_user?.full_name || 'Unknown'}
                              </span>
                              <span className="text-gray-600">
                                <span className="font-medium">Date:</span> {new Date(proposal.sent_at || proposal.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 ml-4">
                            <button
                              onClick={() => handleApproveProposal(proposal.id)}
                              className="inline-flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                            >
                              <FiCheckCircle className="w-4 h-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectProposal(proposal.id)}
                              className="inline-flex items-center gap-1 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                            >
                              <FiXCircle className="w-4 h-4" />
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Item Details */}
                      <div className="p-4 bg-gray-50">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">
                          Items ({proposal.selected_items?.length || 0})
                        </h4>
                        {proposal.items && proposal.items.length > 0 ? (
                          <div className="space-y-2">
                            {proposal.items.map((item: any) => (
                              <div key={item.id} className="flex justify-between items-center py-2 px-3 bg-white rounded border border-gray-100">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{item.item_name}</p>
                                  <p className="text-xs text-gray-500">
                                    {item.quantity} × ₹{(item.rate || 0).toLocaleString('en-IN')}
                                  </p>
                                </div>
                                <span className="font-medium text-gray-900">
                                  ₹{(item.amount || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Item details not loaded</p>
                        )}

                        {/* Total */}
                        <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200">
                          <span className="font-semibold text-gray-700">Total Amount</span>
                          <span className="text-xl font-bold text-amber-700">
                            ₹{(proposal.total_amount || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
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
                    step={30}
                    timeslots={2}
                    showAllDayEventRow={false}
                    onView={(v: CalendarViewType) => setView(v)}
                    onNavigate={(d: Date) => setDate(d)}
                    formats={customFormats}
                    selectable
                    onSelectSlot={(slotInfo: any) => {
                      console.log('Slot selected:', slotInfo);
                      // For week/day view, slotInfo.start should contain the exact time
                      // slotInfo.slots[0] might also contain the first slot time
                      const selectedTime = slotInfo.start instanceof Date
                        ? slotInfo.start
                        : new Date(slotInfo.start);
                      console.log('Selected time hours:', selectedTime.getHours(), 'minutes:', selectedTime.getMinutes());
                      openCreateAt(selectedTime);
                    }}
                    onSelectEvent={(event: any) => {
                      const task: CalendarTask | undefined = event.resource;
                      if (task) {
                        openViewTask(task);
                      }
                    }}
                    components={{
                      event: (props: any) => <EventComp {...props} view={view} onSelectEvent={onSelectEvent} />,
                      toolbar: TasksToolbar,
                      month: {
                        dateHeader: ({ date, label }: { date: Date; label: string }) => {
                          let isToday = false;
                          try {
                            isToday = format(new Date(), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
                          } catch (e) {
                            // Ignore format errors
                          }
                          return (
                            <div className="rbc-date-cell">
                              <div className={`rbc-date-cell-content ${isToday ? 'rbc-now' : ''}`}>
                                {label}
                              </div>
                            </div>
                          );
                        }
                      }
                    }}
                    style={{
                      height: '100%',
                      minHeight: '600px',
                      '--rbc-today-bg': '#f0f9ff',
                      '--rbc-off-range-bg': '#f9fafb',
                      '--rbc-event-bg': '#4f46e5',
                      '--rbc-event-color': '#fff',
                      '--rbc-current-time-indicator': '#4f46e5',
                    } as React.CSSProperties}
                    popup
                    messages={{
                      showMore: (count: number) => `+${count} more` as any,
                      noEventsInRange: loading ? 'Loading...' : 'No tasks'
                    }}
                    className="tasks-calendar"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => openCreateAt(new Date())}
                className="fixed bottom-20 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500 text-gray-900 shadow-lg hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 sm:hidden"
                aria-label="Add new task"
              >
                <FiPlus className="h-7 w-7" />
              </button>

              {
                error && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700 rounded">{error}</div>
                )
              }

              {/* Mobile: BottomSheet for View Task */}
              <BottomSheet
                isOpen={viewModalOpen && isMobile}
                onClose={() => { setViewModalOpen(false); setViewTask(null); }}
                title="Task Details"
              >
                <ViewTaskContent />
              </BottomSheet>

              {/* Desktop: Modal for View Task */}
              {
                viewModalOpen && !isMobile && viewTask && (
                  <div
                    className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
                    onClick={() => { setViewModalOpen(false); setViewTask(null); }}
                  >
                    <div
                      className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-gray-900">Task Details</h2>
                        <button
                          onClick={() => { setViewModalOpen(false); setViewTask(null); }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          <FiX className="w-5 h-5" />
                        </button>
                      </div>
                      <ViewTaskContent />
                    </div>
                  </div>
                )
              }

              {/* Mobile: BottomSheet for Create/Edit Task */}
              <BottomSheet
                isOpen={modalOpen && isMobile}
                onClose={() => { setModalOpen(false); setEditingTask(null); }}
                title={isEditing ? 'Edit Task' : 'Create Task'}
              >
                <TaskFormContent />
              </BottomSheet>

              {/* Desktop: Modal for Create/Edit Task */}
              {
                modalOpen && !isMobile && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-3 sm:px-0"
                    onClick={() => { setModalOpen(false); setEditingTask(null); }}
                  >
                    <div
                      className="bg-white rounded-lg shadow-xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto p-3 sm:p-5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-gray-900">{isEditing ? 'Edit Task' : 'Create Task'}</h2>
                        <button
                          onClick={() => { setModalOpen(false); setEditingTask(null); }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          <FiX className="w-5 h-5" />
                        </button>
                      </div>
                      <TaskFormContent />
                    </div>
                  </div>
                )
              }

              {/* Mobile Bottom Navigation */}
              {
                isMobile && (
                  <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-30">
                    <div className="flex justify-around">
                      <button
                        onClick={() => setActiveCategory('for-me')}
                        className={`flex-1 py-3 flex flex-col items-center gap-1 relative ${activeCategory === 'for-me' ? 'text-yellow-600' : 'text-gray-600'
                          }`}
                      >
                        <FiUser className="w-5 h-5" />
                        <span className="text-xs">For Me</span>
                        {categoryCounts.forMe > 0 && (
                          <span className="absolute top-1 right-1/4 bg-yellow-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            {categoryCounts.forMe}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveCategory('by-me')}
                        className={`flex-1 py-3 flex flex-col items-center gap-1 relative ${activeCategory === 'by-me' ? 'text-yellow-600' : 'text-gray-600'
                          }`}
                      >
                        <FiClock className="w-5 h-5" />
                        <span className="text-xs">By Me</span>
                        {categoryCounts.byMe > 0 && (
                          <span className="absolute top-1 right-1/4 bg-yellow-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            {categoryCounts.byMe}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveCategory('all')}
                        className={`flex-1 py-3 flex flex-col items-center gap-1 relative ${activeCategory === 'all' ? 'text-yellow-600' : 'text-gray-600'
                          }`}
                      >
                        <FiList className="w-5 h-5" />
                        <span className="text-xs">All</span>
                        {categoryCounts.all > 0 && (
                          <span className="absolute top-1 right-1/4 bg-yellow-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            {categoryCounts.all}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
