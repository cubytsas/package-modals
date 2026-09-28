import {
  createContext,
  createElement as h,
  Fragment,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react";
import { modalManager } from "../manager.js";
import {
  closeModalRoute,
  getModalRoute,
  modalRouteHref,
  openModalRoute,
  subscribeModalRoute,
} from "../route.js";
import { ManagerContext } from "./modal.js";
import { AlertModal, ConfirmModal, DangerModal, PromptModal } from "./presets.js";

const ModalApiContext = createContext(null);

/**
 * Hosts imperatively opened modals. `useModal().open(Component, props)` renders
 * `Component` with `open`, `onOpenChange`, `onResolve` and `onClosed` injected and
 * returns a promise for the value passed to `onResolve` (or `undefined` on dismiss).
 */
export function ModalProvider({ manager = modalManager, children }) {
  const entriesRef = useRef([]);
  const [, rerender] = useReducer((count) => count + 1, 0);

  const api = useMemo(() => {
    let counter = 0;
    const commit = (next) => {
      entriesRef.current = next;
      rerender();
    };

    const close = (id, value) => {
      const entry = entriesRef.current.find((item) => item.id === id);
      if (!entry || !entry.open) return;
      entry.resolve(value);
      commit(entriesRef.current.map((item) => (item === entry ? { ...item, open: false } : item)));
    };

    const open = (Component, props = {}) => {
      const id = `cubyt-modal-entry-${++counter}`;
      let resolve;
      const promise = new Promise((done) => (resolve = done));
      commit([...entriesRef.current, { id, Component, props, open: true, resolve }]);
      return Object.assign(promise, {
        id,
        close: (value) => close(id, value),
        update: (next) => update(id, next),
      });
    };

    const update = (id, next) => {
      commit(
        entriesRef.current.map((item) =>
          item.id === id ? { ...item, props: { ...item.props, ...next } } : item,
        ),
      );
    };

    return {
      open,
      close,
      update,
      remove: (id) => commit(entriesRef.current.filter((item) => item.id !== id)),
      closeAll: () => {
        for (const entry of entriesRef.current) close(entry.id, undefined);
      },
      confirm: (options) =>
        open(options.confirmText || options.tone === "danger" ? DangerModal : ConfirmModal, options).then(
          (value) => value === true,
        ),
      prompt: (options) =>
        open(PromptModal, options).then((value) => (typeof value === "string" ? value : null)),
      alert: (options) => open(AlertModal, options).then(() => undefined),
    };
  }, []);

  return h(
    ManagerContext.Provider,
    { value: manager },
    h(
      ModalApiContext.Provider,
      { value: api },
      children,
      h(
        Fragment,
        null,
        entriesRef.current.map((entry) =>
          h(entry.Component, {
            key: entry.id,
            ...entry.props,
            open: entry.open,
            onOpenChange: (next, reason) => {
              entry.props.onOpenChange?.(next, reason);
              if (!next) api.close(entry.id, undefined);
            },
            onResolve: (value) => {
              entry.props.onResolve?.(value);
              api.close(entry.id, value);
            },
            onClosed: () => {
              entry.props.onClosed?.();
              api.remove(entry.id);
            },
          }),
        ),
      ),
    ),
  );
}

/** Imperative modal API. Must be used inside `<ModalProvider>`. */
export function useModal() {
  const api = useContext(ModalApiContext);
  if (!api) throw new Error("useModal() must be used inside <ModalProvider>.");
  return api;
}

/**
 * Sync a modal with `?modal=name` in the URL (deep links, Back button closes it).
 * Spread `modalProps` onto any modal: `<InviteModal {...route.modalProps} />`.
 */
export function useModalRoute(name, options = {}) {
  const { param = "modal", eventName } = options;
  const current = useSyncExternalStore(
    (listener) => subscribeModalRoute(listener, { param, eventName }),
    () => getModalRoute({ param }),
    () => null,
  );
  const open = current === name;
  const openModal = (extra) => openModalRoute(name, { param, ...extra });
  const closeModal = () => closeModalRoute({ param });

  return {
    open,
    openModal,
    closeModal,
    getHref: () => modalRouteHref(name, { param }),
    modalProps: {
      open,
      onOpenChange: (next) => (next ? openModal() : closeModal()),
    },
  };
}
