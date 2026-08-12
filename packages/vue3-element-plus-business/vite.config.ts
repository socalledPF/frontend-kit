import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.json',
      entryRoot: 'src',
      outDir: 'dist',
      include: ['src'],
      exclude: ['src/__tests__/**', 'src/**/*.test.ts'],
      pathsToAliases: false,
      insertTypesEntry: true
    })
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'AmusiteVue3ElementPlusBusiness',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.cjs')
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        'vue',
        'element-plus',
        '@element-plus/icons-vue',
        '@amusite/business-core',
        '@amusite/utils'
      ],
      output: {
        exports: 'named',
        assetFileNames: (asset) => (asset.name?.endsWith('.css') ? 'style.css' : 'assets/[name][extname]')
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
    alias: {
      vue: fileURLToPath(new URL('./node_modules/vue/dist/vue.esm-bundler.js', import.meta.url))
    }
  }
})
