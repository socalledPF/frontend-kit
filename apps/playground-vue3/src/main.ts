import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@amusite/vue3-element-plus-business/style.css'
import '@amusite/vue3-echarts-business/style.css'
import { Vue3ElementPlusBusiness } from '@amusite/vue3-element-plus-business'
import { Vue3EChartsBusiness } from '@amusite/vue3-echarts-business'
import App from './App.vue'
import './app.css'

createApp(App)
  .use(ElementPlus)
  .use(Vue3ElementPlusBusiness, {
    permission: {
      getPermissions: () => ['system:user:list', 'system:user:add', 'system:user:edit'],
      getRoles: () => ['operator']
    }
  })
  .use(Vue3EChartsBusiness)
  .mount('#app')
