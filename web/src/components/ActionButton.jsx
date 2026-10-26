/**
 * ActionButton — 큰 행동 버튼 (U1: 높이 64px [임시], 전체 폭)
 * variant: 'primary' | 'secondary' | 'danger'
 */
export default function ActionButton({
  variant = 'primary',
  onClick,
  children,
  disabled = false,
  type = 'button',
}) {
  return (
    <button
      type={type}
      className={`action-btn action-btn--${variant}`}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
    >
      {children}
    </button>
  )
}
