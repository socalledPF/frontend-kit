import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Amusite Frontend Kit',
  description: 'Vue2/Vue3 admin business development accelerator.',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/quick-start' },
      { text: 'RuoYi', link: '/guide/ruoyi' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: '快速开始', link: '/guide/quick-start' },
            { text: 'RuoYi 接入', link: '/guide/ruoyi' }
          ]
        },
        {
          text: 'Packages',
          items: [
            { text: 'Request', link: '/guide/request' },
            { text: 'Utils', link: '/guide/utils' },
            { text: 'Vue Core', link: '/guide/vue-core' },
            { text: 'Vue2 Element Business', link: '/guide/vue2-element-business' }
          ]
        }
      ]
    },
    socialLinks: []
  }
})
