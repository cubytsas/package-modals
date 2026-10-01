# @cubyt/modals

Accessible modal system for Cubyt apps. It folds the ~75 "Dash Modal" designs into a small set of presets and adds media modals (image, gallery, lightbox, video, embed, onboarding steps, promo and a command palette).

- Native `<dialog>` + `showModal()`: top layer, focus trap and inert background come from the browser.
- A modal **stack** with scroll lock, focus restoration and Escape/backdrop dismissal for the top-most modal only.
- Styles built on `@cubyt/style` tokens and `@cubyt/ui` primitives (light and dark mode). Modals become bottom sheets on screens under 640px.
- Links in actions go through [`@cubyt/navigation`](https://github.com/cubytsas/package-navigation), so SPA routes stay client-side, other apps get a full-page navigation and unsafe URLs are rejected.
- The core has no framework dependency; React bindings live under `@cubyt/modals/react`.

## Install

```sh
npm install @cubyt/modals @cubyt/ui @cubyt/style
```

For local development in this repository:

```sh
npm install ../branding/packages/ui ../branding/packages/modals
```

```css
@import "@cubyt/style/tokens.css";
@import "@cubyt/ui/ui.css";
@import "@cubyt/modals/modals.css";
```

## React

Wrap the app once, then open modals imperatively or render them declaratively.

```tsx
import {
  ModalProvider,
  useModal,
  VideoModal,
  FormModal,
  DrawerModal,
  SheetModal,
} from "@cubyt/modals/react";

<ModalProvider>
  <App />
</ModalProvider>;

function RemoveAccount({ user }) {
  const modal = useModal();
  return (
    <Button
      variant="danger"
      onClick={async () => {
        const ok = await modal.confirm({
          title: "Remover del workspace",
          lead: `${user.name} perderá el acceso a todas las organizaciones.`,
          warning: "Se revocarán sesiones activas.",
          confirmText: "REMOVER",
          confirmLabel: "Remover cuenta",
          onConfirm: () => api.removeUser(user.id),
        });
        if (ok) toast.success("Cuenta removida");
      }}
    >
      Remover
    </Button>
  );
}

modal.open(VideoModal, { title: "Tour de Cubyt", src: "https://youtu.be/dQw4w9WgXcQ" });
const name = await modal.prompt({ title: "Renombrar organización", label: "Nombre" });
```

`modal.open(Component, props)` works with any component that accepts `open`, `onOpenChange` and `onResolve`, and returns a promise for the value passed to `onResolve` (`undefined` when dismissed). Async `onConfirm`/`onSubmit` handlers show a loading state, block dismissal while pending and display thrown errors inline.

### Declarative and composed

```tsx
const [open, setOpen] = useState(false);
const [drawerOpen, setDrawerOpen] = useState(false);
const [sheetOpen, setSheetOpen] = useState(false);

<FormModal
  open={open}
  onOpenChange={setOpen}
  title="Invitar cuenta"
  lead="Envía un acceso al workspace con el rol que elijas."
  submitLabel="Enviar invitación"
  submitIcon="arrow-right"
  onSubmit={(data) => api.invite(Object.fromEntries(data))}
>
  <Field label="Correo"><Input name="email" type="email" required /></Field>
</FormModal>

<Modal open={open} onOpenChange={setOpen} size="lg" tone="info">
  <Modal.Header title="Verificar DNS" lead="Añade este registro TXT." />
  <Modal.Body>…</Modal.Body>
  <Modal.Footer>…</Modal.Footer>
</Modal>

<DrawerModal open={drawerOpen} onOpenChange={setDrawerOpen} title="Detalles del dominio">
  <p>Contenido lateral para revisar y editar sin perder el contexto de la página.</p>
</DrawerModal>

<SheetModal open={sheetOpen} onOpenChange={setSheetOpen} title="Filtrar resultados">
  <FilterOptions />
</SheetModal>
```

`DrawerModal` defaults to the side placement and `SheetModal` to the bottom-sheet placement. Both accept the regular `Modal` props, including size, tone, close behavior, and compound header/body/footer parts.

Shared props: `size` (`sm` 400, `md` 480, `lg` 640, `xl` 880, `full`), `tone` (`default`, `danger`, `info`, `warning`, `neutral`), `placement` (`center`, `top`, `sheet`, `side`), `dismissible`, `closeOnEscape`, `closeOnBackdrop`, `initialFocus` and `inline` (renders in place, which is useful for docs and previews). Add `data-autofocus` to any element to focus it on open.

### Presets and the designs they replace

| Preset | Replaces (app.pen) |
| --- | --- |
| `ConfirmModal` | Pause domain, Close session, Resend invite, Change to Scale |
| `DangerModal` | Remove account, Delete org/account/data, Revoke API key/secret, Cancel plan |
| `FormModal` / `PromptModal` | Invite, Add domain/webhook/subdomain, Edit name, Change email/slug, Update password, Create org/API key, Generate report |
| `DetailsModal` | Asset/Finding/Category detail, Change plan, Audit event, Activity detail |
| `ActionsModal` | Account/Domain/Org/Request/Report/Webhook/API key actions |
| `SelectModal` | Language, Timezone, Domain pick, Assign org, Category/Activity filter, Trend range, Change role, Appearance |
| `CodeModal` | Backup codes, Secret detail, Verify DNS, API key created |
| `ListModal` | Invoices, Org members, Account orgs |
| `ProgressModal` / `ResultModal` | Export org data, Contract download, Org settings save |
| `AlertModal` | Simple acknowledgements |

### Media modals

| Component | Use |
| --- | --- |
| `ImageModal` | Hero image with copy and CTA (announcements, feature releases). `alt` is required. |
| `GalleryModal` / `LightboxModal` | Carousel with captions, thumbnails, arrow keys, swipe and preloading. The lightbox is full-screen and dark. |
| `VideoModal` | YouTube and Vimeo links become privacy-friendly embeds (`youtube-nocookie.com`, `dnt=1`); `.mp4`/`.webm` files and same-origin URLs use `<video>` with captions. Playback stops on close. |
| `EmbedModal` | Sandboxed iframe restricted to same-origin or HTTPS `allowedHosts` (supports `*.example.com`). |
| `StepsModal` | Onboarding or wizard with progress, back/next, async per-step `validate` and optional media per step. |
| `PromoModal` | Split media + copy with CTA links. With `dismissKey`, "No volver a mostrar" is persisted; gate it with `shouldShowPromo(key)`. |
| `CommandModal` | Command palette with accent-insensitive search, groups, shortcuts and keyboard navigation. Pair it with `useCommandShortcut(() => setOpen(true))` for Cmd/Ctrl+K. |

### URL-synced modals

```tsx
const invite = useModalRoute("invite-account");

<Button onClick={() => invite.openModal()}>Invitar</Button>
<FormModal {...invite.modalProps} title="Invitar cuenta">…</FormModal>
```

Opening pushes `?modal=invite-account` (other query parameters are preserved through `withQuery`), the browser Back button closes the modal, and deep links open it on load.

## Without a framework

```js
import { confirm, openModal, prompt, bindModalRoute } from "@cubyt/modals";

const ok = await confirm({ title: "Pausar dominio", confirmLabel: "Pausar" });

const handle = openModal({
  title: "Novedades",
  media: { type: "video", src: "https://vimeo.com/76979871" },
  actions: [{ label: "Ver changelog", href: "https://cubyt.co/changelog", variant: "primary" }],
});
await handle.closed;

bindModalRoute("verify-dns", () => openModal({ title: "Verificar DNS", body: "…" }));
```

`openModal` accepts `title`, `lead`, `body` (string, DOM node, array, or `({ close }) => node`), `media`, `actions`, `size`, `tone`, `placement` and `dismissible`. Action `onClick` handlers may be async; returning `false` keeps the modal open.
