import { chromium, type FullConfig } from '@playwright/test'
import { mkdirSync } from 'node:fs'

export const PLAYED_STATE = 'e2e/.state/played.json'

/**
 * Builds the "played" state once: the sandbox, with starter quests and eight invented weeks, saved as a
 * browser storage state that the tests reuse. It exercises the simulation tool the way a person would.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!
  const browser = await chromium.launch()
  const context = await browser.newContext({ baseURL, viewport: { width: 375, height: 812 }, serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' })
  const page = await context.newPage()
  await page.goto('#settings')
  await page.getByRole('button', { name: 'Entrer dans le bac à sable' }).click()
  await page.getByRole('button', { name: 'Oui, entrer' }).click()
  await page.getByText('Bac à sable actif').waitFor()
  await page.getByRole('button', { name: 'Ajouter des quêtes d’exemple' }).click()
  await page.getByRole('button', { name: '4 semaines', exact: true }).click()
  await page.getByText('4 semaines jouées').waitFor()
  await page.keyboard.press('Escape') // the level-up panel covers the screen
  await page.getByRole('button', { name: '4 semaines', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  mkdirSync('e2e/.state', { recursive: true })
  await context.storageState({ path: PLAYED_STATE })
  await browser.close()
}
