<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Search, ArrowUp, ArrowDown, CornerDownLeft, FileText, X } from 'lucide-vue-next'
import { searchDocs } from '../content'
const emit = defineEmits<{ close: []; navigate: [slug: string] }>()
const query = ref('')
const selected = ref(0)
const input = ref<HTMLInputElement>()
const panel = ref<HTMLElement>()
const results = computed(() => searchDocs(query.value))
const previousFocus = document.activeElement as HTMLElement | null
function onInput() { selected.value = 0 }
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close') }
  if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault()
    const count = results.value.length
    if (!count) return
    selected.value = (selected.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
    nextTick(() => panel.value?.querySelector('.search-result.selected')?.scrollIntoView({ block: 'nearest' }))
  }
  if (event.key === 'Enter' && document.activeElement === input.value && results.value[selected.value]) emit('navigate', results.value[selected.value].slug)
  if (event.key === 'Tab') {
    const elements = Array.from(panel.value?.querySelectorAll<HTMLElement>('input, button, a[href]') || [])
    const first = elements[0], last = elements.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
}
onMounted(() => { input.value?.focus(); document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('keydown', onKey); previousFocus?.focus() })
</script>
<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <section ref="panel" role="dialog" aria-modal="true" aria-label="搜索文档" class="search-dialog">
      <div class="search-input-row"><Search :size="22" /><input ref="input" v-model="query" aria-label="搜索文档关键词" placeholder="搜索文档、配置或错误信息…" @input="onInput" /><button class="icon-button" aria-label="关闭搜索" @click="emit('close')"><X :size="19" /></button></div>
      <div class="search-results"><p class="search-caption">{{ query.trim() ? `找到 ${results.length} 篇文档` : '推荐阅读' }}</p>
        <button v-for="(item, index) in results" :key="item.slug" class="search-result" :class="{ selected: selected === index }" @mouseenter="selected = index" @click="emit('navigate', item.slug)"><FileText :size="19" /><span><small>{{ item.group }}</small><strong>{{ item.title }}</strong><span class="result-excerpt">{{ item.excerpt }}</span></span><CornerDownLeft :size="16" /></button>
        <div v-if="!results.length" class="search-empty"><Search :size="32" /><strong>没有找到相关文档</strong><p>换一个关键词试试，例如「API」「密钥」或「配置」。</p></div>
      </div>
      <div class="search-footer"><span><ArrowUp :size="13" /><ArrowDown :size="13" /> 切换</span><span><CornerDownLeft :size="13" /> 打开</span><span><kbd>esc</kbd> 关闭</span><b>极速 AI 文档</b></div>
    </section>
  </div>
</template>
