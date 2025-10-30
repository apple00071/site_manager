'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Step = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
};

function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function GanttView({ projectId }: { projectId: string }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSteps = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('project_steps')
        .select('id,title,start_date,end_date')
        .eq('project_id', projectId)
        .order('start_date', { ascending: true });
      if (error) setError('Failed to load timeline');
      else setSteps((data as any[]) as Step[]);
      setLoading(false);
    };
    fetchSteps();
  }, [projectId]);

  const bounds = useMemo(() => {
    const dates: Date[] = [];
    steps.forEach(s => {
      if (s.start_date) dates.push(new Date(s.start_date));
      if (s.end_date) dates.push(new Date(s.end_date));
    });
    if (dates.length === 0) return null;
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    return { min, max };
  }, [steps]);

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading timeline…</div>;
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (!bounds) return <div className="p-4 text-sm text-gray-500">No dated steps yet</div>;

  const totalDays = Math.max(1, daysBetween(bounds.min, bounds.max));

  return (
    <div className="mt-6">
      <div className="overflow-x-auto border rounded">
        <div className="min-w-[800px]">
          <div className="grid" style={{ gridTemplateColumns: '240px 1fr' }}>
            <div className="bg-gray-50 border-b px-3 py-2 text-xs font-semibold text-gray-600">Step</div>
            <div className="bg-gray-50 border-b px-3 py-2 text-xs font-semibold text-gray-600">Timeline</div>
          </div>
          {steps.map(step => {
            const s = step.start_date ? new Date(step.start_date) : null;
            const e = step.end_date ? new Date(step.end_date) : null;
            const offsetDays = s ? Math.max(0, daysBetween(bounds.min, s) - 1) : 0;
            const durationDays = s && e ? Math.max(1, daysBetween(s, e)) : 1;
            const leftPct = (offsetDays / totalDays) * 100;
            const widthPct = (durationDays / totalDays) * 100;
            return (
              <div key={step.id} className="grid items-center" style={{ gridTemplateColumns: '240px 1fr' }}>
                <div className="border-b px-3 py-2 text-sm text-gray-800 truncate">{step.title}</div>
                <div className="border-b px-3 py-3">
                  <div className="relative h-6 bg-gray-100 rounded">
                    <div
                      className="absolute top-0 h-6 bg-indigo-500 rounded text-[10px] text-white flex items-center px-2"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      title={`${step.title}`}
                    >
                      {durationDays}d
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default GanttView;



