<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import BrandIcon from '~/components/ui/BrandIcon.vue'

export interface RadialItem {
  path: string
  label: string
  brandName?: string
  iconComponent?: any
}

interface Props {
  isOpen: boolean
  originX: number
  originY: number
  items: RadialItem[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  select: [path: string]
}>()

const route = useRoute()

const isRouteActive = (targetRoute: string) => {
  if (targetRoute === '/' && route.path === '/') return true
  if (targetRoute !== '/' && route.path === targetRoute) return true
  return false
}

// Reach boundaries for the hover bridge
const maxReach = computed(() => {
  if (props.items.length <= 4) return { dx: 95, dy: 75 }
  if (props.items.length <= 7) return { dx: 122, dy: 115 }
  return { dx: 136, dy: 130 }
})

// Calculate harmonious circular arc coordinates strictly to the right of the sidebar
const positionedItems = computed(() => {
  const n = props.items.length
  if (n === 0) return []

  // 1. Small lists (N <= 4): clean forward arc right next to rail
  if (n <= 4) {
    const radius = 85
    const span = n === 1 ? 0 : (n - 1) * 32
    return props.items.map((item, i) => {
      const angle = n === 1 ? 0 : -span / 2 + (span / (n - 1)) * i
      const rad = (angle * Math.PI) / 180
      return {
        ...item,
        dx: Math.round(radius * Math.cos(rad)),
        dy: Math.round(radius * Math.sin(rad)),
      }
    })
  }

  // 2. Medium lists (N <= 7): graceful compact semicircle
  if (n <= 7) {
    const radius = 112
    const step = n <= 5 ? 27 : 24.5
    const span = (n - 1) * step
    return props.items.map((item, i) => {
      const angle = -span / 2 + (span / (n - 1)) * i
      const rad = (angle * Math.PI) / 180
      return {
        ...item,
        dx: Math.round(radius * Math.cos(rad)),
        dy: Math.round(radius * Math.sin(rad)),
      }
    })
  }

  // 3. Balanced dual-ring orbit (N > 7): balanced distribution with ample clearance
  const r1 = 76
  const r2 = 126
  // Keep inner ring compact (approx 35-40% of items), outer ring has remainder
  const innerCount = Math.max(3, Math.min(4, Math.floor(n * 0.38)))
  const outerCount = n - innerCount

  const step1 = 36
  const step2 = 24
  const span1 = (innerCount - 1) * step1
  const span2 = (outerCount - 1) * step2

  return props.items.map((item, i) => {
    let radius: number
    let angle: number
    if (i < innerCount) {
      radius = r1
      angle = -span1 / 2 + (span1 / (innerCount - 1)) * i
    } else {
      const outerIdx = i - innerCount
      radius = r2
      angle = -span2 / 2 + (span2 / (outerCount - 1)) * outerIdx
    }
    const rad = (angle * Math.PI) / 180
    return {
      ...item,
      dx: Math.round(radius * Math.cos(rad)),
      dy: Math.round(radius * Math.sin(rad)),
    }
  })
})

// Stable hover grace with no premature retract jitter
const isClosing = ref(false)
const hoveredIndex = ref<number | null>(null)
let closeTimer: ReturnType<typeof setTimeout> | null = null
let retractTimer: ReturnType<typeof setTimeout> | null = null

const clearAllTimers = () => {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  if (retractTimer) {
    clearTimeout(retractTimer)
    retractTimer = null
  }
}

const cancelClose = () => {
  clearAllTimers()
  if (isClosing.value) {
    isClosing.value = false
  }
}

const handleItemMouseEnter = (index: number) => {
  cancelClose()
  hoveredIndex.value = index
}

const handleItemMouseLeave = () => {
  hoveredIndex.value = null
}

const scheduleClose = (delay = 220) => {
  clearAllTimers()
  closeTimer = setTimeout(() => {
    isClosing.value = true
    const retractTime = 160 + (props.items.length * 14) + 40
    retractTimer = setTimeout(() => {
      emit('close')
      isClosing.value = false
      retractTimer = null
    }, retractTime)
  }, delay)
}

watch([() => props.items, () => props.originY], () => {
  cancelClose()
})

watch(() => props.isOpen, (val) => {
  if (val) {
    cancelClose()
  } else {
    clearAllTimers()
    isClosing.value = false
  }
})

// Click or tap outside close handler
const handlePointerDown = (e: PointerEvent) => {
  if (!props.isOpen) return
  const target = e.target as HTMLElement
  if (!target.closest('.radial-menu-item') && !target.closest('.sidebar-category-btn')) {
    emit('close')
  }
}

// Global Escape key listener
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('pointerdown', handlePointerDown)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('pointerdown', handlePointerDown)
  }
  clearAllTimers()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 select-none pointer-events-none">
      <!-- Invisible Hover Reach Bridge -->
      <div
        class="fixed z-40 pointer-events-auto"
        :style="{
          left: '52px',
          top: `${Math.max(0, originY - maxReach.dy - 45)}px`,
          width: `${maxReach.dx + 65}px`,
          height: `${(maxReach.dy + 45) * 2}px`,
        }"
        @mouseenter="cancelClose"
        @mouseleave="scheduleClose(220)"
      />

      <!-- Orbiting Circular Submenu Buttons -->
      <div
        v-for="(item, index) in positionedItems"
        :key="item.path"
        class="radial-menu-item fixed -translate-x-1/2 -translate-y-1/2 group pointer-events-auto"
        :class="hoveredIndex === index ? 'z-[100]' : 'z-50'"
        :style="{
          left: `${originX + item.dx}px`,
          top: `${originY + item.dy}px`,
          willChange: 'transform, opacity',
          '--from-x': `${-item.dx}px`,
          '--from-y': `${-item.dy}px`,
          animation: isClosing
            ? `sidebarSpringRetract 0.14s cubic-bezier(0.4, 0, 1, 1) ${(positionedItems.length - 1 - index) * 12}ms forwards`
            : `sidebarSpringBlossom 0.3s cubic-bezier(0.22, 1.3, 0.36, 1) ${index * 14}ms backwards`,
        }"
        @mouseenter="handleItemMouseEnter(index)"
        @mouseleave="handleItemMouseLeave"
      >
        <NuxtLink
          :to="item.path"
          class="w-9.5 h-9.5 rounded-full bg-white dark:bg-[#1C1C1E] border border-zinc-200 dark:border-[#2E2E2E] hover:border-zinc-400 dark:hover:border-white/60 hover:bg-zinc-50 dark:hover:bg-[#2A2A2D] shadow-xl flex items-center justify-center text-zinc-900 dark:text-white hover:scale-110 active:scale-95 transition-all duration-150 cursor-pointer relative"
          :class="isRouteActive(item.path) ? 'border-zinc-400 bg-zinc-100 ring-2 ring-zinc-400/25 text-zinc-950 dark:border-white dark:bg-white/15 dark:ring-white/25 dark:text-white shadow-xs' : ''"
          @click="emit('close')"
        >
          <BrandIcon
            v-if="item.brandName"
            :name="item.brandName"
            :size="20"
          />
          <component
            v-else-if="item.iconComponent"
            :is="item.iconComponent"
            class="w-5 h-5"
          />
        </NuxtLink>

        <!-- Floating Tooltip -->
        <div
          class="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-150 absolute left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-zinc-800 text-white dark:bg-[#18181A] border border-zinc-700 dark:border-[#2E2E2E] text-xs font-medium whitespace-nowrap shadow-xl pointer-events-none z-[110]"
          :class="item.dy < 0 ? 'bottom-full mb-2' : 'top-full mt-2'"
        >
          {{ item.label }}
        </div>
      </div>
    </div>
  </Teleport>
</template>
