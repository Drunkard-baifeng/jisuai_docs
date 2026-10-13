import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { load } from 'cheerio'
import sanitizeHtml from 'sanitize-html'
import { applyLocalDocs, collectLocalAssets, localOverrides, removedArticleSlugs } from './apply-local-docs.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceArg = process.argv.indexOf('--source')
if (sourceArg < 0 || !process.argv[sourceArg + 1]) {
  throw new Error('Usage: npm run sync:docs -- --source <documentation URL>')
}
const source = new URL(process.argv[sourceArg + 1])
const targetHost = 'jisuai.net'
const sourceBrand = source.hostname.split('.')[0]
const replaceBrand = value => value.replaceAll(source.hostname, targetHost)
  .replace(new RegExp(source.hostname.split('.').join('\\.'), 'gi'), targetHost)
  .replace(new RegExp(sourceBrand, 'gi'), match => match === match.toUpperCase() ? 'JISUAI' : match[0] === match[0].toUpperCase() ? 'Jisuai' : 'jisuai')

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
  return response
}
// Only decode literal AST nodes. Never execute JavaScript fetched from a website.
function literal(node) {
  if (node.type === 'Literal') return node.value
  if (node.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked
  if (node.type === 'ArrayExpression') return node.elements.map(literal)
  if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.map(p => {
    if (p.type !== 'Property' || p.computed || p.method || p.kind !== 'init') throw new Error('Unsupported object property')
    const key = p.key.name ?? p.key.value
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe key')
    return [key, literal(p.value)]
  }))
  throw new Error(`Non-literal source node: ${node.type}`)
}

const landing = await (await download(source)).text()
const $landing = load(landing)
const dataPath = $landing('script[src]').toArray().map(el => $landing(el).attr('src')).find(src => /docs-data\.js/.test(src))
if (!dataPath) throw new Error('No documentation data script found')
const raw = await (await download(new URL(dataPath, source))).text()
const ast = parse(raw, { ecmaVersion: 'latest' })
const assignment = ast.body.find(n => n.type === 'ExpressionStatement' && n.expression.type === 'AssignmentExpression')
if (!assignment) throw new Error('No literal documentation payload found')
const docs = literal(assignment.expression.right)
if (!docs.navGroups?.length || !docs.articles?.[docs.defaultSlug]) throw new Error('Invalid documentation payload')
const excluded = new Set(removedArticleSlugs)
for (const slug of excluded) delete docs.articles[slug]
docs.navGroups = docs.navGroups.map(group => ({ ...group, items: group.items.filter(item => !excluded.has(item.slug)) })).filter(group => group.items.length)
const expected = docs.navGroups.flatMap(group => group.items.map(item => item.slug))
for (const slug of expected) if (!docs.articles[slug]?.bodyHtml) throw new Error(`Missing article: ${slug}`)

const assets = new Map()
for (const article of Object.values(docs.articles)) {
  const $ = load(article.bodyHtml, null, false)
  // The original operator's personal support identity is not our contact.
  $('p').filter((_, el) => $(el).text().includes('onefly2001')).text('如需进一步协助，请通过 jisuai.net 控制台联系支持团队。')
  $('img[src], source[src], video[src], a[href]').each((_, el) => {
    const attr = el.name === 'a' ? 'href' : 'src'
    const value = $(el).attr(attr)
    if (!value || /^(data:|#)/.test(value)) return
    const remote = new URL(value, source)
    if (remote.origin !== source.origin || !/\.(png|jpe?g|webp|gif|svg|avif|mp4|pdf)$/i.test(remote.pathname)) return
    const digest = createHash('sha256').update(remote.pathname).digest('hex').slice(0, 12)
    const local = `/media/${digest}${extname(remote.pathname)}`
    assets.set(remote.href, local)
    $(el).attr(attr, local)
  })
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (href.startsWith('#') || href.startsWith('/media/')) return
    const url = new URL(href, source)
    if (url.origin === source.origin && url.pathname.startsWith('/docs')) {
      $(el).attr('href', `?doc=${encodeURIComponent(url.searchParams.get('doc') || docs.defaultSlug)}${url.hash}`)
    } else if (url.origin === source.origin) {
      url.host = targetHost
      $(el).attr('href', url.href)
    }
    if (/^https?:/.test($(el).attr('href'))) $(el).attr({ target: '_blank', rel: 'noopener noreferrer' })
  })
  article.bodyHtml = sanitizeHtml(replaceBrand($.html()), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'section', 'figure', 'figcaption', 'details', 'summary'],
    allowedAttributes: { '*': ['class', 'id', 'aria-label'], a: ['href', 'target', 'rel', 'download'], img: ['src', 'alt', 'width', 'height', 'loading'], th: ['scope', 'colspan', 'rowspan'], td: ['colspan', 'rowspan'], code: ['class'] },
    allowedSchemes: ['https', 'http', 'mailto'],
  })
}
const normalized = JSON.parse(replaceBrand(JSON.stringify(docs)))
await applyLocalDocs(normalized)
for (const article of Object.values(normalized.articles)) {
  article.bodyHtml = article.bodyHtml.replaceAll('避免使用旧域名 <code>jisuai.net</code>', '确认使用 <code>https://jisuai.net</code>')
}
const usedAssets = collectLocalAssets(normalized)
for (const [remote, local] of assets) {
  if (!usedAssets.includes(local)) continue
  const file = resolve(root, 'public', local.slice(1))
  await mkdir(dirname(file), { recursive: true })
  const image = Buffer.from(await (await download(remote)).arrayBuffer())
  await writeFile(file, image)
  console.log(`Saved asset ${local}`)
}
await mkdir(resolve(root, 'src/data'), { recursive: true })
await writeFile(resolve(root, 'src/data/docs.json'), JSON.stringify(normalized, null, 2) + '\n')
const report = { fetchedAt: new Date().toISOString(), sourceSha256: createHash('sha256').update(raw).digest('hex'), targetHost, groups: normalized.navGroups.length, articleCount: Object.keys(normalized.articles).length, assets: [...assets.values()], articles: Object.entries(normalized.articles).map(([slug, article]) => ({ slug, title: article.title, characters: article.bodyHtml.length })) }
await mkdir(resolve(root, 'reports'), { recursive: true })
report.assets = usedAssets
report.localOverrides = localOverrides
report.changes = ['域名与品牌替换为 jisuai.net，保留代码标识符大小写习惯', '将原站个人微信联系方式替换为控制台支持说明', '仅下载保留文章实际引用的资源', '保留原始文章日期及技术内容；未验证目标域名的 API、模型分组和安装脚本']
await writeFile(resolve(root, 'reports/content-sync.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
