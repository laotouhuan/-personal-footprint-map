-- 在 Supabase SQL Editor 中执行本脚本。
-- 先在 Authentication 中创建你的管理员账号，再登录网页使用。

create table if not exists public.footprint_logs (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  province text,
  city text,
  visit_date date not null,
  companion_type text not null,
  remark text,
  created_at timestamptz not null default now()
);

alter table public.footprint_logs enable row level security;

drop policy if exists "footprint_logs_select_own" on public.footprint_logs;
drop policy if exists "footprint_logs_insert_own" on public.footprint_logs;
drop policy if exists "footprint_logs_delete_own" on public.footprint_logs;
drop policy if exists "footprint_logs_select_authenticated" on public.footprint_logs;
create policy "footprint_logs_select_authenticated"
on public.footprint_logs
for select
to authenticated
using (true);

drop policy if exists "footprint_logs_insert_authenticated" on public.footprint_logs;
create policy "footprint_logs_insert_authenticated"
on public.footprint_logs
for insert
to authenticated
with check (true);

drop policy if exists "footprint_logs_delete_authenticated" on public.footprint_logs;
create policy "footprint_logs_delete_authenticated"
on public.footprint_logs
for delete
to authenticated
using (true);

drop policy if exists "footprint_logs_update_authenticated" on public.footprint_logs;
create policy "footprint_logs_update_authenticated"
on public.footprint_logs
for update
to authenticated
using (true)
with check (true);

create index if not exists footprint_logs_visit_date_idx
on public.footprint_logs (visit_date desc);

notify pgrst, 'reload schema';
