import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { api, getSession } from '../data/api.js'

export const CONSENT_VERSION = 'demo-2026-10-28-v1'
const STEPS = [
  {item:'family_alert',title:'① 가족에게 알려드릴까요?',text:'위험한 문자로 판단되면 연결한 가족에게 위험 단계와 정해진 요약을 알려드려요. 문자 원문은 보내지 않아요. AI 제공사가 가려진 내용을 국외에서 일정 기간 보관할 수 있어요.'},
  {item:'impersonation_check',title:'② 가족에게 물어볼까요?',text:'가족이 보낸 문자인지 직접 물어보고 답을 받을 수 있어요. 가족 알림에 동의한 경우에만 사용할 수 있어요.'},
  {item:'check_log',title:'③ 확인 기록을 남길까요?',text:'위험 단계와 신호 등 확인 기록을 24시간 보관해요. 삭제 작업은 10분마다 실행돼요. 문자 원문은 저장하지 않아요. 백업에는 삭제 후 최대 7일 남을 수 있어요.'},
]
export default function SetupScreen() {
  const [session,setSession] = useState(undefined)
  const [role,setRole] = useState('parent')
  const [code,setCode] = useState('')
  const [over14,setOver14] = useState(false)
  const [relation,setRelation] = useState('딸')
  const [invite,setInvite] = useState(null)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [step,setStep] = useState(0)
  const refresh = async () => { const s=await getSession(); setSession(s); return s }
  useEffect(() => { refresh().catch(e=>setError(e.message)) },[])
  const run = async (fn) => { setBusy(true);setError('');try{await fn()}catch(e){setError(e.message)}finally{setBusy(false)} }
  const parentCircle = session?.circles.find(c=>c.isParent)
  const current = STEPS[step]
  const alertGranted = session?.consents.find(c=>c.circleId===parentCircle?.id && c.item==='family_alert')?.granted
  const login = (event) => {
    event.preventDefault()
    run(async()=>{const data=await api(role==='parent'?'/auth/join':'/auth/demo',{code,over14});setSession(data.session);setCode('');setStep(0)})
  }
  const consent = (granted) => run(async()=>{
    await api('/consent',{circleId:parentCircle.id,item:current.item,granted,textVersion:CONSENT_VERSION})
    await refresh();setStep(step+1)
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
    {parentCircle && current && <section aria-label="부모님 직접 동의">
      <h2 className="screen-title">{current.title}</h2><p className="screen-body">{current.text}</p>
      <div className="screen-actions">
        <ActionButton disabled={busy || (current.item==='impersonation_check'&&!alertGranted)} onClick={()=>consent(true)}>동의해요</ActionButton>
        <ActionButton variant="secondary" disabled={busy} onClick={()=>consent(false)}>동의하지 않아요</ActionButton>
      </div>
      {current.item==='impersonation_check'&&!alertGranted && <p className="screen-body">가족 알림에 동의하지 않아 사칭 확인도 꺼져 있어요.</p>}
    </section>}
    {parentCircle && !current && <section><h2 className="screen-title">가족이 연결됐어요</h2><p className="screen-body">동의는 설정에서 바꿀 수 있어요. 알림 도착 시험은 따로 확인해야 해요.</p><Link to="/check/input" className="action-btn action-btn--primary">가상 문자로 확인하기</Link></section>}
    {session && <div className="screen-actions"><ActionButton variant="secondary" disabled={busy} onClick={()=>run(async()=>{await api('/auth/logout',{});sessionStorage.clear();setSession(null);setInvite(null)})}>로그아웃</ActionButton></div>}
    <NoLinkFooter/>
  </main>
}
