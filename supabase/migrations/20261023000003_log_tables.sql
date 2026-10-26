-- Logging & metrics tables: auth_events, rate_limits, misjudge_reports, metrics

-- auth_events: 기기 변경·재인증·세션 종료 기록 (12장). 90일 보관 [임시]
CREATE TABLE public.auth_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('new_device','reauth','session_end')),
  metadata   jsonb,              -- IP·UA 등 — 식별 최소화
  created_at timestamptz NOT NULL DEFAULT now(),
  purge_at   timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);
CREATE INDEX auth_events_user_idx ON public.auth_events(user_id, created_at DESC);
CREATE INDEX auth_events_purge_idx ON public.auth_events(purge_at);

-- rate_limits: 남용 방지 (12-6). 윈도우 기반 카운터
CREATE TABLE public.rate_limits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   uuid NOT NULL,     -- user_id 또는 circle_id
  subject_type text NOT NULL CHECK (subject_type IN ('user','circle')),
  kind         text NOT NULL CHECK (kind IN ('check','sms','otp','url_lookup')),
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 1,
  UNIQUE (subject_id, subject_type, kind, window_start)
);
CREATE INDEX rate_limits_subject_kind_idx ON public.rate_limits(subject_id, kind, window_start);

-- misjudge_reports: 오판 신고. 별도 동의 시에만 masked_text 저장 (D17, 원칙 7)
-- 신호·판정만 90일 보관 [임시]. masked_text는 비식별 검토 후 동의 철회 시 즉시 삭제.
CREATE TABLE public.misjudge_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id      uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  level          text NOT NULL CHECK (level IN ('danger','caution','check')),
  fired_rules    text[],
  signals_final  text[],
  reason         text NOT NULL CHECK (reason IN (
                   'false_alarm',      -- 정상인데 위험/주의로 나옴
                   'missed_threat'     -- 위험인데 낮게 나옴
                 )),
  share_consent  boolean NOT NULL DEFAULT false,
  masked_text    text,            -- share_consent = true이고 비식별 처리된 경우에만
  review_status  text NOT NULL DEFAULT 'pending'
                   CHECK (review_status IN ('pending','reviewed','dismissed')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  purge_at       timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);
CREATE INDEX misjudge_reports_purge_idx ON public.misjudge_reports(purge_at);

-- metrics: 식별 값 없음. 동의했을 때만 수집 (11-2)
CREATE TABLE public.metrics (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level                     text NOT NULL CHECK (level IN ('danger','caution','check')),
  fired_rules               text[],
  impersonation_type        text,
  time_to_first_response_s  real,
  outcome                   text CHECK (outcome IN ('confirmed','dismissed','expired','none')),
  fallback_used             boolean,
  model_id                  text,
  created_at                timestamptz NOT NULL DEFAULT now()
);
