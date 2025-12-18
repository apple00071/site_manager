-- Create site_logs table
create table if not exists site_logs (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references projects(id) on delete cascade not null,
    log_date date not null default current_date,
    work_description text,
    work_start_date date,
    estimated_completion_date date,
    labor_count integer default 0,
    main_worker_name text,
    main_worker_phone text,
    photos text[] default array[]::text[],
    created_by uuid references users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table site_logs enable row level security;

-- Policies
create policy "Users can view site_logs for projects they have access to"
    on site_logs for select
    using (
        exists (
            select 1 from projects
            where projects.id = site_logs.project_id
            -- Add your project access logic here, usually basic check for now
        )
    );

create policy "Users can insert site_logs for projects they have access to"
    on site_logs for insert
    with check (
        exists (
            select 1 from projects
            where projects.id = site_logs.project_id
        )
    );

create policy "Users can update their own site_logs"
    on site_logs for update
    using ( auth.uid() = created_by );

create policy "Users can delete their own site_logs"
    on site_logs for delete
    using ( auth.uid() = created_by );
