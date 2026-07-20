import type { PluginObject, VueConstructor } from 'vue'
import QueryForm from './components/QueryForm'
import ProTable from './components/ProTable'
import Pagination from './components/Pagination'

export * from './types'
export { QueryForm, ProTable, Pagination }
export const XSearchForm = QueryForm
export const XDataTable = ProTable
export const XPagination = Pagination

export interface Vue2ElementBusinessPluginOptions {
  prefix?: string
  registerCompatibleNames?: boolean
}

export const Vue2ElementBusiness: PluginObject<Vue2ElementBusinessPluginOptions> = {
  install(Vue: VueConstructor, options: Vue2ElementBusinessPluginOptions = {}) {
    const prefix = options.prefix ?? 'X'
    const registerCompatibleNames = options.registerCompatibleNames ?? true

    Vue.component(`${prefix}SearchForm`, QueryForm)
    Vue.component(`${prefix}DataTable`, ProTable)
    Vue.component(`${prefix}Pagination`, Pagination)

    if (registerCompatibleNames) {
      Vue.component('QueryForm', QueryForm)
      Vue.component('ProTable', ProTable)
      Vue.component('Pagination', Pagination)
    }
  }
}

export default Vue2ElementBusiness
