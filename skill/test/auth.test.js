import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase } from '../src/database.js'
import { createAuth, hashCode, hashToken, newCode, readSessionCookie, sessionCookie, checkBrowserRequest, CONSENT_VERSION } from '../src/auth.js'

test('session cookie is HttpOnly, Secure and SameSite=Lax; invalid tokens are ignored', () => {
  assert.match(sessionCookie('test'), /HttpOnly; SameSite=Lax; Max-Age=2592000; Secure/)
  assert.match(sessionCookie(null), /Max-Age=0/)
  assert.equal(readSessionCookie({headers:{cookie:'fs_session=bad'}}),null)
  assert.equal(readSessionCookie({headers:{cookie:`other=x; fs_session=${'a'.repeat(43)}`}}),'a'.repeat(43))
})
test('browser writes require same-origin requests and the custom request header', () => {
  assert.throws(()=>checkBrowserRequest({headers:{}},'https://familyshield.kr'))
  assert.throws(()=>checkBrowserRequest({headers:{'x-fs-request':'1',origin:'https://evil.invalid'}},'https://familyshield.kr'))
  assert.doesNotThrow(()=>checkBrowserRequest({headers:{'x-fs-request':'1',origin:'https://familyshield.kr'}},'https://familyshield.kr'))
})

describe('real PostgreSQL: demo login, invitation, consent and isolation', { skip:process.env.FS_DB_TEST !== '1' }, () => {
  // Deliberately fixed local address: cannot accidentally run these writes on the VM.
  const db = createDatabase({host:'127.0.0.1',port:55432,database:'familyshield',user:'fs_app'})
  const key='local-test-only-hmac-key'
  const auth=createAuth(db,{hmacKey:key})
  const users=[]
  after(async()=>{
    try { await db.service(async tx=>{
      await tx.query('delete from public.circles where protected_user_id=any($1::uuid[])',[users])
      await tx.query('delete from auth.users where id=any($1::uuid[])',[users])
    }) } finally { await db.close() }
  })
  async function guardian() {
    const code=newCode()
    await db.service(tx=>tx.query('insert into private.demo_codes(code_hash) values ($1)',[hashCode(code,key)]))
    const result=await auth.redeem(code,true,`test:${code}`)
    users.push(result.userId)
    return result
  }
  test('one-time guardian code: concurrent redemption creates one account',async()=>{
    const code=newCode()
    await db.service(tx=>tx.query('insert into private.demo_codes(code_hash) values ($1)',[hashCode(code,key)]))
    const results=await Promise.allSettled([auth.redeem(code,true,code),auth.redeem(code,true,code)])
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
    users.push(results.find(r=>r.status==='fulfilled').value.userId)
    assert.equal(results.find(r=>r.status==='rejected').reason.reason,'invalid_code')
  })
  test('under 14 and expired codes cannot create accounts',async()=>{
    const code=newCode()
    await db.service(tx=>tx.query("insert into private.demo_codes(code_hash,expires_at) values ($1,now()-interval '1 second')",[hashCode(code,key)]))
    await assert.rejects(auth.redeem(code,false,code),{reason:'age_required'})
    await assert.rejects(auth.redeem(code,true,code),{reason:'invalid_code'})
  })
  test('parent joins guardian; consents append, depend on alert and cannot cross circles',async()=>{
    const g=await guardian()
    const invitation=await auth.invite(g.userId,'딸')
    const parent=await auth.redeem(invitation.code,true,invitation.code,true)
    users.push(parent.userId)
    await assert.rejects(auth.redeem(invitation.code,true,invitation.code,true),{reason:'invalid_code'})
    const profile=await auth.profile(parent.userId)
    const circleId=profile.circles[0].id
    assert.equal(profile.circles[0].isParent,true)
    assert.equal(profile.members[0].id,g.userId)
    assert.equal((await auth.profile(g.userId)).circles[0].isParent,false)
    const consent=(item,granted)=>auth.consent(parent.userId,{circleId,item,granted,textVersion:CONSENT_VERSION})
    await assert.rejects(consent('impersonation_check',true),{reason:'alert_consent_required'})
    await consent('family_alert',true)
    await consent('impersonation_check',true)
    await consent('family_alert',false)
    const current=await auth.profile(parent.userId)
    assert.equal(current.consents.find(c=>c.item==='impersonation_check').granted,false)
    const {rows:[count]}=await db.user(parent.userId,tx=>tx.query('select count(*)::int as n from public.consents where circle_id=$1',[circleId]))
    assert.equal(count.n,4)
    const outsider=await guardian()
    assert.equal((await auth.profile(outsider.userId)).circles.length,0)
    await assert.rejects(auth.consent(outsider.userId,{circleId,item:'family_alert',granted:true,textVersion:CONSENT_VERSION}),{reason:'parent_required'})
    await assert.rejects(db.user(outsider.userId,tx=>tx.query("insert into public.consents(circle_id,user_id,item,granted,text_version) values($1,$2,'family_alert',true,'test')",[circleId,outsider.userId])),{code:'42501'})
    await assert.rejects(db.user(parent.userId,tx=>tx.query('select * from private.sessions')),{code:'42501'})
  })
  test('session survives a new auth instance and logout revokes it',async()=>{
    const g=await guardian()
    const req={headers:{cookie:`fs_session=${g.token}`}}
    assert.equal((await createAuth(db,{hmacKey:key}).authenticate(req)).userId,g.userId)
    await auth.logout(await auth.authenticate(req))
    assert.equal(await auth.authenticate(req),null)
    const other=await guardian()
    await db.service(tx=>tx.query("update private.sessions set expires_at=now()-interval '1 second' where token_hash=$1",[hashToken(other.token)]))
    assert.equal(await auth.authenticate({headers:{cookie:`fs_session=${other.token}`}}),null)
  })
  test('failed code attempts persist and are rate limited',async()=>{
    const subject=`bad:${newCode()}`
    for(let i=0;i<10;i++) await assert.rejects(auth.redeem('bad',true,subject),{reason:'invalid_code'})
    await assert.rejects(createAuth(db,{hmacKey:key}).redeem('bad',true,subject),{reason:'rate_limited'})
  })
})
