<script setup lang="ts">
interface Props {
  class?: string
}

defineProps<Props>()
</script>

<template>
  <div
    class="animate-pulse bg-[#2E2E2E]/60 rounded-md"
    :class="$props.class"
  />
</template>
