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
import FormDialog from './components/FormDialog'
import Permission, { configurePermission, PermissionDirective } from './components/Permission'
import Descriptions from './components/Descriptions'
import ImportDialog from './components/ImportDialog'
import ExportButton from './components/ExportButton'
import type { BusinessHostAdapters } from './types'
import { installBusinessContext } from './context'

export * from './types'
export * from './context'
export { checkPermission, configurePermission, PermissionDirective } from './components/Permission'
export {
  QueryForm,
  ProTable,
  Pagination,
  Loading,
  Upload,
  AsyncButton,
  DictTag,
  DictSelect,
  TableToolbar,
  FormDialog,
  Permission,
  Descriptions,
  ImportDialog,
  ExportButton
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
export const XFormDialog: typeof FormDialog = FormDialog
export const XPermission: typeof Permission = Permission
export const XDescriptions: typeof Descriptions = Descriptions
export const XImportDialog: typeof ImportDialog = ImportDialog
export const XExportButton: typeof ExportButton = ExportButton

export interface Vue2ElementBusinessPluginOptions extends BusinessHostAdapters {
  prefix?: string
  registerCompatibleNames?: boolean
  registerPermissionDirective?: boolean
}

export function createVue2BusinessPlugin(
  defaultOptions: Vue2ElementBusinessPluginOptions = {}
): PluginObject<Vue2ElementBusinessPluginOptions> {
  return {
    install(Vue: VueConstructor, installOptions: Vue2ElementBusinessPluginOptions = {}) {
      const options = {
        ...defaultOptions,
        ...installOptions,
        locale: installOptions.locale ?? defaultOptions.locale
      }
      const prefix = options.prefix ?? 'X'
      const registerCompatibleNames = options.registerCompatibleNames ?? true
      const context = installBusinessContext(Vue, options)
      configurePermission(context.permission)

      Vue.component(`${prefix}SearchForm`, QueryForm)
      Vue.component(`${prefix}DataTable`, ProTable)
      Vue.component(`${prefix}Pagination`, Pagination)
      Vue.component(`${prefix}Loading`, Loading)
      Vue.component(`${prefix}Upload`, Upload)
      Vue.component(`${prefix}AsyncButton`, AsyncButton)
      Vue.component(`${prefix}DictTag`, DictTag)
      Vue.component(`${prefix}DictSelect`, DictSelect)
      Vue.component(`${prefix}TableToolbar`, TableToolbar)
      Vue.component(`${prefix}FormDialog`, FormDialog)
      Vue.component(`${prefix}Permission`, Permission)
      Vue.component(`${prefix}Descriptions`, Descriptions)
      Vue.component(`${prefix}ImportDialog`, ImportDialog)
      Vue.component(`${prefix}ExportButton`, ExportButton)

      if ((options.registerPermissionDirective ?? true) && typeof Vue.directive === 'function') {
        Vue.directive('permission', PermissionDirective)
      }

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
        Vue.component('FormDialog', FormDialog)
        Vue.component('Permission', Permission)
        Vue.component('Descriptions', Descriptions)
        Vue.component('ImportDialog', ImportDialog)
        Vue.component('ExportButton', ExportButton)
      }
    }
  }
}

export const Vue2ElementBusiness = createVue2BusinessPlugin()

export default Vue2ElementBusiness
