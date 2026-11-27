export const MAX_ANALYSIS_CHARS = 2000

export function canAnalyzeText(text) {
  return text.trim().length >= 2 && [...text].length <= MAX_ANALYSIS_CHARS
}

export function parentInputsForCallAnswer(answer) {
  switch (answer) {
    case 'none':
      return { called_before: false }
    case 'earlier':
      return { called_before: true }
    case 'in_progress':
      return { call_in_progress: true }
    default:
      throw new Error('통화 상태를 골라 주세요.')
  }
}

export async function analyzeText(text, answer, { fetchImpl = fetch, signal } = {}) {
  const parentInputs = parentInputsForCallAnswer(answer)
  let response
  try {
    response = await fetchImpl('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', accept: 'application/json', 'x-fs-request': '1' },
      credentials: 'same-origin',
      body: JSON.stringify({ text, parentInputs }),
      cache: 'no-store',
      signal,
    })
  } catch {
    throw new Error('인터넷 연결을 확인해 주세요.')
  }

  const body = await response.json().catch(() => null)
  if (response.status === 200 && body?.ok && body.result) return body.result
  if (response.status === 401) throw new Error('먼저 설정에서 가족 연결을 시작해 주세요.')
  if (response.status === 429) throw new Error('조금 전에 여러 번 물어보셨어요. 1분 뒤에 다시 시도해 주세요.')
  if (response.status === 400 && body?.reason === 'too_long') {
    throw new Error('글이 너무 길어요. 2000자 이내로 줄여 주세요.')
  }
  if (response.status === 400 && body?.reason === 'empty') {
    throw new Error('판별할 문자 내용을 붙여 넣어 주세요.')
  }
  throw new Error('지금은 확인이 어렵습니다. 잠시 후 다시 시도해 주세요.')
}
