import {test,describe,after} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {makeHandler} from '../src/handler.js'
import {createDatabase} from '../src/database.js'
import {createAuth,hashCode,hashToken,newCode,CONSENT_VERSION} from '../src/auth.js'
import {createReceipts,createDbResultStore,createCheckRecorder} from '../src/results.js'
import {createConfirmService,PROCESSING_VERSION} from '../src/confirm.js'

const result={level:'주의',signals_final:['SIG_LINK'],fired_rules:['R7'],impersonation_type:'none',
  explanation_for_parent:['Never persist this sentence or 010-0000-1234'],text:'RAW INPUT'}
const key='local-confirm-test-key'
test('result receipts reject tampering and other accounts and omit free text',()=>{
  const receipts=createReceipts(key),receipt=receipts.issue(result,'parent')
  assert.equal(receipts.read(receipt,'parent').level,'주의')
  assert.throws(()=>receipts.read(receipt,'outsider'))
  assert.throws(()=>receipts.read(receipt+'x','parent'))
  const data=Buffer.from(receipt.split('.')[0],'base64url').toString()
  assert.ok(!data.includes('Never persist')&&!data.includes('RAW INPUT'))
})
test('parent context is re-signed by the server and cannot lower a verdict',async()=>{
  const receipts=createReceipts(key),service=createConfirmService(null,receipts)
  const first=await service.context('parent',{receipt:receipts.issue(result,'parent'),calledBefore:true,level:'확인필요'})
  assert.equal(first.result.level,'위험')
  assert.ok(first.result.fired_rules.includes('R2'))
  const again=await service.context('parent',{receipt:first.result.receipt,calledBefore:false})
  assert.equal(receipts.read(again.result.receipt,'parent').level,'위험')
})

describe('PostgreSQL family round trip',{skip:process.env.FS_DB_TEST!=='1'},()=>{
  const db=createDatabase({host:'127.0.0.1',port:55432,database:'familyshield',user:'fs_app'})
  const auth=createAuth(db,{hmacKey:key}),receipts=createReceipts(key),service=createConfirmService(db,receipts)
  const users=[]
  const anonymousChecks=[]
  after(async()=>{try{await db.service(async tx=>{
    await tx.query('delete from public.circles where protected_user_id=any($1::uuid[])',[users])
    await tx.query('delete from public.checks where id=any($1::uuid[])',[anonymousChecks])
    await tx.query('delete from auth.users where id=any($1::uuid[])',[users])
  })}finally{await db.close()}})
  async function family() {
    const code=newCode()
    await db.service(tx=>tx.query('insert into private.demo_codes(code_hash) values($1)',[hashCode(code,key)]))
    const g=await auth.redeem(code,true,code);users.push(g.userId)
    const invite=await auth.invite(g.userId,'딸')
    const p=await auth.redeem(invite.code,true,invite.code,true);users.push(p.userId)
    const circleId=(await auth.profile(p.userId)).circles[0].id
    for(const item of ['family_alert','impersonation_check'])await auth.consent(p.userId,{circleId,item,granted:true,textVersion:CONSENT_VERSION})
    const body={receipt:receipts.issue(result,p.userId),requestType:'link_check',processingConsent:true,processingVersion:PROCESSING_VERSION}
    return {p:p.userId,g:g.userId,circleId,body,token:p.token}
  }
  test('no storage without record consent; per-request consent and retries are recorded once',async()=>{
    const f=await family()
    await assert.rejects(service.create(f.p,{...f.body,processingConsent:false}),{reason:'processing_consent_required'})
    const a=await service.create(f.p,f.body),b=await service.create(f.p,f.body)
    assert.equal(a.request.id,b.request.id);assert.equal(b.created,false)
    assert.equal((await service.get(f.g,a.request.id)).canRespond,true)
    const {rows:[stored]}=await db.service(tx=>tx.query('select ch.*,cr.processing_consent_version from public.checks ch join public.confirm_requests cr on cr.check_id=ch.id where cr.id=$1',[a.request.id]))
    assert.equal(stored.processing_consent_version,PROCESSING_VERSION)
    assert.ok(!JSON.stringify(stored).includes('Never persist'))
    assert.equal((await auth.profile(f.p)).consents.find(c=>c.item==='check_log'),undefined)
  })
  test('analysis records require current check-log consent and are stored once without free text',async()=>{
    const f=await family(),record=createCheckRecorder(db,receipts)
    assert.equal(await record(f.p,f.body.receipt),null)
    await auth.consent(f.p,{circleId:f.circleId,item:'check_log',granted:true,textVersion:CONSENT_VERSION})
    const id=await record(f.p,f.body.receipt)
    assert.ok(id)
    assert.equal(await record(f.p,f.body.receipt),id)
    const {rows:[row]}=await db.service(tx=>tx.query('select * from public.checks where id=$1',[id]))
    assert.ok(!JSON.stringify(row).includes('Never persist')&&!JSON.stringify(row).includes('RAW INPUT'))
    assert.ok(new Date(row.purge_at)-new Date(row.created_at)<=86400100)
    const {request}=await service.create(f.p,{...f.body,processingConsent:false})
    assert.equal(request.checkId,id)
    await auth.consent(f.p,{circleId:f.circleId,item:'check_log',granted:false,textVersion:CONSENT_VERSION})
    assert.equal(await record(f.p,receipts.issue(result,f.p)),null)
    const count=await db.service(tx=>tx.query('select count(*)::int as n from public.checks where circle_id=$1',[f.circleId]))
    assert.equal(count.rows[0].n,1)
  })
  test('HTTP analysis and context honor record consent and reuse the stored check for a request',async()=>{
    const f=await family()
    const handler=makeHandler({database:{host:'127.0.0.1',port:55432,database:'familyshield',user:'fs_app'},hmacKey:key,
      ai:{model:'',webModel:'',apiKey:'unused'},webBaseUrl:'http://127.0.0.1:5173'})
    const server=createServer(handler)
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
    const post=async(path,body)=>{
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,{method:'POST',
        headers:{'content-type':'application/json','x-fs-request':'1',origin:'http://127.0.0.1:5173',cookie:`fs_session=${f.token}`},body:JSON.stringify(body)})
      assert.equal(response.status,200)
      return response.json()
    }
    const count=async()=>(await db.service(tx=>tx.query('select count(*)::int as n from public.checks where circle_id=$1',[f.circleId]))).rows[0].n
    try {
      await post('analyze',{text:'합성 안내 https://example.invalid/check'})
      assert.equal(await count(),0)
      await auth.consent(f.p,{circleId:f.circleId,item:'check_log',granted:true,textVersion:CONSENT_VERSION})
      const analyzed=await post('analyze',{text:'합성 안내 https://example.invalid/check'})
      assert.equal(await count(),1)
      const updated=await post('result/context',{receipt:analyzed.result.receipt,calledBefore:true})
      assert.equal(updated.result.level,'위험')
      assert.equal(await count(),2)
      const requested=await post('confirm',{receipt:updated.result.receipt,requestType:'link_check'})
      assert.ok(requested.request.id)
      assert.equal(await count(),2)
    }finally{await new Promise(resolve=>server.close(resolve));await handler.close()}
  })
  test('only the target can respond, and two simultaneous replies have one winner',async()=>{
    const f=await family(),other=await family()
    const {request}=await service.create(f.p,{...f.body,requestType:'impersonation'})
    assert.equal(await service.get(other.g,request.id),null)
    await assert.rejects(service.respond(f.p,request.id,'sent'),{reason:'missing'})
    await assert.rejects(service.respond(other.g,request.id,'sent'),{reason:'missing'})
    const replies=await Promise.allSettled([service.respond(f.g,request.id,'not_sent'),service.respond(f.g,request.id,'sent')])
    assert.equal(replies.filter(r=>r.status==='fulfilled').length,1)
    const final=await service.get(f.p,request.id)
    assert.equal(final.state,'responded')
    assert.equal(final.summary.level,final.answer==='not_sent'?'위험':'주의')
  })
  test('revoking consent cancels pending requests and blocks guardian access',async()=>{
    const f=await family(),{request}=await service.create(f.p,f.body)
    await auth.consent(f.p,{circleId:f.circleId,item:'family_alert',granted:false,textVersion:CONSENT_VERSION})
    assert.equal((await service.get(f.p,request.id)).state,'cancelled')
    assert.equal(await service.get(f.g,request.id),null)
    await assert.rejects(service.respond(f.g,request.id,'will_call'))
  })
  test('removed guardians and expired requests cannot be answered',async()=>{
    const f=await family(),{request}=await service.create(f.p,f.body)
    await db.service(tx=>tx.query("update public.confirm_requests set deadline_at=now()-interval '1 second' where id=$1",[request.id]))
    assert.equal((await service.get(f.p,request.id)).state,'expired')
    await assert.rejects(service.respond(f.g,request.id,'will_call'))
    await db.service(tx=>tx.query("update public.circle_members set status='removed' where circle_id=$1",[f.circleId]))
    assert.equal(await service.get(f.g,request.id),null)
  })
  test('result token survives store recreation and only redeems once concurrently',async()=>{
    const token=await createDbResultStore(db).put(result)
    const {rows:[record]}=await db.service(tx=>tx.query('select check_id from public.result_tokens where token_hash=$1',[hashToken(token)]))
    anonymousChecks.push(record.check_id)
    const second=createDbResultStore(db)
    const replies=await Promise.all([second.redeem(token),second.redeem(token)])
    assert.equal(replies.filter(r=>r.ok).length,1)
    assert.equal(replies.find(r=>r.ok).result.level,'주의')
    assert.ok(!JSON.stringify(replies).includes('Never persist'))
  })
  test('report requires separate consent and ignores supplied raw text',async()=>{
    const f=await family()
    await assert.rejects(service.report(f.p,{receipt:f.body.receipt,reason:'other'}),{reason:'report_consent'})
    const report=await service.report(f.p,{receipt:f.body.receipt,reason:'other',shareConsent:true,masked_text:'RAW INPUT'})
    const {rows:[row]}=await db.service(tx=>tx.query('select * from public.misjudge_reports where id=$1',[report.id]))
    assert.equal(row.masked_text,null)
  })
})
