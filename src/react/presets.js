import {
  createElement as h,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { copyText } from "@cubyt/ui";
import {
  Button,
  ChipGroup,
  CodeBlock,
  Field,
  Icon,
  IconButton,
  Input,
  KeyValue,
  ListItem,
  Notice,
  Progress,
} from "@cubyt/ui/react";
import { Modal, ModalBody, ModalFooter, renderIcon, splitModalProps, useModalContext } from "./modal.js";

const errorMessage = (error) =>
  error instanceof Error ? error.message : typeof error === "string" ? error : "Algo salió mal.";

/** Resolve the modal with a value, then request close. */
function useFinish(onOpenChange, onResolve) {
  return (value) => {
    onResolve?.(value);
    onOpenChange?.(false, "resolved");
  };
}

/** Run an async handler with busy/error state. Returns `undefined` on failure. */
function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  const run = async (fn) => {
    setError(null);
    setBusy(true);
    try {
      return { ok: true, value: await fn() };
    } catch (caught) {
      if (mounted.current) setError(errorMessage(caught));
      return { ok: false };
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

/** Render a footer action (`{ label, variant, icon, href, onClick, value, close }`). */
export function renderAction(action, finish, defaults = {}) {
  if (!action) return null;
  if (!action.label) return action;
  return h(
    Button,
    {
      key: action.key ?? action.label,
      variant: action.variant ?? defaults.variant ?? "primary",
      icon: action.icon,
      iconEnd: action.iconEnd,
      href: action.href,
      external: action.external,
      newTab: action.newTab,
      replace: action.replace,
      disabled: action.disabled,
      loading: action.loading,
      "data-autofocus": action.autoFocus || undefined,
      onClick: async (event) => {
        const result = await action.onClick?.(event);
        if (result === false || action.close === false) return;
        finish(action.value ?? result);
      },
    },
    action.label,
  );
}

const cancelButton = (label, onClick, disabled) =>
  label === null
    ? null
    : h(Button, { key: "cancel", variant: "secondary", onClick, disabled }, label ?? "Cancelar");

/** Confirm/cancel. `onConfirm` may be async; returning `false` keeps the modal open. */
export function ConfirmModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    title,
    lead,
    icon,
    description,
    children,
    confirmLabel = "Confirmar",
    cancelLabel,
    confirmIcon,
    confirmVariant,
    onConfirm,
    onCancel,
    onResolve,
  } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  const action = useAsyncAction();

  const confirm = async () => {
    const result = await action.run(() => onConfirm?.());
    if (result.ok && result.value !== false) finish(true);
  };

  return h(
    Modal,
    {
      ...modal,
      dismissible: modal.dismissible !== false && !action.busy,
      title,
      lead,
      icon,
      footer: [
        cancelButton(cancelLabel, () => {
          onCancel?.();
          finish(false);
        }, action.busy),
        h(
          Button,
          {
            key: "confirm",
            variant: confirmVariant ?? (modal.tone === "danger" ? "danger" : "primary"),
            iconEnd: confirmIcon,
            loading: action.busy,
            onClick: confirm,
            "data-autofocus": true,
          },
          confirmLabel,
        ),
      ],
    },
    description ? h("p", { className: "cubyt-modal__text" }, description) : null,
    children,
    action.error ? h(Notice, { tone: "danger" }, action.error) : null,
  );
}

/** Destructive confirmation with a warning and optional typed confirmation (e.g. "REMOVER"). */
export function DangerModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    title,
    lead,
    icon,
    warningTitle = "Esta acción no se puede deshacer",
    warning,
    description,
    children,
    confirmText,
    confirmHint,
    confirmLabel = "Eliminar",
    cancelLabel,
    confirmIcon,
    onConfirm,
    onCancel,
    onResolve,
  } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  const action = useAsyncAction();
  const [typed, setTyped] = useState("");
  const matches = !confirmText || typed.trim() === confirmText;

  const confirm = async () => {
    if (!matches) return;
    const result = await action.run(() => onConfirm?.());
    if (result.ok && result.value !== false) finish(true);
  };

  return h(
    Modal,
    {
      ...modal,
      tone: "danger",
      dismissible: modal.dismissible !== false && !action.busy,
      title,
      lead,
      icon,
      footer: [
        cancelButton(cancelLabel, () => {
          onCancel?.();
          finish(false);
        }, action.busy),
        h(
          Button,
          {
            key: "confirm",
            variant: "danger",
            iconEnd: confirmIcon,
            disabled: !matches,
            loading: action.busy,
            onClick: confirm,
          },
          confirmLabel,
        ),
      ],
    },
    warningTitle || warning ? h(Notice, { tone: "danger", title: warningTitle }, warning) : null,
    description ? h("p", { className: "cubyt-modal__text" }, description) : null,
    children,
    confirmText
      ? h(
          Field,
          { label: confirmHint ?? `Escribe ${confirmText} para confirmar` },
          h(Input, {
            mono: true,
            value: typed,
            autoComplete: "off",
            autoCapitalize: "off",
            spellCheck: false,
            "data-autofocus": true,
            onChange: (event) => setTyped(event.target.value),
            onKeyDown: (event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) confirm();
            },
          }),
        )
      : null,
    action.error ? h(Notice, { tone: "danger" }, action.error) : null,
  );
}

/**
 * Modal wrapping a `<form>`. `onSubmit(formData, event)` may be async; its return
 * value resolves the modal (`false` keeps it open, thrown errors are shown inline).
 */
export function FormModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    title,
    lead,
    icon,
    children,
    submitLabel = "Guardar",
    cancelLabel,
    submitIcon,
    submitVariant,
    submitDisabled,
    onSubmit,
    onResolve,
    footerMeta,
    error: externalError,
  } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  const action = useAsyncAction();
  const formId = `cubyt-form-${useId()}`;

  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await action.run(() => onSubmit?.(data, event));
    if (result.ok && result.value !== false) finish(result.value ?? Object.fromEntries(data));
  };

  const content = typeof children === "function" ? children({ busy: action.busy }) : children;
  const shownError = externalError ?? action.error;

  return h(
    Modal,
    {
      ...modal,
      dismissible: modal.dismissible !== false && !action.busy,
      title,
      lead,
      icon,
      footer: [
        footerMeta ? h("span", { key: "meta", className: "cubyt-modal__footer-meta" }, footerMeta) : null,
        h(
          "div",
          { key: "group", className: "cubyt-modal__footer-group" },
          cancelButton(cancelLabel, () => finish(undefined), action.busy),
          h(
            Button,
            {
              key: "submit",
              type: "submit",
              form: formId,
              variant: submitVariant ?? (modal.tone === "danger" ? "danger" : "primary"),
              iconEnd: submitIcon,
              disabled: submitDisabled,
              loading: action.busy,
            },
            submitLabel,
          ),
        ),
      ],
    },
    h(
      "form",
      { id: formId, onSubmit: submit, style: { display: "contents" } },
      content,
      shownError ? h(Notice, { tone: "danger" }, shownError) : null,
    ),
  );
}

/** Single-field form. Resolves with the entered string. */
export function PromptModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    label,
    hint,
    placeholder,
    defaultValue = "",
    inputType = "text",
    required = true,
    requiredMessage = "Este campo es obligatorio.",
    validate,
    mono,
    autoComplete = "off",
    confirmLabel = "Guardar",
    ...formProps
  } = rest;
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState(null);

  return h(
    FormModal,
    {
      ...modal,
      ...formProps,
      submitLabel: confirmLabel,
      onSubmit: async () => {
        const message =
          (required && !value.trim() ? requiredMessage : undefined) ?? (await validate?.(value));
        setError(message ?? null);
        return message ? false : value;
      },
    },
    h(
      Field,
      { label, hint, error },
      h(Input, {
        type: inputType,
        value,
        placeholder,
        mono,
        autoComplete,
        "data-autofocus": true,
        onChange: (event) => {
          setValue(event.target.value);
          if (error) setError(null);
        },
      }),
    ),
  );
}

/** Informational modal with a single acknowledgement button. */
export function AlertModal(props) {
  const [modal, rest] = splitModalProps(props);
  const { title, lead, icon, description, children, confirmLabel = "Entendido", onResolve } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  return h(
    Modal,
    {
      ...modal,
      title,
      lead,
      icon,
      footerAlign: "end",
      footer: h(
        Button,
        {
          variant: modal.tone === "danger" ? "danger" : "primary",
          onClick: () => finish(undefined),
          "data-autofocus": true,
        },
        confirmLabel,
      ),
    },
    description ? h("p", { className: "cubyt-modal__text" }, description) : null,
    children,
  );
}

const renderNotice = (notice) => {
  if (!notice) return null;
  if (notice.text === undefined && notice.title === undefined) return notice;
  return h(Notice, { tone: notice.tone ?? "success", title: notice.title, icon: notice.icon }, notice.text);
};

/** Read-only details as key/value rows, with an optional notice and primary action. */
export function DetailsModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    title,
    lead,
    icon,
    items = [],
    notice,
    children,
    primaryAction,
    secondaryAction,
    closeLabel: dismissLabel = "Cerrar",
    onResolve,
  } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  return h(
    Modal,
    {
      ...modal,
      title,
      lead,
      icon,
      footerAlign: primaryAction ? undefined : "end",
      footer: [
        secondaryAction
          ? renderAction(secondaryAction, finish, { variant: "secondary" })
          : h(Button, { key: "close", variant: "secondary", onClick: () => finish(undefined) }, dismissLabel),
        renderAction(primaryAction, finish),
      ],
    },
    items.length ? h(KeyValue, { items }) : null,
    children,
    renderNotice(notice),
  );
}

/** Action menu. Resolves with the chosen action `id`. Actions with `href` navigate. */
export function ActionsModal(props) {
  const [modal, rest] = splitModalProps(props);
  const { title, lead, icon, actions = [], children, cancelLabel = null, onSelect, onResolve } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  const listRef = useRef(null);

  return h(
    Modal,
    {
      ...modal,
      size: modal.size ?? "sm",
      title,
      lead,
      icon,
      footer: cancelLabel ? cancelButton(cancelLabel, () => finish(undefined)) : undefined,
      footerAlign: "stretch",
    },
    children,
    h(
      "ul",
      {
        ref: listRef,
        className: "cubyt-list",
        role: "menu",
        "aria-label": typeof title === "string" ? title : undefined,
        onKeyDown: (event) => moveFocus(event, listRef.current, '[role="menuitem"]:not(:disabled)'),
      },
      actions.map((action, index) =>
        action.separator
          ? h("li", { key: action.id ?? `sep-${index}`, role: "separator", className: "cubyt-list__separator" })
          : h(
              "li",
              { key: action.id, role: "none" },
              h(ListItem, {
                role: "menuitem",
                icon: action.icon,
                label: action.label,
                description: action.description,
                trailing: action.trailing ?? (action.href ? h(Icon, { name: action.external || action.newTab ? "external-link" : "chevron-right", size: 16 }) : undefined),
                tone: action.tone,
                disabled: action.disabled,
                href: action.href,
                external: action.external,
                newTab: action.newTab,
                "data-autofocus": index === 0 || undefined,
                onClick: async (event) => {
                  const result = await action.onClick?.(event);
                  if (result === false) return;
                  onSelect?.(action.id);
                  finish(action.id);
                },
              }),
            ),
      ),
    ),
  );
}

function moveFocus(event, root, selector) {
  if (!root || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = [...root.querySelectorAll(selector)];
  if (!items.length) return;
  event.preventDefault();
  const current = items.indexOf(document.activeElement);
  let next = current;
  if (event.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % items.length;
  if (event.key === "ArrowUp") next = current <= 0 ? items.length - 1 : current - 1;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = items.length - 1;
  items[next]?.focus();
}

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Pick one or many options (language, timezone, role, filters...). Resolves with
 * the selected value (or array when `multiple`). `variant: "chips"` for short lists.
 */
export function SelectModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    title,
    lead,
    icon,
    options = [],
    value,
    defaultValue,
    multiple = false,
    variant = "list",
    searchable = options.length > 7,
    searchPlaceholder = "Buscar…",
    emptyLabel = "Sin resultados",
    confirmLabel = "Aplicar",
    cancelLabel,
    autoConfirm = false,
    required = !multiple,
    onChange,
    onResolve,
    children,
  } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  const [draft, setDraft] = useState(() => value ?? defaultValue ?? (multiple ? [] : undefined));
  const [query, setQuery] = useState("");
  const listRef = useRef(null);
  const listId = `cubyt-select-${useId()}`;

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return options;
    return options.filter((option) =>
      normalize(`${option.label} ${option.description ?? ""} ${(option.keywords ?? []).join(" ")}`).includes(needle),
    );
  }, [options, query]);

  const isSelected = (optionValue) => (multiple ? draft.includes(optionValue) : draft === optionValue);
  const apply = (next = draft) => {
    onChange?.(next);
    finish(next);
  };
  const pick = (optionValue) => {
    if (!multiple) {
      setDraft(optionValue);
      if (autoConfirm) apply(optionValue);
      return;
    }
    setDraft((current) =>
      current.includes(optionValue) ? current.filter((item) => item !== optionValue) : [...current, optionValue],
    );
  };
  const hasSelection = multiple ? draft.length > 0 : draft !== undefined;

  const list =
    variant === "chips"
      ? h(ChipGroup, {
          options,
          value: draft,
          multiple,
          label: typeof title === "string" ? title : undefined,
          onChange: (next) => (multiple ? setDraft(next) : pick(next)),
        })
      : visible.length
        ? h(
            "ul",
            {
              ref: listRef,
              id: listId,
              className: "cubyt-list",
              role: "listbox",
              "aria-multiselectable": multiple || undefined,
              "aria-label": typeof title === "string" ? title : undefined,
              onKeyDown: (event) => moveFocus(event, listRef.current, '[role="option"]:not(:disabled)'),
            },
            visible.map((option) =>
              h(
                "li",
                { key: option.value, role: "none" },
                h(ListItem, {
                  role: "option",
                  icon: option.icon,
                  label: option.label,
                  description: option.description,
                  trailing: option.trailing,
                  selected: isSelected(option.value),
                  disabled: option.disabled,
                  onClick: () => pick(option.value),
                }),
              ),
            ),
          )
        : h("p", { className: "cubyt-modal-empty" }, emptyLabel);

  return h(
    Modal,
    {
      ...modal,
      title,
      lead,
      icon,
      footer:
        autoConfirm && !multiple
          ? cancelButton(cancelLabel, () => finish(undefined))
          : [
              cancelButton(cancelLabel, () => finish(undefined)),
              h(
                Button,
                { key: "apply", disabled: required && !hasSelection, onClick: () => apply() },
                confirmLabel,
              ),
            ],
      footerAlign: autoConfirm && !multiple ? "end" : undefined,
    },
    children,
    searchable && variant !== "chips"
      ? h(Input, {
          type: "search",
          icon: "search",
          value: query,
          placeholder: searchPlaceholder,
          "aria-controls": listId,
          "data-autofocus": true,
          onChange: (event) => setQuery(event.target.value),
          onKeyDown: (event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              listRef.current?.querySelector('[role="option"]:not(:disabled)')?.focus();
            }
          },
        })
      : null,
    list,
  );
}

function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Copyable secrets: backup code grids, API keys, DNS records. */
export function CodeModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    title,
    lead,
    icon,
    codes,
    values = [],
    notice,
    children,
    copyAllLabel = "Copiar todo",
    copiedLabel = "Copiado",
    downloadLabel = "Descargar",
    downloadName,
    doneLabel = "Listo",
    onResolve,
  } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  const [copied, setCopied] = useState(false);
  const allText = (codes ?? values.map((item) => `${item.label ? `${item.label}: ` : ""}${item.value}`)).join("\n");

  return h(
    Modal,
    {
      ...modal,
      title,
      lead,
      icon,
      footer: [
        h(
          "div",
          { key: "secondary", className: "cubyt-modal__footer-group", style: { marginLeft: 0 } },
          h(
            Button,
            {
              key: "copy",
              variant: "secondary",
              icon: copied ? "check" : "copy",
              onClick: async () => setCopied(await copyText(allText)),
            },
            copied ? copiedLabel : copyAllLabel,
          ),
          downloadName
            ? h(
                Button,
                { key: "download", variant: "secondary", icon: "download", onClick: () => downloadText(downloadName, allText) },
                downloadLabel,
              )
            : null,
        ),
        h(Button, { key: "done", onClick: () => finish(undefined), "data-autofocus": true }, doneLabel),
      ],
    },
    codes?.length ? h("div", { className: "cubyt-code-grid" }, codes.map((code) => h("span", { key: code }, code))) : null,
    values.map((item, index) => h(CodeBlock, { key: item.label ?? index, ...item })),
    children,
    renderNotice(notice),
  );
}

/** Rows with metadata and per-row actions (invoices, members, organizations). */
export function ListModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    title,
    lead,
    icon,
    items = [],
    emptyLabel = "No hay elementos todavía.",
    children,
    primaryAction,
    closeLabel: dismissLabel = "Cerrar",
    onResolve,
  } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);

  return h(
    Modal,
    {
      ...modal,
      title,
      lead,
      icon,
      footerAlign: primaryAction ? undefined : "end",
      footer: [
        h(Button, { key: "close", variant: "secondary", onClick: () => finish(undefined) }, dismissLabel),
        renderAction(primaryAction, finish),
      ],
    },
    children,
    items.length
      ? h(
          "ul",
          { className: "cubyt-list" },
          items.map((item) =>
            h(
              "li",
              { key: item.id },
              h(ListItem, {
                icon: item.avatar
                  ? h("img", { src: item.avatar, alt: "", width: 32, height: 32, style: { borderRadius: 10, objectFit: "cover" } })
                  : item.icon,
                label: item.title,
                description: item.description,
                href: item.href,
                onClick: item.onClick,
                trailing: [
                  item.meta ? h("span", { key: "meta" }, item.meta) : null,
                  ...(item.actions ?? []).map((action) =>
                    action.icon && !action.showLabel
                      ? h(IconButton, {
                          key: action.label,
                          icon: action.icon,
                          label: action.label,
                          variant: "ghost",
                          onClick: (event) => {
                            event.stopPropagation();
                            action.onClick?.(event);
                          },
                        })
                      : h(
                          Button,
                          {
                            key: action.label,
                            size: "sm",
                            variant: action.tone === "danger" ? "danger" : "secondary",
                            icon: action.icon,
                            href: action.href,
                            newTab: action.newTab,
                            onClick: (event) => {
                              event.stopPropagation();
                              action.onClick?.(event);
                            },
                          },
                          action.label,
                        ),
                  ),
                ],
              }),
            ),
          ),
        )
      : h("p", { className: "cubyt-modal-empty" }, emptyLabel),
  );
}

function ResultBlock({ tone = "success", icon, title, message }) {
  const context = useModalContext();
  return h(
    "div",
    { className: "cubyt-result", "data-tone": tone, role: "status" },
    h("span", { className: "cubyt-result__icon" }, renderIcon(icon ?? (tone === "danger" ? "alert-circle" : "check-circle"), 24)),
    h("h2", { id: context.titleId, className: "cubyt-result__title" }, title),
    message ? h("p", { className: "cubyt-result__text" }, message) : null,
  );
}

/** Success or error outcome with a single call to action. */
export function ResultModal(props) {
  const [modal, rest] = splitModalProps(props);
  const { tone = "success", icon, title, message, children, action, closeLabel: dismissLabel = "Cerrar", onResolve } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  return h(
    Modal,
    { ...modal, size: modal.size ?? "sm", tone: tone === "danger" ? "danger" : "default" },
    h(ModalBody, null, h(ResultBlock, { tone, icon, title, message }), children),
    h(
      ModalFooter,
      { align: "stretch" },
      action
        ? [
            h(Button, { key: "close", variant: "secondary", onClick: () => finish(undefined) }, dismissLabel),
            renderAction({ ...action, key: "action" }, finish),
          ]
        : h(Button, { onClick: () => finish(undefined), "data-autofocus": true }, dismissLabel),
    ),
  );
}

/**
 * Long-running task (export, download, save). `status` moves from `running` to
 * `success` or `error`; omit `progress` for an indeterminate bar.
 */
export function ProgressModal(props) {
  const [modal, rest] = splitModalProps(props);
  const {
    title,
    lead,
    icon,
    status = "running",
    progress,
    label = "Procesando…",
    message,
    successTitle = "Listo",
    successMessage,
    errorTitle = "Algo salió mal",
    errorMessage: failureMessage,
    resultAction,
    retryLabel = "Reintentar",
    onRetry,
    cancelLabel = "Cancelar",
    onCancel,
    closeLabel: dismissLabel = "Cerrar",
    onResolve,
    children,
  } = rest;
  const finish = useFinish(modal.onOpenChange, onResolve);
  const running = status === "running";
  const percent = typeof progress === "number" ? Math.round(progress) : undefined;

  const footer = running
    ? onCancel
      ? h(Button, { variant: "secondary", onClick: () => { onCancel(); finish(undefined); } }, cancelLabel)
      : null
    : status === "error"
      ? [
          h(Button, { key: "close", variant: "secondary", onClick: () => finish(undefined) }, dismissLabel),
          onRetry ? h(Button, { key: "retry", onClick: onRetry, "data-autofocus": true }, retryLabel) : null,
        ]
      : [
          h(Button, { key: "close", variant: "secondary", onClick: () => finish(undefined) }, dismissLabel),
          renderAction(resultAction, finish),
        ];

  return h(
    Modal,
    {
      ...modal,
      tone: status === "error" ? "danger" : modal.tone,
      dismissible: !running || !!onCancel,
      title: running ? (title ?? "") : undefined,
      lead: running ? lead : undefined,
      icon: running ? icon : undefined,
      footer: running ? footer ?? undefined : undefined,
      footerAlign: running ? "end" : undefined,
    },
    running
      ? [
          h(
            "div",
            { key: "status", className: "cubyt-progress-status" },
            h("span", null, label),
            percent !== undefined ? h("strong", null, `${percent}%`) : null,
          ),
          h(Progress, { key: "bar", value: percent ?? 0, indeterminate: percent === undefined, label }),
          message ? h("p", { key: "message", className: "cubyt-modal__text" }, message) : null,
          children,
        ]
      : null,
    !running
      ? [
          h(
            ModalBody,
            { key: "result" },
            h(ResultBlock, {
              tone: status === "error" ? "danger" : "success",
              title: status === "error" ? errorTitle : successTitle,
              message: status === "error" ? failureMessage : successMessage,
            }),
          ),
          h(ModalFooter, { key: "footer", align: "stretch" }, footer),
        ]
      : null,
  );
}
