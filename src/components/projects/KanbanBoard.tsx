'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDateIST } from '@/lib/dateUtils';

type StageKey = 'false_ceiling' | 'electrical_work' | 'carpenter_works' | 'painting_work' | 'deep_cleaning';

const STAGES: { key: StageKey; label: string }[] = [
  { key: 'false_ceiling', label: 'False Ceiling' },
  { key: 'electrical_work', label: 'Electrical Work' },
  { key: 'carpenter_works', label: 'Carpenter Works' },
  { key: 'painting_work', label: 'Painting Work' },
  { key: 'deep_cleaning', label: 'Deep Cleaning' },
];

type Step = {
  id: string;
  title: string;
  description: string | null;
  stage: StageKey;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
};

export function KanbanBoard({ projectId }: { projectId: string }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step add modal state
  const [addStepStage, setAddStepStage] = useState<StageKey|null>(null);
  const [addStepForm, setAddStepForm] = useState({
    title: '',
    start_date: '',
    end_date: '',
  });
  const [addStepLoading, setAddStepLoading] = useState(false);
  
  // Quick add state for mobile
  const [quickAddStage, setQuickAddStage] = useState<StageKey|null>(null);
  const [quickTaskName, setQuickTaskName] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  const grouped = useMemo(() => {
    const byStage: Record<StageKey, Step[]> = {
      false_ceiling: [],
      electrical_work: [],
      carpenter_works: [],
      painting_work: [],
      deep_cleaning: [],
    };
    steps.forEach(s => byStage[s.stage].push(s));
    Object.values(byStage).forEach(list => list.sort((a, b) => a.sort_order - b.sort_order));
    return byStage;
  }, [steps]);

  useEffect(() => {
    const fetchSteps = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/project-steps?project_id=${projectId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch steps');
        }
        const data = await response.json();
        setSteps(data as Step[]);
      } catch (err: any) {
        console.error('Error fetching steps:', err);
        setError('Failed to load steps');
      } finally {
        setLoading(false);
      }
    };

    fetchSteps();
  }, [projectId]);

  const addStep = async (stageKey: StageKey) => {
    const title = addStepForm.title.trim();
    if (!title) return;
    setAddStepLoading(true);
    try {
      const response = await fetch('/api/project-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          title,
          stage: stageKey,
          start_date: addStepForm.start_date || null,
          end_date: addStepForm.end_date || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create step');
      }

      const data = await response.json();
      setSteps(prev => [...prev, data as Step]);
      setAddStepStage(null);
      setAddStepForm({ title: '', start_date: '', end_date: '' });
    } catch (err) {
      console.error('Error adding step:', err);
      setError('Failed to add step');
    } finally {
      setAddStepLoading(false);
    }
  };

  // Quick add function for mobile - just needs task name
  const quickAddTask = async (stageKey: StageKey) => {
    const title = quickTaskName.trim();
    if (!title) return;
    setQuickAddLoading(true);
    try {
      const response = await fetch('/api/project-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          title,
          stage: stageKey,
          start_date: null,
          end_date: null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      const data = await response.json();
      setSteps(prev => [...prev, data as Step]);
      setQuickAddStage(null);
      setQuickTaskName('');
    } catch (err) {
      console.error('Error adding task:', err);
      setError('Failed to add task');
    } finally {
      setQuickAddLoading(false);
    }
  };

  const updateStepStage = async (stepId: string, stage: StageKey) => {
    try {
      const response = await fetch('/api/project-steps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stepId, stage }),
      });

      if (!response.ok) {
        throw new Error('Failed to update step stage');
      }

      const data = await response.json();
      setSteps(prev => prev.map(s => (s.id === stepId ? (data as Step) : s)));
    } catch (err) {
      console.error('Error updating step stage:', err);
      setError('Failed to update step');
    }
  };

  const updateStepStatus = async (stepId: string, status: Step['status']) => {
    try {
      const response = await fetch('/api/project-steps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stepId, status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update step status');
      }

      const data = await response.json();
      setSteps(prev => prev.map(s => (s.id === stepId ? (data as Step) : s)));
    } catch (err) {
      console.error('Error updating step status:', err);
      setError('Failed to update step');
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-500">Loading board…</div>
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

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
        </div>
      ) : (
        <>
          {/* Mobile View - Accordion Style */}
          <div className="lg:hidden space-y-4">
            {STAGES.map(stage => (
              <div key={stage.key} className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-200 bg-gray-50">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">{stage.label}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm text-gray-500 bg-white px-2 py-1 rounded-full">
                        {grouped[stage.key].length} tasks
                      </span>
                      <button
                        onClick={() => setQuickAddStage(stage.key)}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-xl transition-all duration-200 touch-target"
                        title="Quick Add Task"
                      >
                        + Add Task
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-4 sm:p-5 space-y-3">
                  {grouped[stage.key].length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-sm">No tasks in this stage</p>
                      <button
                        onClick={() => setAddStepStage(stage.key)}
                        className="mt-2 text-yellow-600 hover:text-yellow-700 text-sm font-medium"
                      >
                        Add first task
                      </button>
                    </div>
                  ) : (
                    grouped[stage.key].map((step, index) => (
                      <div key={step.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{step.title}</h4>
                            {step.description && (
                              <p className="text-xs sm:text-sm text-gray-600 mb-2 line-clamp-2">{step.description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                step.status === 'done' ? 'bg-green-100 text-green-700' :
                                step.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                step.status === 'blocked' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {step.status.replace('_', ' ')}
                              </span>
                              {step.start_date && (
                                <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                                  {formatDateIST(step.start_date)}
                                </span>
                              )}
                            </div>
                            <select
                              value={step.status}
                              onChange={(e) => updateStepStatus(step.id, e.target.value as Step['status'])}
                              className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent touch-target"
                            >
                              <option value="todo">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="blocked">Blocked</option>
                              <option value="done">Done</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View - Traditional Kanban */}
          <div className="hidden lg:block overflow-x-auto">
            <div className="flex space-x-6 min-w-max pb-4">
              {STAGES.map(stage => (
                <div key={stage.key} className="w-80 bg-gray-50 rounded-2xl p-4 shadow-card border border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{stage.label}</h3>
                    <button
                      onClick={() => setAddStepStage(stage.key)}
                      className="text-yellow-600 hover:text-yellow-700 text-sm font-medium px-3 py-1 rounded-lg hover:bg-yellow-50 transition-all duration-200"
                    >
                      + Add Step
                    </button>
                  </div>
                  <div className="space-y-3 min-h-96">
                    {grouped[stage.key].map(step => (
                      <div key={step.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
                        <h4 className="font-medium text-gray-900 mb-2">{step.title}</h4>
                        {step.description && (
                          <p className="text-sm text-gray-600 mb-3">{step.description}</p>
                        )}
                        <div className="flex items-center justify-between mb-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            step.status === 'done' ? 'bg-green-100 text-green-700' :
                            step.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            step.status === 'blocked' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {step.status.replace('_', ' ')}
                          </span>
                          {step.start_date && (
                            <span className="text-xs text-gray-500">
                              {formatDateIST(step.start_date)}
                            </span>
                          )}
                        </div>
                        <select
                          value={step.status}
                          onChange={(e) => updateStepStatus(step.id, e.target.value as Step['status'])}
                          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                    ))}
                    {grouped[stage.key].length === 0 && (
                      <div className="text-center py-12 text-gray-400">
                        <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="text-sm">No tasks</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Add Step Modal */}
      {addStepStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !addStepLoading && setAddStepStage(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Task to {STAGES.find(s=>s.key===addStepStage)?.label}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Task Name *</label>
                <input
                  value={addStepForm.title}
                  onChange={e => setAddStepForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent touch-target"
                  placeholder="Enter task name"
                  disabled={addStepLoading}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={addStepForm.start_date}
                    onChange={e => setAddStepForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent touch-target"
                    disabled={addStepLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={addStepForm.end_date}
                    onChange={e => setAddStepForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent touch-target"
                    disabled={addStepLoading}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
              <button
                className="px-6 py-3 text-sm rounded-xl border border-gray-300 hover:bg-gray-50 w-full sm:w-auto touch-target"
                disabled={addStepLoading}
                onClick={()=>setAddStepStage(null)}
              >
                Cancel
              </button>
              <button
                className="px-6 py-3 text-sm rounded-xl bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto touch-target"
                disabled={addStepLoading||!addStepForm.title.trim()}
                onClick={()=>addStep(addStepStage)}
              >
                {addStepLoading ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Task Modal for Mobile */}
      {quickAddStage && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !quickAddLoading && setQuickAddStage(null)}></div>
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Add Task to {STAGES.find(s=>s.key===quickAddStage)?.label}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Task Name</label>
                <input
                  value={quickTaskName}
                  onChange={e => setQuickTaskName(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && quickAddTask(quickAddStage)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-yellow-400 focus:border-transparent touch-target"
                  placeholder="Enter task name and press Enter"
                  disabled={quickAddLoading}
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  className="flex-1 px-4 py-3 text-sm rounded-xl border border-gray-300 hover:bg-gray-50 touch-target"
                  disabled={quickAddLoading}
                  onClick={() => setQuickAddStage(null)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 px-4 py-3 text-sm rounded-xl bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed touch-target"
                  disabled={quickAddLoading || !quickTaskName.trim()}
                  onClick={() => quickAddTask(quickAddStage)}
                >
                  {quickAddLoading ? 'Adding...' : 'Add Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanBoard;


