import webpush from 'web-push'
import {randomBytes} from 'node:crypto'
import {fail,hashToken,checkBrowserRequest} from './auth.js'

// Only browser push providers may be called. User input cannot select arbitrary URLs.
export function validateSubscription(input) {
  let endpoint
  try{endpoint=new URL(input?.endpoint)}catch{fail(400,'subscription')}
  const host=endpoint.hostname
  const allowed=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(host)
    ||/^[a-z0-9-]+\.notify\.windows\.com$/.test(host)
  if(!allowed||endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.port||endpoint.hash||input.endpoint.length>2048)fail(400,'subscription')
  const {p256dh,auth}=input.keys||{}
  if(typeof p256dh!=='string'||typeof auth!=='string'||!/^[A-Za-z0-9_-]{87}=?$/.test(p256dh)||!/^[A-Za-z0-9_-]{22}={0,2}$/.test(auth))fail(400,'subscription')
  const key=Buffer.from(p256dh,'base64url')
  if(key.length!==65||key[0]!==4||Buffer.from(auth,'base64url').length!==16)fail(400,'subscription')
  return {endpoint:endpoint.href,keys:{p256dh,auth}}
}
export function createPushService(db,config,{send=webpush.sendNotification.bind(webpush)}={}) {
  const enabled=!!(config?.publicKey&&config?.privateKey&&config?.subject)
  const options={TTL:300,urgency:'high',timeout:4000,vapidDetails:enabled?{
    subject:config.subject,publicKey:config.publicKey,privateKey:config.privateKey,
  }:undefined}
  async function status(userId) {
    return db.user(userId,async tx=>({enabled,publicKey:enabled?config.publicKey:null,
      subscriptions:(await tx.query('select id,test_confirmed_at as "confirmedAt" from public.push_subscriptions where revoked_at is null')).rows}))
  }
  async function subscribe(userId,input) {
    if(!enabled)fail(503,'push_unconfigured')
    const subscription=validateSubscription(input)
    return db.user(userId,async tx=>{
      const {rows:[row]}=await tx.query(`insert into public.push_subscriptions(user_id,endpoint,keys) values($1,$2,$3)
        on conflict(user_id,endpoint) do update set keys=excluded.keys,revoked_at=null,test_confirmed_at=null returning id`,[userId,subscription.endpoint,subscription.keys])
      return row.id
    })
  }
  async function identify(userId,endpoint) {
    return db.user(userId,async tx=>({ok:true,id:(await tx.query('select id from public.push_subscriptions where endpoint=$1 and revoked_at is null',[endpoint])).rows[0]?.id||null}))
  }
  async function deliver(row,payload,requestId=null) {
    let result='ok'
    try {
      await send(validateSubscription(row),JSON.stringify(payload),options)
    } catch(error) {result=[404,410].includes(error.statusCode)?'revoked':'fail'}
    await db.service(async tx=>{
      if(result==='ok')await tx.query('update public.push_subscriptions set last_success_at=now() where id=$1',[row.id])
      if(result==='revoked')await tx.query('update public.push_subscriptions set revoked_at=now() where id=$1',[row.id])
      if(requestId)await tx.query(`insert into public.notification_attempts(request_id,channel,result) values($1,'push',$2)`,[requestId,result])
    })
    return result
  }
  async function test(userId,subscriptionId) {
    if(!enabled)fail(503,'push_unconfigured')
    const row=await db.user(userId,async tx=>(await tx.query('select * from public.push_subscriptions where id=$1 and revoked_at is null',[subscriptionId])).rows[0])
    if(!row)fail(404,'subscription')
    const token=randomBytes(32).toString('base64url')
    await db.service(async tx=>{
      await tx.query('delete from private.push_tests where subscription_id=$1',[row.id])
      await tx.query('insert into private.push_tests(token_hash,user_id,subscription_id) values($1,$2,$3)',[hashToken(token),userId,row.id])
    })
    const result=await deliver(row,{kind:'test',token})
    if(result!=='ok')fail(503,'push_failed')
    return {ok:true,sent:true,confirmed:false}
  }
  async function acknowledge(userId,token) {
    if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))fail(400,'push_test')
    return db.service(async tx=>{
      const {rows:[row]}=await tx.query('delete from private.push_tests where token_hash=$1 and user_id=$2 and expires_at>now() returning subscription_id',[hashToken(token),userId])
      if(!row)fail(400,'push_test')
      await tx.query('update public.push_subscriptions set test_confirmed_at=now() where id=$1 and user_id=$2 and revoked_at is null',[row.subscription_id,userId])
      return {ok:true}
    })
  }
  async function notify(userId,requestId) {
    if(!enabled)return
    // Check current ownership/connection/consent immediately before each notification batch.
    const rows=await db.user(userId,async tx=>{
      const {rows:[request]}=await tx.query("select id from public.confirm_requests where id=$1 and target_member_id=$2 and state='pending' and deadline_at>now()",[requestId,userId])
      if(!request)return []
      return (await tx.query('select * from public.push_subscriptions where revoked_at is null')).rows
    })
    await Promise.all(rows.map(row=>deliver(row,{kind:'request'},requestId)))
  }
  async function revoke(userId,id) {
    await db.user(userId,tx=>tx.query('update public.push_subscriptions set revoked_at=now() where id=$1',[id]))
    return {ok:true}
  }
  return {status,subscribe,identify,test,acknowledge,notify,revoke}
}
export function createPushApi(auth,push,config) {
  return async(req,send,readBody)=>{
    const path=new URL(req.url,'http://local').pathname
    if(!path.startsWith('/api/push/'))return false
    try {
      const session=await auth.authenticate(req)
      if(!session)fail(401,'login_required')
      if(path==='/api/push/config'&&req.method==='GET'){send(200,{ok:true,...await push.status(session.userId)});return true}
      if(req.method!=='POST')fail(405,'method')
      checkBrowserRequest(req,config.webBaseUrl)
      let body;try{body=JSON.parse(await readBody(req))}catch{fail(400,'json')}
      if(!body||typeof body!=='object')fail(400,'json')
      if(path==='/api/push/subscribe')send(200,{ok:true,id:await push.subscribe(session.userId,body)})
      else if(path==='/api/push/identify')send(200,await push.identify(session.userId,body.endpoint))
      else if(path==='/api/push/test'){await auth.checkLimit(`push:${session.userId}`);send(200,await push.test(session.userId,body.id))}
      else if(path==='/api/push/ack')send(200,await push.acknowledge(session.userId,body.token))
      else if(path==='/api/push/revoke')send(200,await push.revoke(session.userId,body.id))
      else fail(404,'missing')
    } catch(error){send(error.status||503,{ok:false,reason:error.reason||'unavailable'})}
    return true
  }
}
