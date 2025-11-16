'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProfessionalGanttChart from '@/components/ProfessionalGanttChart';
import { FiRefreshCw, FiFilter, FiSearch, FiPlus } from 'react-icons/fi';
import Modal from '@/components/Modal';

type Task = {
  id: string;
  title: string;
  start_date: string | null;
  estimated_completion_date: string | null;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  step: {
    id: string;
    title: string;
    project: {
      id: string;
      title: string;
      customer_name: string;
      status: string;
    };
  } | null;
  assigned_user?: {
    id: string;
    full_name: string;
  } | null;
};

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
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

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/tasks/all', {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();
      setTasks(data.tasks || []);
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
      const response = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
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
      const response = await fetch('/api/tasks/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingTask?.id,
          ...formData,
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
        (task.step && task.step.title.toLowerCase().includes(search)) ||
        (task.step && task.step.project && task.step.project.title.toLowerCase().includes(search)) ||
        (task.step && task.step.project && task.step.project.customer_name.toLowerCase().includes(search))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // Project filter
    if (projectFilter !== 'all') {
      filtered = filtered.filter(task => 
        task.step && task.step.project && task.step.project.id === projectFilter
      );
    }

    setFilteredTasks(filtered);
  }, [tasks, searchTerm, statusFilter, projectFilter]);

  // Get unique projects for filter dropdown
  const uniqueProjects = tasks.reduce((acc, task) => {
    // Handle tasks that might not have a step or project (daily tasks)
    if (task.step && task.step.project) {
      const project = task.step.project;
      if (!acc.find(p => p.id === project.id)) {
        acc.push(project);
      }
    }
    return acc;
  }, [] as Array<{ id: string; title: string; customer_name: string }>);

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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Tasks</h1>
            <p className="text-sm text-gray-600 mt-1">
              View and manage tasks across all your projects
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <FiPlus className="h-4 w-4 mr-2" />
              Create Task
            </button>
            <button
              onClick={fetchTasks}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FiRefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { key: 'all', label: 'Total', color: 'bg-gray-100 text-gray-900' },
          { key: 'todo', label: 'To Do', color: 'bg-gray-100 text-gray-700' },
          { key: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
          { key: 'blocked', label: 'Blocked', color: 'bg-red-100 text-red-700' },
          { key: 'done', label: 'Done', color: 'bg-green-100 text-green-700' },
        ].map(({ key, label, color }) => (
          <div key={key} className={`rounded-lg p-4 ${color}`}>
            <div className="text-2xl font-bold">{statusCounts[key as keyof typeof statusCounts]}</div>
            <div className="text-sm font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks, projects, or customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            >
              <option value="all">All Status</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </div>

          {/* Project Filter */}
          <div className="sm:w-64">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            >
              <option value="all">All Projects</option>
              {uniqueProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title} - {project.customer_name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {(searchTerm || statusFilter !== 'all' || projectFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setProjectFilter('all');
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Results Info */}
        {filteredTasks.length !== tasks.length && (
          <div className="mt-3 text-sm text-gray-600">
            Showing {filteredTasks.length} of {tasks.length} tasks
          </div>
        )}
      </div>

      {/* Professional Gantt Chart */}
      <ProfessionalGanttChart 
        tasks={filteredTasks} 
        loading={loading} 
        onEditTask={handleEditTask}
      />

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
    const [formData, setFormData] = useState({
      project_id: '',
      task_title: '',
      task_description: '',
      start_date: '',
      estimated_completion_date: '',
      assigned_to: '',
      priority: 'medium',
    });
    const [formError, setFormError] = useState('');

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
                <input
                  type="text"
                  value={formData.task_title}
                  onChange={(e) => setFormData({ ...formData, task_title: e.target.value })}
                  placeholder="Enter task title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  required
                />
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
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.estimated_completion_date}
                    onChange={(e) => setFormData({ ...formData, estimated_completion_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
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
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Task'}
                </button>
              </div>
      </form>
    );
  }

  function EditTaskForm() {
    const [formData, setFormData] = useState({
      project_id: editingTask?.step?.project?.id || '',
      task_title: editingTask?.title || '',
      task_description: '',
      start_date: editingTask?.start_date || '',
      estimated_completion_date: editingTask?.estimated_completion_date || '',
      assigned_to: editingTask?.assigned_to || '',
      priority: editingTask?.priority || 'medium' as 'low' | 'medium' | 'high' | 'urgent',
      status: editingTask?.status || 'todo' as 'todo' | 'in_progress' | 'blocked' | 'done',
    });
    const [formError, setFormError] = useState('');

    // Update form data when editingTask changes
    useEffect(() => {
      if (editingTask) {
        setFormData({
          project_id: editingTask?.step?.project?.id || '',
          task_title: editingTask?.title || '',
          task_description: '',
          start_date: editingTask?.start_date || '',
          estimated_completion_date: editingTask?.estimated_completion_date || '',
          assigned_to: editingTask?.assigned_to || '',
          priority: editingTask?.priority || 'medium' as 'low' | 'medium' | 'high' | 'urgent',
          status: editingTask?.status || 'todo' as 'todo' | 'in_progress' | 'blocked' | 'done',
        });
      }
    }, [editingTask]);

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
          <input
            type="text"
            value={formData.task_title}
            onChange={(e) => setFormData({ ...formData, task_title: e.target.value })}
            placeholder="Enter task title"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            required
          />
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
              Start Date
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={formData.estimated_completion_date}
              onChange={(e) => setFormData({ ...formData, estimated_completion_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
          </div>
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
            className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updating ? 'Updating...' : 'Update Task'}
          </button>
        </div>
      </form>
    );
  }
}
