import { expect, test } from '@playwright/test'

test('visitante é redirecionado para o login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
})

test('troca de idioma na tela de login', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('combobox').first().selectOption('en')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('login com credenciais erradas mostra erro', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('ninguem@example.com')
  await page.getByLabel('Senha').fill('senha-errada-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.', { timeout: 15_000 })
})

test('sem rolagem horizontal', async ({ page }) => {
  await page.goto('/login')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('convite sem sessão leva ao login', async ({ page }) => {
  await page.goto('/join/abc')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
})
