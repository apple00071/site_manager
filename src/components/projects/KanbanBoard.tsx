'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

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
  const [newStep, setNewStep] = useState<{ title: string; stage: StageKey }>(
    { title: '', stage: 'false_ceiling' }
  );

  // Step add modal state
  const [addStepStage, setAddStepStage] = useState<StageKey|null>(null);
  const [addStepTitle, setAddStepTitle] = useState('');
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
      const { data, error } = await supabase
        .from('project_steps')
        .select('*')
        .eq('project_id', projectId)
        .order('stage')
        .order('sort_order');
      if (error) {
        setError('Failed to load steps');
      } else {
        setSteps((data as any[]) as Step[]);
      }
      setLoading(false);
    };

    fetchSteps();
  }, [projectId]);

  const addStep = async (stageKey: StageKey) => {
    const title = addStepTitle.trim();
    if (!title) return;
    setAddStepLoading(true);
    const { data: maxData } = await supabase
      .from('project_steps')
      .select('sort_order')
      .eq('project_id', projectId)
      .eq('stage', stageKey)
      .order('sort_order', { ascending: false })
      .limit(1);
    const nextOrder = (maxData?.[0]?.sort_order ?? -1) + 1;
    const { data, error } = await supabase
      .from('project_steps')
      .insert({
        project_id: projectId,
        title,
        description: null,
        stage: stageKey,
        status: 'todo',
        sort_order: nextOrder,
      })
      .select('*')
      .single();
    setAddStepLoading(false);
    if (!error && data) {
      setSteps(prev => [...prev, data as Step]);
      setAddStepStage(null); setAddStepTitle('');
    }
  };

  const updateStepStage = async (stepId: string, stage: StageKey) => {
    const { data, error } = await supabase
      .from('project_steps')
      .update({ stage })
      .eq('id', stepId)
      .select('*')
      .single();
    if (!error && data) {
      setSteps(prev => prev.map(s => (s.id === stepId ? (data as Step) : s)));
    }
  };

  const updateStepStatus = async (stepId: string, status: Step['status']) => {
    const { data, error } = await supabase
      .from('project_steps')
      .update({ status })
      .eq('id', stepId)
      .select('*')
      .single();
    if (!error && data) {
      setSteps(prev => prev.map(s => (s.id === stepId ? (data as Step) : s)));
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
    <div className="mt-6">
      {/* Add Task button in each column */}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STAGES.map(stage => (
          <div key={stage.key} className="bg-white rounded-lg border shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b font-semibold text-sm text-gray-800">
              <span>{stage.label}</span>
              <button className="p-1 rounded hover:bg-yellow-100 text-yellow-600 hover:text-yellow-700 text-xs font-medium flex items-center gap-1" onClick={() => { setAddStepStage(stage.key); setAddStepTitle(''); }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" d="M12 6v12m6-6H6"/></svg> Add Task
              </button>
            </div>
            <div className="p-4 space-y-3 min-h-24">
              {grouped[stage.key].map(step => (
                <div key={step.id} className="bg-gray-50 rounded-md border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-semibold text-gray-900">{step.title}</div>
                    {step.description && (
                      <div className="text-xs text-gray-600 mt-1">{step.description}</div>
                    )}
                  </div>
                  <TaskList stepId={step.id} />
                  <div className="flex items-center justify-between mt-3">
                    <select
                      className="text-xs border rounded px-2 py-1 bg-white"
                      value={step.status}
                      onChange={e => updateStepStatus(step.id, e.target.value as Step['status'])}
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                    </select>
                    <select
                      className="text-xs border rounded px-2 py-1 bg-white"
                      value={step.stage}
                      onChange={e => updateStepStage(step.id, e.target.value as StageKey)}
                    >
                      {STAGES.map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              {grouped[stage.key].length === 0 && (
                <div className="text-xs text-gray-500">No steps</div>
              )}
            </div>
          </div>
        ))}
      </div>
      {addStepStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !addStepLoading && setAddStepStage(null)}></div>
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-5">
            <div className="text-sm font-semibold text-gray-900 mb-3">Add Task – {STAGES.find(s=>s.key===addStepStage)?.label}</div>
            <input value={addStepTitle} onChange={e => setAddStepTitle(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm mb-4" placeholder="Task name" disabled={addStepLoading} autoFocus />
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 text-sm rounded-md border" disabled={addStepLoading} onClick={()=>setAddStepStage(null)}>Cancel</button>
              <button className="px-4 py-2 text-sm rounded-md bg-yellow-500 text-gray-900 font-bold disabled:opacity-60" disabled={addStepLoading||!addStepTitle.trim()} onClick={()=>addStep(addStepStage)}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Task = {
  id: string;
  title: string;
  start_date: string | null;
  estimated_completion_date: string | null;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
};

function TaskList({ stepId }: { stepId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', start: '', end: '', status: 'todo' as Task['status'] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      const { data } = await supabase
        .from('project_step_tasks')
        .select('*')
        .eq('step_id', stepId)
        .order('created_at', { ascending: true });
      setTasks(((data as any[]) || []) as Task[]);
    };
    fetchTasks();
  }, [stepId]);

  const createTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('project_step_tasks')
      .insert({
        step_id: stepId,
        title: form.title.trim(),
        start_date: form.start || null,
        estimated_completion_date: form.end || null,
        status: form.status,
      })
      .select('*')
      .single();
    setSaving(false);
    if (!error && data) {
      setTasks(prev => [...prev, data as Task]);
      setOpen(false);
      setForm({ title: '', start: '', end: '', status: 'todo' });
    }
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-600">Subtasks ({tasks.length})</div>
        <button className="text-xs bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 text-yellow-700 px-2 py-1 rounded shadow-sm font-medium ml-2" onClick={() => setOpen(true)}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" className="inline-block align-middle mr-1"><path stroke="currentColor" strokeWidth="2" d="M12 6v12m6-6H6"/></svg> Add Subtask
        </button>
      </div>
      {tasks.length > 0 && (
        <ul className="mt-2 space-y-1">
          {tasks.map(t => (
            <li key={t.id} className="text-xs text-gray-700 flex items-center justify-between">
              <span className="truncate mr-2">{t.title}</span>
              <span className="text-[10px] text-gray-500">{t.status.replace('_',' ')}</span>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setOpen(false)}></div>
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-5">
            <div className="text-sm font-semibold text-gray-900 mb-3">Add Task</div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Name</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start date</label>
                  <input type="date" className="w-full border rounded-md px-3 py-2 text-sm" value={form.start} onChange={e => setForm(f => ({...f, start: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Estimated completion</label>
                  <input type="date" className="w-full border rounded-md px-3 py-2 text-sm" value={form.end} onChange={e => setForm(f => ({...f, end: e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Status</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as Task['status']}))}>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-2 text-sm rounded-md border" disabled={saving} onClick={() => setOpen(false)}>Cancel</button>
              <button className="px-4 py-2 text-sm rounded-md bg-yellow-500 text-gray-900 font-bold disabled:opacity-60" disabled={saving} onClick={createTask}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanBoard;


