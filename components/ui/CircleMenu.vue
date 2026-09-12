<script setup lang="ts">
import { ref, computed } from 'vue'
import { Menu, X } from 'lucide-vue-next'
import BrandIcon from '~/components/ui/BrandIcon.vue'

export interface CircleMenuItem {
  label: string
  href: string
  icon?: any
  brandName?: string
}

interface Props {
  items: CircleMenuItem[]
  itemSize?: number
  containerSize?: number
  openStagger?: number
  closeStagger?: number
  modelValue?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  itemSize: 48,
  containerSize: 250,
  openStagger: 0.025,
  closeStagger: 0.02,
  modelValue: undefined,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', item: CircleMenuItem): void
}>()

const internalOpen = ref(false)
const isOpen = computed({
  get: () => props.modelValue !== undefined ? props.modelValue : internalOpen.value,
  set: (val: boolean) => {
    internalOpen.value = val
    emit('update:modelValue', val)
  },
})

const isClosing = ref(false)
const hoveredIndex = ref<number | null>(null)
let closeTimer: ReturnType<typeof setTimeout> | null = null

const toggleMenu = () => {
  if (isOpen.value) {
    // Retract with reverse stagger before closing
    isClosing.value = true
    const totalRetractTime = 200 + props.items.length * (props.closeStagger * 1000)
    if (closeTimer) clearTimeout(closeTimer)
    closeTimer = setTimeout(() => {
      isOpen.value = false
      isClosing.value = false
      closeTimer = null
    }, totalRetractTime)
  } else {
    if (closeTimer) clearTimeout(closeTimer)
    isClosing.value = false
    isOpen.value = true
  }
}

// 360-degree point on circle calculation
const pointOnCircle = (i: number, n: number, r: number) => {
  const theta = (2 * Math.PI * i) / n - Math.PI / 2
  const x = Math.round(r * Math.cos(theta))
  const y = Math.round(r * Math.sin(theta))
  return { x, y }
}

const positionedItems = computed(() => {
  const r = props.containerSize / 2 - props.itemSize / 2
  return props.items.map((item, index) => {
    const { x, y } = pointOnCircle(index, props.items.length, r)
    return {
      ...item,
      x,
      y,
      openDelay: index * props.openStagger,
      closeDelay: (props.items.length - 1 - index) * props.closeStagger,
    }
  })
})
</script>

<template>
  <div
    class="relative flex items-center justify-center select-none"
    :style="{
      width: `${containerSize}px`,
      height: `${containerSize}px`,
    }"
  >
    <!-- Center Trigger Button -->
    <button
      type="button"
      class="relative z-50 rounded-full flex items-center justify-center bg-white text-black hover:bg-neutral-200 transition-transform duration-200 cursor-pointer shadow-2xl focus:outline-hidden"
      :class="[
        isOpen ? 'scale-105 ring-4 ring-white/20' : 'hover:scale-105 active:scale-95',
        isClosing ? 'animate-pulse' : '',
      ]"
      :style="{
        width: `${itemSize}px`,
        height: `${itemSize}px`,
      }"
      @click="toggleMenu"
    >
      <Transition
        mode="out-in"
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 scale-75 rotate-90"
        enter-to-class="opacity-100 scale-100 rotate-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 scale-100 rotate-0"
        leave-to-class="opacity-0 scale-75 -rotate-90"
      >
        <X v-if="isOpen" class="w-5 h-5 stroke-[2.5]" />
        <Menu v-else class="w-5 h-5 stroke-[2.5]" />
      </Transition>
    </button>

    <!-- Orbiting Items Container -->
    <div
      v-if="isOpen || isClosing"
      class="absolute inset-0 pointer-events-none flex items-center justify-center"
    >
      <div
        v-for="(item, index) in positionedItems"
        :key="`circle-item-${index}`"
        class="absolute pointer-events-auto transition-[z-index]"
        :class="hoveredIndex === index ? 'z-50' : 'z-20'"
        :style="{
          '--tx': `${item.x}px`,
          '--ty': `${item.y}px`,
          animation: isClosing
            ? `circleSpringRetract 0.2s cubic-bezier(0.4, 0, 1, 1) ${item.closeDelay}s forwards`
            : `circleSpringBlossom 0.35s cubic-bezier(0.34, 1.45, 0.64, 1) ${item.openDelay}s backwards`,
        }"
      >
        <NuxtLink
          :to="item.href"
          class="rounded-full flex items-center justify-center bg-[#1C1C1E] border border-[#2E2E2E] text-white hover:bg-[#2A2A2D] hover:border-white/60 shadow-xl transition-transform duration-150 hover:scale-115 active:scale-95 cursor-pointer relative group"
          :style="{
            width: `${itemSize - 2}px`,
            height: `${itemSize - 2}px`,
          }"
          @mouseenter="hoveredIndex = index"
          @mouseleave="hoveredIndex = null"
          @click="emit('select', item)"
        >
          <BrandIcon
            v-if="item.brandName"
            :name="item.brandName"
            :size="20"
          />
          <component
            v-else-if="item.icon"
            :is="item.icon"
            class="w-5 h-5"
          />

          <!-- Label Tooltip -->
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-1"
          >
            <span
              v-if="hoveredIndex === index"
              class="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 rounded-md bg-[#141416] border border-[#2E2E2E] text-[11px] font-medium text-white whitespace-nowrap shadow-xl pointer-events-none z-50"
            >
              {{ item.label }}
            </span>
          </Transition>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes circleSpringBlossom {
  0% {
    opacity: 0;
    transform: translate(0px, 0px) scale(0.15);
  }
  65% {
    opacity: 1;
    transform: translate(calc(var(--tx) * 1.08), calc(var(--ty) * 1.08)) scale(1.08);
  }
  85% {
    opacity: 1;
    transform: translate(calc(var(--tx) * 0.98), calc(var(--ty) * 0.98)) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translate(var(--tx), var(--ty)) scale(1);
  }
}

@keyframes circleSpringRetract {
  0% {
    opacity: 1;
    transform: translate(var(--tx), var(--ty)) scale(1);
  }
  25% {
    transform: translate(calc(var(--tx) * 1.04), calc(var(--ty) * 1.04)) scale(1.04);
  }
  100% {
    opacity: 0;
    transform: translate(0px, 0px) scale(0.15);
  }
}
</style>
