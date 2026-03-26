create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  template_type text not null check (template_type in ('initial', 'follow_up_1', 'follow_up_2', 'custom')),
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  file_url text not null,
  file_name text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smtp_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  host text not null,
  port integer not null default 587,
  username text not null,
  password_encrypted text,
  encryption text not null default 'TLS' check (encryption in ('TLS', 'SSL', 'STARTTLS', 'None')),
  from_name text,
  from_email text not null,
  reply_to text,
  is_configured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  followup1_delay_days integer not null default 3,
  followup2_delay_days integer not null default 7,
  business_days_only boolean not null default true,
  daily_send_limit integer not null default 20,
  duplicate_protection boolean not null default true,
  auto_stop_on_reply boolean not null default true,
  send_time_hour integer not null default 9,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  role_title text not null,
  contact_name text,
  contact_email text not null,
  job_link text,
  source text,
  notes text,
  status text not null default 'Draft' check (status in ('Draft', 'Scheduled', 'Sent', 'Replied', 'Interview', 'Rejected', 'Closed')),
  automation_enabled boolean not null default true,
  follow_up_stage integer not null default 0,
  replied boolean not null default false,
  replied_at timestamptz,
  last_sent_at timestamptz,
  next_scheduled_at timestamptz,
  initial_template_id uuid references public.email_templates(id) on delete set null,
  followup1_template_id uuid references public.email_templates(id) on delete set null,
  followup2_template_id uuid references public.email_templates(id) on delete set null,
  cv_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.job_applications(id) on delete cascade,
  template_id uuid references public.email_templates(id) on delete set null,
  direction text not null check (direction in ('outbound', 'inbound')),
  subject text not null,
  body text,
  sent_at timestamptz,
  received_at timestamptz,
  status text check (status in ('sent', 'failed', 'received')),
  stage text check (stage in ('initial', 'follow_up_1', 'follow_up_2', 'custom', 'reply')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.job_applications(id) on delete cascade,
  template_id uuid not null references public.email_templates(id) on delete cascade,
  scheduled_for timestamptz not null,
  stage text not null check (stage in ('initial', 'follow_up_1', 'follow_up_2')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled', 'failed')),
  attempts integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_email_templates_updated_at before update on public.email_templates for each row execute function public.set_updated_at();
create trigger set_resumes_updated_at before update on public.resumes for each row execute function public.set_updated_at();
create trigger set_smtp_settings_updated_at before update on public.smtp_settings for each row execute function public.set_updated_at();
create trigger set_automation_rules_updated_at before update on public.automation_rules for each row execute function public.set_updated_at();
create trigger set_job_applications_updated_at before update on public.job_applications for each row execute function public.set_updated_at();
create trigger set_email_messages_updated_at before update on public.email_messages for each row execute function public.set_updated_at();
create trigger set_scheduled_emails_updated_at before update on public.scheduled_emails for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.email_templates enable row level security;
alter table public.resumes enable row level security;
alter table public.smtp_settings enable row level security;
alter table public.automation_rules enable row level security;
alter table public.job_applications enable row level security;
alter table public.email_messages enable row level security;
alter table public.scheduled_emails enable row level security;

create policy "profiles_owner_all" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "email_templates_owner_all" on public.email_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "resumes_owner_all" on public.resumes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "smtp_settings_owner_all" on public.smtp_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "automation_rules_owner_all" on public.automation_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "job_applications_owner_all" on public.job_applications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "email_messages_owner_all" on public.email_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scheduled_emails_owner_all" on public.scheduled_emails for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
