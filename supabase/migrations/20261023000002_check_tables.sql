-- Judgment pipeline tables: checks, confirm_requests, notification_attempts, after_actions
-- 원칙 7: 어떤 테이블에도 메시지 원문 컬럼 없음
-- 11-2: checks·confirm_requests·notification_attempts·after_actions 24시간 후 purge

-- checks: 판별 1건. purge_at = created_at + interval '24 hours'
CREATE TABLE public.checks (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id            uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  created_by           uuid NOT NULL REFERENCES public.users(id),
  input_channel        text NOT NULL CHECK (input_channel IN ('kakao','web','practice')),

  -- 통화 맥락 (선택)
  call_context         jsonb,       -- {had_call: bool}

  -- 번호 처리: 원문 없음, 가명정보로 취급
  sender_last4         text,        -- 끝 4자리만
  extracted_phone_hmacs text[],     -- HMAC-SHA256 배열

  -- 신호 (원문 없음)
  signals_code         text[],      -- 코드 엔진이 뽑은 SIG_* 배열
  signals_ai           jsonb,       -- AI 출력 그대로 (검증 통과한 것)
  signals_final        text[],      -- 최종 합집합

  -- 판정
  impersonation_type   text,
  impersonated_relation text,
  impersonated_member_id uuid REFERENCES public.users(id),
  level                text NOT NULL CHECK (level IN ('danger','caution','check')),
  fired_rules          text[],

  -- 대체 여부
  fallback_used        boolean NOT NULL DEFAULT false,

  -- AI 메타
  model_id             text,
  prompt_version       text,
  model_latency_ms     integer,

  -- 근거 카드 (버전 스냅샷)
  evidence_card_ids    jsonb,       -- [{id, version}]

  is_practice          boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  purge_at             timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX checks_circle_created_idx ON public.checks(circle_id, created_at DESC);
CREATE INDEX checks_purge_idx ON public.checks(purge_at);

-- confirm_requests: 가족 확인 요청 (F4)
CREATE TABLE public.confirm_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id         uuid NOT NULL REFERENCES public.checks(id) ON DELETE CASCADE,
  target_member_id uuid NOT NULL REFERENCES public.users(id),
  kind             text NOT NULL CHECK (kind IN ('family_check','official_check')),
  state            text NOT NULL DEFAULT 'pending'
                     CHECK (state IN ('pending','responded','expired','cancelled')),
  escalated_from   uuid REFERENCES public.confirm_requests(id),
  response         jsonb,           -- {sent: bool, note: text} 등 — 원문 없음
  sent_at          timestamptz,
  viewed_at        timestamptz,
  responded_at     timestamptz,
  deadline_at      timestamptz,
  is_practice      boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX confirm_requests_check_idx ON public.confirm_requests(check_id);
CREATE INDEX confirm_requests_member_state_idx ON public.confirm_requests(target_member_id, state);

-- notification_attempts: 알림 발송 내역 (웹 푸시·예비 문자)
CREATE TABLE public.notification_attempts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id         uuid NOT NULL REFERENCES public.confirm_requests(id) ON DELETE CASCADE,
  channel            text NOT NULL CHECK (channel IN ('push','sms')),
  attempt_no         smallint NOT NULL DEFAULT 1,
  result             text NOT NULL CHECK (result IN ('ok','fail','revoked')),
  provider_message_id text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_attempts_request_idx ON public.notification_attempts(request_id);

-- after_actions: 사후 대응 안내 단계 (F5)
CREATE TABLE public.after_actions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id   uuid NOT NULL REFERENCES public.checks(id) ON DELETE CASCADE,
  type       text NOT NULL,        -- 'app_installed' | 'info_leaked' | 'money_sent'
  steps_done jsonb NOT NULL DEFAULT '[]',
  card_version smallint,
  created_at timestamptz NOT NULL DEFAULT now()
);
