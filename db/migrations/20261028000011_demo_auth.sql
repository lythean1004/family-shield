-- VM-only authentication. Raw codes and session tokens are never stored.
create table private.demo_codes (
  code_hash text primary key,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz
);
create table private.parent_invites (
  code_hash text primary key,
  guardian_id uuid not null references auth.users(id) on delete cascade,
  relation text not null check (relation in ('딸','아들','배우자','가족')),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz
);
create table private.sessions (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index sessions_user_idx on private.sessions(user_id);
create table private.auth_limits (
  subject_hash text not null,
  window_start timestamptz not null,
  count integer not null,
  primary key (subject_hash, window_start)
);
alter table private.demo_codes enable row level security;
alter table private.parent_invites enable row level security;
alter table private.sessions enable row level security;
alter table private.auth_limits enable row level security;
revoke all on private.demo_codes, private.parent_invites, private.sessions, private.auth_limits from public, anon, authenticated;
grant select, insert, update, delete on private.demo_codes, private.parent_invites, private.sessions, private.auth_limits to service_role;

-- A consent must belong to the parent of this circle, never another family.
drop policy "consents: 본인 삽입" on public.consents;
create policy "consents: 부모님 삽입" on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_circle_protected(circle_id));
