'use client';

import { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, Views, SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { toISTISOString, formatDateTimeIST, getTodayDateString } from '@/lib/dateUtils';
import { FiRefreshCw, FiSearch, FiPlus } from 'react-icons/fi';
import Modal from '@/components/Modal';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/styles/calendar-responsive.css';

type CalendarTask = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string | null;
  project_id: string | null;
  created_by: string;
};

type CalendarTaskEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: CalendarTask;
};

const locales: Record<string, any> = {};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 0 }),
  getDay,
  locales,
});

const TIME_OPTIONS = (() => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      const valueHour = hour.toString().padStart(2, '0');
      const valueMinute = minute === 0 ? '00' : '30';
      const value = `${valueHour}:${valueMinute}`;
      const period = hour < 12 ? 'AM' : 'PM';
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const labelMinute = valueMinute;
      const label = `${displayHour}:${labelMinute} ${period}`;
      options.push({ value, label });
    }
  }
  return options;
})();

const CalendarEvent = ({ event }: { event: any }) => {
  return (
    <div>
      <div className="text-xs font-semibold truncate">{event.title}</div>
      {event?.resource?.description && (
        <div className="text-[10px] leading-tight truncate">
          {event.resource.description}
        </div>
      )}
    </div>
  );
};

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [projects, setProjects] = useState<Array<{id: string; title: string; customer_name: string}>>([]);
  const [users, setUsers] = useState<Array<{id: string; full_name: string; email: string}>>([]);
  const [calendarView, setCalendarView] = useState<string>(Views.WEEK as string);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/calendar-tasks', {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Calendar tasks fetch failed:', errorData);
        throw new Error(errorData.error || 'Failed to fetch tasks');
      }

      const data = await response.json();
      setTasks((data.tasks || []) as CalendarTask[]);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/admin/projects');
      if (response.ok) {
        const data = await response.json();
        console.log('Projects data:', data);
        // Handle different response structures
        const projectsArray = Array.isArray(data) ? data : (data.projects || data.data || []);
        setProjects(projectsArray);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        console.log('Users data:', data);
        // Handle different response structures
        const usersArray = Array.isArray(data) ? data : (data.users || data.data || []);
        setUsers(usersArray);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const createTask = async (formData: any) => {
    try {
      setCreating(true);
      const { task_title, task_description, date, start_time, end_time, project_id, assigned_to, priority } = formData;

      const start = new Date(`${date}T${start_time}:00`);
      const end = new Date(`${date}T${end_time}:00`);

      const response = await fetch('/api/calendar-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: task_title,
          description: task_description || '',
          start_at: toISTISOString(start),
          end_at: toISTISOString(end),
          project_id: project_id || null,
          assigned_to: assigned_to || null,
          priority,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Task creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create task');
      }

      const result = await response.json();
      console.log('Task created:', result);

      // Refresh tasks
      await fetchTasks();
      setShowCreateModal(false);
      
      return { success: true };
    } catch (err: any) {
      console.error('Error creating task:', err);
      if (typeof window !== 'undefined' && err?.message) {
        window.alert(err.message);
      }
      return { success: false, error: err.message };
    } finally {
      setCreating(false);
    }
  };

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setShowEditModal(true);
    fetchProjects();
    fetchUsers();
  };

  const updateTask = async (formData: any) => {
    try {
      setUpdating(true);
      const { task_title, task_description, date, start_time, end_time, project_id, assigned_to, priority, status } = formData;

      const start = new Date(`${date}T${start_time}:00`);
      const end = new Date(`${date}T${end_time}:00`);

      const response = await fetch('/api/calendar-tasks', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingTask?.id,
          title: task_title,
          description: task_description || '',
          start_at: toISTISOString(start),
          end_at: toISTISOString(end),
          project_id: project_id || null,
          assigned_to: assigned_to || null,
          priority,
          status,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Task update failed:', errorData);
        throw new Error(errorData.error || 'Failed to update task');
      }

      const result = await response.json();
      console.log('Task updated:', result);
      
      // Refresh tasks
      await fetchTasks();
      setShowEditModal(false);
      
      return { success: true };
    } catch (err: any) {
      console.error('Error updating task:', err);
      if (typeof window !== 'undefined' && err?.message) {
        window.alert(err.message);
      }
      return { success: false, error: err.message };
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    fetchUsers();
  }, []);

  // Filter tasks based on search and filters
  useEffect(() => {
    let filtered = [...tasks];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(search) ||
        (task.description && task.description.toLowerCase().includes(search))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // Project filter
    if (projectFilter !== 'all') {
      filtered = filtered.filter(task => task.project_id === projectFilter);
    }

    setFilteredTasks(filtered);
  }, [tasks, searchTerm, statusFilter, projectFilter]);

  // Get unique projects for filter dropdown based on tasks that reference a project_id
  const uniqueProjects = projects.filter(project =>
    tasks.some(task => task.project_id === project.id)
  );

  const getStatusCounts = () => {
    return {
      all: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      done: tasks.filter(t => t.status === 'done').length,
    };
  };

  const statusCounts = getStatusCounts();

  const events: CalendarTaskEvent[] = filteredTasks.map((task) => ({
    id: task.id,
    title: task.title,
    start: new Date(task.start_at),
    end: new Date(task.end_at),
    resource: task,
  }));

  // Mobile-specific calendar settings
  useEffect(() => {
    // Set default view to day on mobile for better UX
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setCalendarView(Views.DAY);
    }
  }, []);

  const handleNavigate = (newDate: Date) => {
    setCalendarDate(newDate);
  };

  const handleViewChange = (newView: string) => {
    setCalendarView(newView);
  };

  const handleSelectEvent = (event: any) => {
    // Better touch handling for mobile
    if (event.resource) {
      handleEditTask(event.resource);
    }
  };

  const eventStyleGetter = (event: CalendarTaskEvent) => {
    let backgroundColor = '#9CA3AF';
    if (event.resource.status === 'in_progress') backgroundColor = '#3B82F6';
    else if (event.resource.status === 'blocked') backgroundColor = '#EF4444';
    else if (event.resource.status === 'done') backgroundColor = '#10B981';

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        color: '#ffffff',
        border: 'none',
        display: 'block',
        padding: '2px 4px',
        fontSize: '0.75rem',
      },
    };
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-end">
          <div className="w-32 h-10 bg-gray-200 rounded-xl animate-pulse"></div>
        </div>
        
        {/* Status Overview Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
              <div className="h-8 bg-gray-300 rounded mb-2"></div>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            </div>
          ))}
        </div>

        {/* Filters Skeleton */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="sm:w-48 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="sm:w-64 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Calendar Skeleton */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-4 min-h-[500px] sm:h-[600px] lg:h-[700px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-2">
              <div className="w-12 h-8 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="w-12 h-8 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="w-12 h-8 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
            <div className="w-16 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
          <div className="h-full min-h-[400px] sm:min-h-[500px] bg-gray-50 rounded-lg animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Tasks</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={fetchTasks}
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FiRefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-0.5 sm:px-1 md:px-2 lg:px-4 xl:px-6 space-y-0.5 sm:space-y-1 md:space-y-2 lg:space-y-4">
      <div className="flex justify-end mb-0.5">
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-1.5 py-1 bg-yellow-500 text-gray-900 rounded flex items-center justify-center hover:bg-yellow-600 active:bg-yellow-700 transition-colors font-semibold text-xs touch-target min-h-[32px] min-w-[32px]"
        >
          <FiPlus className="mr-0.5 h-2.5 w-2.5" />
          <span className="hidden sm:inline">New</span>
          <span className="sm:hidden">+</span>
        </button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-0.5 sm:gap-1 lg:gap-4">
        {[
          { key: 'all', label: 'All', color: 'bg-gray-100 text-gray-900' },
          { key: 'todo', label: 'Todo', color: 'bg-gray-100 text-gray-700' },
          { key: 'in_progress', label: 'Progress', color: 'bg-blue-100 text-blue-700' },
          { key: 'blocked', label: 'Blocked', color: 'bg-red-100 text-red-700' },
          { key: 'done', label: 'Done', color: 'bg-green-100 text-green-700' },
        ].map(({ key, label, color }) => (
          <div key={key} className={`rounded-sm p-1 sm:p-1.5 lg:p-4 ${color} min-h-[35px] sm:min-h-[45px] lg:min-h-[80px] flex flex-col justify-center items-center text-center`}>
            <div className="text-[10px] sm:text-xs lg:text-xl font-bold">{statusCounts[key as keyof typeof statusCounts]}</div>
            <div className="text-[8px] sm:text-[10px] lg:text-sm font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 sm:p-1.5 lg:p-4">
        <div className="flex flex-col gap-1 sm:gap-1.5 lg:gap-4">
          {/* Search */}
          <div className="w-full">
            <div className="relative">
              <FiSearch className="absolute left-1.5 top-1/2 transform -translate-y-1/2 h-2.5 w-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-5 pr-1.5 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 text-[10px] sm:text-xs"
              />
            </div>
          </div>

          {/* Filter Row */}
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-1.5">
            {/* Status Filter */}
            <div className="w-full sm:w-24">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-1.5 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 text-[10px] sm:text-xs"
              >
                <option value="all">All</option>
                <option value="todo">Todo</option>
                <option value="in_progress">Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>

            {/* Project Filter */}
            <div className="w-full sm:w-28">
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full px-1.5 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 text-[10px] sm:text-xs"
              >
                <option value="all">Projects</option>
                {uniqueProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            {(searchTerm || statusFilter !== 'all' || projectFilter !== 'all') && (
              <div className="w-full sm:w-auto">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setProjectFilter('all');
                  }}
                  className="w-full px-1.5 py-1 text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-[10px] sm:text-xs whitespace-nowrap min-h-[28px]"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Results Info */}
        {filteredTasks.length !== tasks.length && (
          <div className="mt-3 text-sm text-gray-600">
            Showing {filteredTasks.length} of {tasks.length} tasks
          </div>
        )}
      </div>

      {/* Professional Gantt Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-0.5 sm:p-1 lg:p-4 calendar-responsive-container">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 mb-0.5">
          <div className="flex flex-wrap items-center gap-0.5 sm:gap-2">
            <button
              className={`px-0.5 py-0.5 text-[10px] sm:text-xs rounded-full border ${calendarView === Views.DAY ? 'bg-yellow-500 text-gray-900 border-yellow-500' : 'bg-white text-gray-700 border-gray-200'}`}
              onClick={() => setCalendarView(Views.DAY)}
            >
              <span className="hidden sm:inline">Day</span>
              <span className="sm:hidden">D</span>
            </button>
            <button
              className={`px-0.5 py-0.5 text-[10px] sm:text-xs rounded-full border ${calendarView === Views.WEEK ? 'bg-yellow-500 text-gray-900 border-yellow-500' : 'bg-white text-gray-700 border-gray-200'}`}
              onClick={() => setCalendarView(Views.WEEK)}
            >
              <span className="hidden sm:inline">Week</span>
              <span className="sm:hidden">W</span>
            </button>
            <button
              className={`px-0.5 py-0.5 text-[10px] sm:text-xs rounded-full border ${calendarView === Views.MONTH ? 'bg-yellow-500 text-gray-900 border-yellow-500' : 'bg-white text-gray-700 border-gray-200'}`}
              onClick={() => setCalendarView(Views.MONTH)}
            >
              <span className="hidden sm:inline">Month</span>
              <span className="sm:hidden">M</span>
            </button>
          </div>
          <div className="flex items-center gap-0.5 text-[10px] sm:text-xs text-gray-600">
            <button
              className="px-0.5 py-0.5 border border-gray-200 rounded hover:bg-gray-50 text-[10px] sm:text-xs"
              onClick={() => setCalendarDate(new Date())}
            >
              <span className="hidden sm:inline">Today</span>
              <span className="sm:hidden">Now</span>
            </button>
          </div>
        </div>
        <div className="w-full h-auto min-h-[120px] sm:min-h-[200px] lg:min-h-[450px]">
          <div className="w-full h-full">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              view={calendarView}
              date={calendarDate}
              onView={handleViewChange}
              onNavigate={handleNavigate}
              selectable
              onSelectEvent={handleSelectEvent}
              style={{ height: 'auto', minHeight: '120px', width: '100%' }}
              components={{ event: CalendarEvent }}
              popup
              messages={{
                showMore: (count: number) => `+${count} more`,
                noEvents: 'No tasks scheduled',
              }}
              toolbar={false}
            />
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      <Modal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        title="Create New Task"
        maxWidth="lg"
      >
        <CreateTaskForm />
      </Modal>

      {/* Edit Task Modal */}
      <Modal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)} 
        title="Edit Task"
        maxWidth="lg"
      >
        <EditTaskForm />
      </Modal>
    </div>
  );

  function CreateTaskForm() {
    const TASK_TEMPLATES = [
      { value: 'site_visit', label: 'Site Visit' },
      { value: 'client_meeting', label: 'Client Meeting' },
      { value: 'design_review', label: 'Design Review' },
      { value: 'material_purchase', label: 'Material Purchase' },
      { value: 'follow_up_call', label: 'Follow-up Call' },
      { value: 'other', label: 'Others' },
    ];

    const [formData, setFormData] = useState({
      project_id: '',
      task_title: '',
      task_description: '',
      date: getTodayDateString(),
      start_time: '10:00',
      end_time: '11:00',
      assigned_to: '',
      priority: 'medium',
    });
    const [formError, setFormError] = useState('');
    const [taskTemplate, setTaskTemplate] = useState('');

    const handleTemplateChange = (value: string) => {
      setTaskTemplate(value);

      if (value && value !== 'other') {
        const template = TASK_TEMPLATES.find(t => t.value === value);
        setFormData(prev => ({
          ...prev,
          task_title: template ? template.label : '',
        }));
        setFormError('');
      }
      // Don't clear the title when 'other' is selected - let user keep what they typed
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError('');

      if (!formData.task_title) {
        setFormError('Task title is required');
        return;
      }

      const result = await createTask({
        ...formData,
        step_title: 'General Tasks', // Auto-generate step title
      });

      if (!result.success) {
        setFormError(result.error || 'Failed to create task');
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project <span className="text-sm text-gray-500">(Optional for daily tasks)</span>
                </label>
                <select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title} - {project.customer_name}
                    </option>
                  ))}
                </select>
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task Title *
                </label>
                <div className="space-y-2">
                  <select
                    value={taskTemplate}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  >
                    <option value="">Choose a template or enter custom...</option>
                    {TASK_TEMPLATES.map((template) => (
                      <option key={template.value} value={template.value}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={formData.task_title}
                    onChange={(e) => setFormData({ ...formData, task_title: e.target.value })}
                    placeholder="Enter task title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {taskTemplate ? 'Template selected - you can customize the title above' : 'Select a template or enter a custom task title'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.task_description}
                  onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
                  placeholder="Enter task description (optional)"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <select
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  >
                    {TIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <select
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                >
                  {TIME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign To
                  </label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-600 active:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  {creating ? 'Creating...' : 'Create Task'}
                </button>
              </div>
      </form>
    );
  }

  function EditTaskForm() {
    const TASK_TEMPLATES = [
      { value: 'site_visit', label: 'Site Visit' },
      { value: 'client_meeting', label: 'Client Meeting' },
      { value: 'design_review', label: 'Design Review' },
      { value: 'material_purchase', label: 'Material Purchase' },
      { value: 'follow_up_call', label: 'Follow-up Call' },
      { value: 'other', label: 'Others' },
    ];

    const [formData, setFormData] = useState({
      project_id: editingTask?.project_id || '',
      task_title: editingTask?.title || '',
      task_description: editingTask?.description || '',
      date: editingTask ? new Date(editingTask.start_at).toISOString().slice(0, 10) : getTodayDateString(),
      start_time: editingTask ? new Date(editingTask.start_at).toTimeString().slice(0, 5) : '10:00',
      end_time: editingTask ? new Date(editingTask.end_at).toTimeString().slice(0, 5) : '11:00',
      assigned_to: editingTask?.assigned_to || '',
      priority: (editingTask?.priority || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
      status: (editingTask?.status || 'todo') as 'todo' | 'in_progress' | 'blocked' | 'done',
    });
    const [formError, setFormError] = useState('');
    const [taskTemplate, setTaskTemplate] = useState('');

    // Update form data when editingTask changes
    useEffect(() => {
      if (editingTask) {
        const updatedData = {
          project_id: editingTask?.project_id || '',
          task_title: editingTask?.title || '',
          task_description: editingTask?.description || '',
          date: new Date(editingTask.start_at).toISOString().slice(0, 10),
          start_time: new Date(editingTask.start_at).toTimeString().slice(0, 5),
          end_time: new Date(editingTask.end_at).toTimeString().slice(0, 5),
          assigned_to: editingTask?.assigned_to || '',
          priority: (editingTask?.priority || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
          status: (editingTask?.status || 'todo') as 'todo' | 'in_progress' | 'blocked' | 'done',
        };
        setFormData(updatedData);

        const match = TASK_TEMPLATES.find(t => t.label === (editingTask?.title || ''));
        setTaskTemplate(match ? match.value : 'other');
      }
    }, [editingTask]);

    const handleTemplateChange = (value: string) => {
      setTaskTemplate(value);

      if (value && value !== 'other') {
        const template = TASK_TEMPLATES.find(t => t.value === value);
        setFormData(prev => ({
          ...prev,
          task_title: template ? template.label : '',
        }));
        setFormError('');
      }
      // Don't clear the title when 'other' is selected - let user keep what they typed
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError('');

      if (!formData.task_title) {
        setFormError('Task title is required');
        return;
      }

      const result = await updateTask({
        ...formData,
        step_title: 'General Tasks', // Auto-generate step title
      });

      if (!result.success) {
        setFormError(result.error || 'Failed to update task');
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {formError}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project <span className="text-sm text-gray-500">(Optional for daily tasks)</span>
          </label>
          <select
            value={formData.project_id}
            onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title} - {project.customer_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Task Title *
          </label>
          <div className="space-y-2">
            <select
              value={taskTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            >
              <option value="">Choose a template or enter custom...</option>
              {TASK_TEMPLATES.map((template) => (
                <option key={template.value} value={template.value}>
                  {template.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={formData.task_title}
              onChange={(e) => setFormData({ ...formData, task_title: e.target.value })}
              placeholder="Enter task title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {taskTemplate ? 'Template selected - you can customize the title above' : 'Select a template or enter a custom task title'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'todo' | 'in_progress' | 'blocked' | 'done' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <select
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            >
              {TIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Time
          </label>
          <select
            value={formData.end_time}
            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          >
            {TIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign To
            </label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => setShowEditModal(false)}
            className="flex-1 px-4 py-2 text-gray-700 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updating}
            className="flex-1 px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-600 active:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {updating ? 'Updating...' : 'Update Task'}
          </button>
        </div>
      </form>
    );
  }
}
