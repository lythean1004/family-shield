import {test,describe,after} from 'node:test'
import assert from 'node:assert/strict'
import {createECDH,randomBytes,randomUUID} from 'node:crypto'
import {createDatabase} from '../src/database.js'
import {createPushService,validateSubscription} from '../src/push.js'
const key=createECDH('prime256v1');key.generateKeys()
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/local-test',keys:{p256dh:key.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}
test('push subscriptions reject arbitrary hosts, credentials and malformed keys',()=>{
  assert.equal(validateSubscription(subscription).endpoint,subscription.endpoint)
  for(const endpoint of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.invalid/x','https://user@fcm.googleapis.com/x','https://fcm.googleapis.com:8443/x'])
    assert.throws(()=>validateSubscription({...subscription,endpoint}))
  assert.throws(()=>validateSubscription({...subscription,keys:{auth:'x',p256dh:'x'}}))
})
describe('PostgreSQL push subscription and delivery acknowledgement',{skip:process.env.FS_DB_TEST!=='1'},()=>{
  const db=createDatabase({host:'127.0.0.1',port:55432,database:'familyshield',user:'fs_app'})
  const users=[]
  after(async()=>{try{await db.service(tx=>tx.query('delete from auth.users where id=any($1::uuid[])',[users]))}finally{await db.close()}})
  async function user(){const id=randomUUID();await db.service(tx=>tx.query('insert into auth.users(id) values($1)',[id]));users.push(id);return id}
  const config={publicKey:'test-only',privateKey:'test-only',subject:'https://familyshield.kr'}
  test('accepted push is not confirmed until the right user clicks the test notification',async()=>{
    const owner=await user(),other=await user(),payloads=[]
    const push=createPushService(db,config,{send:async(s,payload)=>{payloads.push(JSON.parse(payload));return{statusCode:201}}})
    const id=await push.subscribe(owner,subscription)
    assert.equal((await push.status(other)).subscriptions.length,0)
    await assert.rejects(push.test(other,id),{reason:'subscription'})
    const sent=await push.test(owner,id)
    assert.equal(sent.confirmed,false)
    assert.equal((await push.status(owner)).subscriptions[0].confirmedAt,null)
    assert.deepEqual(Object.keys(payloads[0]).sort(),['kind','token'])
    await assert.rejects(push.acknowledge(other,payloads[0].token))
    await push.acknowledge(owner,payloads[0].token)
    assert.ok((await push.status(owner)).subscriptions[0].confirmedAt)
    await assert.rejects(push.acknowledge(owner,payloads[0].token))
  })
  test('410 revokes the subscription and failures cannot become delivery success',async()=>{
    const owner=await user()
    const push=createPushService(db,config,{send:async()=>{throw {statusCode:410}}})
    const id=await push.subscribe(owner,subscription)
    await assert.rejects(push.test(owner,id),{reason:'push_failed'})
    assert.equal((await push.status(owner)).subscriptions.length,0)
  })
  test('unconfigured push fails closed',async()=>{
    const owner=await user(),push=createPushService(db,{})
    assert.equal((await push.status(owner)).enabled,false)
    await assert.rejects(push.subscribe(owner,subscription),{reason:'push_unconfigured'})
  })
})
