-- Triggers & functions

-- auth.users에 신규 행이 생기면 public.users 프로필을 자동 생성
-- phone_e164는 auth.users.phone에서 복사 (최초 가입 시 확인된 번호)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, phone_e164, phone_verified_at)
  VALUES (
    NEW.id,
    NULLIF(NEW.phone, ''),
    CASE WHEN NEW.phone_confirmed_at IS NOT NULL THEN NEW.phone_confirmed_at ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- circles 생성 시 passphrase_status·family_rules 기본 행 자동 삽입
CREATE OR REPLACE FUNCTION public.handle_new_circle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.passphrase_status (circle_id) VALUES (NEW.id);
  INSERT INTO public.family_rules (circle_id)      VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_circle_created
  AFTER INSERT ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_circle();
