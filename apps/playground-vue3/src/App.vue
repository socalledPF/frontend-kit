<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  EditableTableColumn,
  FilePreviewItem,
  ProTableColumn,
  TableDensity,
  UploadItem,
  UploadRequestContext
} from '@amusite/vue3-element-plus-business'

interface UserRow {
  id: number
  userName: string
  nickName: string
  status: string
  department: string
  createdAt: string
}
const allUsers = ref<UserRow[]>([
  {
    id: 1,
    userName: 'admin',
    nickName: '系统管理员',
    status: '0',
    department: '平台研发部',
    createdAt: '2026-08-01 09:20'
  },
  {
    id: 2,
    userName: 'li.ming',
    nickName: '李明',
    status: '0',
    department: '运营中心',
    createdAt: '2026-08-03 14:35'
  },
  {
    id: 3,
    userName: 'zhou.yu',
    nickName: '周宇',
    status: '1',
    department: '客户成功部',
    createdAt: '2026-08-05 11:08'
  },
  {
    id: 4,
    userName: 'chen.xi',
    nickName: '陈曦',
    status: '0',
    department: '财务部',
    createdAt: '2026-08-07 16:42'
  }
])
const query = ref<Record<string, unknown>>({ userName: '', status: '' })
const appliedQuery = ref({ userName: '', status: '' })
const showSearch = ref(true)
const loading = ref(false)
const page = ref(1)
const limit = ref(10)
const density = ref<TableDensity>('medium')
const selected = ref<UserRow[]>([])
const formVisible = ref(false)
const importVisible = ref(false)
const mode = ref<'create' | 'edit'>('create')
const form = ref<Record<string, unknown>>({
  id: undefined,
  userName: '',
  nickName: '',
  status: '0',
  department: ''
})
const attachments = ref<UploadItem[]>([])
const avatars = ref<UploadItem[]>([])
const departmentId = ref<string | number>('')
const accountEnabled = ref(true)
const drawerVisible = ref(false)
const drawerModel = ref<Record<string, unknown>>({ name: '', owner: '' })
const previewVisible = ref(false)
const previewFile: FilePreviewItem = {
  name: '发布说明.txt',
  type: 'text/plain',
  data: new Blob(['Amusite Frontend Kit\nVue3 enterprise baseline ready.'], { type: 'text/plain' })
}
const editableRows = ref<Record<string, unknown>[]>([
  { id: 1, role: '系统管理员', quota: 20 },
  { id: 2, role: '业务运营', quota: 8 }
])
const editableColumns: EditableTableColumn[] = [
  { prop: 'role', label: '角色名称', editable: true, minWidth: 160 },
  {
    prop: 'quota',
    label: '账号配额',
    editable: true,
    width: 140,
    editorProps: { type: 'number', min: 1 }
  }
]
const statuses = [
  { label: '正常', value: '0', type: 'success' },
  { label: '停用', value: '1', type: 'danger' }
]
const fields = [
  {
    prop: 'userName',
    label: '用户名称',
    component: 'el-input',
    componentProps: { placeholder: '输入用户名' }
  },
  { prop: 'status', label: '状态', slotName: 'status' }
]
const columns = ref<ProTableColumn[]>([
  { type: 'selection', width: 46, columnSetting: false },
  { prop: 'id', label: '编号', width: 76 },
  { prop: 'userName', label: '用户名称', minWidth: 130 },
  { prop: 'nickName', label: '昵称', minWidth: 130 },
  { prop: 'department', label: '部门', minWidth: 150 },
  { prop: 'status', label: '状态', width: 90, slotName: 'status' },
  { prop: 'createdAt', label: '创建时间', width: 170 },
  {
    label: '操作',
    width: 130,
    fixed: 'right',
    slotName: 'actions',
    showOverflowTooltip: false,
    columnSetting: false
  }
])
const rows = computed(() =>
  allUsers.value.filter((item) => {
    const name = String(appliedQuery.value.userName || '')
    const status = String(appliedQuery.value.status || '')
    return (
      (!name || item.userName.includes(name) || item.nickName.includes(name)) &&
      (!status || item.status === status)
    )
  })
)
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
async function refresh() {
  loading.value = true
  await wait(520)
  loading.value = false
}
function applyQuery(model: Record<string, unknown>) {
  Object.assign(appliedQuery.value, model)
  page.value = 1
  void refresh()
}
function resetQuery(model: Record<string, unknown>) {
  Object.assign(appliedQuery.value, model)
  page.value = 1
}
function openCreate() {
  mode.value = 'create'
  Object.assign(form.value, {
    id: undefined,
    userName: '',
    nickName: '',
    status: '0',
    department: ''
  })
  attachments.value = []
  avatars.value = []
  formVisible.value = true
}
function openEdit(row: UserRow) {
  mode.value = 'edit'
  Object.assign(form.value, row)
  attachments.value = []
  avatars.value = []
  formVisible.value = true
}
async function saveUser(model: Record<string, unknown>) {
  await wait(650)
  if (mode.value === 'create')
    allUsers.value.unshift({
      ...(model as unknown as UserRow),
      id: Date.now(),
      createdAt: '2026-08-10 16:30'
    })
  else {
    const index = allUsers.value.findIndex((item) => item.id === model.id)
    if (index >= 0)
      allUsers.value[index] = { ...allUsers.value[index], ...(model as Partial<UserRow>) }
  }
  return { id: model.id || allUsers.value[0].id }
}
async function uploadFile({ file, onProgress, signal }: UploadRequestContext) {
  for (const value of [18, 46, 72, 100]) {
    await wait(130)
    if (signal?.aborted) throw new Error('上传已取消')
    onProgress(value)
  }
  return {
    id: `${Date.now()}-${file.name}`,
    name: file.name,
    url: URL.createObjectURL(file),
    size: file.size,
    type: file.type
  }
}
async function importUsers(context: {
  file: File
  onProgress: (value: number) => void
  signal?: AbortSignal
}) {
  for (const value of [22, 58, 100]) {
    await wait(180)
    if (context.signal?.aborted) throw new Error('导入已取消')
    context.onProgress(value)
  }
  return { successCount: 12, failureCount: 1, errors: [{ row: 8, message: '手机号格式不正确' }] }
}
async function exportUsers() {
  await wait(600)
  return {
    data: new Blob(['userName,nickName\nadmin,系统管理员'], { type: 'text/csv' }),
    fileName: 'users.csv'
  }
}
async function loadDepartments(keyword: string) {
  await wait(240)
  return ['平台研发部', '运营中心', '客户成功部', '财务部']
    .filter((label) => !keyword || label.includes(keyword))
    .map((label, index) => ({ label, value: `${index + 1}` }))
}
async function updateAccountStatus() {
  await wait(360)
}
async function saveRoleGroup() {
  await wait(520)
}
</script>

<template>
  <div class="admin-shell">
    <header class="topbar">
      <div><strong>AMUSITE</strong><span>业务组件工作台</span></div>
      <div class="topbar__meta"><span class="status-dot" />Vue 3 + Element Plus</div>
    </header>
    <div class="workspace">
      <aside class="sidebar">
        <div class="sidebar__section">系统管理</div>
        <button class="sidebar__item is-active">用户管理</button
        ><button class="sidebar__item">角色管理</button
        ><button class="sidebar__item">部门管理</button>
        <div class="sidebar__section">系统工具</div>
        <button class="sidebar__item">数据导入</button>
      </aside>
      <main class="content">
        <div class="page-heading">
          <div>
            <h1>用户管理</h1>
            <p>维护账号、部门与系统访问状态</p>
          </div>
          <div class="page-heading__summary">{{ rows.length }} 个账号</div>
        </div>
        <section v-show="showSearch" class="search-band">
          <XSearchForm
            v-model:model="query"
            :fields="fields"
            :max-rows="2"
            @query="applyQuery"
            @reset="resetQuery"
            ><template #status="{ value, update }"
              ><XDictSelect
                :model-value="value as any"
                :options="statuses"
                placeholder="全部状态"
                aria-label="状态"
                @update:model-value="update" /></template
          ></XSearchForm>
        </section>
        <section class="table-band">
          <XTableToolbar
            v-model:show-search="showSearch"
            v-model:density="density"
            v-model:columns="columns"
            storage-key="vue3-users"
            :refreshing="loading"
            @refresh="refresh"
          >
            <template #left
              ><XPermission permission="system:user:add"
                ><el-button type="primary" @click="openCreate">新增用户</el-button></XPermission
              ><el-button :disabled="selected.length === 0">批量停用</el-button
              ><el-button @click="importVisible = true">导入</el-button
              ><XExportButton :request="exportUsers" confirm="确认导出当前查询结果吗？"
                >导出</XExportButton
              ></template
            >
            <template #right
              ><span v-if="selected.length" class="selection-count"
                >已选 {{ selected.length }} 项</span
              ></template
            >
          </XTableToolbar>
          <XDataTable
            v-model:page="page"
            v-model:limit="limit"
            :data="rows"
            :columns="columns"
            :total="rows.length"
            :loading="loading"
            :loading-props="{ text: '正在刷新用户数据', delay: 120, minDuration: 260 }"
            :size="density"
            @selection-change="selected = $event"
          >
            <template #status="{ row }"
              ><XDictTag :value="row.status" :options="statuses"
            /></template>
            <template #actions="{ row }"
              ><XPermission permission="system:user:edit"
                ><el-button link type="primary" @click="openEdit(row)">编辑</el-button></XPermission
              ><el-button link type="danger">停用</el-button></template
            >
          </XDataTable>
        </section>
        <section class="feature-band">
          <div class="feature-band__header">
            <div>
              <h2>常用业务操作</h2>
              <span>Vue 3 主线组件</span>
            </div>
            <el-button @click="drawerVisible = true">新建角色组</el-button>
          </div>
          <div class="feature-controls">
            <label
              ><span>归属部门</span
              ><XRemoteSelect
                v-model="departmentId"
                :request="loadDepartments"
                placeholder="搜索部门"
                aria-label="归属部门"
            /></label>
            <label
              ><span>账号开关</span
              ><XStatusSwitch
                v-model="accountEnabled"
                :request="updateAccountStatus"
                confirm="确认变更账号策略吗？"
            /></label>
            <el-button @click="previewVisible = true">预览发布说明</el-button>
          </div>
          <XEditableTable
            v-model="editableRows"
            :columns="editableColumns"
            :create-row="() => ({ id: Date.now(), role: '', quota: 1 })"
            :max-rows="5"
          />
        </section>
      </main>
    </div>
    <XFormDialog
      v-model="formVisible"
      v-model:model="form"
      :mode="mode"
      :title="mode === 'create' ? '新增用户' : '编辑用户'"
      :submit="saveUser"
      confirm-close
    >
      <template #default="{ model }"
        ><el-form-item label="用户名称" prop="userName" required
          ><el-input v-model="model.userName" /></el-form-item
        ><el-form-item label="昵称"><el-input v-model="model.nickName" /></el-form-item
        ><el-form-item label="部门"><el-input v-model="model.department" /></el-form-item
        ><el-form-item label="状态"
          ><XDictSelect v-model="model.status" :options="statuses" /></el-form-item
        ><el-form-item label="附件"
          ><XUpload v-model="attachments" multiple :request="uploadFile"
            ><template #tip>支持常用文档格式，可取消或重试</template></XUpload
          ></el-form-item
        ><el-form-item label="头像"
          ><XUpload v-model="avatars" mode="image" :request="uploadFile" /></el-form-item
      ></template>
    </XFormDialog>
    <XImportDialog v-model="importVisible" :request="importUsers" show-update-existing />
    <XDrawerForm
      v-model="drawerVisible"
      v-model:model="drawerModel"
      title="新建角色组"
      :submit="saveRoleGroup"
      confirm-close
    >
      <template #default="{ model }"
        ><el-form-item label="角色组名称"><el-input v-model="model.name" /></el-form-item
        ><el-form-item label="负责人"><el-input v-model="model.owner" /></el-form-item
      ></template>
    </XDrawerForm>
    <XFilePreview
      v-model="previewVisible"
      :file="previewFile"
      text="Amusite Frontend Kit\nVue3 enterprise baseline ready."
    />
  </div>
</template>
