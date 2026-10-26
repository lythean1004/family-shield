-- Core tables: users, circles, circle_members, invites, consents,
-- passphrase_status, family_rules, official_cards, circle_contacts, push_subscriptions

-- users: auth.users의 공개 프로필. 트리거로 자동 생성, API로 직접 삽입 불가.
CREATE TABLE public.users (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   text,
  phone_e164     text UNIQUE,
  phone_verified_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- circles: 보호받는 사람(부모님) 한 분당 하나 (D21)
CREATE TABLE public.circles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protected_user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- circle_members: 보호자 연결. role은 현재 'guardian'만 허용.
CREATE TABLE public.circle_members (
  circle_id       uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'guardian' CHECK (role IN ('guardian')),
  name_for_parent text,          -- 부모님이 부르는 이름
  relation        text,
  parent_alias    text,          -- 부모님 연락처에 저장된 이름
  priority        smallint NOT NULL DEFAULT 1,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);
CREATE INDEX circle_members_user_idx ON public.circle_members(user_id);

-- invites: 만나서 일회용 숫자 코드/QR로만 보호자 초대 (F1-2, 원칙 3)
CREATE TABLE public.invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash   text NOT NULL UNIQUE,   -- HMAC-SHA256, 원문 저장 안 함
  circle_id   uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES public.users(id),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  attempts    smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- consents: 쌓기만 함. text_version으로 문구 버전 관리 (F1-4)
CREATE TABLE public.consents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id    uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id),
  item         text NOT NULL CHECK (item IN (
                 'family_alert', 'impersonation_check', 'check_log', 'misjudge_share')),
  granted      boolean NOT NULL,
  text_version text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consents_circle_user_item_idx ON public.consents(circle_id, user_id, item, created_at DESC);

-- passphrase_status: 정답은 저장하지 않음. 힌트는 기기에만 (F3-2)
CREATE TABLE public.passphrase_status (
  circle_id            uuid PRIMARY KEY REFERENCES public.circles(id) ON DELETE CASCADE,
  is_set               boolean NOT NULL DEFAULT false,
  set_at               timestamptz,
  rotate_requested_at  timestamptz
);

-- family_rules: 가족 약속 설정 (F3-3)
CREATE TABLE public.family_rules (
  circle_id              uuid PRIMARY KEY REFERENCES public.circles(id) ON DELETE CASCADE,
  parent_calls_original  boolean NOT NULL DEFAULT true,
  ask_passphrase_on_call boolean NOT NULL DEFAULT true,
  money_after_voice      boolean NOT NULL DEFAULT true
);

-- official_cards: 근거 카드. 출처·확인일·라이선스 확인 완료 후만 active (14장)
CREATE TABLE public.official_cards (
  id                  text PRIMARY KEY,   -- 예: 'EC_AGENCY_HANGUP'
  type                text NOT NULL CHECK (type IN ('technique','action','after_action','contact')),
  org_name            text,
  title_parent        text NOT NULL,
  fact                text NOT NULL,
  parent_steps        jsonb,
  normal_contact_note text,
  contacts            jsonb,              -- [{label, phone}]
  source_url          text,
  source_org          text,
  verified_at         date NOT NULL,
  license_status      text NOT NULL DEFAULT 'unconfirmed'
                        CHECK (license_status IN ('confirmed','unconfirmed','restricted')),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','needs_review')),
  version             smallint NOT NULL DEFAULT 1,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- circle_contacts: 우리 집 공식 번호 카드 (F2)
CREATE TABLE public.circle_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id       uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  official_card_id text REFERENCES public.official_cards(id),
  custom_name     text,
  custom_phone    text,
  source_type     text NOT NULL CHECK (source_type IN ('official','custom')),
  created_by      uuid NOT NULL REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX circle_contacts_circle_idx ON public.circle_contacts(circle_id);

-- push_subscriptions: 웹 푸시 구독. 410 응답 시 revoked_at 기록 후 발송 중단 (12-5)
CREATE TABLE public.push_subscriptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint       text NOT NULL,
  keys           jsonb NOT NULL,    -- {p256dh, auth}
  device_label   text,
  last_success_at timestamptz,
  revoked_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
