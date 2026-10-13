<script setup lang="ts">
import { BookOpen, Sparkles, Globe2, Zap, Link2, TriangleAlert, PanelsTopLeft } from 'lucide-vue-next'
import type { Component } from 'vue'
defineProps<{ name?: string }>()
const icons: Record<string, Component> = { book: BookOpen, spark: Sparkles, globe: Globe2, flash: Zap, link: Link2, warning: TriangleAlert, layout: PanelsTopLeft }
</script>
<template><component :is="icons[name || 'book'] || BookOpen" :size="17" :stroke-width="1.7" aria-hidden="true" /></template>
