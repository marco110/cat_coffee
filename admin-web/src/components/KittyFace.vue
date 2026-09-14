<template>
  <svg class="kitty-face" :width="size" :height="size" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- 耳朵 -->
    <path d="M13 26 Q10 8 17 9 Q25 13 29 19 Z" :fill="color" />
    <path d="M51 26 Q54 8 47 9 Q39 13 35 19 Z" :fill="color" />
    <!-- 头部 -->
    <ellipse cx="32" cy="36" rx="22.5" ry="18.5" fill="#fff" :stroke="color" stroke-width="2.4" />
    <!-- 蝴蝶结（右耳） -->
    <g :fill="bow">
      <path d="M45.5 20 C41 13.5 34.5 13 34.5 17.5 C34.5 22 41 24 45.5 21.5 Z" />
      <path d="M48 20 C52.5 13.5 59 13 59 17.5 C59 22 52.5 24 48 21.5 Z" />
      <circle cx="46.8" cy="20" r="3" />
    </g>
    <!-- 眼睛 -->
    <ellipse cx="23.5" cy="35" rx="2.6" ry="3.4" fill="#4a3340" />
    <ellipse cx="40.5" cy="35" rx="2.6" ry="3.4" fill="#4a3340" />
    <!-- 鼻子 -->
    <ellipse cx="32" cy="41.5" rx="2.1" ry="1.5" :fill="nose" />
    <!-- 胡须 -->
    <g stroke="#4a3340" stroke-width="1.5" stroke-linecap="round">
      <path d="M6 31.5 L16.5 34" />
      <path d="M5 38 L16.5 38" />
      <path d="M6.5 44 L17 41.5" />
      <path d="M58 31.5 L47.5 34" />
      <path d="M59 38 L47.5 38" />
      <path d="M57.5 44 L47 41.5" />
    </g>
  </svg>
</template>

<script setup>
defineProps({
  size: { type: [Number, String], default: 40 },
  color: { type: String, default: '#ff6fa5' },
  bow: { type: String, default: '#ef3d6b' },
  nose: { type: String, default: '#ffc53d' },
});
</script>

<style scoped>
.kitty-face {
  display: block;
  flex: none;
}
</style>
