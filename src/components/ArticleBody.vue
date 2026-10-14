<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { slugForPath } from '../content'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import javascript from 'highlight.js/lib/languages/javascript'
hljs.registerLanguage('bash', bash); hljs.registerLanguage('json', json); hljs.registerLanguage('python', python)
hljs.registerLanguage('javascript', javascript)
const props = defineProps<{ html: string; slug: string }>()
const emit = defineEmits<{ headings: [items: { id: string; text: string; level: number }[]]; active: [id: string]; navigate: [slug: string, hash?: string]; toast: [message: string] }>()
const root = ref<HTMLElement>()
let observer: IntersectionObserver | undefined
async function enhance() {
  await nextTick()
  if (!root.value) return
  observer?.disconnect()
  const headings = Array.from(root.value.querySelectorAll<HTMLElement>('h2, h3'))
  headings.forEach((heading, index) => { if (!heading.id) heading.id = `doc-heading-${index + 1}` })
  emit('headings', headings.map(h => ({ id: h.id, text: h.textContent || '', level: Number(h.tagName.slice(1)) })))
  root.value.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code')
    if (!code || pre.querySelector('button')) return
    const raw = code.textContent || ''
    const specified = code.className.match(/language-([\w-]+)/)?.[1]
    const language = specified && hljs.getLanguage(specified) ? specified : /^\s*[\[{]/.test(raw) ? 'json' : /(^|\n)(from |import |def )/.test(raw) ? 'python' : /(^|\n)(const |let |async function |function )/.test(raw) ? 'javascript' : /(^|\n)(export |curl |[A-Z_]+=)/.test(raw) ? 'bash' : 'text'
    if (language !== 'text') code.innerHTML = hljs.highlight(raw, { language, ignoreIllegals: true }).value
    code.classList.add('hljs')
    const toolbar = document.createElement('div'); toolbar.className = 'code-toolbar'
    const label = document.createElement('span'); label.textContent = language.toUpperCase()
    const button = document.createElement('button'); button.type = 'button'; button.dataset.copy = ''; button.textContent = '复制代码'; button.setAttribute('aria-label', '复制代码')
    toolbar.append(label, button); pre.prepend(toolbar)
  })
  root.value.querySelectorAll('table').forEach(table => {
    if (table.parentElement?.classList.contains('table-scroll')) return
    const wrapper = document.createElement('div'); wrapper.className = 'table-scroll'; wrapper.tabIndex = 0; wrapper.setAttribute('role', 'region'); wrapper.setAttribute('aria-label', '文档表格，可横向滚动'); table.before(wrapper); wrapper.append(table)
  })
  observer = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) emit('active', entry.target.id) }, { rootMargin: '-100px 0px -65% 0px' })
  headings.forEach(h => observer?.observe(h))
  if (location.hash) { try { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView() } catch { /* Ignore malformed fragments. */ } }
}
async function click(event: MouseEvent) {
  const target = event.target as HTMLElement
  const button = target.closest<HTMLButtonElement>('[data-copy]')
  if (button) {
    try { await navigator.clipboard.writeText(button.closest('pre')?.querySelector('code')?.textContent || ''); emit('toast', '代码已复制到剪贴板') } catch { emit('toast', '无法访问剪贴板，请选中代码手动复制') }
    return
  }
  const anchor = target.closest<HTMLAnchorElement>('a[href]')
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download') || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
  const href = new URL(anchor.href)
  const targetSlug = href.origin === location.origin ? slugForPath(href.pathname) : undefined
  if (targetSlug && !href.search) { event.preventDefault(); emit('navigate', targetSlug, href.hash) }
}
watch(() => [props.html, props.slug], enhance, { immediate: true })
onBeforeUnmount(() => observer?.disconnect())
</script>
<template><div ref="root" class="article-body" @click="click" v-html="html"></div></template>
