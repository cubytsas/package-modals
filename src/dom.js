import { createIcon, cx, followLink, safeHref } from "@cubyt/ui";
import { modalManager } from "./manager.js";
import { resolveEmbedSource, resolveImageSource, resolveVideoSource } from "./media.js";

let idCounter = 0;
const nextId = (prefix) => `${prefix}-${++idCounter}`;

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "className") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "style") Object.assign(node.style, value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  appendContent(node, children);
  return node;
}

function appendContent(parent, content) {
  for (const child of [content].flat(Infinity)) {
    if (child === undefined || child === null || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

function renderMedia(media) {
  if (!media) return null;
  const aspect = media.aspect ?? "16 / 9";
  const frame = el("div", {
    className: "cubyt-modal__media",
    dataset: { kind: media.type },
    style: { aspectRatio: aspect },
  });

  if (media.type === "image") {
    frame.append(
      el("img", {
        src: resolveImageSource(media.src),
        alt: media.alt ?? "",
        loading: "eager",
        decoding: "async",
        style: { objectFit: media.fit ?? "cover" },
      }),
    );
  } else if (media.type === "video") {
    const source = resolveVideoSource(media.src, media);
    if (source.kind === "embed") {
      frame.append(
        el("iframe", {
          src: source.src,
          title: media.title ?? "Video",
          allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
          allowfullscreen: true,
          referrerpolicy: "strict-origin-when-cross-origin",
          loading: "lazy",
        }),
      );
    } else {
      frame.append(
        el("video", {
          src: source.src,
          poster: media.poster ? resolveImageSource(media.poster) : undefined,
          controls: true,
          playsinline: true,
          autoplay: media.autoplay,
          muted: media.muted ?? media.autoplay,
          loop: media.loop,
          preload: "metadata",
        }),
      );
    }
  } else if (media.type === "embed") {
    frame.style.aspectRatio = "";
    frame.style.height = `${media.height ?? 560}px`;
    frame.append(
      el("iframe", {
        src: resolveEmbedSource(media.src, media),
        title: media.title ?? "Contenido embebido",
        sandbox: media.sandbox ?? "allow-scripts allow-same-origin allow-forms allow-popups",
        referrerpolicy: "strict-origin-when-cross-origin",
        loading: "lazy",
      }),
    );
  }
  return frame;
}

function renderButton(action) {
  const classes = cx(
    "cubyt-btn",
    `cubyt-btn--${action.variant ?? "primary"}`,
    action.size && action.size !== "md" && `cubyt-btn--${action.size}`,
  );
  const href = safeHref(action.href);
  const content = [
    action.icon ? createIcon(action.icon, { size: 14 }) : null,
    action.label,
    action.iconEnd ? createIcon(action.iconEnd, { size: 14 }) : null,
  ];
  if (href && action.close === false) {
    return el(
      "a",
      {
        className: classes,
        href,
        target: action.newTab ? "_blank" : undefined,
        rel: action.newTab ? "noopener noreferrer" : undefined,
      },
      content,
    );
  }
  return el(
    "button",
    {
      type: "button",
      className: classes,
      disabled: action.disabled,
      "data-autofocus": action.autoFocus,
    },
    content,
  );
}

function setLoading(button, loading) {
  button.toggleAttribute("disabled", loading);
  button.dataset.loading = loading ? "true" : "false";
  const spinner = button.querySelector(":scope > .cubyt-spinner");
  if (loading && !spinner) button.prepend(el("span", { className: "cubyt-spinner" }));
  if (!loading) spinner?.remove();
}

/**
 * Build the modal markup (same classes as the React components) without mounting it.
 * `ctx.close(value)` is called for footer actions and the close button.
 */
export function renderModal(options, ctx = {}) {
  const {
    title,
    lead,
    body,
    media,
    actions = [],
    size = "md",
    tone = "default",
    placement = "center",
    dismissible = true,
    closeLabel = "Cerrar",
    footerAlign,
    className,
  } = options;
  const titleId = nextId("cubyt-modal-title");
  const leadId = lead ? nextId("cubyt-modal-lead") : undefined;
  const close = (value) => ctx.close?.(value);

  const dialog = el("dialog", {
    className: cx("cubyt-modal", className),
    dataset: { size, tone, placement },
    "aria-labelledby": title ? titleId : undefined,
    "aria-label": title ? undefined : options.ariaLabel,
    "aria-describedby": leadId,
  });
  const panel = el("div", { className: "cubyt-modal__panel" });
  dialog.append(panel);
  panel.append(el("div", { className: "cubyt-modal__accent", "aria-hidden": "true" }));

  const mediaNode = renderMedia(media);
  if (mediaNode) panel.append(mediaNode);

  if (title || dismissible) {
    const header = el(
      "header",
      { className: "cubyt-modal__header" },
      el(
        "div",
        { className: "cubyt-modal__head-copy" },
        title ? el("h2", { className: "cubyt-modal__title", id: titleId }, title) : null,
        lead ? el("p", { className: "cubyt-modal__lead", id: leadId }, lead) : null,
      ),
    );
    if (dismissible) {
      header.append(
        el(
          "button",
          {
            type: "button",
            className: "cubyt-icon-btn cubyt-modal__close",
            "aria-label": closeLabel,
            title: closeLabel,
            onClick: () => close(undefined),
          },
          createIcon("x", { size: 16 }),
        ),
      );
    }
    panel.append(header);
  }

  const bodyNode = el("div", { className: "cubyt-modal__body" });
  const bodyContent =
    typeof body === "function" ? body({ close, dialog, panel }) : body;
  appendContent(bodyNode, bodyContent);
  if (bodyNode.childNodes.length) panel.append(bodyNode);

  const buttons = [];
  if (actions.length) {
    const footer = el("footer", {
      className: "cubyt-modal__footer",
      dataset: footerAlign ? { align: footerAlign } : undefined,
    });
    for (const action of actions) {
      const button = renderButton(action);
      buttons.push(button);
      if (button.tagName === "BUTTON") {
        button.addEventListener("click", async (event) => {
          let result;
          if (action.onClick) {
            setLoading(button, true);
            try {
              result = await action.onClick(event, { close, dialog });
            } finally {
              if (button.isConnected) setLoading(button, false);
            }
          }
          if (result === false) return;
          if (action.href) followLink(action);
          if (action.close !== false) close(action.value ?? result);
        });
      }
      footer.append(button);
    }
    panel.append(footer);
  }

  return { dialog, panel, body: bodyNode, buttons, titleId };
}

/**
 * Render and open a modal. Resolves `handle.closed` with the value passed to
 * `close()` (footer action `value`, or `undefined` when dismissed).
 */
export function openModal(options, manager = modalManager) {
  let resolveClosed;
  let isClosed = false;
  const closed = new Promise((resolve) => (resolveClosed = resolve));
  const handle = {
    id: "",
    dialog: null,
    closed,
    async close(value) {
      if (isClosed) return;
      isClosed = true;
      await manager.unmount(handle.id);
      handle.dialog.remove();
      options.onClose?.(value);
      resolveClosed(value);
    },
  };

  const view = renderModal(options, { close: (value) => handle.close(value) });
  handle.dialog = view.dialog;
  handle.buttons = view.buttons;
  (options.container ?? document.body).append(view.dialog);
  const dismissible = options.dismissible !== false;
  handle.id = manager.mount(view.dialog, {
    closeOnEscape: dismissible && options.closeOnEscape !== false,
    closeOnBackdrop: dismissible && options.closeOnBackdrop !== false,
    initialFocus: options.initialFocus,
    onDismiss: () => handle.close(undefined),
  });
  return handle;
}

function typedConfirmation(options, onValid) {
  const inputId = nextId("cubyt-confirm");
  const input = el("input", {
    id: inputId,
    className: "cubyt-input cubyt-input--mono",
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: "false",
    "data-autofocus": true,
  });
  input.addEventListener("input", () => onValid(input.value.trim() === options.confirmText));
  return el(
    "div",
    { className: "cubyt-field" },
    el(
      "label",
      { className: "cubyt-field__label", for: inputId },
      options.confirmHint ?? `Escribe ${options.confirmText} para confirmar`,
    ),
    input,
  );
}

function notice(tone, title, text) {
  const iconName = tone === "danger" || tone === "warning" ? "alert-triangle" : "info";
  return el(
    "div",
    { className: `cubyt-notice cubyt-notice--${tone}`, role: tone === "danger" ? "alert" : "note" },
    el("span", { className: "cubyt-notice__icon" }, createIcon(iconName, { size: 18 })),
    el(
      "div",
      { className: "cubyt-notice__body" },
      title ? el("p", { className: "cubyt-notice__title" }, title) : null,
      text ? el("p", { className: "cubyt-notice__text" }, text) : null,
    ),
  );
}

/** Confirmation dialog. With `confirmText`, the user must type it to enable the action. */
export function confirm(options, manager) {
  const danger = options.tone === "danger";
  let confirmButton;
  const handle = openModal(
    {
      ...options,
      body: [
        options.warning || options.warningTitle
          ? notice(danger ? "danger" : "warning", options.warningTitle, options.warning)
          : null,
        options.description ? el("p", { className: "cubyt-modal__text" }, options.description) : null,
        options.confirmText
          ? typedConfirmation(options, (valid) => confirmButton?.toggleAttribute("disabled", !valid))
          : null,
        options.body ?? null,
      ],
      actions: [
        { label: options.cancelLabel ?? "Cancelar", variant: "secondary", value: false },
        {
          label: options.confirmLabel ?? "Confirmar",
          variant: danger ? "danger" : "primary",
          icon: options.confirmIcon,
          value: true,
          disabled: !!options.confirmText,
          autoFocus: !options.confirmText,
          onClick: options.onConfirm,
        },
      ],
    },
    manager,
  );
  confirmButton = handle.buttons[1];
  return handle.closed.then((value) => value === true);
}

/** Single-field prompt. Resolves with the value, or `null` when cancelled. */
export function prompt(options, manager) {
  const inputId = nextId("cubyt-prompt");
  const errorId = `${inputId}-error`;
  const input = el("input", {
    id: inputId,
    className: "cubyt-input",
    type: options.inputType ?? "text",
    placeholder: options.placeholder,
    value: options.defaultValue ?? "",
    autocomplete: options.autocomplete ?? "off",
    "data-autofocus": true,
  });
  const error = el("p", { id: errorId, className: "cubyt-field__error", role: "alert", hidden: true });

  const validate = () => {
    const message = options.validate?.(input.value) ?? (options.required !== false && !input.value.trim() ? options.requiredMessage ?? "Este campo es obligatorio." : undefined);
    error.hidden = !message;
    error.textContent = message ?? "";
    input.setAttribute("aria-invalid", message ? "true" : "false");
    if (message) input.setAttribute("aria-describedby", errorId);
    else input.removeAttribute("aria-describedby");
    return !message;
  };

  const handle = openModal(
    {
      ...options,
      body: el(
        "div",
        { className: "cubyt-field" },
        options.label ? el("label", { className: "cubyt-field__label", for: inputId }, options.label) : null,
        input,
        error,
      ),
      actions: [
        { label: options.cancelLabel ?? "Cancelar", variant: "secondary", value: null },
        {
          label: options.confirmLabel ?? "Guardar",
          variant: "primary",
          onClick: () => (validate() ? input.value : false),
        },
      ],
    },
    manager,
  );
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      handle.buttons[1].click();
    }
  });
  return handle.closed.then((value) => (typeof value === "string" ? value : null));
}

/** Informational dialog with a single acknowledgement button. */
export function alert(options, manager) {
  return openModal(
    {
      ...options,
      body: [
        options.description ? el("p", { className: "cubyt-modal__text" }, options.description) : null,
        options.body ?? null,
      ],
      footerAlign: "end",
      actions: [
        {
          label: options.confirmLabel ?? "Entendido",
          variant: options.tone === "danger" ? "danger" : "primary",
          autoFocus: true,
        },
      ],
    },
    manager,
  ).closed.then(() => undefined);
}
