# Contributing

## Workflow

1. Create a focused branch from `main`.
2. Add or update tests for every behavior change.
3. Add a Changeset for every publishable package change.
4. Run `pnpm ci` before requesting review.
5. Keep public API changes backward compatible. A deprecated API remains available
   for at least one minor release and must include a documented replacement.

## Support Policy

- Vue 3 and Element Plus receive active features and fixes.
- Vue 2 and Element-UI receive compatibility and security fixes only.
- Frontend permission controls are presentational. Backend authorization remains
  mandatory for every protected operation.

Pull requests that alter a public type or export must update the API report with
`pnpm api:report` and explain the compatibility impact in the Changeset.
