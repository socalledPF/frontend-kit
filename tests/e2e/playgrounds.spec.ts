import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const apps = [
  { name: 'Vue2', url: 'http://127.0.0.1:4172', marker: '用户详情' },
  { name: 'Vue3', url: 'http://127.0.0.1:4173', marker: '用户管理' }
] as const

async function expectHealthyPage(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
  const screenshot = await page.screenshot({ animations: 'disabled' })
  expect(screenshot.byteLength).toBeGreaterThan(10_000)

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze()
  const blocking = accessibility.violations.filter(
    ({ impact }) => impact === 'critical' || impact === 'serious'
  )
  const summary = blocking.map(
    ({ id, help, nodes }) =>
      `${id}: ${help}\n${nodes.map((node) => `  ${node.target.join(' ')}: ${node.html}`).join('\n')}`
  )
  expect(summary, summary.join('\n')).toEqual([])
}

for (const app of apps) {
  test(`${app.name} playground renders accessibly without viewport overflow`, async ({ page }) => {
    await page.goto(app.url)
    await expect(page.getByRole('heading', { name: app.marker, exact: true }).first()).toBeVisible()
    await expectHealthyPage(page)
  })
}

test('Vue3 keyboard workflow opens and closes the business form', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173')
  const createButton = page.getByRole('button', { name: '新增用户' })
  await createButton.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: '新增用户' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('input').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(createButton).toBeFocused()
})
