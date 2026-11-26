import { createContext } from 'react'

export const CONTRAST_KEY = 'fs-contrast'
export const ContrastContext = createContext(null)

export function readPref(storage) {
  try {
    const value = storage?.getItem(CONTRAST_KEY)
    return value === 'high' || value === 'normal' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

export function resolveContrast(pref, { prefersMore, forcedColors }) {
  if (pref === 'auto') return prefersMore || forcedColors ? 'high' : 'normal'
  return pref
}

export function nextPref(current) {
  return current === 'high' ? 'normal' : 'high'
}

export function applyContrast(doc, mode) {
  doc.documentElement.setAttribute('data-contrast', mode)
}
