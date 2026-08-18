import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Amusite Frontend Kit',
  description: 'Vue2/Vue3 admin business development accelerator.',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/quick-start' },
      { text: 'Components', link: '/guide/component-api' },
      { text: 'Governance', link: '/guide/enterprise' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: '快速开始', link: '/guide/quick-start' },
            { text: 'RuoYi 接入', link: '/guide/ruoyi' },
            { text: '企业治理', link: '/guide/enterprise' }
          ]
        },
        {
          text: 'Packages',
          items: [
            { text: 'Request', link: '/guide/request' },
            { text: 'RuoYi Adapter', link: '/guide/ruoyi-adapter' },
            { text: 'Utils', link: '/guide/utils' },
            { text: 'Vue Core', link: '/guide/vue-core' },
            { text: '宿主适配与主题', link: '/guide/host-adapters' },
            { text: 'Schema 与 useCrudPage', link: '/guide/schema-crud' },
            { text: '组件 API', link: '/guide/component-api' },
            { text: 'Vue2 Element Business', link: '/guide/vue2-element-business' },
            { text: 'Vue3 Element Plus Business', link: '/guide/vue3-element-plus-business' },
            { text: 'Vue2 迁移 Vue3', link: '/guide/vue2-to-vue3' }
          ]
        }
      ]
    },
    socialLinks: []
  }
})
