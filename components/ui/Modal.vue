<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'

interface Props {
  modelValue: boolean
  title?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  title: '',
  maxWidth: 'lg',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
}>()

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.modelValue) {
    close()
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (typeof document !== 'undefined') {
      if (val) {
        document.body.style.overflow = 'hidden'
      } else {
        document.body.style.overflow = ''
      }
    }
  }
)

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
  }
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
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/35 dark:bg-black/75 backdrop-blur-sm transition-opacity"
          @click="close"
        />

        <!-- Modal Dialog Surface -->
        <div
          class="relative w-full bg-white dark:bg-[#161617] border border-zinc-200 dark:border-[#28282D] rounded-[14px] shadow-[0_16px_48px_rgba(0,0,0,0.12)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.7)] overflow-hidden z-10 my-8 transition-all transform max-h-[90vh] flex flex-col"
          :class="{
            'max-w-sm': maxWidth === 'sm',
            'max-w-md': maxWidth === 'md',
            'max-w-lg': maxWidth === 'lg',
            'max-w-xl': maxWidth === 'xl',
            'max-w-2xl': maxWidth === '2xl',
            'max-w-3xl': maxWidth === '3xl',
            'max-w-4xl': maxWidth === '4xl',
            'max-w-5xl': maxWidth === '5xl',
          }"
        >
          <!-- Header -->
          <div
            v-if="title || $slots.header"
            class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-[#26262A] bg-zinc-50/50 dark:bg-[#161617]"
          >
            <slot name="header">
              <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                {{ title }}
              </h3>
            </slot>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-neutral-400 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-[#26262A] rounded-md transition-colors cursor-pointer"
              @click="close"
              aria-label="Close dialog"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 overflow-y-auto flex-1 bg-white dark:bg-[#161617]">
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer"
            class="flex items-center justify-end px-6 py-3.5 bg-zinc-50 dark:bg-[#131315] border-t border-zinc-200 dark:border-[#26262A] gap-2.5"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
