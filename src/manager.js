import { createModalStack } from "./stack.js";

const CLOSE_FALLBACK_MS = 260;

const prefersReducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

let scrollLocks = 0;
let savedBodyStyle = { overflow: "", paddingRight: "" };

function lockScroll() {
  if (scrollLocks++ > 0) return;
  const { body, documentElement: root } = document;
  const scrollbar = window.innerWidth - root.clientWidth;
  savedBodyStyle = {
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
  };
  body.style.overflow = "hidden";
  if (scrollbar > 0) {
    const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + scrollbar}px`;
  }
  root.dataset.cubytModalOpen = "true";
}

function unlockScroll() {
  if (scrollLocks === 0 || --scrollLocks > 0) return;
  const { body, documentElement: root } = document;
  body.style.overflow = savedBodyStyle.overflow;
  body.style.paddingRight = savedBodyStyle.paddingRight;
  delete root.dataset.cubytModalOpen;
}

function waitForExitAnimation(dialog) {
  return new Promise((resolve) => {
    const panel = dialog.querySelector(".cubyt-modal__panel") ?? dialog;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      panel.removeEventListener("animationend", onEnd);
      resolve();
    };
    const onEnd = (event) => {
      if (event.target === panel) finish();
    };
    panel.addEventListener("animationend", onEnd);
    const timer = setTimeout(finish, CLOSE_FALLBACK_MS);
  });
}

function resolveFocusTarget(dialog, initialFocus) {
  if (!initialFocus) return dialog.querySelector("[data-autofocus]");
  if (typeof initialFocus === "string") return dialog.querySelector(initialFocus);
  return initialFocus;
}

/**
 * Manage native `<dialog>` elements as a stack: top layer, focus trap, scroll lock,
 * Escape/backdrop dismissal for the top-most modal, and focus restoration on close.
 */
export function createModalManager(defaults = {}) {
  const stack = createModalStack();
  const dialogStates = new WeakMap();

  function releaseDialogState(dialog, state) {
    if (state.id !== null || state.suppressedCloseEvents > 0) return;
    dialog.removeEventListener("close", state.onClose);
    dialogStates.delete(dialog);
  }

  function getDialogState(dialog) {
    let state = dialogStates.get(dialog);
    if (state) return state;

    // Native close events are queued. Keep one listener per dialog element so a
    // close requested during an effect cleanup can be distinguished from a
    // user close even if React remounts the same element before dispatch.
    state = { id: null, suppressedCloseEvents: 0, onClose: null };
    state.onClose = () => {
      if (state.suppressedCloseEvents > 0) {
        state.suppressedCloseEvents -= 1;
        releaseDialogState(dialog, state);
        return;
      }

      const entry = stack.get(state.id);
      if (!entry || entry.closing) return;
      const settings = entry.settings;
      const allowed = stack.isTop(entry.id) && settings.closeOnEscape;
      if (allowed && !settings.onDismiss) {
        unmount(entry.id, { immediate: true });
        return;
      }
      const accepted = allowed && settings.onDismiss("escape") !== false;
      if (!accepted && dialog.isConnected && !dialog.open) dialog.showModal();
    };
    dialog.addEventListener("close", state.onClose);
    dialogStates.set(dialog, state);
    return state;
  }

  function mount(dialog, options = {}) {
    const settings = {
      closeOnEscape: true,
      closeOnBackdrop: true,
      ...defaults,
      ...options,
    };
    const returnFocus =
      typeof document !== "undefined" ? document.activeElement : null;
    let pressedOnBackdrop = false;
    const dialogState = getDialogState(dialog);

    const onCancel = (event) => {
      event.preventDefault();
      if (stack.isTop(id) && settings.closeOnEscape) {
        settings.onDismiss?.("escape");
      }
    };
    const onPointerDown = (event) => {
      pressedOnBackdrop = event.target === dialog;
    };
    const onClick = (event) => {
      const fromBackdrop = pressedOnBackdrop && event.target === dialog;
      pressedOnBackdrop = false;
      if (fromBackdrop && stack.isTop(id) && settings.closeOnBackdrop) {
        settings.onDismiss?.("backdrop");
      }
    };

    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("click", onClick);

    const id = stack.push({
      dialog,
      settings,
      returnFocus,
      dialogState,
      cleanup: () => {
        dialog.removeEventListener("cancel", onCancel);
        dialog.removeEventListener("pointerdown", onPointerDown);
        dialog.removeEventListener("click", onClick);
      },
    });
    dialogState.id = id;

    dialog.dataset.cubytModalId = id;
    lockScroll();
    if (!dialog.open) dialog.showModal();
    dialog.dataset.state = "open";

    const focusTarget = resolveFocusTarget(dialog, settings.initialFocus);
    focusTarget?.focus?.({ preventScroll: true });
    return id;
  }

  function unmount(id, options = {}) {
    const entry = stack.get(id);
    if (!entry) return Promise.resolve();
    if (entry.closing) return entry.closing;

    entry.closing = (async () => {
      const { dialog } = entry;
      if (!options.immediate && !prefersReducedMotion()) {
        dialog.dataset.state = "closing";
        await waitForExitAnimation(dialog);
      }
      entry.cleanup();
      if (dialog.open) {
        // The matching native `close` event may arrive after this dialog is
        // mounted again; the stable listener consumes this pending event.
        entry.dialogState.suppressedCloseEvents += 1;
        dialog.close();
      }
      delete dialog.dataset.state;
      stack.remove(id);
      if (entry.dialogState.id === id) entry.dialogState.id = null;
      releaseDialogState(dialog, entry.dialogState);
      unlockScroll();
      const target = entry.returnFocus;
      if (target?.isConnected && typeof target.focus === "function") {
        target.focus({ preventScroll: true });
      }
    })();
    return entry.closing;
  }

  /** Ask the owner of a modal to close it (runs `onDismiss`), or unmount it directly. */
  function dismiss(id, reason = "programmatic") {
    const entry = stack.get(id);
    if (!entry) return;
    if (entry.settings.onDismiss) entry.settings.onDismiss(reason);
    else unmount(id);
  }

  return {
    mount,
    unmount,
    dismiss,
    dismissTop(reason) {
      const top = stack.top();
      if (top) dismiss(top.id, reason);
    },
    dismissAll(reason) {
      for (const entry of stack.list().reverse()) dismiss(entry.id, reason);
    },
    isTop: (id) => stack.isTop(id),
    subscribe: (listener) => stack.subscribe(listener),
    get size() {
      return stack.size;
    },
  };
}

export const modalManager = createModalManager();
