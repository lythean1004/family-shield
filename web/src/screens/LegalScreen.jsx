// 개인정보 처리방침·이용약관 화면 (/privacy, /terms). 내용은 data/legal.js 한 곳에서 관리한다.
import { Link } from 'react-router-dom'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { PRIVACY, TERMS, LEGAL_NOTICE } from '../data/legal.js'

export default function LegalScreen({ kind }) {
  const doc = kind === 'terms' ? TERMS : PRIVACY
  return (
    <main id="main" className="mode-parent legal">
      <h1 className="screen-title">{doc.title}</h1>
      <p className="legal-notice" role="note">{LEGAL_NOTICE}</p>
      {doc.sections.map((s) => (
        <section key={s.h} className="legal-section">
          <h2>{s.h}</h2>
          {s.rows && (
            <div className="legal-table-wrap">
              <table className="legal-table">
                <thead><tr>{s.head.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
                <tbody>{s.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} data-label={s.head[i]}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
          {(s.p ?? []).map((t) => <p key={t}>{t}</p>)}
        </section>
      ))}
      <div className="screen-actions">
        <Link className="action-btn" to={kind === 'terms' ? '/privacy' : '/terms'}>
          {kind === 'terms' ? '개인정보 처리방침 보기' : '이용약관 보기'}
        </Link>
        <Link className="action-btn action-btn--primary" to="/">처음으로</Link>
      </div>
      <NoLinkFooter />
    </main>
  )
}
