<script setup lang="ts">
interface Props {
  modelValue?: string | number
  type?: string
  placeholder?: string
  disabled?: boolean
  id?: string
  size?: 'default' | 'sm' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  placeholder: '',
  disabled: false,
  size: 'default',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'keydown', event: KeyboardEvent): void
}>()

const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <input
    :id="id"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="onInput"
    @keydown="$emit('keydown', $event)"
    class="w-full bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-lg transition-all duration-150 ease-in-out focus:outline-none focus:border-[#1447E6] focus:ring-3 focus:ring-[#1447E6]/15 disabled:opacity-50 disabled:cursor-not-allowed"
    :class="{
      'h-8 px-2.5 text-xs': size === 'sm',
      'h-10 px-3.5 text-sm': size === 'default',
      'h-12 px-4 text-base': size === 'lg',
    }"
  />
</template>
