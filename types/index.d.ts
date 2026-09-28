import type { IconName, LinkOptions } from "@cubyt/ui";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";
export type ModalTone = "default" | "danger" | "info" | "warning" | "neutral";
export type ModalPlacement = "center" | "top" | "sheet" | "side";
export type DismissReason =
  | "escape"
  | "backdrop"
  | "close-button"
  | "resolved"
  | "programmatic"
  | (string & {});

/* Stack */

export type ModalStackEntry = { id: string } & Record<string, unknown>;

export interface ModalStack {
  push(data?: Record<string, unknown>): string;
  remove(id: string): ModalStackEntry | undefined;
  get(id: string): ModalStackEntry | undefined;
  top(): ModalStackEntry | undefined;
  isTop(id: string): boolean;
  list(): ModalStackEntry[];
  readonly size: number;
  subscribe(listener: (entries: ModalStackEntry[]) => void): () => void;
}

export declare function createModalStack(): ModalStack;

/* Manager */

export type MountOptions = {
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  /** Element or selector to focus on open. Defaults to `[data-autofocus]`. */
  initialFocus?: HTMLElement | string | null;
  /**
   * Called when the user asks to close the top-most modal. Return `false` to decline;
   * the dialog is re-opened if the browser already closed it natively.
   */
  onDismiss?: (reason: DismissReason) => boolean | void | Promise<unknown>;
};

export interface ModalManager {
  /** Show a `<dialog>` as a modal and register it on the stack. Returns its id. */
  mount(dialog: HTMLDialogElement, options?: MountOptions): string;
  /** Play the exit animation, close the dialog and restore focus. */
  unmount(id: string, options?: { immediate?: boolean }): Promise<void>;
  dismiss(id: string, reason?: DismissReason): void;
  dismissTop(reason?: DismissReason): void;
  dismissAll(reason?: DismissReason): void;
  isTop(id: string): boolean;
  subscribe(listener: (entries: ModalStackEntry[]) => void): () => void;
  readonly size: number;
}

export declare function createModalManager(defaults?: MountOptions): ModalManager;
export declare const modalManager: ModalManager;

/* Vanilla renderer */

export type ModalAction = Partial<LinkOptions> & {
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  iconEnd?: IconName;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Value passed to `close()` when clicked. */
  value?: unknown;
  /** Set to `false` to keep the modal open after the click. */
  close?: boolean;
  /** May be async. Returning `false` keeps the modal open; other values become the result. */
  onClick?: (
    event: MouseEvent,
    ctx: { close: (value?: unknown) => void; dialog: HTMLDialogElement },
  ) => unknown;
};

export type ModalMediaOptions =
  | { type: "image"; src: string; alt?: string; aspect?: string; fit?: "cover" | "contain" }
  | {
      type: "video";
      src: string;
      poster?: string;
      aspect?: string;
      title?: string;
      autoplay?: boolean;
      muted?: boolean;
      loop?: boolean;
      allowedHosts?: string[];
    }
  | {
      type: "embed";
      src: string;
      title?: string;
      height?: number;
      sandbox?: string;
      allowedHosts?: string[];
    };

type BodyContent = string | Node | null | undefined | false | BodyContent[];

export type ModalOptions = {
  title?: string;
  lead?: string;
  ariaLabel?: string;
  body?:
    | BodyContent
    | ((ctx: {
        close: (value?: unknown) => void;
        dialog: HTMLDialogElement;
        panel: HTMLElement;
      }) => BodyContent);
  media?: ModalMediaOptions;
  actions?: ModalAction[];
  size?: ModalSize;
  tone?: ModalTone;
  placement?: ModalPlacement;
  /** Show the close button and allow Escape/backdrop dismissal. Defaults to `true`. */
  dismissible?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  closeLabel?: string;
  footerAlign?: "end" | "stretch";
  className?: string;
  initialFocus?: HTMLElement | string;
  container?: HTMLElement;
  onClose?: (value: unknown) => void;
};

export type ModalHandle<T = unknown> = {
  id: string;
  dialog: HTMLDialogElement;
  buttons: HTMLElement[];
  /** Resolves with the close value (`undefined` when dismissed). */
  closed: Promise<T | undefined>;
  close(value?: T): Promise<void>;
};

export declare function renderModal(
  options: ModalOptions,
  ctx?: { close?: (value?: unknown) => void },
): { dialog: HTMLDialogElement; panel: HTMLElement; body: HTMLElement; buttons: HTMLElement[]; titleId: string };

export declare function openModal<T = unknown>(
  options: ModalOptions,
  manager?: ModalManager,
): ModalHandle<T>;

export type ConfirmOptions = Omit<ModalOptions, "actions" | "body"> & {
  description?: string;
  body?: BodyContent;
  warningTitle?: string;
  warning?: string;
  /** Text the user must type to enable the confirm button (e.g. "REMOVER"). */
  confirmText?: string;
  confirmHint?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmIcon?: IconName;
  /** May be async; return `false` to keep the modal open. */
  onConfirm?: () => unknown;
};

export type PromptOptions = Omit<ModalOptions, "actions" | "body"> & {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  inputType?: string;
  autocomplete?: string;
  required?: boolean;
  requiredMessage?: string;
  /** Return an error message to block submission. */
  validate?: (value: string) => string | undefined;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type AlertOptions = Omit<ModalOptions, "actions" | "body"> & {
  description?: string;
  body?: BodyContent;
  confirmLabel?: string;
};

export declare function confirm(options: ConfirmOptions, manager?: ModalManager): Promise<boolean>;
export declare function prompt(options: PromptOptions, manager?: ModalManager): Promise<string | null>;
export declare function alert(options: AlertOptions, manager?: ModalManager): Promise<void>;

/* URL-synced modals */

export type ModalRouteOptions = {
  /** Query parameter name. Defaults to `modal`. */
  param?: string;
  /** SPA navigation event to listen for. Defaults to `cubyt:navigate`. */
  eventName?: string;
};

export declare const MODAL_ROUTE_EVENT: "cubyt:modal-route";
export declare function getModalRoute(options?: ModalRouteOptions): string | null;
export declare function modalRouteHref(name: string, options?: ModalRouteOptions & { base?: string }): string;
export declare function openModalRoute(name: string, options?: ModalRouteOptions & { replace?: boolean }): void;
export declare function closeModalRoute(options?: ModalRouteOptions): void;
export declare function subscribeModalRoute(
  listener: (name: string | null) => void,
  options?: ModalRouteOptions,
): () => void;
export declare function bindModalRoute(
  name: string,
  open: () => ModalHandle,
  options?: ModalRouteOptions,
): () => void;

/* Media helpers */

export type VideoSource = {
  kind: "embed" | "file";
  provider: "youtube" | "vimeo" | "custom" | "file";
  src: string;
};

export declare const DEFAULT_VIDEO_HOSTS: readonly string[];
export declare function isHostAllowed(hostname: string, allowedHosts?: string[]): boolean;
export declare function resolveVideoSource(
  src: string,
  options?: { allowedHosts?: string[]; autoplay?: boolean; muted?: boolean; loop?: boolean },
): VideoSource;
export declare function resolveEmbedSource(src: string, options?: { allowedHosts?: string[] }): string;
export declare function resolveImageSource(src: string): string;

export type CommandItem = {
  id: string;
  label: string;
  description?: string;
  group?: string;
  keywords?: string[];
  disabled?: boolean;
};

export declare function filterCommands<T extends CommandItem>(items: T[], query: string): T[];
export declare function shouldShowPromo(key: string, storage?: Pick<Storage, "getItem">): boolean;
export declare function dismissPromo(key: string, storage?: Pick<Storage, "setItem">): void;
