import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { docs, slugForPath } from './content'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...Object.entries(docs.articles).map(([slug, article]) => ({ path: article.path, component: App, meta: { slug } })),
    { path: '/:pathMatch(.*)*', component: App },
  ],
})
router.beforeEach(to => {
  if (['/', '/docs', '/docs/'].includes(to.path)) {
    if ('doc' in to.query) {
      const legacySlug = typeof to.query.doc === 'string' ? to.query.doc : ''
      const query = { ...to.query }
      delete query.doc
      return { path: docs.articles[legacySlug]?.path || '/not-found', query, hash: to.hash, replace: true }
    }
    if (to.path !== '/') return { path: '/', query: to.query, hash: to.hash, replace: true }
  }
  const canonicalPath = to.path.replace(/\/+$/, '') || '/'
  if (to.path !== canonicalPath && slugForPath(canonicalPath)) {
    return { path: canonicalPath, query: to.query, hash: to.hash, replace: true }
  }
})
createApp(App).use(router).mount('#app')
