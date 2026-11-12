/** Light / dark theme, chosen per device (stored in this browser only). */
export type ThemeChoice = 'auto' | 'light' | 'dark'

const KEY = 'suivapp-rpg:theme'

export function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

/** 'auto' follows the phone or computer setting. */
export function applyTheme(choice: ThemeChoice) {
  if (choice === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', choice)
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // Private browsing: the choice simply lasts until the page is closed.
  }
}
