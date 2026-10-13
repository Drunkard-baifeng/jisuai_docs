import raw from './data/docs.json'

export interface Article { title: string; group: string; summary: string; updatedAt: string; bodyHtml: string }
export interface NavItem { title: string; slug: string; icon: string }
export const docs = raw as { defaultSlug: string; navGroups: { title: string; items: NavItem[] }[]; articles: Record<string, Article> }
export const order = docs.navGroups.flatMap(group => group.items.map(item => ({ ...item, group: group.title })))
const plainText = (html: string) => {
  const template = document.createElement('template')
  template.innerHTML = html
  return (template.content.textContent || '').replace(/\s+/g, ' ').trim()
}
export const searchIndex = order.map(item => ({ ...item, summary: docs.articles[item.slug].summary, text: plainText(docs.articles[item.slug].bodyHtml) }))
export function searchDocs(query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return searchIndex.filter(item => ['introduction', 'auto-config', 'gpt-image-canvas', 'gpt-image-quickstart', 'openai-compatible-api'].includes(item.slug)).map(item => ({ ...item, excerpt: item.summary }))
  return searchIndex.map(item => {
    const title = item.title.toLowerCase()
    const body = `${item.summary} ${item.text}`.toLowerCase()
    if (!terms.every(term => title.includes(term) || body.includes(term))) return null
    const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 10 : 1), 0)
    const hit = item.text.toLowerCase().indexOf(terms[0])
    const start = Math.max(0, hit - 28)
    return { ...item, score, excerpt: hit < 0 ? item.summary : `${start ? '…' : ''}${item.text.slice(start, start + 120)}…` }
  }).filter((item): item is NonNullable<typeof item> => item !== null).sort((a, b) => b.score - a.score).slice(0, 20)
}
