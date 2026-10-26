/**
 * VerdictBanner — 판정 단계 표시 (U3: 색 + SVG 아이콘 + 글자, D33)
 * level: 'danger' | 'caution' | 'check'
 * description: 한 줄 설명 (선택)
 */
const CONFIG = {
  danger:  { label: '위험',    icon: '/icons/icon-danger.svg',  cls: 'verdict--danger' },
  caution: { label: '주의',    icon: '/icons/icon-caution.svg', cls: 'verdict--caution' },
  check:   { label: '확인 필요', icon: '/icons/icon-check.svg',   cls: 'verdict--check' },
}

export default function VerdictBanner({ level, description }) {
  const cfg = CONFIG[level] ?? CONFIG.check
  return (
    <div className={`verdict-banner ${cfg.cls}`} role="status">
      <img
        src={cfg.icon}
        alt=""
        className="verdict-banner__icon"
        width={48}
        height={48}
      />
      <span className="verdict-banner__label">{cfg.label}</span>
      {description && (
        <p className="verdict-banner__desc">{description}</p>
      )}
    </div>
  )
}
