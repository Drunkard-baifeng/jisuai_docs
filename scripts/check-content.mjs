import assert from 'node:assert/strict'
import { readFile, access, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname, extname } from 'node:path'
import { load } from 'cheerio'
import { collectLocalAssets, removedArticleSlugs } from './apply-local-docs.mjs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docs = JSON.parse(await readFile(resolve(root, 'src/data/docs.json'), 'utf8'))
const report = JSON.parse(await readFile(resolve(root, 'reports/content-sync.json'), 'utf8'))
const order = docs.navGroups.flatMap(group => group.items)
assert.equal(new Set(order.map(item => item.slug)).size, order.length, 'Navigation slugs must be unique')
assert.equal(order.length, Object.keys(docs.articles).length, 'Every article must be linked from navigation')
assert.equal(report.articleCount, order.length, 'Sync report count must match')
const assets = collectLocalAssets(docs)
assert.deepEqual(report.assets, assets, 'Report assets must match published content')
const mediaFiles = (await readdir(resolve(root, 'public/media'))).map(name => '/media/' + name).sort()
assert.deepEqual(mediaFiles, assets, 'Remove unused images and include every referenced asset')
for (const slug of removedArticleSlugs) {
  assert(!docs.articles[slug], 'Removed article must not be published: ' + slug)
  assert(!order.some(item => item.slug === slug), 'Removed article must not appear in navigation: ' + slug)
}
let codeBlocks = 0, images = 0, links = 0
for (const item of order) {
  const article = docs.articles[item.slug]
  assert(article?.title && article.summary && article.updatedAt && article.bodyHtml, 'Incomplete article: ' + item.slug)
  const $ = load(article.bodyHtml)
  assert($('h2').length, 'Missing sections: ' + item.slug)
  assert.equal($('script,iframe,object,embed').length, 0, 'Remote active content is not allowed')
  $('*').each((_, el) => { for (const [key, value] of Object.entries(el.attribs || {})) { assert(!/^on/i.test(key), 'Event handler in ' + item.slug); assert(!/^javascript:/i.test(value), 'Unsafe URL') } })
  for (const el of $('a[href]').toArray()) {
    links++
    const href = $(el).attr('href')
    if (href.startsWith('?doc=')) assert(docs.articles[new URL(href, 'https://jisuai.net').searchParams.get('doc')], 'Broken document link ' + href)
    if (/^\//.test(href)) assert(href.startsWith('/media/'), 'Unresolved source-site link ' + href)
  }
  for (const el of $('img').toArray()) {
    images++
    const src = $(el).attr('src')
    assert(src.startsWith('/media/'), 'Image must be local: ' + src)
    await access(resolve(root, 'public', src.slice(1)))
    assert($(el).attr('alt'), 'Image needs alternative text')
  }
  $('pre code').each((_, el) => { codeBlocks++; assert($(el).text().trim(), 'Empty code example') })
}
const forbidden = new RegExp(['to', 'sky'].join(''), 'i')
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) await scan(path)
    else if (['.json','.ts','.vue','.css','.html','.js','.svg'].includes(extname(path))) assert(!forbidden.test(await readFile(path, 'utf8')), 'Original brand remains: ' + path)
  }
}
await scan(resolve(root, 'src')); await scan(resolve(root, 'public'))
console.log(JSON.stringify({ passed: true, groups: docs.navGroups.length, articles: order.length, codeBlocks, images, links, localAssets: report.assets.length }, null, 2))
