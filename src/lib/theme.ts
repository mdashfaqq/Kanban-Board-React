export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'flowkanban_theme'

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch (err) {
    console.warn('[Theme] Could not read saved theme; using default.', err)
  }
  return 'dark'
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch (err) {
    console.warn('[Theme] Could not save theme preference.', err)
  }
}
