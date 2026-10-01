import type {
  ComponentType,
  CSSProperties,
  KeyboardEventHandler,
  ReactElement,
  ReactNode,
  Ref,
} from "react";
import type { Action } from "@cubyt/ui";
import type { ButtonVariant, IconSlot, KeyValueItem, Tone } from "@cubyt/ui/react";
import type {
  CommandItem,
  DismissReason,
  ModalManager,
  ModalPlacement,
  ModalRouteOptions,
  ModalSize,
  ModalTone,
} from "./index.js";

export type { DismissReason, ModalPlacement, ModalSize, ModalTone };
export { dismissPromo, shouldShowPromo } from "./index.js";

/** Props shared by `<Modal>` and every preset. */
export type BaseModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean, reason?: DismissReason) => void;
  /** Called after the exit animation finishes and the dialog is removed. */
  onClosed?: () => void;
  size?: ModalSize;
  tone?: ModalTone;
  placement?: ModalPlacement;
  variant?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  /** Close button + Escape + backdrop. Defaults to `true`. */
  dismissible?: boolean;
  initialFocus?: HTMLElement | string;
  /** Render in place without a portal or `showModal()` (docs, previews, SSR tests). */
  inline?: boolean;
  className?: string;
  manager?: ModalManager;
  container?: HTMLElement;
  ariaLabel?: string;
  closeLabel?: string;
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>;
};

/** Props injected by `useModal().open()`; call `onResolve(value)` to return a result. */
export type ResolvableProps<T = unknown> = {
  onResolve?: (value: T | undefined) => void;
};

export type ModalProps = BaseModalProps & {
  title?: ReactNode;
  lead?: ReactNode;
  eyebrow?: ReactNode;
  icon?: IconSlot;
  headerActions?: ReactNode;
  media?: ModalMediaProps;
  footer?: ReactNode;
  footerAlign?: "end" | "stretch";
  children?: ReactNode;
};

export type ModalMediaProps = {
  kind?: "image" | "video" | "embed";
  aspect?: string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export declare function Modal(props: ModalProps): ReactElement | null;
/** Side-panel layout preset for detail views and focused editing flows. */
export declare function DrawerModal(props: ModalProps): ReactElement | null;
/** Bottom-sheet layout preset for compact mobile-first flows. */
export declare function SheetModal(props: ModalProps): ReactElement | null;
export declare namespace Modal {
  const Header: typeof ModalHeader;
  const Body: typeof ModalBody;
  const Footer: typeof ModalFooter;
  const Media: typeof ModalMedia;
  const Close: typeof ModalCloseButton;
}

export declare function ModalHeader(props: {
  title?: ReactNode;
  lead?: ReactNode;
  eyebrow?: ReactNode;
  icon?: IconSlot;
  actions?: ReactNode;
  /** Show the close button. Defaults to `true`. */
  close?: boolean;
  align?: "start";
  className?: string;
  children?: ReactNode;
}): ReactElement;
export declare function ModalBody(props: {
  flush?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}): ReactElement;
export declare function ModalFooter(props: {
  align?: "end" | "stretch";
  meta?: ReactNode;
  className?: string;
  children?: ReactNode;
}): ReactElement;
export declare function ModalMedia(props: ModalMediaProps): ReactElement;
export declare function ModalCloseButton(props: {
  className?: string;
  variant?: "overlay" | "ghost";
}): ReactElement | null;

export declare function useModalContext(): {
  titleId: string;
  leadId: string;
  tone: ModalTone;
  dismissible: boolean;
  closeLabel: string;
  open: boolean;
  close: (reason?: DismissReason) => void;
};

export declare function splitModalProps<P extends Record<string, unknown>>(
  props: P,
): [BaseModalProps, Omit<P, keyof BaseModalProps>];

/* Provider */

export type ModalPromise<T> = Promise<T | undefined> & {
  id: string;
  close: (value?: T) => void;
  update: (props: Record<string, unknown>) => void;
};

/** Props accepted by `useModal().open()` for a component (injected props removed). */
export type ModalOpenProps<P> = Omit<P, "open" | "onOpenChange" | "onResolve" | "onClosed">;
/** Value a modal component resolves with, taken from its `onResolve` prop. */
export type ModalResult<P> = P extends { onResolve?: (value: infer T) => void } ? Exclude<T, undefined> : unknown;

export interface ModalApi {
  open<P extends object>(
    Component: ComponentType<P>,
    ...props: {} extends ModalOpenProps<P> ? [props?: ModalOpenProps<P>] : [props: ModalOpenProps<P>]
  ): ModalPromise<ModalResult<P>>;
  close(id: string, value?: unknown): void;
  update(id: string, props: Record<string, unknown>): void;
  closeAll(): void;
  confirm(options: Omit<ConfirmModalProps & Partial<DangerModalProps>, keyof ResolvableProps>): Promise<boolean>;
  prompt(options: Omit<PromptModalProps, keyof ResolvableProps>): Promise<string | null>;
  alert(options: Omit<AlertModalProps, keyof ResolvableProps>): Promise<void>;
}

export declare function ModalProvider(props: {
  manager?: ModalManager;
  children?: ReactNode;
}): ReactElement;
export declare function useModal(): ModalApi;

export declare function useModalRoute(
  name: string,
  options?: ModalRouteOptions,
): {
  open: boolean;
  openModal: (options?: { replace?: boolean }) => void;
  closeModal: () => void;
  getHref: () => string;
  modalProps: { open: boolean; onOpenChange: (open: boolean) => void };
};

/* Presets */

export type FooterAction = Action & {
  label: ReactNode;
  key?: string;
  variant?: ButtonVariant;
  icon?: IconSlot;
  iconEnd?: IconSlot;
  disabled?: boolean;
  loading?: boolean;
  autoFocus?: boolean;
  /** Resolved value when clicked. Defaults to the `onClick` result. */
  value?: unknown;
  /** Set to `false` to keep the modal open. */
  close?: boolean;
};

type HeaderProps = { title?: ReactNode; lead?: ReactNode; icon?: IconSlot };
type Preset<P, T = unknown> = (props: BaseModalProps & ResolvableProps<T> & P) => ReactElement | null;

export type ConfirmModalProps = BaseModalProps &
  ResolvableProps<boolean> &
  HeaderProps & {
    description?: ReactNode;
    children?: ReactNode;
    confirmLabel?: ReactNode;
    /** `null` hides the cancel button. */
    cancelLabel?: ReactNode | null;
    confirmIcon?: IconSlot;
    confirmVariant?: ButtonVariant;
    /** May be async. Return `false` to keep open; thrown errors are shown inline. */
    onConfirm?: () => unknown;
    onCancel?: () => void;
  };
export declare const ConfirmModal: Preset<Omit<ConfirmModalProps, keyof BaseModalProps>, boolean>;

export type DangerModalProps = Omit<ConfirmModalProps, "confirmVariant"> & {
  warningTitle?: ReactNode;
  warning?: ReactNode;
  /** Text the user must type to enable the action (e.g. "REMOVER"). */
  confirmText?: string;
  confirmHint?: ReactNode;
};
export declare const DangerModal: Preset<Omit<DangerModalProps, keyof BaseModalProps>, boolean>;

export type FormModalProps<T = unknown> = BaseModalProps &
  ResolvableProps<T> &
  HeaderProps & {
    children?: ReactNode | ((state: { busy: boolean }) => ReactNode);
    submitLabel?: ReactNode;
    cancelLabel?: ReactNode | null;
    submitIcon?: IconSlot;
    submitVariant?: ButtonVariant;
    submitDisabled?: boolean;
    footerMeta?: ReactNode;
    error?: ReactNode;
    /** May be async. The return value resolves the modal; `false` keeps it open. */
    onSubmit?: (data: FormData, event: SubmitEvent | React.FormEvent<HTMLFormElement>) => T | false | Promise<T | false>;
  };
export declare function FormModal<T = unknown>(props: FormModalProps<T>): ReactElement | null;

export type PromptModalProps = Omit<FormModalProps<string>, "children" | "onSubmit" | "submitLabel"> & {
  label?: ReactNode;
  hint?: ReactNode;
  placeholder?: string;
  defaultValue?: string;
  inputType?: string;
  required?: boolean;
  requiredMessage?: string;
  validate?: (value: string) => string | undefined | Promise<string | undefined>;
  mono?: boolean;
  autoComplete?: string;
  confirmLabel?: ReactNode;
};
export declare const PromptModal: Preset<Omit<PromptModalProps, keyof BaseModalProps>, string>;

export type AlertModalProps = BaseModalProps &
  ResolvableProps<void> &
  HeaderProps & { description?: ReactNode; children?: ReactNode; confirmLabel?: ReactNode };
export declare const AlertModal: Preset<Omit<AlertModalProps, keyof BaseModalProps>, void>;

export type NoticeProps = { tone?: Tone; title?: ReactNode; text?: ReactNode; icon?: IconSlot | false };

export declare const DetailsModal: Preset<
  HeaderProps & {
    items?: KeyValueItem[];
    notice?: NoticeProps | ReactNode;
    children?: ReactNode;
    primaryAction?: FooterAction;
    secondaryAction?: FooterAction;
    closeLabel?: string;
  }
>;

export type ActionItem = Action & {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: IconSlot;
  tone?: "danger";
  trailing?: ReactNode;
  disabled?: boolean;
  separator?: false;
};

export declare const ActionsModal: Preset<
  HeaderProps & {
    actions?: Array<ActionItem | { id?: string; separator: true }>;
    children?: ReactNode;
    cancelLabel?: ReactNode | null;
    onSelect?: (id: string) => void;
  },
  string
>;

export type SelectOption<V extends string = string> = {
  value: V;
  label: ReactNode;
  description?: ReactNode;
  icon?: IconSlot;
  trailing?: ReactNode;
  keywords?: string[];
  disabled?: boolean;
};

export declare function SelectModal<V extends string = string>(
  props: BaseModalProps &
    ResolvableProps<V | V[]> &
    HeaderProps & {
      options?: SelectOption<V>[];
      value?: V | V[];
      defaultValue?: V | V[];
      multiple?: boolean;
      variant?: "list" | "chips";
      searchable?: boolean;
      searchPlaceholder?: string;
      emptyLabel?: ReactNode;
      confirmLabel?: ReactNode;
      cancelLabel?: ReactNode | null;
      /** Single select: resolve as soon as an option is picked. */
      autoConfirm?: boolean;
      required?: boolean;
      onChange?: (value: V | V[]) => void;
      children?: ReactNode;
    },
): ReactElement | null;

export declare const CodeModal: Preset<
  HeaderProps & {
    /** Short codes shown in a two-column grid (backup codes). */
    codes?: string[];
    /** Labeled copyable values (API keys, DNS records). */
    values?: Array<{ label?: ReactNode; value: string; masked?: boolean }>;
    notice?: NoticeProps | ReactNode;
    children?: ReactNode;
    copyAllLabel?: ReactNode;
    copiedLabel?: ReactNode;
    downloadLabel?: ReactNode;
    /** Enables a "download as .txt" button with this file name. */
    downloadName?: string;
    doneLabel?: ReactNode;
  }
>;

export type ListItemData = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  icon?: IconSlot;
  avatar?: string;
  href?: string;
  onClick?: () => void;
  actions?: Array<{
    label: string;
    icon?: IconSlot;
    showLabel?: boolean;
    tone?: "danger";
    href?: string;
    newTab?: boolean;
    onClick?: (event: React.MouseEvent) => void;
  }>;
};

export declare const ListModal: Preset<
  HeaderProps & {
    items?: ListItemData[];
    emptyLabel?: ReactNode;
    children?: ReactNode;
    primaryAction?: FooterAction;
    closeLabel?: string;
  }
>;

export declare const ResultModal: Preset<{
  tone?: "success" | "danger";
  icon?: IconSlot;
  title: ReactNode;
  message?: ReactNode;
  children?: ReactNode;
  action?: FooterAction;
  closeLabel?: string;
}>;

export declare const ProgressModal: Preset<
  HeaderProps & {
    status?: "running" | "success" | "error";
    /** 0-100. Omit for an indeterminate bar. */
    progress?: number;
    label?: ReactNode;
    message?: ReactNode;
    successTitle?: ReactNode;
    successMessage?: ReactNode;
    errorTitle?: ReactNode;
    errorMessage?: ReactNode;
    resultAction?: FooterAction;
    retryLabel?: ReactNode;
    onRetry?: () => void;
    cancelLabel?: ReactNode;
    /** Makes the running state dismissible and shows a cancel button. */
    onCancel?: () => void;
    closeLabel?: string;
    children?: ReactNode;
  }
>;

/* Media */

export type MediaSource =
  | { type: "image"; src: string; alt?: string; fit?: "cover" | "contain"; aspect?: string }
  | {
      type: "video";
      src: string;
      poster?: string;
      tracks?: VideoTrack[];
      autoplay?: boolean;
      muted?: boolean;
      loop?: boolean;
      controls?: boolean;
      allowedHosts?: string[];
      title?: string;
      aspect?: string;
    }
  | { type: "embed"; src: string; allowedHosts?: string[]; sandbox?: string; allow?: string; title?: string; aspect?: string };

export type VideoTrack = {
  src: string;
  srclang: string;
  label: string;
  kind?: "captions" | "subtitles" | "descriptions" | "chapters";
  default?: boolean;
};

export declare function MediaElement(props: {
  media: MediaSource;
  /** Embeds render only while active (stops playback on close). */
  active?: boolean;
  videoRef?: Ref<HTMLVideoElement>;
  fallbackLabel?: ReactNode;
}): ReactElement | null;

export declare const ImageModal: Preset<{
  src: string;
  /** Required for accessibility; use "" only for decorative images. */
  alt: string;
  aspect?: string;
  fit?: "cover" | "contain";
  badge?: ReactNode;
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  primaryAction?: FooterAction;
  secondaryAction?: FooterAction;
}>;

export type GalleryImage = { src: string; alt?: string; caption?: ReactNode; thumbnail?: string };

export type GalleryModalProps = {
  images?: GalleryImage[];
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  loop?: boolean;
  showThumbnails?: boolean;
  title?: ReactNode;
  lead?: ReactNode;
  aspect?: string;
  immersive?: boolean;
  prevLabel?: string;
  nextLabel?: string;
  children?: ReactNode;
};
export declare const GalleryModal: Preset<GalleryModalProps>;
export declare const LightboxModal: Preset<Omit<GalleryModalProps, "immersive">>;

export declare const VideoModal: Preset<{
  /** YouTube/Vimeo URL, allowlisted embed URL, or a direct video file. */
  src: string;
  poster?: string;
  tracks?: VideoTrack[];
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  allowedHosts?: string[];
  aspect?: string;
  title?: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  primaryAction?: FooterAction;
  fallbackLabel?: ReactNode;
}>;

export declare const EmbedModal: Preset<{
  src: string;
  title?: ReactNode;
  lead?: ReactNode;
  /** Hosts allowed for the iframe (`*.example.com` wildcards supported). */
  allowedHosts?: string[];
  height?: number;
  sandbox?: string;
  allow?: string;
  openInNewTabLabel?: ReactNode | null;
  fallbackLabel?: ReactNode;
}>;

export type Step = {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  content?: ReactNode | ((ctx: { index: number; goTo: (index: number) => void }) => ReactNode);
  media?: MediaSource;
  /** Return `false` or an error message to block "next". May be async. */
  validate?: () => boolean | string | void | Promise<boolean | string | void>;
};

export declare const StepsModal: Preset<{
  steps?: Step[];
  initialStep?: number;
  onStepChange?: (index: number, id?: string) => void;
  onFinish?: () => unknown;
  finishLabel?: ReactNode;
  nextLabel?: ReactNode;
  backLabel?: ReactNode;
  skipLabel?: ReactNode;
  stepLabel?: (current: number, total: number) => ReactNode;
}>;

export declare const PromoModal: Preset<{
  media?: MediaSource;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  primaryAction?: FooterAction;
  secondaryAction?: FooterAction;
  /** Enables "don't show again" persisted in localStorage. */
  dismissKey?: string;
  dontShowAgainLabel?: ReactNode | null;
}>;

export type CommandPaletteItem = CommandItem &
  Action & {
    icon?: IconSlot;
    shortcut?: string | string[];
    /** Return `false` to keep the palette open. */
    onSelect?: (item: CommandPaletteItem) => unknown;
  };

export declare const CommandModal: Preset<
  {
    items?: CommandPaletteItem[];
    placeholder?: string;
    emptyLabel?: ReactNode;
    filter?: (items: CommandPaletteItem[], query: string) => CommandPaletteItem[];
    onSelect?: (item: CommandPaletteItem) => void;
    hints?: { navigate: ReactNode; select: ReactNode; close: ReactNode } | null;
  },
  string
>;

export declare function useCommandShortcut(
  callback: (event: KeyboardEvent) => void,
  options?: { key?: string; enabled?: boolean },
): void;
