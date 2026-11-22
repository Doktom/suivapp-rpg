import { expect, test } from '@playwright/test'
import { PLAYED_STATE } from './global-setup'
import { openRoute, smallTargets } from './helpers'

/** Every dialog the screens can open: [screen, button that opens it]. */
const DIALOGS: [Parameters<typeof openRoute>[1], string][] = [
  ['habits', 'Nouvelle quête'],
  ['habits', 'Catalogue'],
  ['tasks', 'Nouvelle mission'],
  ['tasks', 'Nouveau parchemin'],
  ['agenda', '+ Mission'],
  ['agenda', '+ Événement'],
]

test.use({ storageState: PLAYED_STATE })

for (const [route, opener] of DIALOGS) {
  test(`${route} : « ${opener} » s’ouvre, tient dans l’écran et se ferme`, async ({ page }) => {
    await openRoute(page, route)
    await page.getByRole('button', { name: opener, exact: true }).click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    const viewport = page.viewportSize()!
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    expect(await dialog.evaluate((d) => d.scrollWidth - d.clientWidth), 'défilement horizontal dans le dialogue').toBe(0)
    expect(await smallTargets(dialog)).toEqual([])
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
}

test('Un dialogue de quête existante propose la suppression en deux temps', async ({ page }) => {
  await openRoute(page, 'habits')
  await page.getByRole('button', { name: 'Modifier', exact: true }).first().click()
  const dialog = page.locator('dialog[open]')
  await dialog.getByRole('button', { name: /Rayer la quête/ }).click()
  await expect(dialog.getByRole('alert')).toContainText('définitif')
  await dialog.getByRole('button', { name: 'Garder' }).click()
  await expect(dialog.getByRole('alert')).toBeHidden()
})
