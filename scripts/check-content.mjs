import assert from 'node:assert/strict'
import { readFile, access, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname, extname } from 'node:path'
import { load } from 'cheerio'
import { collectLocalAssets } from './content-assets.mjs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docs = JSON.parse(await readFile(resolve(root, 'src/data/docs.json'), 'utf8'))
const order = docs.navGroups.flatMap(group => group.items)
assert.equal(new Set(order.map(item => item.slug)).size, order.length, 'Navigation slugs must be unique')
assert.equal(order.length, Object.keys(docs.articles).length, 'Every article must be linked from navigation')
assert(docs.articles[docs.defaultSlug], 'Default article must exist')
const paths = new Set(Object.values(docs.articles).map(article => article.path))
assert.equal(paths.size, order.length, 'Article paths must be unique')
const sources = (await readdir(resolve(root, 'content'))).filter(name => name.endsWith('.html')).sort()
assert.deepEqual(sources, Object.keys(docs.articles).map(slug => slug + '.html').sort(), 'Every article must have exactly one local source')
const assets = collectLocalAssets(docs)
const mediaFiles = (await readdir(resolve(root, 'public/media'))).map(name => '/media/' + name).sort()
assert.deepEqual(mediaFiles, assets, 'Remove unused images and include every referenced asset')
let codeBlocks = 0, images = 0, links = 0
for (const item of order) {
  const article = docs.articles[item.slug]
  assert(article?.title && article.summary && article.updatedAt && article.bodyHtml && article.path, 'Incomplete article: ' + item.slug)
  assert(/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(article.path), 'Invalid article path: ' + item.slug)
  assert.equal(article.bodyHtml, await readFile(resolve(root, 'content', item.slug + '.html'), 'utf8'), 'Run npm run update:docs after editing ' + item.slug)
  const $ = load(article.bodyHtml)
  assert($('h2').length, 'Missing sections: ' + item.slug)
  assert.equal($('script,iframe,object,embed').length, 0, 'Remote active content is not allowed')
  $('*').each((_, el) => { for (const [key, value] of Object.entries(el.attribs || {})) { assert(!/^on/i.test(key), 'Event handler in ' + item.slug); assert(!/^javascript:/i.test(value), 'Unsafe URL') } })
  for (const el of $('a[href]').toArray()) {
    links++
    const href = $(el).attr('href')
    const url = new URL(href, 'https://docs.jisuai.net')
    if (url.origin === 'https://docs.jisuai.net') {
      assert(!url.searchParams.has('doc'), 'Use canonical document paths: ' + href)
      if (!url.pathname.startsWith('/media/')) assert(paths.has(url.pathname), 'Broken document link ' + href)
    }
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
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) await scan(path)
    else if (['.json','.ts','.vue','.css','.html','.js','.svg'].includes(extname(path))) assert(!/sk-[a-zA-Z0-9]{32,}/.test(await readFile(path, 'utf8')), 'Unexpected API credential: ' + path)
  }
}
await scan(resolve(root, 'src')); await scan(resolve(root, 'public'))
console.log(JSON.stringify({ passed: true, groups: docs.navGroups.length, articles: order.length, codeBlocks, images, links, localAssets: assets.length }, null, 2))
