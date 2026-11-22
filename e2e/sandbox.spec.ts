import { expect, test, type Page } from '@playwright/test'

const realTables = (page: Page) =>
  page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('suivapp-rpg:') && !k.endsWith(':theme'))
      .sort()
      .map((k) => `${k}=${localStorage.getItem(k)}`),
  )

test('Le bac à sable joue des semaines sans toucher aux vraies données', async ({ page }) => {
  await page.goto('#settings')
  await page.locator('main h1').waitFor()
  const before = await realTables(page)
  expect(before.length).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Entrer dans le bac à sable' }).click()
  await page.getByRole('button', { name: 'Oui, entrer' }).click()
  await expect(page.getByText('Bac à sable actif')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Rien de réel ici' })).toBeVisible()

  await page.getByRole('button', { name: 'Ajouter des quêtes d’exemple' }).click()
  await page.getByRole('button', { name: 'Régulier' }).click()
  await page.getByRole('button', { name: '2 semaines', exact: true }).click()
  await expect(page.getByText(/2 semaines jouées \(régulier\)/)).toBeVisible()
  await page.keyboard.press('Escape') // the level-up panel covers the screen
  await expect(page.getByText('+14 j')).toBeVisible()

  // The invented weeks show up in the game: the hero has levelled up.
  await page.goto('#progress')
  await expect(page.getByText(/Niveau [2-9]/).first()).toBeVisible()

  // Tomorrow, by hand: the date moves on and nothing is ticked.
  await page.goto('#settings')
  await page.getByRole('button', { name: 'Demain' }).click()
  await expect(page.getByText('+15 j')).toBeVisible()

  await page.getByRole('button', { name: 'Quitter le bac à sable…' }).click()
  await page.getByRole('button', { name: 'Quitter et jeter' }).click()
  await expect(page.getByRole('button', { name: 'Entrer dans le bac à sable' })).toBeVisible()
  expect(await realTables(page)).toEqual(before)
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('suivapp-rpg-')))).toEqual([])
})

test('Un jour sauté sans rien cocher casse la série d’une quête', async ({ page }) => {
  await page.goto('#settings')
  await page.getByRole('button', { name: 'Entrer dans le bac à sable' }).click()
  await page.getByRole('button', { name: 'Oui, entrer' }).click()
  await page.getByRole('button', { name: 'Ajouter des quêtes d’exemple' }).click()
  await page.getByRole('button', { name: 'Régulier' }).click()
  await page.getByRole('button', { name: '2 semaines', exact: true }).click()
  await expect(page.getByText(/2 semaines jouées/)).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto('#habits')
  await expect(page.getByText(/🔥 \d+ j/).first()).toBeVisible()
  await page.goto('#settings')
  await page.getByRole('button', { name: 'Dans une semaine' }).click()
  await page.goto('#habits')
  await expect(page.getByText('série à lancer').first()).toBeVisible()
})
