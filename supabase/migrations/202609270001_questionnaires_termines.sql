-- Questionnaires terminés, avant tout paiement : une ligne par compte, remplacée
-- à chaque nouveau passage. Elle sert aux chiffres de la page admin (qui va au bout
-- du questionnaire sans acheter). Comme les autres tables, le navigateur n’y accède pas.

begin;

create table public.questionnaires (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questionnaires_answers_object check (jsonb_typeof(answers) = 'object')
);

alter table public.questionnaires enable row level security;
revoke all on public.questionnaires from anon, authenticated;

commit;
