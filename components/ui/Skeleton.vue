<script setup lang="ts">
interface Props {
  class?: string
}

defineProps<Props>()
</script>

<template>
  <div
    class="animate-pulse bg-[#27272A]/60 rounded-md"
    :class="class"
  />
</template>
