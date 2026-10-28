// Explicit in-memory/storage fixture adapter. Never used as a network-error fallback.
import { toGuardianSummary } from './confirm.js'
export function createDemoConfirmStore({fallbackStorage:storage,clock=Date.now}) {
  const prefix='fs.confirm.'
  const get=async id=>{try{return JSON.parse(storage?.getItem(prefix+id)||'null')}catch{return null}}
  const save=row=>storage?.setItem(prefix+row.id,JSON.stringify(row))
  return {
    async create(result,{senderLast4=null,requestType='impersonation'}={}) {
      const row={id:`fb_${crypto.randomUUID()}`,state:'pending',sentAt:clock(),requestType,
        summary:toGuardianSummary(result,senderLast4),answer:null,respondedAt:null,deviceSuspect:false}
      save(row);return row
    },get,
    async respond(id,answer) {
      const row=await get(id)
      if(!row||row.state!=='pending')return row
      if(!['not_sent','will_call','sent','dont_press','wait'].includes(answer))throw new Error('unknown answer')
      const next={...row,state:'responded',answer,respondedAt:clock()};save(next);return next
    },
    async markDeviceSuspect(id){const row=await get(id);if(row)save({...row,deviceSuspect:true})},
    async listRecent(windowMs=86400000){
      const rows=[]
      for(let i=0;i<(storage?.length||0);i++){const k=storage.key(i);if(k?.startsWith(prefix)){const r=await get(k.slice(prefix.length));if(r&&r.sentAt>=clock()-windowMs)rows.push(r)}}
      return rows.sort((a,b)=>b.sentAt-a.sentAt)
    },
  }
}
