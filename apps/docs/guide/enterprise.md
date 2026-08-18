# 企业治理

## 支持策略

| 范围                        | 支持状态                |
| --------------------------- | ----------------------- |
| Node 22.12 / 24             | CI 必测                 |
| Vue 3.3+ / Element Plus 2.x | 主线开发                |
| Vue 2.6+ / Element-UI 2.15  | 兼容与缺陷修复          |
| pnpm 11.18                  | 仓库锁定                |
| Vite 8.1.x                  | playground 与 Vue3 构建 |

Vue2 已结束上游维护，新项目默认使用 Vue3。Vue2 公共 API 保持兼容，但不再同步新增业务组件。

## PR 门禁

分支保护应要求 `quality`、`node-compatibility` 和 `browser` 三个检查通过，并至少获得 CODEOWNERS 审查。门禁包含 lint、类型、覆盖率、构建、文档、API 快照、发布包结构和体积预算。

公共 API 变化必须提交 Changeset 和更新后的 `etc/*.api.md`。废弃 API 至少保留一个 minor 版本，并在文档中给出替代方案。

## 发布流程

1. Changesets 在 `main` 自动维护 Release PR 和 changelog。
2. Release PR 合并后先手动发布 `next` 标签。
3. playground 与真实业务项目安装 `next` 完成构建、升级和回归。
4. 通过审批后将同一版本提升为 `latest`，并推送生成的 Git tag。

首个稳定版本必须在两个真实业务项目完成安装与升级验证，不允许源码路径依赖或宿主补丁。私有 registry 仅通过 `NPM_REGISTRY_URL` 和 `NPM_TOKEN` 注入。

## 安全边界

`XPermission` 与 `v-permission` 只控制前端展示，服务端必须对每个受保护接口执行真实鉴权。上传组件的类型和大小校验也只是交互保护，服务端仍需验证文件内容、权限、大小和安全策略。

每周任务执行依赖审计和 Chromium、Firefox、WebKit 浏览器矩阵。漏洞请按仓库 `SECURITY.md` 私下报告。
