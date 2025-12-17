import { supabaseAdmin } from '@/lib/supabase-server';

export interface OrgSettings {
    enabled_modules: string[];
    budget_enforcement: 'warn' | 'block';
    approval_strictness: 'strict' | 'relaxed';
    default_project_buckets: string[];
}

export interface ApprovalRule {
    id: string;
    entity_type: 'purchase_order' | 'payment';
    min_amount: number;
    max_amount: number | null;
    approver_role: string;
    sequence_order: number;
    is_mandatory: boolean;
}

export class GovernanceService {
    /**
     * Fetches settings for the organization.
     * In Phase 1, we assume a single organization or fetch by slug/ID if available.
     * For MVP, we'll fetch the first org found or a specific hardcoded slug 'apple-interior'.
     */
    static async getOrgSettings(orgIdOrSlug: string = 'apple-interior'): Promise<OrgSettings> {
        // 1. Resolve Org ID
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('slug', orgIdOrSlug)
            .single();

        if (!org) {
            // Fallback for Phase 1 if DB not seeded yet, to prevent app crash
            return {
                enabled_modules: ['boq', 'procurement', 'snag', 'projects', 'users'],
                budget_enforcement: 'warn',
                approval_strictness: 'relaxed',
                default_project_buckets: []
            };
        }

        // 2. Fetch Settings
        const { data: settings } = await supabaseAdmin
            .from('org_settings')
            .select('config')
            .eq('org_id', org.id)
            .single();

        return settings?.config || {
            enabled_modules: ['boq', 'procurement', 'snag', 'projects', 'users'],
            budget_enforcement: 'warn',
            approval_strictness: 'relaxed',
            default_project_buckets: []
        };
    }

    /**
     * Determines if a specific module is enabled.
     */
    static async isModuleEnabled(moduleName: string): Promise<boolean> {
        const settings = await this.getOrgSettings();
        return settings.enabled_modules.includes(moduleName);
    }

    /**
     * Fetches applicable approval rules for a given entity and amount.
     */
    static async getApprovalRules(
        entityType: 'purchase_order' | 'payment',
        amount: number,
        orgIdOrSlug: string = 'apple-interior'
    ): Promise<ApprovalRule[]> {
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('slug', orgIdOrSlug)
            .single();

        if (!org) return [];

        const { data: rules } = await supabaseAdmin
            .from('approval_workflows')
            .select('*')
            .eq('org_id', org.id)
            .eq('entity_type', entityType)
            .lte('min_amount', amount)
            .order('sequence_order', { ascending: true });

        // Filter max_amount in memory if needed (handling null = infinity)
        const applicableRules = (rules || []).filter((r: any) => {
            if (r.max_amount !== null && amount > r.max_amount) return false;
            return true;
        });

        return applicableRules;
    }
}
