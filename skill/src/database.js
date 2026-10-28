import pg from 'pg'

// Each transaction owns one connection. Identity and role never leak into the pool.
export function createDatabase(options) {
  const pool = new pg.Pool({ ...options, max: 8, connectionTimeoutMillis: 5000 })
  async function transaction(role, userId, work) {
    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query("select set_config('statement_timeout', '10000', true)")
      await client.query(`set local role ${role}`)
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId || ''])
      const result = await work(client)
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }
  return {
    user: (id, work) => transaction('authenticated', id, work),
    service: (work) => transaction('service_role', null, work),
    close: () => pool.end(),
  }
}
