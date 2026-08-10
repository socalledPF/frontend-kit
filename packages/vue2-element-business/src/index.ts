import type { PluginObject, VueConstructor } from 'vue'
import QueryForm from './components/QueryForm'
import ProTable from './components/ProTable'
import Pagination from './components/Pagination'
import Loading from './components/Loading'
import Upload from './components/Upload'
import AsyncButton from './components/AsyncButton'
import DictTag from './components/DictTag'
import DictSelect from './components/DictSelect'
import TableToolbar from './components/TableToolbar'

export * from './types'
export {
  QueryForm,
  ProTable,
  Pagination,
  Loading,
  Upload,
  AsyncButton,
  DictTag,
  DictSelect,
  TableToolbar
}
export const XSearchForm = QueryForm
export const XDataTable = ProTable
export const XPagination = Pagination
export const XLoading = Loading
export const XUpload: typeof Upload = Upload
export const XAsyncButton: typeof AsyncButton = AsyncButton
export const XDictTag: typeof DictTag = DictTag
export const XDictSelect: typeof DictSelect = DictSelect
export const XTableToolbar: typeof TableToolbar = TableToolbar

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
    Vue.component(`${prefix}AsyncButton`, AsyncButton)
    Vue.component(`${prefix}DictTag`, DictTag)
    Vue.component(`${prefix}DictSelect`, DictSelect)
    Vue.component(`${prefix}TableToolbar`, TableToolbar)

    if (registerCompatibleNames) {
      Vue.component('QueryForm', QueryForm)
      Vue.component('ProTable', ProTable)
      Vue.component('Pagination', Pagination)
      Vue.component('Loading', Loading)
      Vue.component('Upload', Upload)
      Vue.component('AsyncButton', AsyncButton)
      Vue.component('DictTag', DictTag)
      Vue.component('DictSelect', DictSelect)
      Vue.component('TableToolbar', TableToolbar)
    }
  }
}

export default Vue2ElementBusiness
