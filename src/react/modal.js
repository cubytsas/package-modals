import {
  createContext,
  createElement as h,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "@cubyt/ui";
import { Icon, IconButton } from "@cubyt/ui/react";
import { modalManager } from "../manager.js";

export const ManagerContext = createContext(null);
const ModalContext = createContext(null);

const useIsomorphicLayoutEffect =
  typeof document === "undefined" ? useEffect : useLayoutEffect;

function useLatest(value) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** Context of the closest `<Modal>`: ids for ARIA wiring and a `close()` helper. */
export function useModalContext() {
  const context = useContext(ModalContext);
  if (!context) throw new Error("Modal parts must be rendered inside <Modal>.");
  return context;
}

export const renderIcon = (icon, size = 16) =>
  typeof icon === "string" ? h(Icon, { name: icon, size }) : icon;

export const MODAL_PROP_KEYS = [
  "open",
  "onOpenChange",
  "onClosed",
  "size",
  "tone",
  "placement",
  "variant",
  "closeOnEscape",
  "closeOnBackdrop",
  "dismissible",
  "initialFocus",
  "inline",
  "className",
  "manager",
  "container",
  "ariaLabel",
  "onKeyDown",
  "closeLabel",
];

/** Split shared `<Modal>` props from preset-specific props. */
export function splitModalProps(props) {
  const modal = {};
  const rest = {};
  for (const [key, value] of Object.entries(props)) {
    if (MODAL_PROP_KEYS.includes(key)) modal[key] = value;
    else rest[key] = value;
  }
  return [modal, rest];
}

/**
 * Accessible modal built on native `<dialog>`. Controlled with `open` +
 * `onOpenChange(open, reason)`. Pass `title`/`lead`/`footer` for the standard
 * layout, or compose `Modal.Header`, `Modal.Body` and `Modal.Footer` yourself.
 */
export function Modal(props) {
  const {
    open = false,
    onOpenChange,
    onClosed,
    size = "md",
    tone = "default",
    placement = "center",
    variant,
    closeOnEscape = true,
    closeOnBackdrop = true,
    dismissible = true,
    initialFocus,
    inline = false,
    className,
    manager: managerProp,
    container,
    ariaLabel,
    onKeyDown,
    closeLabel = "Cerrar",
    title,
    lead,
    eyebrow,
    icon,
    headerActions,
    media,
    footer,
    footerAlign,
    children,
  } = props;

  const contextManager = useContext(ManagerContext);
  const manager = managerProp ?? contextManager ?? modalManager;
  const [rendered, setRendered] = useState(open);
  const dialogRef = useRef(null);
  const idRef = useRef(null);
  const onOpenChangeRef = useLatest(onOpenChange);
  const onClosedRef = useLatest(onClosed);
  const dismissRef = useLatest({ dismissible, closeOnEscape, closeOnBackdrop });
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const leadId = `${baseId}-lead`;

  if (open && !rendered) setRendered(true);

  useIsomorphicLayoutEffect(() => {
    if (inline) return;
    const dialog = dialogRef.current;
    if (open && dialog && !idRef.current) {
      idRef.current = manager.mount(dialog, {
        initialFocus,
        onDismiss: (reason) => {
          const rules = dismissRef.current;
          if (!rules.dismissible) return false;
          if (reason === "escape" && !rules.closeOnEscape) return false;
          if (reason === "backdrop" && !rules.closeOnBackdrop) return false;
          onOpenChangeRef.current?.(false, reason);
          return true;
        },
      });
    } else if (!open && idRef.current) {
      const id = idRef.current;
      idRef.current = null;
      manager.unmount(id).then(() => {
        setRendered(false);
        onClosedRef.current?.();
      });
    }
  }, [open, rendered, inline, manager]);

  useEffect(
    () => () => {
      if (idRef.current) {
        manager.unmount(idRef.current, { immediate: true });
        idRef.current = null;
      }
    },
    [manager],
  );

  if (!inline && (!rendered || typeof document === "undefined")) return null;

  const context = {
    titleId,
    leadId,
    tone,
    dismissible,
    closeLabel,
    open,
    close: (reason = "close-button") => onOpenChangeRef.current?.(false, reason),
  };

  const standardLayout =
    title !== undefined || lead !== undefined || footer !== undefined || media !== undefined;
  const content = standardLayout
    ? [
        media ? h(ModalMedia, { key: "media", ...media }) : null,
        h(ModalHeader, { key: "header", title, lead, eyebrow, icon, actions: headerActions }),
        children !== undefined && children !== null && children !== false
          ? h(ModalBody, { key: "body" }, children)
          : null,
        footer ? h(ModalFooter, { key: "footer", align: footerAlign }, footer) : null,
      ]
    : children;

  const dialog = h(
    "dialog",
    {
      ref: dialogRef,
      className: cx("cubyt-modal", className),
      "data-size": size,
      "data-tone": tone,
      "data-placement": placement,
      "data-variant": variant,
      "data-inline": inline || undefined,
      open: inline || undefined,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabel ? undefined : titleId,
      "aria-describedby": leadId,
      onKeyDown,
    },
    h(
      "div",
      { className: "cubyt-modal__panel" },
      h("div", { className: "cubyt-modal__accent", "aria-hidden": true }),
      h(ModalContext.Provider, { value: context }, content),
    ),
  );

  return inline ? dialog : createPortal(dialog, container ?? document.body);
}

/** Modal preset for persistent side panels such as details and edit drawers. */
export function DrawerModal({ placement = "side", ...props }) {
  return h(Modal, { ...props, placement });
}

/** Modal preset for compact mobile-first actions and pickers. */
export function SheetModal({ placement = "sheet", ...props }) {
  return h(Modal, { ...props, placement });
}

export function ModalHeader({
  title,
  lead,
  eyebrow,
  icon,
  actions,
  close = true,
  align,
  className,
  children,
}) {
  const context = useModalContext();
  const showClose = close && context.dismissible;
  return h(
    "header",
    { className: cx("cubyt-modal__header", className), "data-align": align },
    icon ? h("span", { className: "cubyt-modal__head-icon" }, renderIcon(icon, 20)) : null,
    h(
      "div",
      { className: "cubyt-modal__head-copy" },
      eyebrow ? h("p", { className: "cubyt-modal__eyebrow" }, eyebrow) : null,
      title ? h("h2", { id: context.titleId, className: "cubyt-modal__title" }, title) : null,
      lead ? h("p", { id: context.leadId, className: "cubyt-modal__lead" }, lead) : null,
      children,
    ),
    actions || showClose
      ? h(
          "div",
          { className: "cubyt-modal__header-actions" },
          actions,
          showClose
            ? h(IconButton, {
                icon: "x",
                label: context.closeLabel,
                className: "cubyt-modal__close",
                onClick: () => context.close("close-button"),
              })
            : null,
        )
      : null,
  );
}

export function ModalBody({ flush = false, className, children, ...rest }) {
  return h(
    "div",
    { ...rest, className: cx("cubyt-modal__body", className), "data-flush": flush || undefined },
    children,
  );
}

export function ModalFooter({ align, meta, className, children }) {
  return h(
    "footer",
    { className: cx("cubyt-modal__footer", className), "data-align": align },
    meta ? h("span", { className: "cubyt-modal__footer-meta" }, meta) : null,
    children,
  );
}

export function ModalMedia({ kind = "image", aspect = "16 / 9", height, className, style, children }) {
  return h(
    "div",
    {
      className: cx("cubyt-modal__media", className),
      "data-kind": kind,
      style: { aspectRatio: height ? undefined : aspect, height, ...style },
    },
    children,
  );
}

/** Overlay close button for media-first layouts (image, promo, lightbox). */
export function ModalCloseButton({ className, variant = "overlay" }) {
  const context = useModalContext();
  if (!context.dismissible) return null;
  return h(IconButton, {
    icon: "x",
    label: context.closeLabel,
    variant,
    className: cx("cubyt-modal__media-close", className),
    onClick: () => context.close("close-button"),
  });
}

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
Modal.Media = ModalMedia;
Modal.Close = ModalCloseButton;
