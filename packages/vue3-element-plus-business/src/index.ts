import type { App } from 'vue'
import './style.css'
import type { PermissionProvider } from '@amusite/business-core'
import QueryForm from './components/QueryForm.vue'
import ProTable from './components/ProTable.vue'
import Pagination from './components/Pagination.vue'
import Loading from './components/Loading.vue'
import Upload from './components/Upload.vue'
import AsyncButton from './components/AsyncButton.vue'
import DictTag from './components/DictTag.vue'
import DictSelect from './components/DictSelect.vue'
import TableToolbar from './components/TableToolbar.vue'
import FormDialog from './components/FormDialog.vue'
import Permission from './components/Permission.vue'
import Descriptions from './components/Descriptions.vue'
import ImportDialog from './components/ImportDialog.vue'
import ExportButton from './components/ExportButton.vue'
import { createPermissionDirective, providePermission } from './permission'

export * from '@amusite/business-core'
export * from './permission'
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
export const XUpload = Upload
export const XAsyncButton = AsyncButton
export const XDictTag = DictTag
export const XDictSelect = DictSelect
export const XTableToolbar = TableToolbar
export const XFormDialog = FormDialog
export const XPermission = Permission
export const XDescriptions = Descriptions
export const XImportDialog = ImportDialog
export const XExportButton = ExportButton

export interface Vue3ElementPlusBusinessPluginOptions {
  prefix?: string
  registerCompatibleNames?: boolean
  permission?: PermissionProvider
  registerPermissionDirective?: boolean
}

const components = {
  SearchForm: QueryForm,
  DataTable: ProTable,
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

const compatibleNames = {
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

export const Vue3ElementPlusBusiness = {
  install(app: App, options: Vue3ElementPlusBusinessPluginOptions = {}) {
    const prefix = options.prefix ?? 'X'
    const provider = options.permission ?? {}
    Object.entries(components).forEach(([name, component]) => app.component(`${prefix}${name}`, component))
    if (options.registerCompatibleNames ?? true) {
      Object.entries(compatibleNames).forEach(([name, component]) => app.component(name, component))
    }
    providePermission(app, provider)
    if (options.registerPermissionDirective ?? true) {
      app.directive('permission', createPermissionDirective(provider))
    }
  }
}

export default Vue3ElementPlusBusiness
