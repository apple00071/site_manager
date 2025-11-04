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
    <div className="mt-4 md:mt-6">
      {/* Mobile: Horizontal scrolling stages, Desktop: Grid layout */}
      <div className="md:hidden overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max px-1">
          {STAGES.map(stage => (
            <div key={stage.key} className="bg-gray-50 rounded-lg border border-gray-200 w-72 flex-shrink-0">
              {/* Stage Header */}
              <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200 rounded-t-lg">
                <span className="font-semibold text-sm text-gray-800">{stage.label}</span>
                <button
                  className="p-1 rounded hover:bg-yellow-50 text-yellow-600 hover:text-yellow-700 text-xs font-medium flex items-center gap-1"
                  onClick={() => { setAddStepStage(stage.key); setAddStepForm({ title: '', start_date: '', end_date: '' }); }}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeWidth="2" d="M12 6v12m6-6H6"/>
                  </svg>
                  Add
                </button>
              </div>

              {/* Tasks Container */}
              <div className="p-3 space-y-2 min-h-[200px]">
                {grouped[stage.key].length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-8">No tasks yet</div>
                ) : (
                  grouped[stage.key].map(step => (
                    <div key={step.id} className="bg-white rounded-md border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">{step.title}</h4>
                      {(step.start_date || step.end_date) && (
                        <div className="text-xs text-gray-600 mb-2 space-y-1">
                          {step.start_date && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">Start:</span>
                              <span>{formatDateIST(step.start_date)}</span>
                            </div>
                          )}
                          {step.end_date && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">Due:</span>
                              <span>{formatDateIST(step.end_date)}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <select
                        value={step.status}
                        onChange={(e) => updateStepStatus(step.id, e.target.value as Step['status'])}
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: Grid layout */}
      <div className="hidden md:grid grid-cols-3 lg:grid-cols-5 gap-4">
        {STAGES.map(stage => (
          <div key={stage.key} className="bg-gray-50 rounded-lg border border-gray-200">
            {/* Stage Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200 rounded-t-lg">
              <span className="font-semibold text-sm text-gray-800">{stage.label}</span>
              <button
                className="p-1 rounded hover:bg-yellow-50 text-yellow-600 hover:text-yellow-700 text-xs font-medium flex items-center gap-1"
                onClick={() => { setAddStepStage(stage.key); setAddStepForm({ title: '', start_date: '', end_date: '' }); }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeWidth="2" d="M12 6v12m6-6H6"/>
                </svg>
                Add Task
              </button>
            </div>

            {/* Tasks Container */}
            <div className="p-3 space-y-2 min-h-[200px]">
              {grouped[stage.key].length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-8">No tasks yet</div>
              ) : (
                grouped[stage.key].map(step => (
                  <div key={step.id} className="bg-white rounded-md border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">{step.title}</h4>
                    {(step.start_date || step.end_date) && (
                      <div className="text-xs text-gray-600 mb-2 space-y-1">
                        {step.start_date && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Start:</span>
                            <span>{formatDateIST(step.start_date)}</span>
                          </div>
                        )}
                        {step.end_date && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Due:</span>
                            <span>{formatDateIST(step.end_date)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <select
                      value={step.status}
                      onChange={(e) => updateStepStatus(step.id, e.target.value as Step['status'])}
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      {addStepStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !addStepLoading && setAddStepStage(null)}></div>
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-4 md:p-6 max-h-screen overflow-y-auto">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">
              Add Task to {STAGES.find(s=>s.key===addStepStage)?.label}
            </h3>
            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Name *</label>
                <input
                  value={addStepForm.title}
                  onChange={e => setAddStepForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  placeholder="Enter task name"
                  disabled={addStepLoading}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={addStepForm.start_date}
                    onChange={e => setAddStepForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    disabled={addStepLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated End Date</label>
                  <input
                    type="date"
                    value={addStepForm.end_date}
                    onChange={e => setAddStepForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    disabled={addStepLoading}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4 md:mt-6">
              <button
                className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 w-full sm:w-auto"
                disabled={addStepLoading}
                onClick={()=>setAddStepStage(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm rounded-md bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                disabled={addStepLoading||!addStepForm.title.trim()}
                onClick={()=>addStep(addStepStage)}
              >
                {addStepLoading ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanBoard;


