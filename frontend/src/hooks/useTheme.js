import { useState, useEffect } from 'react'

const STORAGE_KEY = 'ys-theme'
export const THEMES = ['light', 'system', 'dark']

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return THEMES.includes(saved) ? saved : 'system'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  return [theme, setTheme]
}
