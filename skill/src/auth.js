import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto'

export const CONSENT_VERSION = 'demo-2026-10-28-v2'
export const CONSENT_ITEMS = ['family_alert', 'impersonation_check', 'check_log', 'misjudge_share']
export const RELATIONS = ['딸', '아들', '배우자', '가족']
const SESSION_SECONDS = 30 * 24 * 60 * 60
export const hashToken = (value) => createHash('sha256').update(value).digest('hex')
export const hashCode = (value, key) => createHmac('sha256', key).update(value).digest('hex')
export const newCode = () => String(randomInt(0, 100000000)).padStart(8, '0')
export function fail(status, reason) { throw Object.assign(new Error(reason), { status, reason }) }

export function readSessionCookie(req) {
  const value = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('fs_session='))?.slice(11)
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null
}
export function sessionCookie(token, secure = true) {
  return `fs_session=${token || ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_SECONDS : 0}${secure ? '; Secure' : ''}`
}
export function checkBrowserRequest(req, webBaseUrl) {
  if (req.headers['x-fs-request'] !== '1') fail(403, 'origin')
  const origin = req.headers.origin
  if (origin && origin !== new URL(webBaseUrl).origin) fail(403, 'origin')
  if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'origin')
}

export function createAuth(db, { hmacKey }) {
  if (!hmacKey) throw new Error('PHONE_HMAC_SECRET is required for authentication')

  async function startSession(tx, userId) {
    const token = randomBytes(32).toString('base64url')
    await tx.query('insert into private.sessions(token_hash, user_id) values ($1,$2)', [hashToken(token), userId])
    await tx.query("insert into public.auth_events(user_id,type) values ($1,'new_device')", [userId])
    return token
  }
  async function createUser(tx, role) {
    const { rows: [user] } = await tx.query(`insert into auth.users(raw_app_meta_data)
      values (jsonb_build_object('demo_role', $1::text, 'over14_confirmed_at', now())) returning id`, [role])
    return user.id
  }
  async function checkLimit(subject) {
    // Committed separately: failed redemption attempts must still count.
    const count = await db.service(async tx => {
      const { rows: [row] } = await tx.query(`insert into private.auth_limits(subject_hash,window_start,count)
        values ($1,date_trunc('hour',now()),1) on conflict (subject_hash,window_start)
        do update set count = private.auth_limits.count + 1 returning count`, [hashCode(subject, hmacKey)])
      return row.count
    })
    if (count > 10) fail(429, 'rate_limited')
  }
  async function redeem(code, over14, subject, parent = false) {
    await checkLimit(`${parent ? 'parent' : 'guardian'}:${subject}`)
    if (over14 !== true) fail(400, 'age_required')
    if (typeof code !== 'string' || !/^\d{8}$/.test(code)) fail(400, 'invalid_code')
    return db.service(async tx => {
      const table = parent ? 'parent_invites' : 'demo_codes'
      const { rows: [invite] } = await tx.query(`update private.${table} set used_at = now()
        where code_hash=$1 and used_at is null and expires_at>now() returning *`, [hashCode(code, hmacKey)])
      if (!invite) fail(400, 'invalid_code')
      const userId = await createUser(tx, parent ? 'parent' : 'guardian')
      if (parent) {
        const { rows: [circle] } = await tx.query('insert into public.circles(protected_user_id) values ($1) returning id', [userId])
        await tx.query(`insert into public.circle_members(circle_id,user_id,relation,name_for_parent)
          values ($1,$2,$3,$3)`, [circle.id, invite.guardian_id, invite.relation])
      }
      return { token: await startSession(tx, userId), userId }
    })
  }
  async function authenticate(req) {
    const token = readSessionCookie(req)
    if (!token) return null
    return db.service(async tx => {
      const { rows: [row] } = await tx.query(`update private.sessions set last_seen_at=now(), expires_at=now()+interval '30 days'
        where token_hash=$1 and expires_at>now() returning user_id`, [hashToken(token)])
      return row ? { userId: row.user_id, tokenHash: hashToken(token) } : null
    })
  }
  async function profile(userId) {
    return db.user(userId, async tx => {
      const { rows: circles } = await tx.query(`select id, protected_user_id=$1 as "isParent" from public.circles order by created_at`, [userId])
      const { rows: members } = await tx.query(`select circle_id as "circleId",user_id as id,relation,name_for_parent as "callName",priority
        from public.circle_members where status='active' order by priority,created_at`)
      const { rows: consents } = await tx.query(`select distinct on (circle_id,item) circle_id as "circleId",item,granted,text_version
        from public.consents order by circle_id,item,created_at desc,id desc`)
      return { userId, circles, members, consents, demo: true }
    })
  }
  async function invite(userId, relation) {
    if (!RELATIONS.includes(relation)) fail(400, 'relation')
    await checkLimit(`invite:${userId}`)
    return db.service(async tx => {
      const { rows: [user] } = await tx.query("select id from auth.users where id=$1 and raw_app_meta_data->>'demo_role'='guardian'", [userId])
      if (!user) fail(403, 'guardian_required')
      await tx.query('update private.parent_invites set used_at=now() where guardian_id=$1 and used_at is null', [userId])
      const code = newCode()
      const { rows: [row] } = await tx.query(`insert into private.parent_invites(code_hash,guardian_id,relation)
        values ($1,$2,$3) returning expires_at`, [hashCode(code, hmacKey), userId, relation])
      return { code, expiresAt: row.expires_at }
    })
  }
  async function consent(userId, { circleId, item, granted, textVersion }) {
    if (!CONSENT_ITEMS.includes(item) || typeof granted !== 'boolean' || textVersion !== CONSENT_VERSION) fail(400, 'consent')
    return db.user(userId, async tx => {
      // Lock the circle to serialize consent transitions with request creation/response.
      const { rows: [circle] } = await tx.query('select id from public.circles where id=$1 and protected_user_id=$2', [circleId, userId])
      if (!circle) fail(403, 'parent_required')
      await tx.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [circleId])
      if (item === 'impersonation_check' && granted) {
        const { rows: [alert] } = await tx.query(`select granted from public.consents where circle_id=$1 and item='family_alert'
          order by created_at desc,id desc limit 1`, [circleId])
        if (!alert?.granted) fail(409, 'alert_consent_required')
      }
      await tx.query('insert into public.consents(circle_id,user_id,item,granted,text_version) values ($1,$2,$3,$4,$5)',
        [circleId,userId,item,granted,textVersion])
      if (item === 'family_alert' && !granted) {
        await tx.query(`insert into public.consents(circle_id,user_id,item,granted,text_version)
          values ($1,$2,'impersonation_check',false,$3)`, [circleId,userId,textVersion])
      }
      return { ok: true }
    })
  }
  async function logout(session) {
    if (!session) return
    await db.service(async tx => {
      await tx.query('delete from private.sessions where token_hash=$1', [session.tokenHash])
      await tx.query("insert into public.auth_events(user_id,type) values ($1,'session_end')", [session.userId])
    })
  }
  return { authenticate, profile, redeem, invite, consent, logout, checkLimit }
}
