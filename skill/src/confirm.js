import { fail, hashToken } from './auth.js'
import { insertCheck, LEVEL_FROM_DB, rowResult } from './results.js'
import { decide } from '../../packages/core/src/rule-engine.js'

export const PROCESSING_VERSION='confirm-processing-2026-10-28-v1'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TYPES={impersonation:'family_check',link_check:'official_check'}
const ANSWERS={family_check:['not_sent','will_call','sent'],official_check:['dont_press','will_call','wait']}
const SELECT=`select cr.*,ch.circle_id,ch.level,ch.signals_final,ch.impersonated_relation,ch.sender_last4,
  m.name_for_parent as guardian_name from public.confirm_requests cr
  join public.checks ch on ch.id=cr.check_id
  join public.circle_members m on m.circle_id=ch.circle_id and m.user_id=cr.target_member_id
  where ch.purge_at>now() and m.status='active'`
function requestView(row,userId) {
  if(!row) return null
  return {
    id:row.id,checkId:row.check_id, state:row.state==='pending'&&new Date(row.deadline_at)<=new Date()?'expired':row.state,
    sentAt:new Date(row.created_at).getTime(),respondedAt:row.responded_at?new Date(row.responded_at).getTime():null,
    requestType:row.kind==='family_check'?'impersonation':'link_check',answer:row.response?.answer||null,
    deviceSuspect:row.device_suspect,guardianName:row.guardian_name||'가족',canRespond:row.target_member_id===userId,
    summary:{level:row.response?.answer==='not_sent'?'위험':LEVEL_FROM_DB[row.level],signals_final:row.signals_final||[],impersonated_relation:row.impersonated_relation,sender_last4:row.sender_last4},
  }
}
export function createConfirmService(db,receipts) {
  async function create(userId,body) {
    const result=receipts.read(body.receipt,userId)
    if(!TYPES[body.requestType]) fail(400,'request_type')
    const receiptHash=hashToken(body.receipt)
    return db.user(userId,async tx=>{
      const {rows:[circle]}=await tx.query('select id from public.circles where protected_user_id=$1',[userId])
      if(!circle) fail(403,'parent_required')
      await tx.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[circle.id])
      const {rows:consents}=await tx.query(`select distinct on(item) item,granted from public.consents
        where circle_id=$1 order by item,created_at desc,id desc`,[circle.id])
      const granted=item=>consents.find(c=>c.item===item)?.granted
      if(!granted('family_alert')||!granted('impersonation_check')) fail(403,'consent_required')
      if(!granted('check_log')&&!(body.processingConsent===true&&body.processingVersion===PROCESSING_VERSION)) fail(409,'processing_consent_required')
      // A retried POST returns the original request; no duplicate push or sibling request.
      const {rows:[existing]}=await tx.query(`${SELECT} and ch.receipt_hash=$1`,[receiptHash])
      if(existing) return {request:requestView(existing,userId),created:false}
      const {rows:members}=await tx.query(`select user_id,relation from public.circle_members
        where circle_id=$1 and status='active' order by priority,created_at`,[circle.id])
      const target=body.targetId?members.find(m=>m.user_id===body.targetId)
        :members.find(m=>m.relation===result.impersonated_relation)||members[0]
      if(!target) fail(409,'family_missing')
      // Only a signed server result is stored. Free text and client-supplied levels are ignored.
      // RLS authorized the parent/circle/consents above. Only the server may insert a verdict.
      await tx.query('set local role service_role')
      const checkId=await insertCheck(tx,result,{userId,circleId:circle.id,receiptHash})
      await tx.query('set local role authenticated')
      const {rows:[row]}=await tx.query(`insert into public.confirm_requests(check_id,target_member_id,kind,sent_at,
        processing_consent_version,processing_consent_at) values($1,$2,$3,now(),$4,now()) returning id`,
        [checkId,target.user_id,TYPES[body.requestType],granted('check_log')?'check_log':PROCESSING_VERSION])
      const {rows:[request]}=await tx.query(`${SELECT} and cr.id=$1`,[row.id])
      return {request:requestView(request,userId),created:true,targetId:target.user_id}
    })
  }
  async function get(userId,id) {
    if(!UUID.test(id)) return null
    return db.user(userId,async tx=>requestView((await tx.query(`${SELECT} and cr.id=$1`,[id])).rows[0],userId))
  }
  async function list(userId) {
    return db.user(userId,async tx=>(await tx.query(`${SELECT} order by cr.created_at desc limit 100`)).rows.map(row=>requestView(row,userId)))
  }
  async function respond(userId,id,answer) {
    if(!UUID.test(id)) fail(404,'missing')
    return db.user(userId,async tx=>{
      let {rows:[row]}=await tx.query(`${SELECT} and cr.id=$1`,[id])
      if(!row||row.target_member_id!==userId) fail(404,'missing')
      await tx.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[row.circle_id])
      if(!ANSWERS[row.kind].includes(answer)) fail(400,'answer')
      const {rows:[changed]}=await tx.query(`update public.confirm_requests set state='responded',response=jsonb_build_object('answer',$2::text),responded_at=now()
        where id=$1 and target_member_id=$3 and state='pending' and deadline_at>now() returning id`,[id,answer,userId])
      if(!changed) fail(409,'already_answered')
      // The parent's result is raised by the rules on their next read; it is never lowered.
      const {rows:[updated]}=await tx.query(`${SELECT} and cr.id=$1`,[id])
      const view=requestView(updated,userId)
      if(answer==='not_sent') view.summary.level=decide({family_denied:true}).level
      return view
    })
  }
  async function suspect(userId,id) {
    if(!UUID.test(id)) fail(404,'missing')
    return db.user(userId,async tx=>{
      const {rows:[r]}=await tx.query(`update public.confirm_requests cr set device_suspect=true
        where cr.id=$1 and exists (select 1 from public.checks ch join public.circles c on c.id=ch.circle_id
        where ch.id=cr.check_id and c.protected_user_id=$2) returning id`,[id,userId])
      if(!r) fail(404,'missing')
      return {ok:true}
    })
  }
  async function report(userId,body) {
    if(!['false_alarm','missed','other'].includes(body.reason)||body.shareConsent!==true) fail(400,'report_consent')
    const result=receipts.read(body.receipt,userId)
    return db.user(userId,async tx=>{
      const {rows:[circle]}=await tx.query('select id from public.circles where protected_user_id=$1',[userId])
      if(!circle) fail(403,'parent_required')
      // Only enums from the signed result; no text input is accepted or persisted.
      const {rows:[row]}=await tx.query(`insert into public.misjudge_reports(circle_id,level,fired_rules,signals_final,reason,share_consent)
        values($1,$2,$3,$4,$5,true) returning id`,[circle.id,{위험:'danger',주의:'caution',확인필요:'check'}[result.level],result.fired_rules,result.signals_final,body.reason==='missed'?'missed_threat':body.reason])
      return {ok:true,id:row.id}
    })
  }
  return {create,get,list,respond,suspect,report}
}
