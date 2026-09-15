import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig({
  plugins: [uni()],
  css: {
    preprocessorOptions: {
      scss: {
        // 当前 Vite 5.2 仍通过 sass 的 legacy JS API（sass.render）编译，
        // Dart Sass 1.80+ 会打印 legacy-js-api 弃用警告，这里显式静默。
        // 升级到 Vite >= 5.4 后，可改为 api: 'modern-compiler' + sass-embedded。
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
});
