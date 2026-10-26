-- RLS 정책 파트 1: users ~ push_subscriptions (PRD 11-3)
-- 모든 테이블 RLS on, 기본 거부. anon 정책 없음.

-- ── users ──────────────────────────────────────────────
alter table public.users enable row level security;

create policy "users: 본인 읽기" on public.users
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "users: 본인 수정" on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "users: 같은 그룹 읽기" on public.users
  for select to authenticated
  using (private.shares_circle_with(id));

-- ── circles ────────────────────────────────────────────
alter table public.circles enable row level security;

create policy "circles: 참여자 읽기" on public.circles
  for select to authenticated
  using (private.is_circle_participant(id));

create policy "circles: 부모님 생성" on public.circles
  for insert to authenticated
  with check (protected_user_id = (select auth.uid()));

-- ── circle_members ─────────────────────────────────────
alter table public.circle_members enable row level security;

create policy "circle_members: 참여자 읽기" on public.circle_members
  for select to authenticated
  using (private.is_circle_participant(circle_id));

create policy "circle_members: 부모님 관리" on public.circle_members
  for all to authenticated
  using  (private.is_circle_protected(circle_id))
  with check (private.is_circle_protected(circle_id));

-- ── invites ────────────────────────────────────────────
alter table public.invites enable row level security;

create policy "invites: 부모님 관리" on public.invites
  for all to authenticated
  using  (private.is_circle_protected(circle_id))
  with check (private.is_circle_protected(circle_id));

-- ── consents ───────────────────────────────────────────
alter table public.consents enable row level security;

create policy "consents: 본인 읽기" on public.consents
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "consents: 본인 삽입" on public.consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ── passphrase_status ──────────────────────────────────
alter table public.passphrase_status enable row level security;

create policy "passphrase_status: 참여자 읽기" on public.passphrase_status
  for select to authenticated
  using (private.is_circle_participant(circle_id));

create policy "passphrase_status: 부모님 수정" on public.passphrase_status
  for update to authenticated
  using  (private.is_circle_protected(circle_id))
  with check (private.is_circle_protected(circle_id));

-- ── family_rules ───────────────────────────────────────
alter table public.family_rules enable row level security;

create policy "family_rules: 참여자 읽기" on public.family_rules
  for select to authenticated
  using (private.is_circle_participant(circle_id));

create policy "family_rules: 부모님 수정" on public.family_rules
  for update to authenticated
  using  (private.is_circle_protected(circle_id))
  with check (private.is_circle_protected(circle_id));

-- ── official_cards ─────────────────────────────────────
alter table public.official_cards enable row level security;

create policy "official_cards: authenticated 읽기" on public.official_cards
  for select to authenticated
  using (status = 'active');

-- ── circle_contacts ────────────────────────────────────
alter table public.circle_contacts enable row level security;

create policy "circle_contacts: 참여자 읽기" on public.circle_contacts
  for select to authenticated
  using (private.is_circle_participant(circle_id));

create policy "circle_contacts: 부모님 관리" on public.circle_contacts
  for all to authenticated
  using  (private.is_circle_protected(circle_id))
  with check (private.is_circle_protected(circle_id));

-- ── push_subscriptions ─────────────────────────────────
alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: 본인 관리" on public.push_subscriptions
  for all to authenticated
  using  (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
