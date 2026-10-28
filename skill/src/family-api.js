import { checkBrowserRequest, fail } from './auth.js'

export function createFamilyApi(auth,confirm,config,{notify=async()=>{}}={}) {
  return async(req,send,readBody)=>{
    const url=new URL(req.url,'http://local')
    const path=url.pathname
    if(path!=='/api/confirm'&&!path.startsWith('/api/confirm/')&&path!=='/api/misjudge'&&path!=='/api/result/context') return false
    try {
      const session=await auth.authenticate(req)
      if(!session) fail(401,'login_required')
      const id=path.split('/')[3]
      if(req.method==='GET'&&path.startsWith('/api/confirm')) {
        if(id) {const request=await confirm.get(session.userId,id);if(!request)fail(404,'missing');send(200,{ok:true,request})}
        else send(200,{ok:true,requests:await confirm.list(session.userId)})
        return true
      }
      if(req.method!=='POST') fail(405,'method')
      checkBrowserRequest(req,config.webBaseUrl)
      let body
      try{body=JSON.parse(await readBody(req))}catch{fail(400,'json')}
      if(!body||typeof body!=='object') fail(400,'json')
      if(path==='/api/result/context')send(200,await confirm.context(session.userId,body))
      else if(path==='/api/confirm') {
        await auth.checkLimit(`confirm:${session.userId}`)
        const result=await confirm.create(session.userId,body)
        if(result.created) await notify(result.targetId,result.request.id).catch(()=>{})
        send(200,{ok:true,request:result.request})
      } else if(path===`/api/confirm/${id}/respond`) send(200,{ok:true,request:await confirm.respond(session.userId,id,body.answer)})
      else if(path===`/api/confirm/${id}/suspect`) send(200,await confirm.suspect(session.userId,id))
      else if(path==='/api/misjudge') {await auth.checkLimit(`report:${session.userId}`);send(200,await confirm.report(session.userId,body))}
      else fail(404,'missing')
    } catch(error) { send(error.status||503,{ok:false,reason:error.reason||'unavailable'}) }
    return true
  }
}
