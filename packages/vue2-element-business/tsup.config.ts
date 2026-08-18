import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/entries/*.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ['vue', 'element-ui', '@amusite/business-core', '@amusite/utils'],
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs'
    }
  }
})
