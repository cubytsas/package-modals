# Changelog

All notable changes to `@cubyt/modals` are documented here.

## [1.1.0] - 2026-10-01

### Added

- `DrawerModal` and `SheetModal` React layout presets for side panels and bottom sheets.
- Repository structure and component contribution guidance.

### Changed

- Moved the stylesheet under `src/styles/` while preserving the public `@cubyt/modals/modals.css` import.
- Simplified the README to focus on installation and component usage.

## [1.0.1] - 2026-09-28

### Changed

- Publish from GitHub Actions with npm provenance attestations linking the package to its source commit and workflow.

## [1.0.0] - 2026-09-28

Initial public release.

### Added

- Native `<dialog>` modal manager with a modal stack, scroll lock, focus restoration, Escape/backdrop dismissal for the top-most modal and exit animations that respect `prefers-reduced-motion`.
- Framework-agnostic renderer (`openModal`) and promise-based `confirm`, `prompt` and `alert`.
- URL-synced modals (`?modal=name`) built on `@cubyt/navigation`, with Back-button support and deep links.
- `modals.css` shell matching the Cubyt "Dash Modal" design: sizes, tones, center/top/sheet/side placements and automatic bottom sheets on mobile.
- Reserved a consistent responsive content area for every Steps wizard step so media, form, and short confirmation steps do not make the modal jump in size; added direction-aware transitions between steps.
- Refined modal entrance easing and made modal and step transitions honor reduced-motion preferences without forced overrides.
- React bindings: `Modal` compound component, `ModalProvider`/`useModal`, `useModalRoute`, presets (`ConfirmModal`, `DangerModal`, `FormModal`, `PromptModal`, `AlertModal`, `DetailsModal`, `ActionsModal`, `SelectModal`, `CodeModal`, `ListModal`, `ProgressModal`, `ResultModal`) and media modals (`ImageModal`, `GalleryModal`, `LightboxModal`, `VideoModal`, `EmbedModal`, `StepsModal`, `PromoModal`, `CommandModal`).
- Media URL validation: privacy-friendly YouTube/Vimeo embeds, HTTPS allowlists for iframes, and safe image sources.
- TypeScript declarations, explicit package exports and a minimal npm file allowlist.
- MIT license.
