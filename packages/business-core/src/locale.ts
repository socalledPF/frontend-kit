export type BusinessLocale = 'zh-CN' | 'en-US' | (string & {})

export type BusinessMessageKey =
  | 'common.confirmTitle'
  | 'common.confirmAction'
  | 'common.submit'
  | 'common.save'
  | 'common.cancel'
  | 'common.close'
  | 'common.retry'
  | 'common.remove'
  | 'common.preview'
  | 'common.operationFailed'
  | 'query.search'
  | 'query.reset'
  | 'query.expand'
  | 'query.collapse'
  | 'dict.placeholder'
  | 'loading.text'
  | 'table.density'
  | 'table.densityMedium'
  | 'table.densitySmall'
  | 'table.densityMini'
  | 'table.columnSettings'
  | 'table.columnDisplay'
  | 'table.refresh'
  | 'table.fullscreen'
  | 'table.exitFullscreen'
  | 'table.fullscreenUnsupported'
  | 'table.previousPage'
  | 'table.nextPage'
  | 'table.pageSize'
  | 'table.jumpToPage'
  | 'upload.selectFile'
  | 'upload.selectImage'
  | 'upload.dropText'
  | 'upload.clickText'
  | 'upload.ready'
  | 'upload.queued'
  | 'upload.uploading'
  | 'upload.success'
  | 'upload.failed'
  | 'upload.cancelUpload'
  | 'upload.limit'
  | 'upload.type'
  | 'upload.size'
  | 'upload.duplicate'
  | 'upload.beforeRejected'
  | 'upload.missingRequest'
  | 'upload.invalidResponse'
  | 'form.unsavedConfirm'
  | 'import.title'
  | 'import.updateExisting'
  | 'import.start'
  | 'import.selectFirst'
  | 'import.templateHint'
  | 'import.downloadTemplate'
  | 'import.supportTip'
  | 'import.type'
  | 'import.size'
  | 'import.beforeRejected'
  | 'import.failed'
  | 'import.completed'
  | 'import.successCount'
  | 'import.failureCount'
  | 'import.rowError'
  | 'export.action'
  | 'editable.addRow'
  | 'status.confirmChange'
  | 'preview.title'
  | 'preview.download'
  | 'preview.unsupported'

export type BusinessMessages = Record<BusinessMessageKey, string>
export type BusinessMessagesPatch = Partial<BusinessMessages>

export interface BusinessLocaleConfig {
  locale?: BusinessLocale
  fallbackLocale?: BusinessLocale
  messages?: Partial<Record<BusinessLocale, BusinessMessagesPatch>> | BusinessMessagesPatch
}

export const zhCN: BusinessMessages = {
  'common.confirmTitle': '提示',
  'common.confirmAction': '确认执行此操作吗？',
  'common.submit': '提交',
  'common.save': '保存',
  'common.cancel': '取消',
  'common.close': '关闭',
  'common.retry': '重试',
  'common.remove': '删除',
  'common.preview': '预览',
  'common.operationFailed': '操作失败，请重试',
  'query.search': '查询',
  'query.reset': '重置',
  'query.expand': '展开',
  'query.collapse': '收起',
  'dict.placeholder': '请选择',
  'loading.text': '加载中...',
  'table.density': '表格密度',
  'table.densityMedium': '宽松',
  'table.densitySmall': '默认',
  'table.densityMini': '紧凑',
  'table.columnSettings': '列设置',
  'table.columnDisplay': '列显示',
  'table.refresh': '刷新',
  'table.fullscreen': '全屏',
  'table.exitFullscreen': '退出全屏',
  'table.fullscreenUnsupported': '当前浏览器或目标容器不支持全屏',
  'table.previousPage': '上一页',
  'table.nextPage': '下一页',
  'table.pageSize': '每页条数',
  'table.jumpToPage': '跳转页码',
  'upload.selectFile': '选择文件',
  'upload.selectImage': '选择图片',
  'upload.dropText': '将文件拖到此处，或',
  'upload.clickText': '点击选择',
  'upload.ready': '等待上传',
  'upload.queued': '排队中',
  'upload.uploading': '上传中 {percent}%',
  'upload.success': '已上传',
  'upload.failed': '上传失败',
  'upload.cancelUpload': '取消上传',
  'upload.limit': '最多只能上传 {limit} 个文件',
  'upload.type': '文件 {name} 的类型不符合要求',
  'upload.size': '文件 {name} 不能超过 {size} MB',
  'upload.duplicate': '文件 {name} 已存在',
  'upload.beforeRejected': '文件 {name} 未通过上传校验',
  'upload.missingRequest': 'Upload 组件缺少 request 回调',
  'upload.invalidResponse': '上传请求必须返回 UploadItem 对象',
  'form.unsavedConfirm': '内容尚未保存，确认关闭吗？',
  'import.title': '导入数据',
  'import.updateExisting': '更新已存在的数据',
  'import.start': '开始导入',
  'import.selectFirst': '请先选择导入文件',
  'import.templateHint': '请使用标准导入模板',
  'import.downloadTemplate': '下载模板',
  'import.supportTip': '支持 {accept}，文件不超过 {size} MB',
  'import.type': '请选择 {accept} 格式的文件',
  'import.size': '文件大小不能超过 {size} MB',
  'import.beforeRejected': '文件未通过导入前校验',
  'import.failed': '导入失败，请重试',
  'import.completed': '导入完成',
  'import.successCount': '成功 {count} 条',
  'import.failureCount': '失败 {count} 条',
  'import.rowError': '第 {row} 行：',
  'export.action': '导出',
  'editable.addRow': '新增一行',
  'status.confirmChange': '确认切换当前状态吗？',
  'preview.title': '文件预览',
  'preview.download': '下载文件',
  'preview.unsupported': '暂不支持此文件类型的在线预览'
}

export const enUS: BusinessMessages = {
  'common.confirmTitle': 'Confirm',
  'common.confirmAction': 'Continue with this action?',
  'common.submit': 'Submit',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.retry': 'Retry',
  'common.remove': 'Remove',
  'common.preview': 'Preview',
  'common.operationFailed': 'Operation failed. Please try again.',
  'query.search': 'Search',
  'query.reset': 'Reset',
  'query.expand': 'Expand',
  'query.collapse': 'Collapse',
  'dict.placeholder': 'Select',
  'loading.text': 'Loading...',
  'table.density': 'Table density',
  'table.densityMedium': 'Comfortable',
  'table.densitySmall': 'Default',
  'table.densityMini': 'Compact',
  'table.columnSettings': 'Column settings',
  'table.columnDisplay': 'Visible columns',
  'table.refresh': 'Refresh',
  'table.fullscreen': 'Fullscreen',
  'table.exitFullscreen': 'Exit fullscreen',
  'table.fullscreenUnsupported': 'Fullscreen is not supported for this target.',
  'table.previousPage': 'Previous page',
  'table.nextPage': 'Next page',
  'table.pageSize': 'Rows per page',
  'table.jumpToPage': 'Jump to page',
  'upload.selectFile': 'Select file',
  'upload.selectImage': 'Select image',
  'upload.dropText': 'Drop files here, or',
  'upload.clickText': 'click to select',
  'upload.ready': 'Ready',
  'upload.queued': 'Queued',
  'upload.uploading': 'Uploading {percent}%',
  'upload.success': 'Uploaded',
  'upload.failed': 'Upload failed',
  'upload.cancelUpload': 'Cancel upload',
  'upload.limit': 'Up to {limit} files are allowed',
  'upload.type': '{name} is not an accepted file type',
  'upload.size': '{name} must not exceed {size} MB',
  'upload.duplicate': '{name} already exists',
  'upload.beforeRejected': '{name} did not pass validation',
  'upload.missingRequest': 'Upload requires a request callback',
  'upload.invalidResponse': 'The upload request must return an UploadItem object',
  'form.unsavedConfirm': 'You have unsaved changes. Close anyway?',
  'import.title': 'Import data',
  'import.updateExisting': 'Update existing records',
  'import.start': 'Start import',
  'import.selectFirst': 'Select an import file first',
  'import.templateHint': 'Use the standard import template',
  'import.downloadTemplate': 'Download template',
  'import.supportTip': 'Accepts {accept}, up to {size} MB',
  'import.type': 'Select a {accept} file',
  'import.size': 'The file must not exceed {size} MB',
  'import.beforeRejected': 'The file did not pass import validation',
  'import.failed': 'Import failed. Please try again.',
  'import.completed': 'Import completed',
  'import.successCount': '{count} succeeded',
  'import.failureCount': '{count} failed',
  'import.rowError': 'Row {row}: ',
  'export.action': 'Export',
  'editable.addRow': 'Add row',
  'status.confirmChange': 'Change the current status?',
  'preview.title': 'File preview',
  'preview.download': 'Download file',
  'preview.unsupported': 'Online preview is not available for this file type'
}

export function interpolateMessage(message: string, params: Record<string, unknown> = {}): string {
  return message.replace(/\{([^}]+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`))
}

export function resolveMessages(config: BusinessLocaleConfig = {}): BusinessMessages {
  const locale = config.locale ?? 'zh-CN'
  const fallbackLocale = config.fallbackLocale ?? 'zh-CN'
  const builtIn: Partial<Record<BusinessLocale, BusinessMessages>> = {
    'zh-CN': zhCN,
    'en-US': enUS
  }
  const fallback = builtIn[locale] ?? builtIn[fallbackLocale] ?? zhCN
  const configured = config.messages
  const localeMap =
    configured &&
    Object.values(configured).some((value) => value != null && typeof value === 'object')
  const patch = localeMap
    ? ((configured as Partial<Record<BusinessLocale, BusinessMessagesPatch>>)[locale] ??
      (configured as Partial<Record<BusinessLocale, BusinessMessagesPatch>>)[fallbackLocale])
    : (configured as BusinessMessagesPatch | undefined)
  return { ...fallback, ...patch }
}
