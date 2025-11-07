'use client';

import { useEffect, useState } from 'react';
import { formatDateIST } from '@/lib/dateUtils';

type StageKey = 'false_ceiling' | 'electrical_work' | 'carpenter_works' | 'painting_work' | 'deep_cleaning';

const STAGES: { key: StageKey; label: string }[] = [
  { key: 'false_ceiling', label: 'False Ceiling' },
  { key: 'electrical_work', label: 'Electrical Work' },
  { key: 'carpenter_works', label: 'Carpenter Works' },
  { key: 'painting_work', label: 'Painting Work' },
  { key: 'deep_cleaning', label: 'Deep Cleaning' },
];

type TaskStatus = 'todo' | 'progress' | 'completed';

type Task = {
  id: string;
  title: string;
  description: string | null;
  stage: StageKey;
  status: TaskStatus;
  start_date: string | null;
  end_date: string | null;
  worker_name?: string;
  worker_number?: string;
  sort_order: number;
};

export function KanbanBoard({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add task modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTaskForm, setAddTaskForm] = useState({
    title: '',
    stage: 'false_ceiling' as StageKey,
    start_date: '',
    end_date: '',
    worker_name: '',
    worker_number: '',
  });
  const [addTaskLoading, setAddTaskLoading] = useState(false);

  // Group tasks by status for display
  const groupedByStatus = {
    todo: tasks.filter(t => t.status === 'todo'),
    progress: tasks.filter(t => t.status === 'progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/project-steps?project_id=${projectId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch tasks');
        }
        const data = await response.json();
        // Convert API response to our Task format
        const formattedTasks = data.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          stage: item.stage,
          status: item.status === 'done' ? 'completed' : 
                  item.status === 'in_progress' ? 'progress' : 'todo',
          start_date: item.start_date,
          end_date: item.end_date,
          worker_name: item.worker_name || '',
          worker_number: item.worker_number || '',
          sort_order: item.sort_order || 0
        }));
        setTasks(formattedTasks);
      } catch (err: any) {
        console.error('Error fetching tasks:', err);
        setError('Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [projectId]);

  const addTask = async () => {
    const title = addTaskForm.title.trim();
    if (!title) return;
    setAddTaskLoading(true);
    try {
      const response = await fetch('/api/project-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          title,
          stage: addTaskForm.stage,
          start_date: addTaskForm.start_date || null,
          end_date: addTaskForm.end_date || null,
          worker_name: addTaskForm.worker_name || null,
          worker_number: addTaskForm.worker_number || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      const data = await response.json();
      const newTask: Task = {
        id: data.id,
        title: data.title,
        description: data.description,
        stage: data.stage,
        status: 'todo',
        start_date: data.start_date,
        end_date: data.end_date,
        worker_name: addTaskForm.worker_name,
        worker_number: addTaskForm.worker_number,
        sort_order: data.sort_order || 0
      };
      setTasks(prev => [...prev, newTask]);
      setShowAddModal(false);
      setAddTaskForm({
        title: '',
        stage: 'false_ceiling',
        start_date: '',
        end_date: '',
        worker_name: '',
        worker_number: '',
      });
    } catch (err) {
      console.error('Error adding task:', err);
      setError('Failed to add task');
    } finally {
      setAddTaskLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const apiStatus = newStatus === 'completed' ? 'done' : 
                       newStatus === 'progress' ? 'in_progress' : 'todo';
      
      const response = await fetch('/api/project-steps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: apiStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task status');
      }

      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
    } catch (err) {
      console.error('Error updating task status:', err);
      setError('Failed to update task');
    }
  };

  const onDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    updateTaskStatus(taskId, newStatus);
  };

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-500">Loading tasks…</div>
    );
  }
  if (error) {
    return (
      <div className="p-4 text-sm text-red-600">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Add Task Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Project Tasks</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-medium rounded-xl transition-all duration-200 touch-target"
        >
          + Add Task
        </button>
      </div>

      {/* Desktop View - Drag and Drop Columns */}
      <div className="hidden lg:block overflow-x-auto">
        <div className="flex space-x-6 min-w-max pb-4">
          {(['todo', 'progress', 'completed'] as TaskStatus[]).map(status => (
            <div 
              key={status}
              className="w-80 bg-gray-50 rounded-2xl p-4 shadow-card border border-gray-100"
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, status)}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 capitalize">
                  {status === 'progress' ? 'In Progress' : status}
                </h3>
                <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded-full">
                  {groupedByStatus[status].length} tasks
                </span>
              </div>
              <div className="space-y-3 min-h-96">
                {groupedByStatus[status].map(task => (
                  <div 
                    key={task.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, task.id)}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 cursor-move"
                  >
                    <h4 className="font-medium text-gray-900 mb-2">{task.title}</h4>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">{STAGES.find(s => s.key === task.stage)?.label}</span>
                    </div>
                    {task.worker_name && (
                      <div className="text-xs text-gray-500 mb-2">
                        Worker: {task.worker_name}
                      </div>
                    )}
                    {task.start_date && (
                      <div className="text-xs text-gray-500">
                        Start: {formatDateIST(task.start_date)}
                      </div>
                    )}
                  </div>
                ))}
                {groupedByStatus[status].length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-sm">No {status} tasks</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile View - Simple List with Status Dropdowns */}
      <div className="lg:hidden space-y-4">
        {tasks.map((task, index) => (
          <div key={task.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{task.title}</h4>
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">{STAGES.find(s => s.key === task.stage)?.label}</span>
                </div>
                {task.worker_name && (
                  <div className="text-xs text-gray-500 mb-2">
                    Worker: {task.worker_name}
                  </div>
                )}
                {task.start_date && (
                  <div className="text-xs text-gray-500 mb-2">
                    Start: {formatDateIST(task.start_date)}
                  </div>
                )}
              </div>
            </div>
            <select
              value={task.status}
              onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
              className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent touch-target"
            >
              <option value="todo">To Do</option>
              <option value="progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No tasks yet. Add your first task!</p>
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !addTaskLoading && setShowAddModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Task</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Task Name *</label>
                <input
                  value={addTaskForm.title}
                  onChange={e => setAddTaskForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent touch-target"
                  placeholder="Enter task name"
                  disabled={addTaskLoading}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stage *</label>
                <select
                  value={addTaskForm.stage}
                  onChange={e => setAddTaskForm(f => ({ ...f, stage: e.target.value as StageKey }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent touch-target"
                  disabled={addTaskLoading}
                >
                  {STAGES.map(stage => (
                    <option key={stage.key} value={stage.key}>{stage.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={addTaskForm.start_date}
                    onChange={e => setAddTaskForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent touch-target"
                    disabled={addTaskLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Completion</label>
                  <input
                    type="date"
                    value={addTaskForm.end_date}
                    onChange={e => setAddTaskForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent touch-target"
                    disabled={addTaskLoading}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Worker Name</label>
                  <input
                    value={addTaskForm.worker_name}
                    onChange={e => setAddTaskForm(f => ({ ...f, worker_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent touch-target"
                    placeholder="Enter worker name"
                    disabled={addTaskLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Worker Number</label>
                  <input
                    value={addTaskForm.worker_number}
                    onChange={e => setAddTaskForm(f => ({ ...f, worker_number: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent touch-target"
                    placeholder="Enter worker number"
                    disabled={addTaskLoading}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                className="px-6 py-3 text-sm rounded-xl border border-gray-300 hover:bg-gray-50 w-full sm:w-auto touch-target"
                disabled={addTaskLoading}
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-6 py-3 text-sm rounded-xl bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto touch-target"
                disabled={addTaskLoading || !addTaskForm.title.trim()}
                onClick={addTask}
              >
                {addTaskLoading ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanBoard;
