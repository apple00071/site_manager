'use client';

import { useEffect, useState } from 'react';
import { formatDateIST } from '@/lib/dateUtils';
import { SidePanel } from '@/components/ui/SidePanel';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { FiPlus } from 'react-icons/fi';

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTaskForm, setAddTaskForm] = useState({
    stage: 'false_ceiling' as StageKey,
    start_date: '',
    end_date: '',
    worker_name: '',
    worker_number: '',
  });
  const [addTaskLoading, setAddTaskLoading] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Group tasks by status
  const groupedByStatus = {
    todo: tasks.filter(t => t.status === 'todo'),
    progress: tasks.filter(t => t.status === 'progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching tasks for project:', projectId);
      const response = await fetch(`/api/project-steps?project_id=${projectId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      console.log('Raw response text:', text);

      if (!text) {
        console.log('Empty response, setting empty tasks');
        setTasks([]);
        return;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        console.error('Response text was:', text);
        setError('Invalid response from server');
        setTasks([]);
        return;
      }

      console.log('Parsed data:', data);
      console.log('Data type:', typeof data);
      console.log('Is data an array?', Array.isArray(data));

      // Handle different response formats
      let stepsArray = [];
      if (data && typeof data === 'object') {
        if (Array.isArray(data)) {
          stepsArray = data;
        } else if ('steps' in data && Array.isArray(data.steps)) {
          stepsArray = data.steps;
        } else if ('error' in data) {
          console.error('API returned error:', data.error);
          setError(data.error);
          setTasks([]);
          return;
        } else {
          console.error('Unknown response format:', data);
          setTasks([]);
          return;
        }
      } else {
        console.error('Data is not an object:', data);
        setTasks([]);
        return;
      }

      console.log('Final steps array:', stepsArray);

      if (stepsArray.length === 0) {
        setTasks([]);
        return;
      }

      // Map the tasks with explicit error handling
      const formattedTasks = stepsArray.map((item: any) => {
        if (!item || typeof item !== 'object') {
          console.error('Invalid item in array:', item);
          return null;
        }

        return {
          id: item.id || '',
          title: item.title || '',
          description: item.description || null,
          stage: item.stage || 'general',
          status: (item.status === 'done' ? 'completed' :
            item.status === 'in_progress' ? 'progress' : 'todo') as TaskStatus,
          start_date: item.start_date || null,
          end_date: item.end_date || null,
          worker_name: item.worker_name || '',
          worker_number: item.worker_number || '',
          sort_order: item.sort_order || 0
        };
      }).filter(Boolean); // Remove any null items

      console.log('Formatted tasks:', formattedTasks);
      setTasks(formattedTasks);

    } catch (error) {
      console.error('Complete error in fetchTasks:', error);
      setError('Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async () => {
    // Use the stage label as the title
    const stageLabel = STAGES.find(s => s.key === addTaskForm.stage)?.label || '';

    setAddTaskLoading(true);
    try {
      const response = await fetch('/api/project-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          title: stageLabel,
          // Remove stage field since it doesn't exist in database
          status: 'todo',
          start_date: addTaskForm.start_date || null,
          end_date: addTaskForm.end_date || null,
          worker_name: addTaskForm.worker_name || null,
          worker_number: addTaskForm.worker_number || null,
        }),
      });
      if (!response.ok) {
        let errorBody: any = null;
        try {
          const text = await response.text();
          try {
            errorBody = JSON.parse(text);
          } catch {
            errorBody = text;
          }
        } catch {
          // ignore parse errors
        }
        console.error('Add task failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
        });
        throw new Error('Failed to add task');
      }

      await fetchTasks();
      setShowAddModal(false);
      setAddTaskForm({
        stage: 'false_ceiling',
        start_date: '',
        end_date: '',
        worker_name: '',
        worker_number: '',
      });
    } catch (err: any) {
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
        body: JSON.stringify({
          id: taskId,
          status: apiStatus,
        }),
      });

      if (!response.ok) throw new Error('Failed to update task');
      await fetchTasks();
    } catch (err: any) {
      console.error('Error updating task:', err);
      setError('Failed to update task status');
    }
  };

  const onDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    if (draggedTaskId) {
      updateTaskStatus(draggedTaskId, newStatus);
      setDraggedTaskId(null);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading tasks…</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="bg-white shadow sm:rounded-lg">
      {/* Kanban Columns - Desktop */}
      <div className="hidden lg:block p-3">
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-600 text-xs font-medium flex items-center gap-1.5 transition-all duration-200"
          >
            <FiPlus className="w-3.5 h-3.5" />
            Add Task
          </button>
        </div>
        <div className="flex gap-4">
          {(['todo', 'progress', 'completed'] as TaskStatus[]).map(status => (
            <div
              key={status}
              className="flex-1 bg-gray-50 rounded-2xl p-5 shadow-sm border border-gray-200"
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, status)}
            >
              {/* Column Header */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 capitalize">
                  {status === 'progress' ? 'In Progress' : status}
                </h3>
                <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded-full">
                  {groupedByStatus[status].length}
                </span>
              </div>

              {/* Tasks */}
              <div className="space-y-3">
                {groupedByStatus[status].map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, task.id)}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all cursor-move"
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

                {/* Empty State */}
                {groupedByStatus[status].length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-sm">No {status} tasks</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile View */}
      <div className="lg:hidden space-y-4">
        {tasks.map(task => (
          <div key={task.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">{task.title}</h4>
                <p className="text-sm text-gray-600">{STAGES.find(s => s.key === task.stage)?.label}</p>
              </div>
              <select
                value={task.status}
                onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1"
              >
                <option value="todo">Todo</option>
                <option value="progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            {task.worker_name && (
              <div className="text-xs text-gray-500">Worker: {task.worker_name}</div>
            )}
          </div>
        ))}
      </div>

      {/* Add Task Form Content */}
      {(() => {
        const formContent = (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage *</label>
              <select
                value={addTaskForm.stage}
                onChange={(e) => setAddTaskForm({ ...addTaskForm, stage: e.target.value as StageKey })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              >
                {STAGES.map(stage => (
                  <option key={stage.key} value={stage.key}>{stage.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={addTaskForm.start_date}
                  onChange={(e) => setAddTaskForm({ ...addTaskForm, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={addTaskForm.end_date}
                  onChange={(e) => setAddTaskForm({ ...addTaskForm, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Worker Name</label>
              <input
                type="text"
                value={addTaskForm.worker_name}
                onChange={(e) => setAddTaskForm({ ...addTaskForm, worker_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Worker Phone Number</label>
              <input
                type="tel"
                value={addTaskForm.worker_number}
                onChange={(e) => setAddTaskForm({ ...addTaskForm, worker_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder="Optional"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addTask}
                disabled={addTaskLoading}
                className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {addTaskLoading ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </div>
        );

        return (
          <>
            {/* Desktop Side Panel */}
            <SidePanel
              isOpen={showAddModal && !isMobile}
              onClose={() => setShowAddModal(false)}
              title="Add New Task"
            >
              {formContent}
            </SidePanel>

            {/* Mobile Bottom Sheet */}
            <BottomSheet
              isOpen={showAddModal && isMobile}
              onClose={() => setShowAddModal(false)}
              title="Add New Task"
            >
              {formContent}
            </BottomSheet>
          </>
        );
      })()}
    </div>
  );
}
