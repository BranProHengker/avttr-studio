<script setup lang="ts">
// Catch-all route to trigger standard 404 error page
throw createError({
  statusCode: 404,
  statusMessage: 'Page Not Found',
  fatal: true,
})
</script>

<template>
  <div />
</template>
