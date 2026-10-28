// The server is the source of truth. Failed writes never look like saved consent.
import { api, getSession } from './api.js'
export const CONSENT_VERSION = 'demo-2026-10-28-v1'
export async function loadFamilyConsent() {
  try {
    const session = await getSession()
    const circle = session?.circles.find(c=>c.isParent)
    if (!circle) return false
    return ['family_alert','impersonation_check'].every(item=>session.consents.find(c=>c.circleId===circle.id&&c.item===item)?.granted)
  } catch { return false }
}
export async function saveFamilyConsent(granted) {
  const session = await getSession()
  const circle = session?.circles.find(c=>c.isParent)
  if (!circle) throw new Error('먼저 부모님 계정으로 가족을 연결해 주세요.')
  await api('/consent',{circleId:circle.id,item:'impersonation_check',granted,textVersion:CONSENT_VERSION})
}
