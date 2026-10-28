-- Keep the original rule: only trusted server code writes checks.
drop policy "checks: 부모님 생성" on public.checks;
drop policy "checks: 부모님 판정 갱신" on public.checks;
