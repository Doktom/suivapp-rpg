import type { Locator, Page } from '@playwright/test'

export const ROUTES = ['today', 'habits', 'training', 'tasks', 'agenda', 'progress', 'settings'] as const

/** Opens a screen and waits until its title is on screen. */
export async function openRoute(page: Page, route: (typeof ROUTES)[number]) {
  await page.goto(`#${route}`)
  await page.locator('main h1').first().waitFor()
}

/** How many pixels the page is wider than the screen; 0 when nothing sticks out. */
export const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

/**
 * Describes every control smaller than `min` px in either direction, inside `scope`.
 * Exempt: inline text links, and a checkbox or radio inside a label (the label is the target).
 */
export function smallTargets(scope: Locator, min = 44): Promise<string[]> {
  return scope.evaluate((root, size) => {
    const selector = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=checkbox]'
    const found: string[] = []
    for (const el of Array.from(root.querySelectorAll(selector))) {
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      if (el.closest('[aria-hidden="true"]')) continue
      if (el.tagName === 'A' && style.display === 'inline') continue
      let target: Element = el
      if (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type)) target = el.closest('label') ?? el
      const r = target.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.width < size - 0.5 || r.height < size - 0.5) {
        const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 28)
        found.push(`${el.tagName.toLowerCase()} « ${text} » ${Math.round(r.width)}×${Math.round(r.height)}`)
      }
    }
    return found
  }, min)
}
