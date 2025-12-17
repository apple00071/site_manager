-- Create Snags Table
create table if not exists snags (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade,
  created_by uuid references users(id),
  assigned_to_user_id uuid references users(id),
  description text not null,
  location text,
  category text,
  priority text default 'medium', -- low, medium, high
  status text default 'open', -- open, assigned, resolved, verified, closed
  photos text[] default array[]::text[],
  created_at timestamptz default now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

-- Enable RLS
alter table snags enable row level security;

-- Policies
create policy "Users can view snags for their projects"
  on snags for select
  using (
    exists (
      select 1 from project_members
      where project_id = snags.project_id
      and user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects
      where id = snags.project_id
      and created_by = auth.uid()
    )
  );

create policy "Users can insert snags for their projects"
  on snags for insert
  with check (
    exists (
      select 1 from project_members
      where project_id = snags.project_id
      and user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects
      where id = snags.project_id
      and created_by = auth.uid()
    )
  );

create policy "Users can update snags for their projects"
  on snags for update
  using (
    exists (
      select 1 from project_members
      where project_id = snags.project_id
      and user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects
      where id = snags.project_id
      and created_by = auth.uid()
    )
  );

create policy "Users can delete snags for their projects"
  on snags for delete
  using (
    exists (
      select 1 from project_members
      where project_id = snags.project_id
      and user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects
      where id = snags.project_id
      and created_by = auth.uid()
    )
  );
