/**
 * C2. 보호자: 요약과 응답 /family/req/:id   (mode-guardian, 일반 글자 크기)
 * C3. 보호자: 응답 후 안내 /family/req/:id/done
 *
 * 보여 주는 것은 F5-8 범위만: 받은 시각, 문장 틀 요약(9-9), 사칭된 관계, 끝 4자리(입력했을 때만).
 * 원문·AI 설명은 보여 주지 않는다(U8).
 * "제가 보냈어요"는 맨 아래, 누르면 한 번 더 묻는다.
 * 응답은 한 번만(F5-4). 로그인·대상자 확인은 4주차(Supabase Auth + RLS C4 정책).
 */
import { useEffect, useState } from 'react'
import { Route, Routes, useNavigate, useParams } from 'react-router-dom'
import VerdictBanner from '../components/VerdictBanner.jsx'
import SignalList from '../components/SignalList.jsx'
import ActionButton from '../components/ActionButton.jsx'
import CallButton from '../components/CallButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { ANSWERS, ANSWERS_LINK, REQUEST_TYPES, confirmStore, DEV_FAMILY, formatTime } from '../data/confirm.js'
import { levelKey } from '../data/result.js'

export default function FamilyScreen() {
  return (
    <Routes>
      <Route path="req/:id" element={<RequestScreen />} />
      <Route path="req/:id/done" element={<DoneScreen />} />
      <Route path="*" element={<NoRequest />} />
    </Routes>
  )
}

function NoRequest() {
  return (
    <main id="main" className="mode-guardian">
      <h1 className="screen-title">확인 요청을 찾을 수 없어요.</h1>
      <p className="screen-body">요청이 지워졌거나(24시간 보관) 주소가 잘못됐어요. 부모님께 직접 전화해 보세요.</p>
      <NoLinkFooter />
    </main>
  )
}

function RequestScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [confirmSent, setConfirmSent] = useState(false)
  const [req, setReq] = useState(null)
  const { parent } = DEV_FAMILY

  // 초기 로드
  useEffect(() => {
    if (!id) return
    confirmStore.get(id).then(setReq)
  }, [id])

  if (!req) return <NoRequest />

  const answer = async (a) => {
    await confirmStore.respond(id, a)
    navigate(`/family/req/${id}/done`, { replace: true })
  }

  if (req.state === 'responded') {
    return <DoneScreen />
  }

  const isLinkCheck = req.requestType === REQUEST_TYPES.LINK_CHECK
  const s = req.summary
  return (
    <main id="main" className="mode-guardian">
      <p className="guardian-head">
        {parent.title}({parent.name})가 확인을 요청했어요 · <span className="tabular">{formatTime(req.sentAt)}</span>
      </p>
      <VerdictBanner level={levelKey(s.level)} />
      <SignalList signals={s.signals_final} impersonatedRelation={s.impersonated_relation} />
      {s.sender_last4 && (
        <p className="screen-body">보낸 번호 끝 4자리: <span className="tabular">{s.sender_last4}</span></p>
      )}

      {/* F5-3: 요청 유형에 따라 보호자 버튼 분기 */}
      {isLinkCheck ? (
        <>
          <h1 className="screen-title">어떻게 할까요?</h1>
          <div className="screen-actions">
            <ActionButton variant="primary" onClick={() => answer(ANSWERS_LINK.DONT_PRESS)}>
              누르지 마세요
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => answer(ANSWERS_LINK.WILL_CALL)}>
              제가 전화할게요
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => answer(ANSWERS_LINK.WAIT)}>
              잠깐 기다려 주세요
            </ActionButton>
          </div>
        </>
      ) : (
        <>
          <h1 className="screen-title">이 문자를 보냈나요?</h1>
          {!confirmSent ? (
            <div className="screen-actions">
              <ActionButton variant="primary" onClick={() => answer(ANSWERS.NOT_SENT)}>보낸 적 없어요</ActionButton>
              <ActionButton variant="secondary" onClick={() => answer(ANSWERS.WILL_CALL)}>
                지금 {parent.title}께 전화할게요
              </ActionButton>
              <ActionButton variant="secondary" onClick={() => setConfirmSent(true)}>제가 보냈어요</ActionButton>
            </div>
          ) : (
            <section className="confirm-box" aria-live="polite">
              <p className="screen-body">
                보냈다고 답해도 {parent.title} 화면의 판정은 바뀌지 않아요. 꼭 목소리로 통화해 주세요.
              </p>
              <div className="screen-actions">
                <ActionButton variant="primary" onClick={() => answer(ANSWERS.SENT)}>보냈어요</ActionButton>
                <ActionButton variant="secondary" onClick={() => setConfirmSent(false)}>취소</ActionButton>
              </div>
            </section>
          )}
        </>
      )}
      <NoLinkFooter />
    </main>
  )
}

const DONE_TEXT = {
  // 가족 사칭 답변
  [ANSWERS.NOT_SENT]: (t) => `${t} 화면에 '보낸 적 없음'이 표시됐어요. ${t}께 전화해서 괜찮은지 확인해 주세요.`,
  [ANSWERS.WILL_CALL]: (t) => `지금 ${t}께 전화해 주세요. ${t} 화면에는 '곧 전화가 온다'고 표시돼요.`,
  [ANSWERS.SENT]: (t) => `${t}께 목소리로 통화해서 직접 설명해 주세요.`,
  // F5-3: 링크·일반 문자 답변
  [ANSWERS_LINK.DONT_PRESS]: (t) => `${t} 화면에 '누르지 마세요'가 표시됐어요. ${t}께 전화해서 확인해 주세요.`,
  [ANSWERS_LINK.WILL_CALL]: (t) => `지금 ${t}께 전화해 주세요. ${t} 화면에는 '곧 전화가 온다'고 표시돼요.`,
  [ANSWERS_LINK.WAIT]: (t) => `${t} 화면에 '잠깐 기다려 주세요'가 표시됐어요. 곧 ${t}께 직접 전화해 주세요.`,
}

function DoneScreen() {
  const { id } = useParams()
  const [req, setReq] = useState(null)
  const { parent } = DEV_FAMILY

  // 초기 로드
  useEffect(() => {
    if (!id) return
    confirmStore.get(id).then(setReq)
  }, [id])

  if (!req) return <NoRequest />
  if (req.state !== 'responded') {
    return (
      <main id="main" className="mode-guardian">
        <h1 className="screen-title">아직 답하지 않았어요.</h1>
        <NoLinkFooter />
      </main>
    )
  }

  return (
    <main id="main" className="mode-guardian">
      <h1 className="screen-title">답을 보냈어요.</h1>
      <p className="screen-body">{DONE_TEXT[req.answer](parent.title)}</p>
      <div className="screen-actions">
        {req.deviceSuspect ? (
          <p className="warning-112" role="alert">
            {parent.title} 휴대폰 말고 집 전화나 다른 방법으로 연락해 보세요.
          </p>
        ) : (
          <CallButton name={`${parent.title}께 전화`} number={parent.phone} source="등록된 번호" />
        )}
      </div>
      <NoLinkFooter />
    </main>
  )
}
