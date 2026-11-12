-- Schéma complet de Suivapp (V0.3), pour une installation neuve : exécuter ce seul fichier
-- dans l'éditeur SQL de Supabase.
-- Base existante : V0.1 → exécuter migration_v0.2.sql puis migration_v0.3.sql ; V0.2 → migration_v0.3.sql.
-- Chaque table est privée : la RLS limite les lignes à leur propriétaire.

create table families (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null,
  stat_name text not null,
  position int not null default 0
);

create table habit_templates (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  family_id uuid references families on delete set null,
  name text not null,
  tracking text not null check (tracking in ('simple', 'duration', 'quantity', 'levels', 'routine', 'avoid')),
  goal numeric not null default 1,
  unit text not null default '',
  frequency jsonb not null,
  moments text[] not null,
  levels jsonb not null default '[]',
  steps jsonb not null default '[]',
  avoid jsonb,
  builtin boolean not null default false
);

create table habits (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  family_id uuid references families on delete set null,
  name text not null,
  description text not null default '',
  tracking text not null check (tracking in ('simple', 'duration', 'quantity', 'levels', 'routine', 'avoid')),
  goal numeric not null default 1,
  unit text not null default '',
  frequency jsonb not null,
  moments text[] not null,
  levels jsonb not null default '[]',
  steps jsonb not null default '[]',
  avoid jsonb,
  time_of_day text,
  start_date date not null,
  end_date date,
  pauses jsonb not null default '[]',
  archived boolean not null default false
);

create table validations (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id uuid not null references habits on delete cascade,
  day date not null,
  moment text not null,
  value numeric not null,
  steps text[] not null default '{}',
  xp_earned int not null default 0,
  unique (habit_id, day, moment)
);

create table slips (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id uuid not null references habits on delete cascade,
  day date not null,
  time text not null
);

create table task_lists (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null
);

create table tasks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  list_id uuid references task_lists on delete set null,
  parent_id uuid references tasks on delete cascade,
  title text not null,
  note text not null default '',
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  recurrence jsonb,
  previous_id uuid,
  checklist_id uuid,
  position int not null default 0,
  completed_at timestamptz,
  xp_earned int not null default 0
);

create table checklists (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  items text[] not null default '{}',
  list_id uuid references task_lists on delete set null,
  recurrence jsonb
);

create table events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  day date not null,
  start_time text,
  end_time text,
  note text not null default '',
  color text not null default '#3F6B52'
);

create table profile (
  id uuid primary key,
  user_id uuid not null unique default auth.uid() references auth.users on delete cascade,
  day_rollover_hour int not null default 4 check (day_rollover_hour between 0 and 12),
  xp jsonb
);

do $$
declare t text;
begin
  foreach t in array array['families','habit_templates','habits','validations','slips','task_lists','tasks','checklists','events','profile'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy owner_only on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ——— V0.3 : Entraînement (sport, mobilité, danse) ———

create table if not exists training_exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  muscle text not null default '',
  measure text not null default 'reps_weight' check (measure in ('reps_weight', 'reps', 'duration')),
  unilateral boolean not null default false,
  notes text not null default ''
);

create table if not exists training_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  discipline text not null default 'sport',
  place text not null default 'gym',
  position int not null default 0,
  warmup text not null default '',
  items jsonb not null default '[]',
  finisher boolean not null default true,
  archived boolean not null default false
);

-- Routines de mobilité : catégorie et niveaux (Rapide / Normal / Complet).
alter table training_sessions
  add column if not exists category text not null default '',
  add column if not exists levels jsonb not null default '[]';

create table if not exists training_wods (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  format text not null check (format in ('amrap', 'emom', 'for_time', 'tabata')),
  minutes int not null default 10,
  rounds int not null default 0,
  items text[] not null default '{}',
  builtin boolean not null default false
);

create table if not exists training_logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid references training_sessions on delete set null,
  discipline text not null default 'sport',
  name text not null,
  day date not null,
  started_at timestamptz not null,
  duration_s int not null default 0,
  feeling text,
  note text not null default '',
  warmup_done boolean not null default false,
  circuits jsonb not null default '{}',
  sets jsonb not null default '[]',
  wod_id uuid references training_wods on delete set null,
  wod_result text not null default '',
  records text[] not null default '{}',
  family_id uuid references families on delete set null,
  xp_earned int not null default 0
);

-- Objectifs sport.
create table if not exists training_goals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  measure text not null check (measure in ('weight', 'reps', 'sessions', 'volume')),
  exercise_id uuid references training_exercises on delete set null,
  target numeric not null default 1,
  start_day date not null,
  due_day date,
  means jsonb not null default '[]',
  achieved_on date,
  xp_earned int not null default 0
);

-- Danse : cours fixes, séances (cours, soirées, pratique), figures, objectifs.
create table if not exists dance_classes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  style text not null,
  weekday int not null check (weekday between 0 and 6),
  start_time text not null,
  end_time text not null,
  place text not null default '',
  level text not null default '',
  active boolean not null default true
);

create table if not exists dance_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  style text not null,
  kind text not null check (kind in ('class', 'social', 'practice')),
  day date not null,
  start_time text,
  duration_min int not null default 60,
  status text not null default 'done' check (status in ('planned', 'done', 'skipped')),
  class_id uuid references dance_classes on delete set null,
  title text not null default '',
  note text not null default '',
  figure_ids text[] not null default '{}',
  family_id uuid references families on delete set null,
  xp_earned int not null default 0
);

create table if not exists dance_figures (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  style text not null,
  name text not null,
  status text not null default 'to_learn' check (status in ('to_learn', 'learning', 'mastered')),
  notes text not null default '',
  mastered_on date,
  xp_earned int not null default 0
);

create table if not exists dance_goals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  style text not null default '',
  measure text not null check (measure in ('figures', 'socials', 'hours', 'means')),
  target int not null default 1,
  start_day date not null,
  due_day date,
  means jsonb not null default '[]',
  achieved_on date,
  xp_earned int not null default 0
);

do $$
declare t text;
begin
  foreach t in array array['training_exercises','training_sessions','training_wods','training_logs','training_goals','dance_classes','dance_sessions','dance_figures','dance_goals'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_only on %I', t);
    execute format('create policy owner_only on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
