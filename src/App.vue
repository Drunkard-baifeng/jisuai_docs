<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowUpRight, ArrowRight, ArrowLeft, ChevronRight, Search, Sun, Moon, Menu, X, Link2, Check, Zap, BookOpen, Code2, Terminal, Sparkles, CircleHelp, ThumbsUp, ThumbsDown, Clock3, ExternalLink } from 'lucide-vue-next'
import { docs, order } from './content'
import DocIcon from './components/DocIcon.vue'
import SearchDialog from './components/SearchDialog.vue'
import ArticleBody from './components/ArticleBody.vue'
const route = useRoute(), router = useRouter()
const slug = computed(() => typeof route.query.doc === 'string' ? route.query.doc : docs.defaultSlug)
const article = computed(() => docs.articles[slug.value])
const isIntro = computed(() => slug.value === 'introduction')
const currentIndex = computed(() => order.findIndex(item => item.slug === slug.value))
const previous = computed(() => order[currentIndex.value - 1])
const following = computed(() => order[currentIndex.value + 1])
const searchOpen = ref(false), menuOpen = ref(false)
const dark = ref(document.documentElement.dataset.theme === 'dark')
const headings = ref<{ id: string; text: string; level: number }[]>([])
const activeHeading = ref(''), toastMessage = ref(''), feedback = ref('')
const toc = computed(() => headings.value.filter(h => h.level === 2))
const readTime = computed(() => Math.max(1, Math.ceil((article.value?.bodyHtml.replace(/<[^>]*>/g, '').length || 0) / 600)))
let toastTimer: ReturnType<typeof setTimeout>
const cards = [
  { slug: 'auto-config', title: 'CC Switch', description: '通过图形界面配置多个 AI 应用', type: 'claude', tag: '推荐', icon: Sparkles },
  { slug: 'gpt-image-canvas', title: 'GPT 生图画布', description: '配置渠道，在生图工作台生成图片', type: 'codex', icon: Sparkles },
  { slug: 'openai-compatible-api', title: '通用 API', description: '兼容标准协议，自由连接应用', type: 'api', icon: Terminal },
]
function notify(message: string) { clearTimeout(toastTimer); toastMessage.value = message; toastTimer = setTimeout(() => toastMessage.value = '', 2600) }
async function navigate(next: string, hash = '') {
  menuOpen.value = false; searchOpen.value = false
  await router.push({ path: route.path, query: { doc: next }, hash })
  if (!hash) window.scrollTo({ top: 0, behavior: 'instant' })
  else { await nextTick(); document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }) }
}
function toggleTheme() { dark.value = !dark.value; document.documentElement.dataset.theme = dark.value ? 'dark' : 'light'; try { localStorage.setItem('jisuai-theme', dark.value ? 'dark' : 'light') } catch {} }
async function copyLink() { try { await navigator.clipboard.writeText(location.href); notify('页面链接已复制') } catch { notify('复制失败，请从地址栏复制页面链接') } }
function vote(value: string) { feedback.value = value; try { localStorage.setItem(`jisuai-feedback-${slug.value}`, value) } catch {}; notify('感谢反馈，已保存在当前浏览器') }
function shortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchOpen.value = !searchOpen.value }
  if (event.key === 'Escape') menuOpen.value = false
}
function jump(id: string) { activeHeading.value = id; router.replace({ query: route.query, hash: `#${id}` }); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }
watch([searchOpen, menuOpen], ([search, menu]) => document.body.style.overflow = search || menu ? 'hidden' : '')
watch(slug, () => {
  headings.value = []; activeHeading.value = ''
  document.title = `${article.value?.title || '页面未找到'} · 极速 AI 文档`
  document.querySelector('meta[name=description]')?.setAttribute('content', article.value?.summary || '极速 AI 开发者文档')
  try { feedback.value = localStorage.getItem(`jisuai-feedback-${slug.value}`) || '' } catch { feedback.value = '' }
}, { immediate: true })
onMounted(() => document.addEventListener('keydown', shortcut))
onBeforeUnmount(() => { document.removeEventListener('keydown', shortcut); clearTimeout(toastTimer); document.body.style.overflow = '' })
</script>

<template>
  <a href="#main" class="skip-link">跳转到文档内容</a>
  <header class="topbar">
    <a class="brand" href="?doc=introduction" @click.prevent="navigate('introduction')"><span class="brand-symbol"><Zap :size="23" fill="currentColor" :stroke-width="1.5" /></span><strong>极速<span>AI</span></strong><span class="brand-divider"></span><span class="brand-label">开发者文档</span></a>
    <nav class="top-nav" aria-label="主导航"><a href="?doc=introduction" :class="{ active: slug !== 'openai-compatible-api' && slug !== 'faq' }" @click.prevent="navigate('introduction')">文档指南</a><a href="?doc=openai-compatible-api" :class="{ active: slug === 'openai-compatible-api' }" @click.prevent="navigate('openai-compatible-api')">API 参考</a><a href="?doc=faq" :class="{ active: slug === 'faq' }" @click.prevent="navigate('faq')">常见问题</a></nav>
    <div class="top-tools"><button class="mobile-search icon-button" aria-label="搜索文档" @click="searchOpen = true"><Search :size="19" /></button><button class="icon-button theme-button" :aria-label="dark ? '切换浅色模式' : '切换深色模式'" @click="toggleTheme"><Sun v-if="dark" :size="19" /><Moon v-else :size="18" /></button><span class="tool-divider"></span><a class="console-link" href="https://jisuai.net" target="_blank" rel="noopener noreferrer">控制台 <ArrowUpRight :size="15" /></a><a class="primary-button header-cta" href="https://jisuai.net/register" target="_blank" rel="noopener noreferrer">开始使用 <ArrowRight :size="15" /></a><button class="menu-button icon-button" :aria-expanded="menuOpen" aria-label="切换文档目录" aria-controls="sidebar" @click="menuOpen = !menuOpen"><X v-if="menuOpen" :size="21" /><Menu v-else :size="21" /></button></div>
  </header>
  <div v-if="menuOpen" class="sidebar-backdrop" @click="menuOpen = false"></div>
  <aside id="sidebar" class="sidebar" :class="{ open: menuOpen }" aria-label="文档导航">
    <button class="search-trigger" @click="searchOpen = true; menuOpen = false"><Search :size="16" /><span>搜索文档</span><kbd>Ctrl K</kbd></button>
    <div class="sidebar-caption"><BookOpen :size="15" /><span>文档导航</span><span class="tiny-tag">指南</span></div>
    <nav class="side-nav"><section v-for="group in docs.navGroups" :key="group.title" class="nav-group"><h2>{{ group.title }}</h2><a v-for="item in group.items" :key="item.slug" :href="`?doc=${item.slug}`" class="nav-item" :class="{ active: slug === item.slug }" :aria-current="slug === item.slug ? 'page' : undefined" @click.prevent="navigate(item.slug)"><DocIcon :name="item.icon" /><span>{{ item.title.replace('jisuai.net 使用指南', '平台使用指南') }}</span><span v-if="slug === item.slug" class="active-dot"></span></a></section></nav>
    <a class="sidebar-help" href="?doc=errors" @click.prevent="navigate('errors')"><span class="help-icon"><CircleHelp :size="18" /></span><span><strong>遇到问题？</strong><small>接入排障与常见解答</small></span><ArrowUpRight :size="16" /></a>
    <div class="sidebar-footer"><span class="mini-symbol"><Zap :size="12" fill="currentColor" /></span>jisuai.net <span>为开发者而构建</span></div>
  </aside>
  <div class="workspace">
    <main id="main" class="main-content" tabindex="-1">
      <template v-if="article">
        <div class="article-toolbar"><div class="breadcrumbs"><BookOpen :size="14" /><ChevronRight :size="13" /><span>{{ article.group }}</span><ChevronRight :size="13" /><strong>{{ article.title }}</strong></div><button class="copy-link" aria-label="复制页面链接" @click="copyLink"><Link2 :size="15" /><span>复制链接</span></button></div>
        <template v-if="isIntro">
          <section class="welcome-hero"><div class="hero-copy"><span class="eyebrow"><span></span> BUILD WITH JISUAI</span><h1>欢迎使用 <span>极速 AI</span></h1><p>连接强大的模型，释放你的创造力。<br />从第一行配置开始，让 AI 融入你的开发工作流。</p><div class="hero-actions"><a class="primary-button" href="?doc=auto-config" @click.prevent="navigate('auto-config')">快速开始 <ArrowRight :size="16" /></a><a class="text-link" href="?doc=openai-compatible-api" @click.prevent="navigate('openai-compatible-api')">探索 API <ArrowUpRight :size="15" /></a></div></div><div class="hero-visual" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="hero-core"><Zap :size="39" fill="currentColor" /></div><div class="orbit-chip chip-claude"><Sparkles :size="14" /> Claude</div><div class="orbit-chip chip-codex"><Code2 :size="14" /> Codex</div><div class="orbit-chip chip-deepseek"><span>≈</span> DeepSeek</div><span class="orbit-dot dot-one"></span><span class="orbit-dot dot-two"></span></div></section>
          <div class="intro-note"><span class="note-icon"><Zap :size="17" /></span><div><strong>一个平台，多种可能。</strong><span>统一接入 Claude、Codex 与 DeepSeek，专注于构建本身。</span></div></div>
          <section class="quickstart-section"><div class="section-heading"><h2>选择你的接入方式</h2><span>几分钟，开启 AI 开发之旅</span></div><div class="quickstart-grid"><a v-for="card in cards" :key="card.slug" :href="`?doc=${card.slug}`" class="quickstart-card" @click.prevent="navigate(card.slug)"><div class="quickstart-top"><span class="product-icon" :class="card.type"><component :is="card.icon" :size="23" :stroke-width="1.7" /></span><span v-if="card.tag" class="recommend-tag">{{ card.tag }}</span><ArrowUpRight v-else :size="15" class="card-arrow" /></div><h3>{{ card.title }}</h3><p>{{ card.description }}</p><span class="card-link">查看接入指南 <ArrowRight :size="13" /></span></a></div></section>
          <div class="overview-heading"><span>认识极速 AI</span><div></div></div>
        </template>
        <header v-else class="article-header"><span class="eyebrow">{{ article.group }}</span><h1>{{ article.title }}</h1><p>{{ article.summary }}</p><div class="article-meta"><Clock3 :size="14" /> 约 {{ readTime }} 分钟阅读 <span>·</span> 内容更新于 {{ article.updatedAt }}</div></header>
        <ArticleBody :key="slug" :html="article.bodyHtml" :slug="slug" @headings="headings = $event" @active="activeHeading = $event" @navigate="navigate" @toast="notify" />
        <div class="article-feedback"><div><span>这篇文档对你有帮助吗？</span><button :class="{ voted: feedback === 'yes' }" :aria-pressed="feedback === 'yes'" aria-label="有帮助" @click="vote('yes')"><ThumbsUp :size="14" /> 有帮助</button><button :class="{ voted: feedback === 'no' }" :aria-pressed="feedback === 'no'" aria-label="需要改进" @click="vote('no')"><ThumbsDown :size="14" /></button></div><small>{{ article.updatedAt }} 更新</small></div>
        <nav class="pagination" aria-label="文章翻页"><a v-if="previous" :href="`?doc=${previous.slug}`" @click.prevent="navigate(previous.slug)"><ArrowLeft :size="17" /><span><small>上一篇</small><strong>{{ previous.title }}</strong></span></a><span v-else></span><a v-if="following" class="next" :href="`?doc=${following.slug}`" @click.prevent="navigate(following.slug)"><span><small>下一篇</small><strong>{{ following.title }}</strong></span><ArrowRight :size="17" /></a></nav>
      </template>
      <section v-else class="not-found"><BookOpen :size="44" /><p>404 · DOCUMENT NOT FOUND</p><h1>这篇文档还未抵达</h1><p>请检查链接，或从文档首页继续探索。</p><button class="primary-button" @click="navigate('introduction')">返回文档首页 <ArrowRight :size="16" /></button></section>
      <footer class="page-footer"><span>© {{ new Date().getFullYear() }} 极速 AI · jisuai.net</span><span>让创造，更进一步 <ArrowUpRight :size="12" /></span></footer>
    </main>
    <aside v-if="article" class="page-toc" aria-label="本页目录"><div class="toc-title"><span class="toc-lines">☷</span> 本页内容</div><nav><a v-for="heading in toc" :key="heading.id" :href="`#${heading.id}`" :class="{ active: activeHeading === heading.id }" @click.prevent="jump(heading.id)">{{ heading.text }}</a></nav><div class="toc-divider"></div><a class="toc-support" href="?doc=errors" @click.prevent="navigate('errors')"><CircleHelp :size="15" /> 获取帮助 <ArrowUpRight :size="13" /></a><a class="toc-support" href="https://jisuai.net" target="_blank" rel="noopener noreferrer"><ExternalLink :size="14" /> 前往控制台 <ArrowUpRight :size="13" /></a><div class="toc-tip"><span class="tip-spark"><Sparkles :size="19" /></span><strong>准备好开始了吗？</strong><p>获取你的 API Key，<br />开启下一次创造。</p><a href="https://jisuai.net/keys" target="_blank" rel="noopener noreferrer">获取密钥 <ArrowRight :size="13" /></a></div></aside>
  </div>
  <Teleport to="body"><SearchDialog v-if="searchOpen" @close="searchOpen = false" @navigate="navigate" /><Transition name="toast"><div v-if="toastMessage" class="toast-message" role="status"><Check :size="17" />{{ toastMessage }}</div></Transition></Teleport>
</template>
