-- Create appointments table if it doesn't exist
create table if not exists public.appointments (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references public.patients(id) on delete cascade not null,
  scheduled_date date not null,
  scheduled_time time not null,
  status text check (status in ('scheduled', 'confirmed', 'completed', 'cancelled')) default 'scheduled',
  notes text,
  source text default 'internal',
  google_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table public.appointments enable row level security;

create policy "Enable read access for authenticated users"
on public.appointments for select
to authenticated
using (true);

create policy "Enable insert for authenticated users and service role"
on public.appointments for insert
to authenticated, service_role
with check (true);

create policy "Enable update for authenticated users and service role"
on public.appointments for update
to authenticated, service_role
using (true);
