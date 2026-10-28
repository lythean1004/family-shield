const MESSAGES = {
  login_required:'먼저 참여 코드나 초대 코드로 시작해 주세요.',
  invalid_code:'코드가 맞지 않거나 시간이 지났어요. 새 코드를 받아 주세요.',
  age_required:'만 14세 이상인지 확인해 주세요.',
  rate_limited:'여러 번 시도하셨어요. 잠시 뒤 다시 해 주세요.',
  already_logged_in:'이미 로그인되어 있어요. 설정에서 현재 계정을 확인해 주세요.',
  alert_consent_required:'먼저 가족 알림에 동의해 주세요.',
  consent_required:'가족 알림과 사칭 확인 동의를 설정에서 확인해 주세요.',
  result_expired:'결과를 보관할 수 있는 시간이 지났어요. 문자를 다시 확인해 주세요.',
  family_missing:'연결된 가족이 없어요. 설정에서 가족을 연결해 주세요.',
  already_answered:'이미 답했거나 요청이 끝났어요. 요청 내역을 다시 확인해 주세요.',
}
export async function api(path, body, { fetchImpl = fetch } = {}) {
  let res
  try {
    res = await fetchImpl(`/api${path}`, {
      method:body === undefined ? 'GET' : 'POST', credentials:'same-origin', cache:'no-store',
      headers:{accept:'application/json','content-type':'application/json','x-fs-request':'1'},
      ...(body === undefined ? {} : {body:JSON.stringify(body)}),
    })
  } catch { throw new Error('연결이 어려워요. 인터넷 연결을 확인하고 다시 해 주세요.') }
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) throw Object.assign(new Error(MESSAGES[data?.reason] || '처리하지 못했어요. 잠시 뒤 다시 해 주세요.'), {status:res.status,reason:data?.reason})
  return data
}
export const getSession = () => api('/auth/session').then(data => data.session)
