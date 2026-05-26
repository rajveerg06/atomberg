-- Migrations for Tasks Schema
-- Matches file: migrations/02_tasks_schema.sql

-- Create tasks table
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  creator_id uuid references public.profiles(id) on delete cascade not null,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger to automatically update the updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_tasks_updated_at on public.tasks;
create trigger update_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.update_updated_at_column();

-- Set up Row Level Security (RLS)
alter table public.tasks enable row level security;

-- Policies for tasks
create policy "Authenticated users can view tasks they are part of" on public.tasks
  for select using (
    auth.role() = 'authenticated' and (
      auth.uid() = creator_id or 
      auth.uid() = assignee_id or 
      -- Allow all authenticated users to see tasks so they can see assignment distributions
      -- (or restrict if preferred; here we allow all authenticated users to view)
      true
    )
  );

create policy "Authenticated users can insert tasks they create" on public.tasks
  for insert with check (
    auth.role() = 'authenticated' and 
    auth.uid() = creator_id
  );

create policy "Creators or assignees can update tasks" on public.tasks
  for update using (
    auth.role() = 'authenticated' and (
      auth.uid() = creator_id or 
      auth.uid() = assignee_id
    )
  );

create policy "Creators can delete tasks" on public.tasks
  for delete using (
    auth.role() = 'authenticated' and 
    auth.uid() = creator_id
  );
