'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDateIST } from '@/lib/dateUtils';
import { FiCalendar, FiClock, FiUser, FiFolder, FiMoreHorizontal, FiEdit, FiCheck, FiX, FiPlay, FiPause } from 'react-icons/fi';

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
};

type ProfessionalGanttChartProps = {
  tasks: Task[];
  loading?: boolean;
};

function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function getStatusColor(status: string) {
  switch (status) {
    case 'todo':
      return 'bg-gray-400';
    case 'in_progress':
      return 'bg-blue-500';
    case 'blocked':
      return 'bg-red-500';
    case 'done':
      return 'bg-green-500';
    default:
      return 'bg-gray-400';
  }
}

function getStatusText(status: string) {
  switch (status) {
    case 'todo':
      return 'To Do';
    case 'in_progress':
      return 'In Progress';
    case 'blocked':
      return 'Blocked';
    case 'done':
      return 'Done';
    default:
      return 'Unknown';
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'low':
      return 'bg-green-100 text-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'urgent':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getPriorityText(priority: string) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function ProfessionalGanttChart({ tasks, loading = false }: ProfessionalGanttChartProps) {
  const [viewMode, setViewMode] = useState<'table' | 'gantt' | 'timeline'>('table');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      // Find the task to get step_id
      const task = tasks.find(t => t.id === taskId);
      
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: taskId,
          status: newStatus,
          step_id: task?.step?.id || null,
        }),
      });

      if (response.ok) {
        console.log('Task status updated successfully');
        // Refresh the page to show updated status
        window.location.reload();
      } else {
        const errorData = await response.json();
        console.error('Failed to update task status:', errorData);
      }
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  // Filter tasks that have dates for Gantt view
  const datedTasks = useMemo(() => {
    return tasks.filter(task => task.start_date && task.estimated_completion_date);
  }, [tasks]);

  const bounds = useMemo(() => {
    if (datedTasks.length === 0) return null;
    
    const dates: Date[] = [];
    datedTasks.forEach(task => {
      if (task.start_date) dates.push(new Date(task.start_date));
      if (task.estimated_completion_date) dates.push(new Date(task.estimated_completion_date));
    });
    
    if (dates.length === 0) return null;
    
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Add some padding
    min.setDate(min.getDate() - 1);
    max.setDate(max.getDate() + 1);
    
    return { min, max };
  }, [datedTasks]);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-500">Loading tasks...</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="p-6 text-center">
        <FiCalendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
        <p className="text-sm text-gray-500">Tasks will appear here once they are created.</p>
      </div>
    );
  }

  const totalDays = bounds ? Math.max(1, daysBetween(bounds.min, bounds.max)) : 1;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header with view toggle */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Project Tasks</h2>
            <p className="text-sm text-gray-500">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} total
              {datedTasks.length > 0 && datedTasks.length !== tasks.length && 
                `, ${datedTasks.length} with dates`
              }
            </p>
          </div>
          
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'gantt'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Gantt Chart
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Timeline
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-x-auto">
        {viewMode === 'table' ? (
          // Table View (like the reference image)
          <div className="min-w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{task.title}</div>
                          {task.step && task.step.project && (
                            <div className="text-sm text-gray-500">{task.step.title}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)} text-white`}>
                        {getStatusText(task.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {task.start_date ? formatDateIST(task.start_date) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {task.estimated_completion_date ? formatDateIST(task.estimated_completion_date) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {getPriorityText(task.priority)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {task.step && task.step.project ? (
                        <div>
                          <div className="font-medium">{task.step.project.title}</div>
                          <div className="text-gray-500">{task.step.project.customer_name}</div>
                        </div>
                      ) : (
                        <span className="italic text-gray-500">Daily Task</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {task.status !== 'done' && (
                          <button
                            onClick={() => updateTaskStatus(task.id, 'done')}
                            className="text-green-600 hover:text-green-800"
                            title="Mark as Done"
                          >
                            <FiCheck className="h-4 w-4" />
                          </button>
                        )}
                        {task.status === 'todo' && (
                          <button
                            onClick={() => updateTaskStatus(task.id, 'in_progress')}
                            className="text-blue-600 hover:text-blue-800"
                            title="Start Task"
                          >
                            <FiPlay className="h-4 w-4" />
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <button
                            onClick={() => updateTaskStatus(task.id, 'todo')}
                            className="text-yellow-600 hover:text-yellow-800"
                            title="Pause Task"
                          >
                            <FiPause className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          className="text-gray-400 hover:text-gray-600"
                          title="Edit Task"
                        >
                          <FiEdit className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'gantt' ? (
          // Gantt Chart View
          <div className="p-4">
            {!bounds || datedTasks.length === 0 ? (
              <div className="text-center py-8">
                <FiCalendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No tasks with dates for Gantt view</p>
                <p className="text-xs text-gray-400 mt-1">Switch to Table View to see all tasks</p>
              </div>
            ) : (
              <div className="min-w-[800px]">
                {/* Timeline header */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Timeline: {formatDateIST(bounds.min.toISOString())} - {formatDateIST(bounds.max.toISOString())}</span>
                    <span>{totalDays} days</span>
                  </div>
                </div>

                {/* Gantt chart */}
                <div className="space-y-3">
                  {datedTasks.map((task) => {
                    const startDate = new Date(task.start_date!);
                    const endDate = new Date(task.estimated_completion_date!);
                    const offsetDays = Math.max(0, daysBetween(bounds.min, startDate) - 1);
                    const durationDays = Math.max(1, daysBetween(startDate, endDate));
                    const leftPct = (offsetDays / totalDays) * 100;
                    const widthPct = Math.max(2, (durationDays / totalDays) * 100);

                    return (
                      <div key={task.id} className="border border-gray-200 rounded-lg p-3">
                        {/* Task info */}
                        <div className="mb-3">
                          <div className="flex items-start justify-between mb-1">
                            <h3 className="font-medium text-gray-900 text-sm">{task.title}</h3>
                            <div className="flex gap-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                                {getPriorityText(task.priority)}
                              </span>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(task.status)}`}>
                                {getStatusText(task.status)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-600">
                            {task.step && task.step.project ? (
                              <>
                                <span className="font-medium">{task.step.project.title}</span>
                                <span className="mx-1">•</span>
                                <span>{task.step.title}</span>
                              </>
                            ) : (
                              <span className="italic text-gray-500">Daily Task</span>
                            )}
                          </div>
                        </div>

                        {/* Timeline bar */}
                        <div className="relative">
                          <div className="h-6 bg-gray-100 rounded-md relative overflow-hidden">
                            <div
                              className={`absolute top-0 h-full rounded-md flex items-center px-2 text-white text-xs font-medium ${getStatusColor(task.status)}`}
                              style={{ 
                                left: `${leftPct}%`, 
                                width: `${widthPct}%`,
                                minWidth: '20px'
                              }}
                              title={`${task.title} (${durationDays} day${durationDays !== 1 ? 's' : ''})`}
                            >
                              <span className="truncate">
                                {durationDays}d
                              </span>
                            </div>
                          </div>
                          
                          {/* Date labels */}
                          <div className="flex justify-between mt-1 text-xs text-gray-500">
                            <span>{formatDateIST(task.start_date!)}</span>
                            <span>{formatDateIST(task.estimated_completion_date!)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Timeline View (like the reference image)
          <div className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Today's Tasks */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Tasks</h3>
                <div className="space-y-3">
                  {tasks.filter(task => {
                    const today = new Date().toISOString().split('T')[0];
                    return task.start_date === today || task.estimated_completion_date === today;
                  }).map((task) => (
                    <div key={task.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{task.title}</h4>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {getPriorityText(task.priority)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(task.status)}`}>
                          {getStatusText(task.status)}
                        </span>
                        <div className="flex items-center gap-2">
                          {task.status !== 'done' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'done')}
                              className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                              title="Mark as Done"
                            >
                              <FiCheck className="h-4 w-4" />
                            </button>
                          )}
                          {task.status === 'todo' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'in_progress')}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                              title="Start Task"
                            >
                              <FiPlay className="h-4 w-4" />
                            </button>
                          )}
                          {task.status === 'in_progress' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'todo')}
                              className="text-yellow-600 hover:text-yellow-800 p-1 rounded hover:bg-yellow-50"
                              title="Pause Task"
                            >
                              <FiPause className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calendar Timeline */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
                <div className="bg-gray-50 rounded-lg p-4 h-96 overflow-y-auto">
                  {datedTasks.map((task) => {
                    const startDate = task.start_date ? new Date(task.start_date) : null;
                    const endDate = task.estimated_completion_date ? new Date(task.estimated_completion_date) : null;
                    
                    return (
                      <div key={task.id} className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900 text-sm">{task.title}</h4>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                            {getPriorityText(task.priority)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mb-2">
                          {startDate && endDate && (
                            <div className="flex items-center gap-2">
                              <FiCalendar className="h-3 w-3" />
                              <span>{formatDateIST(task.start_date!)} - {formatDateIST(task.estimated_completion_date!)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(task.status)}`}>
                            {getStatusText(task.status)}
                          </span>
                          <div className="flex items-center gap-1">
                            {task.status !== 'done' && (
                              <button
                                onClick={() => updateTaskStatus(task.id, 'done')}
                                className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                                title="Mark as Done"
                              >
                                <FiCheck className="h-3 w-3" />
                              </button>
                            )}
                            {task.status === 'todo' && (
                              <button
                                onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                                title="Start Task"
                              >
                                <FiPlay className="h-3 w-3" />
                              </button>
                            )}
                            {task.status === 'in_progress' && (
                              <button
                                onClick={() => updateTaskStatus(task.id, 'todo')}
                                className="text-yellow-600 hover:text-yellow-800 p-1 rounded hover:bg-yellow-50"
                                title="Pause Task"
                              >
                                <FiPause className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfessionalGanttChart;
