import {useEffect,useState} from 'react'
import {api} from '../data/api.js'
import ActionButton from './ActionButton.jsx'

function publicKeyBytes(key){return Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))}
export default function PushSettings(){
  const [config,setConfig]=useState(null),[id,setId]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window
  const refresh=async()=>{
    const current=await api('/push/config');setConfig(current)
    const registration=await navigator.serviceWorker?.getRegistration()
    const subscription=await registration?.pushManager.getSubscription()
    // The subscription ID is per current browser; a different device's test is never shown as this device's success.
    if(subscription){const saved=await api('/push/identify',{endpoint:subscription.endpoint});setId(saved.id)}
  }
  useEffect(()=>{refresh().catch(()=>{});const focus=()=>refresh().catch(()=>{});window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus)},[])
  const enable=async()=>{
    setBusy(true);setMessage('')
    try{
      if(await Notification.requestPermission()!=='granted')throw new Error('알림 권한이 꺼져 있어요. 휴대폰의 브라우저 설정에서 허용해 주세요.')
      const registration=await navigator.serviceWorker.getRegistration()
      if(!registration)throw new Error('앱을 설치하거나 새로고침한 뒤 다시 해 주세요.')
      let subscription=await registration.pushManager.getSubscription()
      if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKeyBytes(config.publicKey)})
      const saved=await api('/push/subscribe',subscription.toJSON());setId(saved.id)
      setMessage('알림을 켰어요. 시험 알림을 보내고 도착한 알림을 눌러 주세요.')
      setConfig(await api('/push/config'))
    }catch(e){setMessage(e.message)}finally{setBusy(false)}
  }
  const test=async()=>{setBusy(true);try{await api('/push/test',{id});setMessage('시험 알림을 보냈어요. 휴대폰에 도착한 알림을 눌러 주세요.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}
  const revoke=async()=>{setBusy(true);try{await api('/push/revoke',{id});const registration=await navigator.serviceWorker.getRegistration();await(await registration?.pushManager.getSubscription())?.unsubscribe();setId(null);setMessage('이 기기의 알림을 껐어요.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}
  const confirmed=config?.subscriptions.find(s=>s.id===id)?.confirmedAt
  return <section className="settings-section" aria-label="웹 알림 설정">
    <h2 className="settings-section__title">휴대폰 알림</h2>
    <p className="screen-body">알림에는 문자 내용이나 위험 단계를 표시하지 않아요. 아이폰은 먼저 홈 화면에 추가한 앱에서 열어 주세요.</p>
    {!supported?<p className="screen-body">이 브라우저는 알림을 지원하지 않아요. 가족 확인 화면을 열거나 직접 연락해 주세요.</p>
      :!config?<p className="screen-body">가족 연결 후 알림을 설정할 수 있어요.</p>
      :!config.enabled?<p className="screen-body">서버 알림 설정을 준비하고 있어요. 확인 요청 내역은 직접 열어볼 수 있어요.</p>
      :<div className="screen-actions">
        {!id?<ActionButton disabled={busy} onClick={enable}>이 기기에서 알림 받기</ActionButton>:<>
          <ActionButton disabled={busy} onClick={test}>시험 알림 보내기</ActionButton>
          <ActionButton variant="secondary" disabled={busy} onClick={revoke}>이 기기 알림 끄기</ActionButton>
        </>}
      </div>}
    {confirmed&&<p className="screen-body" role="status">이 기기에서 시험 알림을 누른 것을 확인했어요.</p>}
    {message&&<p className="screen-body" role="status">{message}</p>}
  </section>
}
