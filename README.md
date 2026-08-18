# Amusite Frontend Kit

Private enterprise frontend foundations for Vue 3, maintained Vue 2 applications,
and RuoYi-style admin systems.

## Packages

- `@amusite/shared`: transport and pagination contracts.
- `@amusite/utils`: framework-neutral utilities.
- `@amusite/request`: adapter-driven Axios client.
- `@amusite/vue-core`: Vue 2/3 composables through `vue-demi`.
- `@amusite/business-core`: shared business types and policies.
- `@amusite/vue3-element-plus-business`: active Vue 3 component suite.
- `@amusite/vue2-element-business`: compatibility-maintenance Vue 2 suite.
- `@amusite/styles`: shared tokens and admin layout styles.
- `@amusite/ruoyi-adapter`: response, pagination, dictionary and file adapters.
- `create-amusite-admin`: Vue 3 + Element Plus + RuoYi preset scaffolder.

## Support Matrix

| Runtime                     | Policy                    |
| --------------------------- | ------------------------- |
| Node 22.12 / 24             | CI supported              |
| Vue 3.3+ / Element Plus 2.x | Active development        |
| Vue 2.6+ / Element-UI 2.15  | Compatibility maintenance |
| pnpm 11.18 / Vite 8.1.x     | Locked toolchain          |

## Development

Use Node 22.12 or Node 24 and the pnpm version declared in `packageManager`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm ci
```

Vue 3 is the default for new applications. Vue 2 is end-of-life upstream and this
repository only provides compatibility fixes for existing Vue 2 consumers.

See `apps/docs` for package guides, component APIs, release governance and migration notes.
