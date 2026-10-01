# Contributing

## Repository layout

- `src/` contains the framework-independent modal manager and React components.
- `src/react/` contains the React provider, base modal, presets, and media components.
- `src/styles/` contains the published component stylesheet.
- `types/` contains the public TypeScript declarations.
- `tests/` contains the package's Node test suite.
- `README.md` documents consumer APIs; `CHANGELOG.md` records package changes.

## Component conventions

- Prefer composing the shared `Modal` and existing presets over duplicating dialog behavior.
- Keep public React exports, TypeScript declarations, package exports, and usage docs in sync.
- Preserve accessible names, keyboard focus behavior, dismissal semantics, and reduced-motion support.
- Keep shared visuals in `src/styles/modals.css` and use the Cubyt style and UI tokens.
- Avoid changing the framework-independent API when adding React-only conveniences.
