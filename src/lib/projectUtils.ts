import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * Module-level cache for project code map.
 * ponytail: simple object cache — good enough for a small team app.
 * Ceiling: stale for up to 60s after a new project is created.
 * Upgrade path: invalidate on project POST if sub-second accuracy is needed.
 */
let codeMapCache: Map<string, string> | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 600_000; // 10 minutes (invalidated immediately when new projects are created)

async function getCodeMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (codeMapCache && now < cacheExpiresAt) return codeMapCache;

  const { data: allProjects } = await supabaseAdmin
    .from('projects')
    .select('id, created_at, start_date')
    .order('created_at', { ascending: true });

  const map = new Map<string, string>();
  let seq = 0;
  for (const p of allProjects || []) {
    seq++;
    const dateStr = p.created_at || p.start_date;
    const d = dateStr ? new Date(dateStr) : new Date();
    const yy = !isNaN(d.getTime()) ? d.getFullYear().toString().slice(-2) : new Date().getFullYear().toString().slice(-2);
    map.set(p.id, `AI/${yy}/${String(seq).padStart(2, '0')}`);
  }

  codeMapCache = map;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return map;
}

/** Call this after creating a new project so the next request gets fresh codes. */
export function invalidateProjectCodeCache() {
  codeMapCache = null;
  cacheExpiresAt = 0;
}

/**
 * Attaches sequential project codes (AI/YY/01, AI/YY/02...) to project objects.
 * Uses a 60s module-level cache — only hits the DB once per minute across all routes.
 */
export async function attachProjectCodes<T = any>(projectsData: T): Promise<T> {
  if (!projectsData) return projectsData;

  try {
    const codeMap = await getCodeMap();
    const globalCounter = codeMap.size;

    const attachCode = (p: any) => {
      if (!p || typeof p !== 'object') return p;
      const dateStr = p.created_at || p.start_date;
      const d = dateStr ? new Date(dateStr) : new Date();
      const yy = !isNaN(d.getTime()) ? d.getFullYear().toString().slice(-2) : new Date().getFullYear().toString().slice(-2);
      const fallback = `AI/${yy}/${String(globalCounter + 1).padStart(2, '0')}`;
      let code = codeMap.get(p.id) || p.project_code || p.ref_no || fallback;
      code = code.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');
      return { ...p, project_code: code, ref_no: code };
    };

    if (Array.isArray(projectsData)) return projectsData.map(attachCode) as unknown as T;
    if (typeof projectsData === 'object') return attachCode(projectsData) as unknown as T;
  } catch (err) {
    console.warn('Error attaching project codes:', err);
  }

  return projectsData;
}
