create table if not exists public.workboard_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kanban jsonb not null default '{"cols": []}'::jsonb,
  cal_events jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workboard_states enable row level security;

drop policy if exists "workboard-select-own" on public.workboard_states;
create policy "workboard-select-own"
on public.workboard_states
for select
using (auth.uid() = user_id);

drop policy if exists "workboard-insert-own" on public.workboard_states;
create policy "workboard-insert-own"
on public.workboard_states
for insert
with check (auth.uid() = user_id);

drop policy if exists "workboard-update-own" on public.workboard_states;
create policy "workboard-update-own"
on public.workboard_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
