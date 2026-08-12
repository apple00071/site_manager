import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * Computes and attaches continuous sequential project codes (AI/PRJ/YY/01, AI/PRJ/YY/02...)
 * to project objects based on creation order ascending (created_at).
 * ponytail: O(N) scan over all projects to calculate 1-based sequential code per year.
 */
export async function attachProjectCodes<T = any>(projectsData: T): Promise<T> {
  if (!projectsData) return projectsData;

  try {
    const { data: allProjectsMeta } = await supabaseAdmin
      .from('projects')
      .select('id, created_at, start_date')
      .order('created_at', { ascending: true });

    const codeMap = new Map<string, string>();
    if (allProjectsMeta && allProjectsMeta.length > 0) {
      const yearCounters = new Map<string, number>();
      allProjectsMeta.forEach((p: any) => {
        const dateStr = p.start_date || p.created_at;
        const d = dateStr ? new Date(dateStr) : new Date();
        const yy = !isNaN(d.getTime()) ? d.getFullYear().toString().slice(-2) : new Date().getFullYear().toString().slice(-2);

        const count = (yearCounters.get(yy) || 0) + 1;
        yearCounters.set(yy, count);
        const seqStr = String(count).padStart(2, '0');
        codeMap.set(p.id, `AI/PRJ/${yy}/${seqStr}`);
      });
    }

    const attachCode = (p: any) => {
      if (!p || typeof p !== 'object') return p;
      const code = codeMap.get(p.id) || (p.created_at ? `AI/PRJ/${new Date(p.created_at).getFullYear().toString().slice(-2)}/01` : 'AI/PRJ/26/01');
      return { ...p, project_code: code, ref_no: code };
    };

    if (Array.isArray(projectsData)) {
      return projectsData.map(attachCode) as unknown as T;
    } else if (typeof projectsData === 'object') {
      return attachCode(projectsData) as unknown as T;
    }
  } catch (codeErr) {
    console.warn('Error attaching continuous sequential project codes:', codeErr);
  }

  return projectsData;
}
