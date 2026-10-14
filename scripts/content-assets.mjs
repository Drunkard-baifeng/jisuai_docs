import { load } from 'cheerio'

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
