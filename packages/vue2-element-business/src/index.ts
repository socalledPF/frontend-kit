import type { PluginObject, VueConstructor } from 'vue'
import QueryForm from './components/QueryForm'
import ProTable from './components/ProTable'
import Pagination from './components/Pagination'
import Loading from './components/Loading'
import Upload from './components/Upload'

export * from './types'
export { QueryForm, ProTable, Pagination, Loading, Upload }
export const XSearchForm = QueryForm
export const XDataTable = ProTable
export const XPagination = Pagination
export const XLoading = Loading
export const XUpload: typeof Upload = Upload

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
    Vue.component(`${prefix}Loading`, Loading)
    Vue.component(`${prefix}Upload`, Upload)

    if (registerCompatibleNames) {
      Vue.component('QueryForm', QueryForm)
      Vue.component('ProTable', ProTable)
      Vue.component('Pagination', Pagination)
      Vue.component('Loading', Loading)
      Vue.component('Upload', Upload)
    }
  }
}

export default Vue2ElementBusiness
