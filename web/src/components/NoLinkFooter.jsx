/**
 * NoLinkFooter — "가족방패는 문자로 링크를 보내지 않아요." (U4, 모든 화면 맨 아래)
 * 처리방침·약관 상시 링크(멘토 Q3·Q13, compliance-plan 4단계)
 */
import { Link } from 'react-router-dom'

export default function NoLinkFooter() {
  return (
    <footer className="no-link-footer">
      가족방패는 문자로 링크를 보내지 않아요.
      <nav className="legal-links" aria-label="약관과 개인정보">
        <Link to="/privacy">개인정보 처리방침</Link>
        <span aria-hidden="true"> · </span>
        <Link to="/terms">이용약관</Link>
      </nav>
    </footer>
  )
}
