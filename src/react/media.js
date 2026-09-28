import {
  createElement as h,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { followLink } from "@cubyt/ui";
import { Button, Icon, IconButton, Kbd, Notice } from "@cubyt/ui/react";
import {
  dismissPromo,
  filterCommands,
  resolveEmbedSource,
  resolveImageSource,
  resolveVideoSource,
} from "../media.js";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  ModalHeader,
  ModalMedia,
  renderIcon,
  splitModalProps,
  useModalContext,
} from "./modal.js";
import { renderAction } from "./presets.js";

function useFinish(onOpenChange, onResolve) {
  return (value) => {
    onResolve?.(value);
    onOpenChange?.(false, "resolved");
  };
}

function safely(resolve) {
  try {
    return { value: resolve() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Image, video or embed element with URL validation. Embeds are only rendered
 * while `active`, so audio stops as soon as the modal starts closing.
 */
export function MediaElement({ media, active = true, videoRef, fallbackLabel = "No se pudo cargar el contenido." }) {
  const type = media?.type ?? "image";
  const resolved = useMemo(
    () =>
      safely(() => {
        if (type === "image") return { kind: "image", src: resolveImageSource(media.src) };
        if (type === "embed") return { kind: "embed", src: resolveEmbedSource(media.src, media) };
        return resolveVideoSource(media.src, { autoplay: true, ...media });
      }),
    [type, media?.src, media?.autoplay, media?.muted, media?.loop, media?.allowedHosts],
  );

  if (resolved.error) {
    return h("div", { className: "cubyt-modal__media-fallback", role: "alert" }, fallbackLabel);
  }
  const source = resolved.value;

  if (source.kind === "image") {
    return h("img", {
      src: source.src,
      alt: media.alt ?? "",
      decoding: "async",
      style: media.fit ? { objectFit: media.fit } : undefined,
    });
  }
  if (source.kind === "file") {
    const { autoplay = true } = media;
    return h(
      "video",
      {
        ref: videoRef,
        src: source.src,
        poster: media.poster ? safely(() => resolveImageSource(media.poster)).value : undefined,
        controls: media.controls ?? true,
        playsInline: true,
        autoPlay: autoplay,
        muted: media.muted ?? autoplay,
        loop: media.loop,
        preload: "metadata",
      },
      (media.tracks ?? []).map((track) =>
        h("track", {
          key: track.src,
          src: track.src,
          kind: track.kind ?? "captions",
          srcLang: track.srclang,
          label: track.label,
          default: track.default,
        }),
      ),
    );
  }
  if (!active) return null;
  return h("iframe", {
    src: source.src,
    title: media.title ?? (type === "embed" ? "Contenido embebido" : "Video"),
    allow: media.allow ?? "autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write",
    allowFullScreen: true,
    referrerPolicy: "strict-origin-when-cross-origin",
    sandbox: type === "embed" ? (media.sandbox ?? "allow-scripts allow-same-origin allow-forms allow-popups") : undefined,
    loading: "lazy",
  });
}

function usePauseOnClose(open) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (!open) videoRef.current?.pause();
  }, [open]);
  return videoRef;
}

/** Announcement / feature modal with a hero image on top. */
export function ImageModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    src,
    alt,
    aspect = "16 / 9",
    fit,
    badge,
    eyebrow,
    title,
    lead,
    children,
    primaryAction,
    secondaryAction,
    onResolve,
  } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  const hasFooter = primaryAction || secondaryAction;

  return h(
    Modal,
    { ...modal, variant: "image" },
    h(
      ModalMedia,
      { kind: "image", aspect },
      h(MediaElement, { media: { type: "image", src, alt, fit } }),
      badge ? h("span", { className: "cubyt-modal__media-badge" }, badge) : null,
      h(ModalCloseButton),
    ),
    h(ModalHeader, { eyebrow, title, lead, close: false }),
    children ? h(ModalBody, null, children) : null,
    hasFooter
      ? h(
          ModalFooter,
          { align: secondaryAction ? undefined : "end" },
          renderAction(secondaryAction, finish, { variant: "secondary" }),
          renderAction(primaryAction, finish),
        )
      : null,
  );
}

function useGallery({ images, index, defaultIndex = 0, onIndexChange, loop = true, open }) {
  const [internal, setInternal] = useState(defaultIndex);
  const current = Math.min(Math.max(index ?? internal, 0), Math.max(images.length - 1, 0));
  const go = (next) => {
    const count = images.length;
    if (!count) return;
    let target = next;
    if (loop) target = (next + count) % count;
    else target = Math.min(Math.max(next, 0), count - 1);
    if (index === undefined) setInternal(target);
    onIndexChange?.(target);
  };

  useEffect(() => {
    if (!open) return;
    for (const offset of [1, -1]) {
      const neighbor = images[(current + offset + images.length) % images.length];
      if (neighbor && typeof Image !== "undefined") {
        const preload = new Image();
        preload.src = safely(() => resolveImageSource(neighbor.src)).value ?? "";
      }
    }
  }, [current, images, open]);

  return {
    current,
    image: images[current],
    count: images.length,
    canPrev: loop || current > 0,
    canNext: loop || current < images.length - 1,
    prev: () => go(current - 1),
    next: () => go(current + 1),
    go,
  };
}

function GalleryView({ gallery, images, showThumbnails, prevLabel, nextLabel, aspect, immersive }) {
  const pointer = useRef(null);
  const { image } = gallery;
  const src = image ? safely(() => resolveImageSource(image.src)).value : undefined;

  return h(
    "div",
    { className: "cubyt-gallery", "aria-roledescription": "carousel" },
    h(
      "div",
      {
        className: "cubyt-gallery__stage",
        style: aspect ? { "--cubyt-gallery-aspect": aspect } : undefined,
        onPointerDown: (event) => (pointer.current = { x: event.clientX, y: event.clientY }),
        onPointerUp: (event) => {
          const start = pointer.current;
          pointer.current = null;
          if (!start) return;
          const dx = event.clientX - start.x;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(event.clientY - start.y)) {
            if (dx < 0) gallery.next();
            else gallery.prev();
          }
        },
      },
      src
        ? h("img", {
            key: src,
            className: "cubyt-gallery__image",
            src,
            alt: image.alt ?? "",
            draggable: false,
          })
        : null,
      gallery.count > 1
        ? [
            h(IconButton, {
              key: "prev",
              icon: "chevron-left",
              label: prevLabel,
              variant: "overlay",
              size: "lg",
              className: "cubyt-gallery__nav",
              "data-dir": "prev",
              disabled: !gallery.canPrev,
              onClick: gallery.prev,
            }),
            h(IconButton, {
              key: "next",
              icon: "chevron-right",
              label: nextLabel,
              variant: "overlay",
              size: "lg",
              className: "cubyt-gallery__nav",
              "data-dir": "next",
              disabled: !gallery.canNext,
              onClick: gallery.next,
            }),
            h(
              "span",
              { key: "counter", className: "cubyt-gallery__counter", "aria-live": "polite" },
              `${gallery.current + 1} / ${gallery.count}`,
            ),
          ]
        : null,
    ),
    image?.caption ? h("p", { className: "cubyt-gallery__caption" }, image.caption) : null,
    showThumbnails && gallery.count > 1
      ? h(
          "div",
          { className: "cubyt-gallery__thumbs", role: "tablist", "aria-label": immersive ? "Miniaturas" : undefined },
          images.map((item, index) => {
              const thumb = safely(() => resolveImageSource(item.thumbnail ?? item.src)).value;
              return h(
                "button",
                {
                  key: index,
                  type: "button",
                  role: "tab",
                  className: "cubyt-gallery__thumb",
                  "aria-current": index === gallery.current,
                  "aria-selected": index === gallery.current,
                  "aria-label": item.alt || `Imagen ${index + 1}`,
                  onClick: () => gallery.go(index),
                },
                thumb ? h("img", { src: thumb, alt: "", loading: "lazy" }) : null,
              );
            }),
        )
      : null,
  );
}

/** Image carousel with captions, thumbnails, arrow keys and swipe. */
export function GalleryModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    images = [],
    index,
    defaultIndex,
    onIndexChange,
    loop,
    showThumbnails = images.length > 1,
    title,
    lead,
    aspect,
    immersive = false,
    prevLabel = "Anterior",
    nextLabel = "Siguiente",
    children,
  } = rest;
  const gallery = useGallery({ images, index, defaultIndex, onIndexChange, loop, open: modal.open });

  const onKeyDown = (event) => {
    modal.onKeyDown?.(event);
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      gallery.next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      gallery.prev();
    }
  };

  const view = h(GalleryView, { gallery, images, showThumbnails, prevLabel, nextLabel, aspect, immersive });

  if (immersive) {
    return h(
      Modal,
      {
        ...modal,
        variant: "lightbox",
        size: "full",
        ariaLabel: modal.ariaLabel ?? (typeof title === "string" ? title : "Galería"),
        onKeyDown,
      },
      h(ModalCloseButton),
      h(ModalBody, null, view, children),
    );
  }
  return h(
    Modal,
    { ...modal, variant: "gallery", size: modal.size ?? "xl", title: title ?? "", lead, onKeyDown },
    view,
    children,
  );
}

/** Full-screen, dark lightbox variant of `GalleryModal`. */
export function LightboxModal(props) {
  return h(GalleryModal, { ...props, immersive: true });
}

/** YouTube/Vimeo (privacy embeds), allowlisted players, or native `<video>` files. */
export function VideoModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    src,
    poster,
    tracks,
    autoplay = true,
    muted,
    loop,
    controls,
    allowedHosts,
    aspect = "16 / 9",
    title,
    lead,
    children,
    primaryAction,
    fallbackLabel,
    onResolve,
  } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  const videoRef = usePauseOnClose(modal.open);
  const media = { type: "video", src, poster, tracks, autoplay, muted, loop, controls, allowedHosts, title };

  return h(
    Modal,
    { ...modal, variant: "video", size: modal.size ?? "lg" },
    h(ModalHeader, { title: title ?? "", lead }),
    h(ModalMedia, { kind: "video", aspect }, h(MediaElement, { media, active: modal.open, videoRef, fallbackLabel })),
    children ? h(ModalBody, { style: { paddingTop: 16 } }, children) : null,
    primaryAction ? h(ModalFooter, { align: "end" }, renderAction(primaryAction, finish)) : null,
  );
}

/** Sandboxed iframe (docs, checkout, forms) limited to HTTPS allowlisted hosts. */
export function EmbedModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    src,
    title,
    lead,
    allowedHosts,
    height = 560,
    sandbox,
    allow,
    openInNewTabLabel = "Abrir en pestaña nueva",
    fallbackLabel,
  } = rest;
  const media = { type: "embed", src, allowedHosts, sandbox, allow, title };
  const newTabHref = safely(() => resolveEmbedSource(src, { allowedHosts })).value;

  return h(
    Modal,
    { ...modal, variant: "embed", size: modal.size ?? "xl" },
    h(ModalHeader, {
      title: title ?? "",
      lead,
      actions: newTabHref && openInNewTabLabel
        ? h(Button, { variant: "ghost", size: "sm", href: newTabHref, newTab: true, iconEnd: "external-link" }, openInNewTabLabel)
        : null,
    }),
    h(ModalMedia, { kind: "embed", height }, h(MediaElement, { media, active: modal.open, fallbackLabel })),
  );
}

function StepMedia({ media, active }) {
  if (!media) return null;
  return h(
    "div",
    { className: "cubyt-steps__media", style: { aspectRatio: media.aspect ?? "16 / 9" } },
    h(MediaElement, { media: { autoplay: true, muted: true, ...media }, active }),
  );
}

/** Wizard / onboarding with progress, back/next, per-step validation and media. */
export function StepsModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    steps = [],
    initialStep = 0,
    onStepChange,
    onFinish,
    finishLabel = "Finalizar",
    nextLabel = "Siguiente",
    backLabel = "Atrás",
    skipLabel,
    stepLabel = (current, total) => `Paso ${current} de ${total}`,
    onResolve,
  } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  const [index, setIndex] = useState(initialStep);
  const [direction, setDirection] = useState("forward");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const goTo = (next) => {
    setError(null);
    setDirection(next < index ? "backward" : "forward");
    setIndex(next);
    onStepChange?.(next, steps[next]?.id);
  };

  const advance = async () => {
    setBusy(true);
    setError(null);
    try {
      const verdict = await step?.validate?.();
      if (verdict === false || typeof verdict === "string") {
        if (typeof verdict === "string") setError(verdict);
        return;
      }
      if (isLast) {
        const result = await onFinish?.();
        if (result !== false) finish(result ?? true);
      } else {
        goTo(index + 1);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  if (!step) return null;

  return h(
    Modal,
    { ...modal, variant: "steps", size: modal.size ?? "md" },
    h(ModalHeader, { eyebrow: stepLabel(index + 1, steps.length), title: step.title, lead: step.lead }),
    h(
      "div",
      { className: "cubyt-steps__progress", role: "progressbar", "aria-valuemin": 1, "aria-valuemax": steps.length, "aria-valuenow": index + 1 },
      steps.map((item, stepIndex) =>
        h("span", {
          key: item.id ?? stepIndex,
          className: "cubyt-steps__dot",
          "data-state": stepIndex < index ? "done" : stepIndex === index ? "current" : "todo",
        }),
      ),
    ),
    h(
      ModalBody,
      null,
      h(
        "div",
        { key: step.id ?? index, className: "cubyt-steps__panel", "data-direction": direction },
        h(StepMedia, { media: step.media, active: modal.open }),
        typeof step.content === "function" ? step.content({ index, goTo }) : step.content,
        error ? h(Notice, { tone: "danger" }, error) : null,
      ),
    ),
    h(
      ModalFooter,
      null,
      index > 0
        ? h(Button, { variant: "secondary", icon: "chevron-left", onClick: () => goTo(index - 1), disabled: busy }, backLabel)
        : skipLabel
          ? h(Button, { variant: "ghost", onClick: () => finish(false) }, skipLabel)
          : h("span"),
      h(
        Button,
        { iconEnd: isLast ? undefined : "arrow-right", loading: busy, onClick: advance, "data-autofocus": true },
        isLast ? finishLabel : nextLabel,
      ),
    ),
  );
}

function PromoContent({ media, eyebrow, title, description, children, primaryAction, secondaryAction, finish, dismissKey, dontShowAgainLabel, optOut, setOptOut, active }) {
  const context = useModalContext();
  return h(
    "div",
    { className: "cubyt-promo" },
    h(
      "div",
      { className: "cubyt-promo__media" },
      media ? h(MediaElement, { media: { autoplay: true, muted: true, loop: true, controls: false, ...media }, active }) : null,
    ),
    h(
      "div",
      { className: "cubyt-promo__copy" },
      eyebrow ? h("p", { className: "cubyt-modal__eyebrow" }, eyebrow) : null,
      h("h2", { id: context.titleId, className: "cubyt-promo__title" }, title),
      description ? h("p", { id: context.leadId, className: "cubyt-promo__text" }, description) : null,
      children,
      h(
        "div",
        { className: "cubyt-promo__actions" },
        renderAction(primaryAction, finish, { variant: "primary" }),
        renderAction(secondaryAction, finish, { variant: "secondary" }),
      ),
      dismissKey && dontShowAgainLabel
        ? h(
            "label",
            { className: "cubyt-promo__optout" },
            h("input", { type: "checkbox", checked: optOut, onChange: (event) => setOptOut(event.target.checked) }),
            dontShowAgainLabel,
          )
        : null,
    ),
  );
}

/**
 * Split promo (image or video + copy). CTA `href`s go through `@cubyt/navigation`.
 * With `dismissKey`, "don't show again" is persisted; gate it with `shouldShowPromo(key)`.
 */
export function PromoModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    media,
    eyebrow,
    title,
    description,
    children,
    primaryAction,
    secondaryAction,
    dismissKey,
    dontShowAgainLabel = "No volver a mostrar",
    onResolve,
  } = rest;
  const [optOut, setOptOut] = useState(false);
  const optOutRef = useRef(optOut);
  optOutRef.current = optOut;

  const persist = () => {
    if (dismissKey && optOutRef.current) dismissPromo(dismissKey);
  };
  const finish = (value) => {
    persist();
    onResolve?.(value);
    modal.onOpenChange?.(false, "resolved");
  };

  return h(
    Modal,
    {
      ...modal,
      variant: "promo",
      size: modal.size ?? "lg",
      onOpenChange: (next, reason) => {
        if (!next) persist();
        modal.onOpenChange?.(next, reason);
      },
    },
    h(ModalCloseButton, { className: "cubyt-promo__close" }),
    h(PromoContent, {
      media,
      eyebrow,
      title,
      description,
      children,
      primaryAction,
      secondaryAction,
      finish,
      dismissKey,
      dontShowAgainLabel,
      optOut,
      setOptOut,
      active: modal.open,
    }),
  );
}

/** Register a global Cmd/Ctrl+K (or custom key) shortcut. */
export function useCommandShortcut(callback, options = {}) {
  const { key = "k", enabled = true } = options;
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === key) {
        event.preventDefault();
        callbackRef.current(event);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, enabled]);
}

/** Command palette: search, grouped results, keyboard navigation, `href` or `onSelect`. */
export function CommandModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    items = [],
    placeholder = "Buscar comandos…",
    emptyLabel = "Sin resultados",
    filter = filterCommands,
    onSelect,
    onResolve,
    hints = { navigate: "navegar", select: "abrir", close: "cerrar" },
  } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const baseId = `cubyt-command-${useId()}`;
  const results = useMemo(() => filter(items, query), [filter, items, query]);
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const select = async (item) => {
    if (!item || item.disabled) return;
    const result = await item.onSelect?.(item);
    if (result === false) return;
    onSelect?.(item);
    finish(item.id);
    if (item.href) followLink(item);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % Math.max(results.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      select(results[activeIndex]);
    }
  };

  let lastGroup;
  const rows = [];
  results.forEach((item, index) => {
    if (item.group && item.group !== lastGroup) {
      rows.push(h("li", { key: `group-${item.group}`, role: "presentation", className: "cubyt-command__group" }, item.group));
    }
    lastGroup = item.group;
    rows.push(
      h(
        "li",
        {
          key: item.id,
          id: `${baseId}-${index}`,
          role: "option",
          "aria-selected": index === activeIndex,
          "aria-disabled": item.disabled || undefined,
          "data-index": index,
          className: "cubyt-list-item",
          "data-active": index === activeIndex || undefined,
          style: { cursor: item.disabled ? "not-allowed" : "pointer", opacity: item.disabled ? 0.5 : undefined },
          onMouseMove: () => index !== activeIndex && setActive(index),
          onClick: () => select(item),
        },
        item.icon ? h("span", { className: "cubyt-list-item__icon" }, renderIcon(item.icon, 16)) : null,
        h(
          "span",
          { className: "cubyt-list-item__copy" },
          h("span", { className: "cubyt-list-item__label" }, item.label),
          item.description ? h("span", { className: "cubyt-list-item__description" }, item.description) : null,
        ),
        item.shortcut ? h("span", { className: "cubyt-list-item__trailing" }, [item.shortcut].flat().map((keyLabel) => h(Kbd, { key: keyLabel }, keyLabel))) : null,
      ),
    );
  });

  return h(
    Modal,
    {
      ...modal,
      variant: "command",
      placement: modal.placement ?? "top",
      size: modal.size ?? "lg",
      ariaLabel: modal.ariaLabel ?? placeholder,
    },
    h(
      "div",
      { className: "cubyt-command__search" },
      h(Icon, { name: "search", size: 18 }),
      h("input", {
        className: "cubyt-command__input",
        type: "text",
        role: "combobox",
        "aria-expanded": true,
        "aria-controls": `${baseId}-list`,
        "aria-activedescendant": results.length ? `${baseId}-${activeIndex}` : undefined,
        "aria-autocomplete": "list",
        autoComplete: "off",
        spellCheck: false,
        placeholder,
        value: query,
        "data-autofocus": true,
        onChange: (event) => setQuery(event.target.value),
        onKeyDown,
      }),
      h(Kbd, null, "Esc"),
    ),
    h(
      "div",
      { className: "cubyt-command__results" },
      results.length
        ? h("ul", { ref: listRef, id: `${baseId}-list`, role: "listbox", className: "cubyt-list", "aria-label": placeholder }, rows)
        : h("p", { className: "cubyt-command__empty", role: "status" }, emptyLabel),
    ),
    hints
      ? h(
          "div",
          { className: "cubyt-command__footer", "aria-hidden": true },
          h("span", { className: "cubyt-command__hint" }, h(Kbd, null, "↑"), h(Kbd, null, "↓"), hints.navigate),
          h("span", { className: "cubyt-command__hint" }, h(Kbd, null, "↵"), hints.select),
          h("span", { className: "cubyt-command__hint" }, h(Kbd, null, "Esc"), hints.close),
        )
      : null,
  );
}
