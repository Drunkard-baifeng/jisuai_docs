import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'cheerio'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function collectLocalAssets(docs) {
  const assets = new Set()
  for (const article of Object.values(docs.articles)) {
    const $ = load(article.bodyHtml, null, false)
    $('img[src], source[src], video[src], a[href]').each((_, element) => {
      const value = $(element).attr(element.name === 'a' ? 'href' : 'src')
      if (value?.startsWith('/media/')) assets.add(value)
    })
  }
  return [...assets].sort()
}
export const removedArticleSlugs = [
  'nodejs-setup',
  'claude-code-quickstart',
  'claude-groups-and-models',
  'codex-quickstart',
  'deepseek-switch-group',
  'openclaw-quickstart',
  'hermes-quickstart',
  'deepseek-harness-quickstart',
  'cherry-studio-quickstart',
  'claude-desktop-config',
  'vscode-gui-guide',
  'claude-codex-collab',
  'global-rules',
]
export const localOverrides = {
  updatedAt: '2026-10-14',
  articles: ['auto-config', 'gpt-image-canvas', 'introduction', 'faq'],
  removedArticles: removedArticleSlugs,
  source: '用户提供的 CC Switch、极速画布操作步骤与截图，以及页面移除要求',
}

export async function applyLocalDocs(docs) {
  const excluded = new Set(removedArticleSlugs)
  for (const slug of excluded) delete docs.articles[slug]
  docs.navGroups = docs.navGroups
    .map(group => ({ ...group, items: group.items.filter(item => !excluded.has(item.slug)) }))
    .filter(group => group.items.length > 0)
  docs.articles['auto-config'] = {
    title: '自动配置工具',
    group: '环境准备',
    summary: '使用 CC Switch 图形界面管理 Claude Code、Claude Desktop、Codex、Gemini CLI、OpenCode、OpenClaw 等多个应用：选择应用、开启显示、导入 API 密钥并完成配置，附 Codex 设置与模型配置示例。',
    updatedAt: '2026-10-14',
    bodyHtml: await readFile(resolve(root, 'content/auto-config.html'), 'utf8'),
  }
  docs.articles['gpt-image-canvas'] = {
    title: 'GPT 生图 · 画布使用',
    group: '快速接入',
    summary: '从控制台进入极速画布，添加渠道并配置 API Key，拉取、全选模型并保存。生图使用生图分组密钥，最后在生图工作台中输入提示词、选择模型并生成图片。',
    updatedAt: '2026-10-14',
    bodyHtml: await readFile(resolve(root, 'content/gpt-image-canvas.html'), 'utf8'),
  }
  // Insert once so repeated updates and fresh imports keep the same navigation.
  for (const group of docs.navGroups) {
    group.items = group.items.filter(item => item.slug !== 'gpt-image-canvas')
  }
  let quickstart = docs.navGroups.find(group => group.title === '快速接入')
  if (!quickstart) {
    quickstart = { title: '快速接入', items: [] }
    docs.navGroups.push(quickstart)
  }
  const imageGuideIndex = quickstart.items.findIndex(item => item.slug === 'gpt-image-quickstart')
  quickstart.items.splice(imageGuideIndex < 0 ? quickstart.items.length : imageGuideIndex, 0, {
    slug: 'gpt-image-canvas', title: docs.articles['gpt-image-canvas'].title, icon: 'layout',
  })
  const introduction = docs.articles.introduction
  if (introduction) {
    const $ = load(introduction.bodyHtml, null, false)
    const readingOrder = $('section').filter((_, el) => $(el).find('h2').text() === '推荐阅读顺序')
    readingOrder.find('ol').html([
      '<li>先看 <a href="?doc=faq">常见问题</a> 和 <a href="?doc=guide">平台使用指南</a>，了解平台与密钥的使用方式。</li>',
      '<li>使用 <a href="?doc=auto-config">自动配置工具（CC Switch）</a> 配置应用；需要调用接口时，查看 <a href="?doc=openai-compatible-api">通用 API 接入教程</a> 或 <a href="?doc=gpt-image-quickstart">GPT-Image 使用指南</a>。</li>',
      '<li>想通过图形界面生成图片，可查看 <a href="?doc=gpt-image-canvas">GPT 生图 · 画布使用</a>，完成渠道配置后进入生图工作台。</li>',
      '<li>遇到问题时，查看 <a href="?doc=errors">错误处理与排障</a>。</li>',
    ].join('\n'))
    introduction.bodyHtml = $.html()
    introduction.updatedAt = localOverrides.updatedAt
  }
  const faq = docs.articles.faq
  if (faq) {
    const $ = load(faq.bodyHtml, null, false)
    $('li').filter((_, el) => $(el).text().includes('按照快速接入指南配置你的工具')).html('参考 <a href="?doc=auto-config">自动配置工具（CC Switch）</a> 配置应用，或查看 <a href="?doc=openai-compatible-api">通用 API 接入教程</a>。')
    faq.bodyHtml = $.html()
    faq.updatedAt = localOverrides.updatedAt
  }
  return docs
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const docsPath = resolve(root, 'src/data/docs.json')
  const docs = await applyLocalDocs(JSON.parse(await readFile(docsPath, 'utf8')))
  await writeFile(docsPath, JSON.stringify(docs, null, 2) + '\n')
  const reportPath = resolve(root, 'reports/content-sync.json')
  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  report.assets = collectLocalAssets(docs)
  report.localOverrides = localOverrides
  report.groups = docs.navGroups.length
  report.articleCount = Object.keys(docs.articles).length
  report.articles = Object.entries(docs.articles).map(([slug, article]) => ({ slug, title: article.title, characters: article.bodyHtml.length }))
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')
  console.log('Applied local documentation updates; excluded ' + removedArticleSlugs.length + ' removed articles.')
}
