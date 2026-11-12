-- Migration Suivapp V0.1 → V0.2. À exécuter dans l'éditeur SQL de Supabase,
-- sur une base créée avec le schema.sql de la V0.1. Les données existantes sont conservées.
-- Le script peut être relancé sans risque (par exemple après une mise à jour de ce fichier).
-- (Une nouvelle installation exécute directement schema.sql, qui contient déjà la V0.2.)

-- Habitudes et modèles : niveaux, routines, habitudes à éviter.
alter table habits drop constraint if exists habits_tracking_check;
alter table habits add constraint habits_tracking_check
  check (tracking in ('simple', 'duration', 'quantity', 'levels', 'routine', 'avoid'));
alter table habits
  add column if not exists levels jsonb not null default '[]',
  add column if not exists steps jsonb not null default '[]',
  add column if not exists avoid jsonb;

alter table habit_templates drop constraint if exists habit_templates_tracking_check;
alter table habit_templates add constraint habit_templates_tracking_check
  check (tracking in ('simple', 'duration', 'quantity', 'levels', 'routine', 'avoid'));
alter table habit_templates
  add column if not exists levels jsonb not null default '[]',
  add column if not exists steps jsonb not null default '[]',
  add column if not exists avoid jsonb;

-- Étapes de routine cochées.
alter table validations add column if not exists steps text[] not null default '{}';

-- Écarts des habitudes à éviter.
create table if not exists slips (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id uuid not null references habits on delete cascade,
  day date not null,
  time text not null
);

-- Tâches récurrentes, lien vers l'occurrence précédente et vers la checklist d'origine.
alter table tasks
  add column if not exists recurrence jsonb,
  add column if not exists previous_id uuid,
  add column if not exists checklist_id uuid,
  add column if not exists position int not null default 0;

-- Valeurs d'XP réglables.
alter table profile add column if not exists xp jsonb;

-- Checklists réutilisables.
create table if not exists checklists (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  items text[] not null default '{}',
  list_id uuid references task_lists on delete set null,
  recurrence jsonb
);

-- Événements de l'agenda.
create table if not exists events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  day date not null,
  start_time text,
  end_time text,
  note text not null default '',
  color text not null default '#3F6B52'
);

do $$
declare t text;
begin
  foreach t in array array['slips','checklists','events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_only on %I', t);
    execute format('create policy owner_only on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
