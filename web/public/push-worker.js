// No names, verdicts, messages or external links are placed on the lock screen.
self.addEventListener('push',event=>{
  let payload={}
  try{payload=event.data?.json()||{}}catch{}
  const isTest=payload.kind==='test'&&typeof payload.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(payload.token)
  event.waitUntil(self.registration.showNotification('가족방패',{
    body:isTest?'시험 알림이에요. 눌러서 도착을 확인해 주세요.':'확인할 알림이 있어요. 앱을 열어 확인해 주세요.',
    icon:'/icon.svg',tag:isTest?'family-shield-test':'family-shield-request',
    data:isTest?{kind:'test',token:payload.token}:{kind:'request'},
  }))
})
self.addEventListener('notificationclick',event=>{
  event.notification.close()
  event.waitUntil((async()=>{
    const data=event.notification.data||{}
    if(data.kind==='test') {
      try{await fetch('/api/push/ack',{method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'content-type':'application/json','x-fs-request':'1'},body:JSON.stringify({token:data.token})})}catch{}
    }
    const target=new URL(data.kind==='test'?'/settings':'/family/dashboard',self.location.origin).href
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true})
    const existing=windows.find(w=>new URL(w.url).origin===self.location.origin)
    if(existing){await existing.navigate(target);await existing.focus()}
    else await self.clients.openWindow(target)
  })())
})
