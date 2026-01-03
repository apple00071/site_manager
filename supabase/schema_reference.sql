-- Create users table with role-based access control
CREATE TYPE user_role AS ENUM ('admin', 'employee');

-- Create users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create clients table
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_members junction table
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  permissions JSONB DEFAULT '{"view": true, "edit": false, "upload": false, "mark_done": false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Create files table for project uploads
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
-- Users table policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own data" 
  ON users FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all user data" 
  ON users FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can insert user data" 
  ON users FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can update user data" 
  ON users FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Projects table policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all projects" 
  ON projects 
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Employees can view assigned projects" 
  ON projects FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM project_members 
    WHERE project_id = projects.id 
    AND user_id = auth.uid() 
    AND permissions->>'view' = 'true'
  ));

-- Project members policies
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage project members" 
  ON project_members 
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Employees can view their project assignments" 
  ON project_members FOR SELECT 
  USING (user_id = auth.uid());

-- Files policies
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all files" 
  ON files 
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Employees can view files of assigned projects" 
  ON files FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM project_members 
    WHERE project_id = files.project_id 
    AND user_id = auth.uid() 
    AND permissions->>'view' = 'true'
  ));

CREATE POLICY "Employees can upload files to assigned projects" 
  ON files FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = files.project_id 
      AND user_id = auth.uid() 
      AND permissions->>'upload' = 'true'
    )
  );

-- Create functions for user management
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.user_metadata->>'full_name',
          COALESCE(NEW.user_metadata->>'role', 'employee')::user_role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile after auth.user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE create_user_profile();


-- Audit logging table for admin actions
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  actor_user_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  action text not null,
  details jsonb,
  constraint audit_logs_actor_fk foreign key (actor_user_id) references public.users (id) on delete set null
);

-- RLS policies: allow admins to read logs; inserts via service role only
alter table public.audit_logs enable row level security;

create policy "Admins can read audit logs"
  on public.audit_logs
  for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- No insert/update/delete via client; handled via service role APIs
