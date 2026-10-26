/**
 * LimitNotice — 한계 문구 (F4-8, 모든 결과 화면 하단)
 */
export const LIMIT_NOTICE =
  '이 결과는 참고용입니다. 정상 메시지를 위험으로 보거나 위험한 메시지를 놓칠 수 있습니다. ' +
  '확실하지 않으면 메시지 속 번호나 링크가 아닌, 직접 찾은 공식 번호로 확인하세요.'

export default function LimitNotice() {
  return (
    <p className="limit-notice">{LIMIT_NOTICE}</p>
  )
}
