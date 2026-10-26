/**
 * CallButton — tel: 전화 버튼 (U7: 근거 카드·번호 카드 번호만 허용)
 * name: 기관 이름
 * number: 전화번호 (표시용)
 * source: 출처 문구 (예: "경찰청 · 확인일 2026-10-15")
 */
export default function CallButton({ name, number, source }) {
  // tel: 링크에 쓸 숫자만 추출
  const telNumber = number.replace(/[^0-9]/g, '')
  return (
    <a
      href={`tel:${telNumber}`}
      className="call-btn"
      aria-label={`${name} ${number} 전화`}
    >
      <span className="call-btn__name">{name}</span>
      <span className="call-btn__number tabular">{number}</span>
      {source && (
        <span className="call-btn__source">출처 {source}</span>
      )}
    </a>
  )
}
