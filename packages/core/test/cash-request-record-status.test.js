import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyze } from '../src/pipeline.js'

// 비작동 상담 기록. 요구 자체의 상태와 방문 일정·실제 인계 상태를 구분한다.
const notice = '받은 통지서 요약\n발신처: 경찰서\n요구 내용: 현금을 직접 만나서 인계하라는 내용'
const withdrawn = '\n요청 상태: 해당 요청은 철회됐습니다.'
const cases = [
  ['단일 요구의 마지막 철회 상태', '\n요청 상태: 철회됨', false],
  ['요구 상태에 기록된 확정 취소', '\n요구 상태: 취소 확정', false],
  ['철회할지 확인 중', '\n요청 상태: 철회 여부 확인 중', true],
  ['철회하지 않은 상태', '\n요청 상태: 철회하지 않음', true],
  ['방문 일정만 취소', '\n방문 일정: 취소됨', true],
  ['실제 인계가 이뤄지지 않음', '\n인계 상태: 미이행', true],
  ['별도 문단에 나온 철회 상태', '\n' + withdrawn, true],
  ['같은 요구가 유효하다고 최종 확인', withdrawn + '\n요청 상태: 같은 요구는 현재 유효합니다.', true],
  ['단일 필드 안에 요구가 두 개', ' 및 별개 일정 안내 요청\n요청 상태: 철회됨', true],
  ['다른 요청이 함께 있는 기록', '\n요청 사항: 자료 목록 정리\n요청 상태: 철회됨', true],
  ['종결 뒤 기록 담당자만 적음', withdrawn + '\n기록 담당: 민원팀', false],
  ['종결 뒤 날짜만 정정', withdrawn + '\n정정: 기록한 날짜만 수정함', false],
  ['종결 뒤 별개 일정의 메모', withdrawn + '\n\n다른 기록의 처리 일자를 적었습니다.', false],
  ['같은 기관의 다른 업무에 관한 유효 상태', withdrawn + '\n\n받은 재확인 기록\n발신처: 경찰서\n처리 목적: 분실물 목록 대조\n요청 상태: 유효함', false],
  ['별건의 참조 메모와 유효 상태가 다른 행', withdrawn + '\n\n그 요청은 이전 자료에 적혀 있습니다.\n처리 목적: 분실물 목록 대조\n요청 상태: 유효함', false],
  ['종결 대상이 명확하지 않은 후속 정정 기록', '\n요청 상태: 취소 완료\n\n받은 정정 기록\n발신처: 경찰서\n요청 상태: 유효', true],
  ['같은 문단의 확정 철회 뒤 작성 일자', '\n요청 상태: 철회됨\n기록 일자: 2026-11-27', false],
  ['새 기록이 이전 현금 요구의 유효 상태를 명시', withdrawn + '\n\n받은 재확인 기록\n발신처: 경찰서\n요청 상태: 같은 현금 인계 요구는 현재 유효합니다.', true],
  ['새로 받은 별도 통지', '\n요청 상태: 철회됨\n\n' + notice, true],
]

for (const [name, suffix, active] of cases) {
  test(name, async () => {
    const result = await analyze({ text: notice + suffix, ai: null })
    assert.equal(result.fired_rules.includes('R15'), active)
    assert.equal(result.level === '위험', active)
  })
}

test('현금 요구 종결 뒤에도 현재 통화 응답은 R1을 유지한다', async () => {
  const result = await analyze({
    text: notice + '\n요청 상태: 철회됨',
    parentInputs: { call_in_progress: true },
    ai: null,
  })
  assert.equal(result.level, '위험')
  assert.ok(result.fired_rules.includes('R1'))
  assert.ok(!result.fired_rules.includes('R15'))
})
