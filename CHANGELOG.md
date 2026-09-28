# Changelog

All notable changes to `@cubyt/modals` are documented here.

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
