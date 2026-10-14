import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
const docs = JSON.parse(readFileSync(new URL('../src/data/docs.json', import.meta.url), 'utf8'))

test('all published documents render with local assets and working navigation', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('欢迎使用')
  for (const group of docs.navGroups) for (const item of group.items) {
    await page.locator('.side-nav').getByRole('link', { name: item.title.replace('jisuai.net 使用指南', '平台使用指南'), exact: true }).click()
    await expect(page).toHaveURL(url => url.pathname === docs.articles[item.slug].path && !url.search)
    await expect(page.locator('.article-body h2').first()).toBeVisible()
    const missing = await page.locator('.article-body img').evaluateAll(async imgs => {
      await Promise.all(imgs.map(img => {
        const image = img as HTMLImageElement
        image.loading = 'eager'
        return image.decode()
      }))
      return imgs.filter(img => !(img as HTMLImageElement).naturalWidth).length
    })
    expect(missing).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(errors).toEqual([])
})
test('full-text search supports keyboard selection, empty results and dismiss', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Control+k')
  const input = page.getByRole('textbox', { name: '搜索文档关键词' })
  await input.fill('chat/completions')
  await expect(page.locator('.search-result').first()).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.article-body')).toContainText('chat/completions')
  await page.keyboard.press('Control+k')
  await input.fill('no-matching-document-987654')
  await expect(page.getByText('没有找到相关文档')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('copy code and page links, theme and feedback persistence', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/api')
  const code = await page.locator('pre code').first().textContent()
  await page.getByRole('button', { name: '复制代码', exact: true }).first().click()
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(code?.replace(/\r\n/g, '\n'))
  await page.getByRole('button', { name: '复制页面链接' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url())
  await page.getByRole('button', { name: '切换深色模式' }).click()
  await page.getByRole('button', { name: '有帮助', exact: true }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: '有帮助', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: 'reports/dark-api.png', fullPage: false, animations: 'disabled' })
})
test('deep links, in-page anchors, history, invalid documents', async ({ page }) => {
  await page.goto('/tools/cc-switch#doc-heading-2')
  await expect(page.locator('h1')).toHaveText('自动配置工具')
  await expect(page.locator('#doc-heading-2')).toBeInViewport()
  await page.locator('.side-nav a[href="/image/api"]').click()
  await page.goBack()
  await expect(page.locator('h1')).toHaveText('自动配置工具')
  await expect(page).toHaveURL(/\/tools\/cc-switch#doc-heading-2$/)
  await page.goto('/missing-page')
  await expect(page.locator('h1')).toHaveText('这篇文档还未抵达')
  await page.getByRole('button', { name: '返回文档首页' }).click()
  await expect(page.locator('h1')).toContainText('欢迎使用')
})
test('desktop and mobile layouts with functional drawer and no horizontal overflow', async ({ page }) => {
  await page.goto('/')
  await page.screenshot({ path: 'reports/desktop.png', fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.locator('.sidebar').evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
  await page.screenshot({ path: 'reports/mobile.png', fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: '切换文档目录' }).click()
  await expect(page.locator('.sidebar')).toHaveClass(/open/)
  await page.locator('.side-nav a[href="/api"]').click()
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/)
  await expect(page.locator('h1')).toHaveText('通用 API 接入教程')
  for (const group of docs.navGroups) for (const item of group.items) {
    await page.goto(docs.articles[item.slug].path)
    await expect(page.locator('.article-body h2').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), item.slug).toBe(true)
  }
  await page.goto('/api')
  await page.screenshot({ path: 'reports/mobile-api.png', fullPage: true })
})

test('legacy links redirect to canonical paths and keep section anchors', async ({ page }) => {
  for (const [slug, article] of Object.entries(docs.articles) as [string, { path: string }][]) {
    for (const prefix of ['/', '/docs/']) {
      await page.goto(prefix + '?doc=' + slug + '#doc-heading-1')
      await expect(page).toHaveURL(url => url.pathname === article.path && !url.search && url.hash === '#doc-heading-1')
      await expect(page.locator('#doc-heading-1')).toBeInViewport()
    }
  }
  await page.goto('/image/canvas/')
  await expect(page).toHaveURL(/\/image\/canvas$/)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('GPT 生图 · 画布使用')
  await page.goto('/?doc=codex-quickstart')
  await expect(page).toHaveURL(/\/not-found$/)
  await expect(page.locator('h1')).toHaveText('这篇文档还未抵达')
})

test('homepage, article links, search and pagination use canonical paths', async ({ page }) => {
  const paths = Object.values(docs.articles).map((article: any) => article.path)
  for (const path of paths) {
    await page.goto(path as string)
    await expect(page.locator('.article-body h2').first()).toBeVisible()
    const links = await page.locator('a[href]').evaluateAll(elements => elements.map(el => (el as HTMLAnchorElement).href).filter(href => new URL(href).origin === location.origin))
    for (const href of links) {
      const url = new URL(href)
      expect(url.searchParams.has('doc')).toBe(false)
      if (!url.pathname.startsWith('/media/')) expect(paths).toContain(url.pathname)
    }
  }
  await page.goto('/')
  await page.locator('.hero-actions .primary-button').click()
  await expect(page).toHaveURL(/\/tools\/cc-switch$/)
  await page.locator('.pagination .next').click()
  await expect(page).toHaveURL(/\/image\/canvas$/)
  await page.keyboard.press('Control+k')
  await page.getByRole('textbox', { name: '搜索文档关键词' }).fill('画布')
  await page.locator('.search-result').filter({ has: page.getByText('GPT 生图 · 画布使用', { exact: true }) }).click()
  await expect(page).toHaveURL(/\/image\/canvas$/)
})
