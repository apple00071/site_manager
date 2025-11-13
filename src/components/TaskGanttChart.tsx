'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDateIST } from '@/lib/dateUtils';
import { FiCalendar, FiClock, FiUser, FiFolder } from 'react-icons/fi';

type Task = {
  id: string;
  title: string;
  start_date: string | null;
  estimated_completion_date: string | null;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
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
  };
};

type TaskGanttChartProps = {
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

export function TaskGanttChart({ tasks, loading = false }: TaskGanttChartProps) {
  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
            <h2 className="text-lg font-semibold text-gray-900">Task Timeline</h2>
            <p className="text-sm text-gray-500">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} total
              {datedTasks.length > 0 && datedTasks.length !== tasks.length && 
                `, ${datedTasks.length} with dates`
              }
            </p>
          </div>
          
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'gantt'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Gantt View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              List View
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {viewMode === 'list' || !bounds || datedTasks.length === 0 ? (
          // List View (mobile-friendly fallback)
          <div className="space-y-4">
            {datedTasks.length === 0 && viewMode === 'gantt' && (
              <div className="text-center py-8">
                <FiCalendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No tasks with dates for Gantt view</p>
                <p className="text-xs text-gray-400 mt-1">Switch to List View to see all tasks</p>
              </div>
            )}
            
            {(viewMode === 'list' ? tasks : []).map((task) => (
              <div key={task.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900 text-sm">{task.title}</h3>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(task.status)}`}>
                    {getStatusText(task.status)}
                  </span>
                </div>
                
                <div className="space-y-2 text-xs text-gray-600">
                  {task.step && task.step.project ? (
                    <>
                      <div className="flex items-center gap-2">
                        <FiFolder className="h-3 w-3" />
                        <span>{task.step.project.title}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <FiUser className="h-3 w-3" />
                        <span>{task.step.project.customer_name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Step:</span>
                        <span>{task.step.title}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FiFolder className="h-3 w-3" />
                      <span className="italic text-gray-500">Daily Task</span>
                    </div>
                  )}
                  
                  {task.start_date && (
                    <div className="flex items-center gap-2">
                      <FiCalendar className="h-3 w-3" />
                      <span>Start: {formatDateIST(task.start_date)}</span>
                    </div>
                  )}
                  
                  {task.estimated_completion_date && (
                    <div className="flex items-center gap-2">
                      <FiClock className="h-3 w-3" />
                      <span>Due: {formatDateIST(task.estimated_completion_date)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Gantt View
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
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
                  const widthPct = Math.max(2, (durationDays / totalDays) * 100); // Minimum 2% width

                  return (
                    <div key={task.id} className="border border-gray-200 rounded-lg p-3">
                      {/* Task info */}
                      <div className="mb-3">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-medium text-gray-900 text-sm">{task.title}</h3>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(task.status)}`}>
                            {getStatusText(task.status)}
                          </span>
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
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskGanttChart;
