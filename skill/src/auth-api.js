import { checkBrowserRequest, fail, sessionCookie, readSessionCookie } from './auth.js'

export function createAuthApi(auth, config) {
  const secure = !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(config.webBaseUrl || '')
  return async function authApi(req, send, readBody) {
    const path = new URL(req.url, 'http://local').pathname
    if (!['/api/auth/session','/api/auth/demo','/api/auth/join','/api/auth/logout','/api/circle/invite','/api/consent'].includes(path)) return false
    try {
      if (req.method === 'GET' && path === '/api/auth/session') {
        const session = await auth.authenticate(req)
        if (!session) { send(200, { ok:true, session:null }); return true }
        send(200, { ok:true, session:await auth.profile(session.userId) }, {'set-cookie':sessionCookie(readSessionCookie(req),secure)})
        return true
      }
      if (req.method !== 'POST') fail(405, 'method')
      checkBrowserRequest(req, config.webBaseUrl)
      const raw = await readBody(req)
      let body
      try { body = JSON.parse(raw) } catch { fail(400,'json') }
      if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400,'json')
      if (path === '/api/auth/demo' || path === '/api/auth/join') {
        if (await auth.authenticate(req)) fail(409,'already_logged_in')
        // Nginx overwrites X-Forwarded-For with the direct peer address.
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
        const result = await auth.redeem(body.code,body.over14,ip,path.endsWith('/join'))
        send(200,{ok:true, session:await auth.profile(result.userId)}, {'set-cookie':sessionCookie(result.token,secure)})
        return true
      }
      const session = await auth.authenticate(req)
      if (path === '/api/auth/logout') {
        await auth.logout(session)
        send(200,{ok:true},{'set-cookie':sessionCookie(null,secure)})
        return true
      }
      if (!session) fail(401,'login_required')
      if (path === '/api/circle/invite') send(200,{ok:true,...await auth.invite(session.userId,body.relation)})
      else send(200,await auth.consent(session.userId,body))
    } catch (error) {
      send(error.status || 503,{ok:false,reason:error.reason || 'unavailable'})
    }
    return true
  }
}
