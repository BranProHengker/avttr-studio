<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { X } from 'lucide-vue-next'
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
  categoryTitle: string
  items: RadialItem[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', path: string): void
}>()

const route = useRoute()

const isRouteActive = (targetRoute: string) => {
  if (targetRoute === '/' && route.path === '/') return true
  if (targetRoute !== '/' && route.path === targetRoute) return true
  return false
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
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
})

// Calculate positions for circular buttons
const positionedItems = computed(() => {
  const n = props.items.length
  if (n === 0) return []

  const winHeight = typeof window !== 'undefined' ? window.innerHeight : 900
  let centerAngle = 0
  if (props.originY < 180) {
    centerAngle = 25
  } else if (props.originY > winHeight - 180) {
    centerAngle = -25
  }

  if (n <= 4) {
    const radius = 96
    const span = 85
    return props.items.map((item, i) => {
      const angle = n === 1 ? centerAngle : centerAngle - span / 2 + (span / (n - 1)) * i
      const rad = (angle * Math.PI) / 180
      return {
        ...item,
        dx: Math.round(radius * Math.cos(rad)),
        dy: Math.round(radius * Math.sin(rad)),
      }
    })
  }

  if (n <= 7) {
    // Alternating radii constellation matching Photo 2
    const span = 125
    return props.items.map((item, i) => {
      const angle = centerAngle - span / 2 + (span / (n - 1)) * i
      const rad = (angle * Math.PI) / 180
      const radius = i % 2 === 0 ? 92 : 148
      return {
        ...item,
        dx: Math.round(radius * Math.cos(rad)),
        dy: Math.round(radius * Math.sin(rad)),
      }
    })
  }

  // 2 concentric orbits for N > 7
  const innerCount = Math.ceil(n / 2)
  const outerCount = n - innerCount
  const r1 = 92
  const r2 = 154
  const spanInner = 100
  const spanOuter = 120

  return props.items.map((item, i) => {
    let angle: number
    let radius: number

    if (i < innerCount) {
      angle = centerAngle - spanInner / 2 + (spanInner / (innerCount - 1)) * i
      radius = r1
    } else {
      const outerIndex = i - innerCount
      angle = centerAngle - spanOuter / 2 + (spanOuter / (outerCount - 1)) * outerIndex
      radius = r2
    }

    const rad = (angle * Math.PI) / 180
    return {
      ...item,
      dx: Math.round(radius * Math.cos(rad)),
      dy: Math.round(radius * Math.sin(rad)),
    }
  })
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isOpen" class="fixed inset-0 z-50 select-none">
        <!-- Subtle Backdrop -->
        <div
          class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          @click="emit('close')"
        />

        <!-- Category Title Pill Above Constellation -->
        <div
          class="fixed z-50 pointer-events-none -translate-x-1/2 transition-all duration-200"
          :style="{
            left: `${originX + 90}px`,
            top: `${originY - 110}px`
          }"
        >
          <span class="px-3.5 py-1 rounded-full bg-[#1E1E20]/95 border border-[#2E2E2E] text-[11px] font-semibold uppercase tracking-wider text-neutral-200 shadow-2xl backdrop-blur-md">
            {{ categoryTitle }}
          </span>
        </div>

        <!-- The White X Button at Origin (Matching Photo 2) -->
        <button
          type="button"
          class="fixed z-50 w-11 h-11 rounded-full bg-white text-black shadow-2xl flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-200 -translate-x-1/2 -translate-y-1/2"
          :style="{ left: `${originX}px`, top: `${originY}px` }"
          title="Close (Esc)"
          @click="emit('close')"
        >
          <X class="w-5 h-5 stroke-[2.5]" />
        </button>

        <!-- Orbiting Circular Submenu Buttons (Matching Photo 2) -->
        <div
          v-for="(item, index) in positionedItems"
          :key="item.path"
          class="fixed z-50 -translate-x-1/2 -translate-y-1/2 group"
          :style="{
            left: `${originX + item.dx}px`,
            top: `${originY + item.dy}px`,
            animation: `radialPop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 25}ms backwards`
          }"
        >
          <NuxtLink
            :to="item.path"
            class="w-12 h-12 rounded-full bg-[#212121] border border-[#2E2E2E] hover:border-white/50 hover:bg-[#2A2A2D] shadow-2xl flex items-center justify-center text-white hover:scale-115 active:scale-95 transition-all cursor-pointer relative"
            :class="isRouteActive(item.path) ? 'border-white bg-white/15 ring-2 ring-white/20 text-white' : ''"
            @click="emit('close')"
          >
            <BrandIcon
              v-if="item.brandName"
              :name="item.brandName"
              :size="22"
            />
            <component
              v-else-if="item.iconComponent"
              :is="item.iconComponent"
              class="w-5.5 h-5.5"
            />
          </NuxtLink>

          <!-- Floating Tooltip on Hover -->
          <div
            class="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-150 absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1 rounded-lg bg-[#1C1C1E] border border-[#2E2E2E] text-xs font-medium text-white whitespace-nowrap shadow-2xl pointer-events-none z-50"
          >
            {{ item.label }}
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@keyframes radialPop {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.2);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
</style>
