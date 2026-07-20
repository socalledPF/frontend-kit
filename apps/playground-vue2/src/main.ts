import Vue from 'vue'
import VueCompositionApi from '@vue/composition-api'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import '@amusite/styles/style.css'
import Vue2ElementBusiness from '@amusite/vue2-element-business'
import '@amusite/vue2-element-business/style.css'
import App from './App'

Vue.use(VueCompositionApi)
Vue.use(ElementUI)
Vue.use(Vue2ElementBusiness)

new Vue({
  render: (h) => h(App)
}).$mount('#app')
