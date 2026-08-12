import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@amusite/vue3-element-plus-business/style.css'
import { Vue3ElementPlusBusiness } from '@amusite/vue3-element-plus-business'
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
  .mount('#app')
