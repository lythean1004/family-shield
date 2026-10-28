// Disposable local DB only. No VM secrets or actual users. The output is gitignored.
import {writeFileSync,mkdirSync} from 'node:fs'
import {createDatabase} from '../../skill/src/database.js'
import {hashCode,newCode} from '../../skill/src/auth.js'
if(process.env.FS_DB_TEST!=='1') throw new Error('Set FS_DB_TEST=1 for the local test database')
const db=createDatabase({host:'127.0.0.1',port:55432,database:'familyshield',user:'fs_app'})
try {
  const code=newCode()
  await db.service(tx=>tx.query('insert into private.demo_codes(code_hash) values($1)',[hashCode(code,'local-test-only-hmac-key')]))
  mkdirSync('private',{recursive:true})
  writeFileSync('private/browser-fixture.json',JSON.stringify({code}),{mode:0o600})
  console.log('Local browser fixture written (code omitted).')
} finally {await db.close()}
