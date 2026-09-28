import { withQuery } from "@cubyt/navigation";

export const MODAL_ROUTE_EVENT = "cubyt:modal-route";
const DEFAULT_PARAM = "modal";

const pathOf = (url) => `${url.pathname}${url.search}${url.hash}`;

/** Current modal name from the query string (`?modal=name`), or `null`. */
export function getModalRoute(options = {}) {
  if (typeof window === "undefined") return null;
  const { param = DEFAULT_PARAM } = options;
  return new URL(window.location.href).searchParams.get(param);
}

/** Absolute URL that opens the named modal, preserving the current query. */
export function modalRouteHref(name, options = {}) {
  const { param = DEFAULT_PARAM, base } = options;
  return withQuery(base ?? window.location.href, { [param]: name });
}

/** Push (or replace) a history entry that opens the named modal. */
export function openModalRoute(name, options = {}) {
  if (typeof window === "undefined") return;
  const { param = DEFAULT_PARAM, replace = false } = options;
  const url = new URL(modalRouteHref(name, { param }));
  const state = { ...(window.history.state ?? {}), cubytModal: name };
  if (replace) window.history.replaceState(state, "", pathOf(url));
  else window.history.pushState(state, "", pathOf(url));
  window.dispatchEvent(new Event(MODAL_ROUTE_EVENT));
}

/**
 * Close the URL-synced modal. Entries pushed by `openModalRoute` are popped with
 * `history.back()`; deep links are cleaned with `replaceState`.
 */
export function closeModalRoute(options = {}) {
  if (typeof window === "undefined") return;
  const { param = DEFAULT_PARAM } = options;
  if (getModalRoute({ param }) === null) return;

  if (window.history.state?.cubytModal) {
    window.history.back();
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete(param);
  const { cubytModal: _removed, ...state } = window.history.state ?? {};
  window.history.replaceState(state, "", pathOf(url));
  window.dispatchEvent(new Event(MODAL_ROUTE_EVENT));
}

/** Listen for modal route changes (back/forward, SPA navigation, open/close calls). */
export function subscribeModalRoute(listener, options = {}) {
  if (typeof window === "undefined") return () => {};
  const { param = DEFAULT_PARAM, eventName = "cubyt:navigate" } = options;
  const notify = () => listener(getModalRoute({ param }));
  const events = ["popstate", eventName, MODAL_ROUTE_EVENT];
  for (const type of events) window.addEventListener(type, notify);
  return () => {
    for (const type of events) window.removeEventListener(type, notify);
  };
}

/**
 * Vanilla binding: open the modal whenever `?modal=name` is present and close it
 * when the parameter disappears. `open` must return a handle from `openModal`.
 */
export function bindModalRoute(name, open, options = {}) {
  let handle = null;
  const sync = (current) => {
    if (current === name && !handle) {
      handle = open();
      handle.closed.then(() => {
        handle = null;
        if (getModalRoute(options) === name) closeModalRoute(options);
      });
    } else if (current !== name && handle) {
      handle.close();
    }
  };
  const unsubscribe = subscribeModalRoute(sync, options);
  sync(getModalRoute(options));
  return unsubscribe;
}
