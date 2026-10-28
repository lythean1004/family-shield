// Operator-only, on VM after approval: sudo node .../skill/scripts/configure-push.mjs
// Existing AI/DB settings stay unchanged. VAPID values are never printed.
import {readFileSync,writeFileSync,renameSync} from 'node:fs'
import {mergeVapidConfig} from '../src/vapid-config.js'
if(process.argv[2]==='--from-stdin'){
  if(!process.argv[3])throw new Error('Owner-only output path required')
  writeFileSync(process.argv[3],mergeVapidConfig(readFileSync(0,'utf8')),{mode:0o600,flag:'wx'})
  console.log('VAPID configuration prepared; secret values omitted.')
  process.exit(0)
}
const path='/etc/family-shield/skill.env'
if(process.platform!=='linux'||process.getuid()!==0)throw new Error('Run on the VM as root after approval')
const original=readFileSync(path,'utf8')
const updated=mergeVapidConfig(original)
if(updated===original){console.log('Existing VAPID settings retained.');process.exit(0)}
writeFileSync(`${path}.before-push`,original,{mode:0o600,flag:'wx'})
writeFileSync(`${path}.push-new`,updated,{mode:0o600,flag:'wx'})
renameSync(`${path}.push-new`,path)
console.log('VAPID settings saved with mode 600. AI and database keys preserved.')
