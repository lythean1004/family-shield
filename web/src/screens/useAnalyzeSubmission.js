import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeText } from '../data/analyze.js'
import { beginCurrentResult } from '../data/session.js'

export default function useAnalyzeSubmission(text) {
  const navigate = useNavigate()
  const request = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useLayoutEffect(() => () => request.current?.abort(), [])

  const submit = async (answer) => {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    try {
      const result = await analyzeText(text, answer, { signal: controller.signal })
      if (controller.signal.aborted) return
      beginCurrentResult(result)
      navigate('/check/result', { replace: true })
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message)
    } finally {
      request.current = null
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return { submit, loading, error }
}
