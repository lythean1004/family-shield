import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { hashToken, fail } from './auth.js'
import { createResultToken, isTokenFormat } from '../../packages/core/src/result-token.js'
import { summarize } from '../../packages/core/src/summarizer.js'
import * as signals from '../../packages/core/src/signals.js'

export const LEVEL_TO_DB = {위험:'danger',주의:'caution',확인필요:'check'}
export const LEVEL_FROM_DB = {danger:'위험',caution:'주의',check:'확인필요'}
const SIGNALS = new Set(Object.entries(signals).filter(([k])=>k.startsWith('SIG_')).map(([,v])=>v))
export function storedResult(result) {
  const validSignals=(result.signals_final||[]).filter(s=>SIGNALS.has(s))
  const relation=signals.ALLOWED_RELATIONS.has(result.impersonated_relation)?result.impersonated_relation:null
  return {
    level:LEVEL_TO_DB[result.level] ? result.level : '확인필요',
    fired_rules:(result.fired_rules||[]).filter(r=>/^R([1-9]|10)$/.test(r)),
    signals_final:validSignals,
    impersonation_type:signals.IMPERSONATION_TYPES.has(result.impersonation_type)?result.impersonation_type:'unknown',
    impersonated_relation:relation,
    fallback_used:!!result.fallback_used,
    explanation_for_parent:[],
    summary:summarize(validSignals,{impersonated_relation:relation}),
  }
}
export function rowResult(row) {
  return storedResult({...row,level:LEVEL_FROM_DB[row.level]})
}
export function createReceipts(key) {
  const sign = value=>createHmac('sha256',key).update(value).digest('base64url')
  return {
    issue(result,userId=null) {
      const payload=Buffer.from(JSON.stringify({result:storedResult(result),userId,expiresAt:Date.now()+600000,nonce:randomBytes(16).toString('hex')})).toString('base64url')
      return `${payload}.${sign(payload)}`
    },
    read(receipt,userId) {
      if(typeof receipt!=='string'||receipt.length>10000) fail(400,'result_expired')
      const parts=receipt.split('.')
      if(parts.length!==2) fail(400,'result_expired')
      const expected=Buffer.from(sign(parts[0])),actual=Buffer.from(parts[1])
      if(expected.length!==actual.length||!timingSafeEqual(expected,actual)) fail(400,'result_expired')
      let data
      try{data=JSON.parse(Buffer.from(parts[0],'base64url').toString())}catch{fail(400,'result_expired')}
      if(data.expiresAt<=Date.now()||(data.userId&&data.userId!==userId)) fail(400,'result_expired')
      return data.result
    },
  }
}
export async function insertCheck(tx,result,{userId=null,circleId=null,channel='web',receiptHash=null}={}) {
  const r=storedResult(result)
  const {rows:[row]}=await tx.query(`insert into public.checks(circle_id,created_by,input_channel,level,signals_final,
    fired_rules,impersonation_type,impersonated_relation,fallback_used,purge_at,receipt_hash)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+$10::interval,$11) returning id`,
    [circleId,userId,channel,LEVEL_TO_DB[r.level],r.signals_final,r.fired_rules,r.impersonation_type,r.impersonated_relation,r.fallback_used,
      userId?'24 hours':'10 minutes',receiptHash])
  return row.id
}
// Called only with server-issued results. Consent and storage share the circle lock
// with consent changes, so a concurrent withdrawal cannot race a new record.
export function createCheckRecorder(db,receipts) {
  return async (userId,receipt) => {
    const result=receipts.read(receipt,userId),receiptHash=hashToken(receipt)
    return db.user(userId,async tx=>{
      const {rows:[circle]}=await tx.query('select id from public.circles where protected_user_id=$1',[userId])
      if(!circle)return null
      await tx.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[circle.id])
      const {rows:[consent]}=await tx.query("select granted from public.consents where circle_id=$1 and item='check_log' order by created_at desc,id desc limit 1",[circle.id])
      if(!consent?.granted)return null
      const {rows:[existing]}=await tx.query('select id from public.checks where receipt_hash=$1 and created_by=$2',[receiptHash,userId])
      if(existing)return existing.id
      await tx.query('set local role service_role')
      const id=await insertCheck(tx,result,{userId,circleId:circle.id,receiptHash})
      await tx.query('set local role authenticated')
      return id
    })
  }
}
export function createDbResultStore(db) {
  return {
    async put(result) {
      return db.service(async tx=>{
        const checkId=await insertCheck(tx,result,{channel:'kakao'})
        const token=createResultToken()
        await tx.query('insert into public.result_tokens(token_hash,check_id,expires_at) values($1,$2,$3)',[token.tokenHash,checkId,new Date(token.expiresAt)])
        return token.token
      })
    },
    async redeem(token) {
      if(!isTokenFormat(token)) return {ok:false,reason:'missing'}
      return db.service(async tx=>{
        const {rows:[r]}=await tx.query('select public.redeem_result_token($1) as id',[hashToken(token)])
        if(!r.id) return {ok:false,reason:'expired'}
        const {rows:[row]}=await tx.query('select * from public.checks where id=$1 and purge_at>now()',[r.id])
        return row?{ok:true,result:rowResult(row)}:{ok:false,reason:'expired'}
      })
    },
  }
}
