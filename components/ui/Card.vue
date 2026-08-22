<script setup lang="ts">
interface Props {
  hoverable?: boolean
  id?: string
}

withDefaults(defineProps<Props>(), {
  hoverable: true,
})
</script>

<template>
  <div
    :id="id"
    class="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[14px] p-5 sm:p-6 transition-all duration-200 ease-in-out shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
    :class="{
      'hover:border-[var(--border-card-hover)] hover:bg-[var(--bg-card-hover)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.15)]': hoverable,
    }"
  >
    <slot />
  </div>
</template>
