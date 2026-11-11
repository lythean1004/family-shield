import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import SpeakButton from '../components/SpeakButton.jsx'
import { api, getSession } from '../data/api.js'
import { CONSENT_STEPS, CONSENT_VERSION, emptySelection, selectAll, setChoice, isComplete, consentPlan, comprehensionQuestion } from '../data/consent.js'
export { CONSENT_VERSION }

export default function SetupScreen() {
  const [session,setSession] = useState(undefined)
  const [role,setRole] = useState('parent')
  const [code,setCode] = useState('')
  const [over14,setOver14] = useState(false)
  const [relation,setRelation] = useState('딸')
  const [invite,setInvite] = useState(null)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [selection,setSelection] = useState(emptySelection())
  const [open,setOpen] = useState(null)
  const [quiz,setQuiz] = useState(null) // null | 'ask' | 'retry' | 'done'
  const refresh = async () => { const s=await getSession(); setSession(s); return s }
  useEffect(() => { refresh().catch(e=>setError(e.message)) },[])
  const run = async (fn) => { setBusy(true);setError('');try{await fn()}catch(e){setError(e.message)}finally{setBusy(false)} }
  const parentCircle = session?.circles.find(c=>c.isParent)
  const latest = item => session?.consents.find(c=>c.circleId===parentCircle?.id && c.item===item)
  // 새 버전(v3)으로 네 항목을 모두 고른 적이 없으면 동의 화면을 보여 준다
  const needsConsent = parentCircle && !CONSENT_STEPS.every(st=>latest(st.item)?.text_version===CONSENT_VERSION)
  const recipients = (session?.members ?? []).filter(m=>m.circleId===parentCircle?.id)
  const question = comprehensionQuestion(session?.members, parentCircle?.id)
  const login = (event) => {
    event.preventDefault()
    run(async()=>{const data=await api(role==='parent'?'/auth/join':'/auth/demo',{code,over14});setSession(data.session);setCode('');setSelection(emptySelection());setQuiz(null)})
  }
  // 고른 대로 저장(가족 보내기를 묻기보다 먼저). 가족 보내기를 허락했으면 이해 확인으로
  const save = () => run(async()=>{
    for (const {item,granted} of consentPlan(selection)) {
      await api('/consent',{circleId:parentCircle.id,item,granted,textVersion:CONSENT_VERSION})
    }
    await refresh()
    setQuiz(selection.family_alert && question ? 'ask' : 'done')
  })
  const answer = (correct) => run(async()=>{
    await api('/consent',{circleId:parentCircle.id,item:'comprehension',granted:correct,textVersion:CONSENT_VERSION})
    setQuiz(correct ? 'done' : 'retry')
  })
  return <main id="main" className="mode-parent">
    <h1 className="screen-title">가족 연결</h1>
    <p className="demo-badge">시연용 계정</p>
    <p className="screen-body">지금은 가상 문자로만 시험해 주세요. 동의 문구는 법률 검토 전이며 실제 개인정보를 입력하지 마세요.</p>
    {error && <p role="alert" className="screen-body">{error}</p>}
    {session===undefined && !error && <p role="status">연결 상태를 확인하고 있어요.</p>}
    {session===null && <form onSubmit={login} className="setup-form">
      <label>사용하실 분<select value={role} onChange={e=>setRole(e.target.value)}><option value="parent">부모님</option><option value="guardian">보호자</option></select></label>
      <label>{role==='parent'?'보호자가 알려준 초대 코드':'운영자가 알려준 참여 코드'}<input inputMode="numeric" autoComplete="off" pattern="[0-9]{8}" maxLength={8} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label>
      <label className="setup-check"><input type="checkbox" checked={over14} onChange={e=>setOver14(e.target.checked)} required/>저는 만 14세 이상입니다.</label>
      <button className="action-btn action-btn--primary" disabled={busy || !over14 || code.length!==8}>가족 연결 시작</button>
      <p className="screen-body">코드는 10분 동안 한 번만 쓸 수 있어요. 만 14세 미만은 가입할 수 없어요.</p>
    </form>}
    {session && !parentCircle && <section className="setup-form" aria-label="부모님 초대">
      <p className="screen-body">부모님과 함께 있을 때 코드를 알려드리세요. 부모님 휴대폰에서 직접 동의해 주세요.</p>
      <label>부모님과 나의 관계<select value={relation} onChange={e=>setRelation(e.target.value)}>{['딸','아들','배우자','가족'].map(r=><option key={r}>{r}</option>)}</select></label>
      <ActionButton disabled={busy} onClick={()=>run(async()=>setInvite(await api('/circle/invite',{relation})))}>부모님 초대 코드 만들기</ActionButton>
      {invite && <div role="status"><p className="setup-code">{invite.code}</p><p className="screen-body">{new Date(invite.expiresAt).toLocaleTimeString('ko-KR')}까지 한 번 쓸 수 있어요. 새 코드를 만들면 이전 코드는 사용할 수 없어요.</p></div>}
      <ActionButton variant="secondary" disabled={busy} onClick={()=>run(refresh)}>가족 연결 확인</ActionButton>
      <p className="screen-body">연결된 가족: {session.circles.length}명</p>
      <Link className="action-btn action-btn--secondary" to="/family/dashboard">확인 요청 보기</Link>
    </section>}
    {parentCircle && needsConsent && !quiz && <section aria-label="부모님 직접 동의" className="consent-list">
      <h2 className="screen-title">허락할 내용을 골라 주세요</h2>
      <p className="screen-body">하나씩 골라도 되고, 한 번에 모두 허락해도 돼요. [자세히]를 누르면 내용을 볼 수 있어요.</p>
      <ActionButton disabled={busy} onClick={()=>setSelection(selectAll())}>모두 허락</ActionButton>
      {CONSENT_STEPS.map(st=>{
        const locked = st.item==='impersonation_check' && selection.family_alert!==true
        const isOpen = open===st.item
        return <article key={st.item} className="consent-item">
          <h3 className="consent-item__title">{st.title}</h3>
          <p className="screen-body">{st.summary}</p>
          {st.item==='family_alert' && <p className="screen-body"><strong>받는 사람:</strong> {recipients.length ? recipients.map(m=>m.callName&&m.callName!==m.relation?`${m.callName}(${m.relation})`:m.relation).join(', ') : '아직 연결된 가족이 없어요'}</p>}
          <button type="button" className="consent-item__more" aria-expanded={isOpen} aria-controls={`consent-${st.item}`} onClick={()=>setOpen(isOpen?null:st.item)}>{isOpen?'접기':'자세히'}</button>
          {isOpen && <div id={`consent-${st.item}`}>
            <ul className="consent-item__details">{st.details.map(d=><li key={d}>{d}</li>)}<li>{st.ifDeclined}</li></ul>
            <SpeakButton text={[st.title, st.summary, ...st.details, st.ifDeclined].join(' ')} />
          </div>}
          <div className="consent-item__choice" role="group" aria-label={`${st.title} 선택`}>
            <button type="button" className={`consent-choice${selection[st.item]===true?' consent-choice--on':''}`} aria-pressed={selection[st.item]===true} disabled={busy||locked} onClick={()=>setSelection(setChoice(selection,st.item,true))}>허락</button>
            <button type="button" className={`consent-choice${selection[st.item]===false?' consent-choice--on':''}`} aria-pressed={selection[st.item]===false} disabled={busy} onClick={()=>setSelection(setChoice(selection,st.item,false))}>허락 안 함</button>
          </div>
          {locked && <p className="screen-body">②를 허락해야 켤 수 있어요.</p>}
        </article>
      })}
      <ActionButton disabled={busy || !isComplete(selection)} onClick={save}>{isComplete(selection)?'고른 대로 저장':'모든 항목을 골라 주세요'}</ActionButton>
    </section>}
    {parentCircle && (quiz==='ask'||quiz==='retry') && question && <section aria-label="이해 확인">
      <h2 className="screen-title">확인할게요</h2>
      {quiz==='retry' && <div className="screen-body" role="status"><p>다시 알려 드릴게요. 내가 “가족에게 물어보기”를 누를 때 아래 가족이 위험 단계와 정해진 요약을 봐요. 문자 원문은 보내지 않아요.</p><SpeakButton text={`내가 가족에게 물어보기를 누를 때 ${question.options[0].label}이 위험 단계와 정해진 요약을 봐요. 문자 원문은 보내지 않아요.`} /><p>보호자 도움 없이 직접 골라 주세요.</p></div>}
      <p className="screen-body">{question.question}</p>
      <div className="screen-actions">{question.options.map(o=><ActionButton key={o.label} variant="secondary" disabled={busy} onClick={()=>answer(o.correct)}>{o.label}</ActionButton>)}</div>
    </section>}
    {parentCircle && !needsConsent && (quiz===null||quiz==='done') && <section><h2 className="screen-title">가족이 연결됐어요</h2><p className="screen-body">허락한 내용은 설정에서 바꿀 수 있어요. 알림 도착 시험은 따로 확인해야 해요.</p><Link to="/check/input" className="action-btn action-btn--primary">가상 문자로 확인하기</Link></section>}
    {session && <div className="screen-actions"><ActionButton variant="secondary" disabled={busy} onClick={()=>run(async()=>{await api('/auth/logout',{});sessionStorage.clear();setSession(null);setInvite(null)})}>로그아웃</ActionButton></div>}
    <NoLinkFooter/>
  </main>
}
