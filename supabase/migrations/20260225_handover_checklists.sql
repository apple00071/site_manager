-- Create handover_checklists table
CREATE TABLE IF NOT EXISTS public.handover_checklists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    room_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    status BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_handover_checklists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_handover_checklists_timestamp
    BEFORE UPDATE ON public.handover_checklists
    FOR EACH ROW
    EXECUTE FUNCTION update_handover_checklists_updated_at();

-- RLS Policies
ALTER TABLE public.handover_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view handover checklists for their projects"
    ON public.handover_checklists FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = handover_checklists.project_id
            AND project_members.user_id = auth.uid()
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE (projects.id = handover_checklists.project_id)
            AND (projects.created_by = auth.uid() OR projects.assigned_employee_id = auth.uid())
        )
        OR 
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Users can create handover checklists for their projects"
    ON public.handover_checklists FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = handover_checklists.project_id
            AND project_members.user_id = auth.uid()
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE (projects.id = handover_checklists.project_id)
            AND (projects.created_by = auth.uid() OR projects.assigned_employee_id = auth.uid())
        )
        OR 
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Users can update handover checklists for their projects"
    ON public.handover_checklists FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = handover_checklists.project_id
            AND project_members.user_id = auth.uid()
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE (projects.id = handover_checklists.project_id)
            AND (projects.created_by = auth.uid() OR projects.assigned_employee_id = auth.uid())
        )
        OR 
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Users can delete handover checklists for their projects"
    ON public.handover_checklists FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = handover_checklists.project_id
            AND project_members.user_id = auth.uid()
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE (projects.id = handover_checklists.project_id)
            AND (projects.created_by = auth.uid())
        )
        OR 
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_handover_checklists_project_id ON public.handover_checklists(project_id);
