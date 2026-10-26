-- anon(비로그인) 권한 회수 (PRD 11-3, 20261023000005 설계 원칙 3)
--
-- Supabase는 public 스키마 테이블에 anon·authenticated 권한을 기본으로 준다.
-- RLS가 행을 걸러 주긴 하지만, 설계 원칙대로 anon은 테이블 권한 자체를 갖지 않게 한다.
-- 공개 데모는 고정 콘텐츠(정적 파일)라 DB를 읽지 않는다(PRD 12-5).

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

-- 앞으로 만드는 객체에도 anon 권한을 주지 않는다
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
