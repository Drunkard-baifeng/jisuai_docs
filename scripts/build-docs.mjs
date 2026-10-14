import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docs = JSON.parse(await readFile(resolve(root, 'content/index.json'), 'utf8'))
for (const [slug, article] of Object.entries(docs.articles)) {
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), 'Invalid article slug: ' + slug)
  article.bodyHtml = await readFile(resolve(root, 'content', slug + '.html'), 'utf8')
}
await writeFile(resolve(root, 'src/data/docs.json'), JSON.stringify(docs, null, 2) + '\n')
console.log('Built ' + Object.keys(docs.articles).length + ' documents from local content.')
