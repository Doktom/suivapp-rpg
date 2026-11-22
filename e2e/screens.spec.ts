import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PLAYED_STATE } from './global-setup'
import { openRoute, overflow, ROUTES, smallTargets } from './helpers'

/** Each screen is checked empty (a first visit) and after eight invented weeks. */
const STATES = [
  { name: 'première visite', state: undefined },
  { name: 'huit semaines jouées', state: PLAYED_STATE },
]

for (const { name, state } of STATES) {
  test.describe(name, () => {
    test.use({ storageState: state ?? { cookies: [], origins: [] } })

    for (const route of ROUTES) {
      test(`${route} : rien ne dépasse de l’écran, pas d’erreur`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
        await openRoute(page, route)
        await page.waitForTimeout(300)
        expect(await overflow(page), 'débordement horizontal (px)').toBe(0)
        expect(errors).toEqual([])
      })

      test(`${route} : cibles tactiles d’au moins 44 px @phone-only`, async ({ page }) => {
        await openRoute(page, route)
        await page.waitForTimeout(300)
        expect(await smallTargets(page.locator('body'))).toEqual([])
      })

      for (const scheme of ['light', 'dark'] as const) {
        test(`${route} : contrastes lisibles, thème ${scheme === 'light' ? 'clair' : 'sombre'} @phone-only`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: scheme })
          await openRoute(page, route)
          await page.waitForTimeout(400)
          const { violations } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
          const lines = violations.flatMap((v) =>
            v.nodes.map((n) => {
              const data = (n.any[0]?.data ?? {}) as { contrastRatio?: number; fgColor?: string; bgColor?: string; expectedContrastRatio?: string }
              return `${n.target.join(' ')} : ${data.contrastRatio} (attendu ${data.expectedContrastRatio}) ${data.fgColor} sur ${data.bgColor}`
            }),
          )
          expect(lines).toEqual([])
        })
      }
    }
  })
}
