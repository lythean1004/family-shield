// Operator-only, on VM after approval: sudo node .../skill/scripts/configure-push.mjs
// Existing AI/DB settings stay unchanged. VAPID values are never printed.
import {readFileSync,writeFileSync,renameSync} from 'node:fs'
import webpush from 'web-push'
const path='/etc/family-shield/skill.env'
if(process.platform!=='linux'||process.getuid()!==0)throw new Error('Run on the VM as root after approval')
const original=readFileSync(path,'utf8')
const hasPublic=/^VAPID_PUBLIC_KEY=.+$/m.test(original),hasPrivate=/^VAPID_PRIVATE_KEY=.+$/m.test(original)
if(hasPublic!==hasPrivate)throw new Error('Incomplete VAPID pair: no changes made')
if(hasPublic){console.log('Existing VAPID keys retained.');process.exit(0)}
const keys=webpush.generateVAPIDKeys()
const clean=original.split('\n').filter(line=>!/^VAPID_(PUBLIC_KEY|PRIVATE_KEY|SUBJECT)=/.test(line)).join('\n')
writeFileSync(`${path}.before-push`,original,{mode:0o600,flag:'wx'})
writeFileSync(`${path}.push-new`,`${clean.trimEnd()}\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=https://familyshield.kr\n`,{mode:0o600,flag:'wx'})
renameSync(`${path}.push-new`,path)
console.log('VAPID settings saved with mode 600. AI and database keys preserved.')
