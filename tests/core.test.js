import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  closeModalRoute,
  createModalManager,
  createModalStack,
  dismissPromo,
  filterCommands,
  getModalRoute,
  isHostAllowed,
  openModalRoute,
  resolveEmbedSource,
  resolveImageSource,
  resolveVideoSource,
  shouldShowPromo,
  subscribeModalRoute,
} from "../src/index.js";

function installWindow(href = "https://app.cubyt.co/es/monitor?tab=all") {
  const listeners = new Map();
  const win = {
    location: new URL(href),
    history: {
      state: null,
      entries: [],
      pushState(state, _title, url) {
        this.entries.push({ state: this.state, href: win.location.href });
        this.state = state;
        win.location = new URL(url, win.location.href);
      },
      replaceState(state, _title, url) {
        this.state = state;
        win.location = new URL(url, win.location.href);
      },
      back() {
        const previous = this.entries.pop();
        if (!previous) return;
        this.state = previous.state;
        win.location = new URL(previous.href);
        win.dispatchEvent({ type: "popstate" });
      },
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent(event) {
      for (const fn of listeners.get(event.type) ?? []) fn(event);
      return true;
    },
  };
  globalThis.window = win;
  globalThis.Event = class {
    constructor(type) {
      this.type = type;
    }
  };
  return win;
}

afterEach(() => {
  delete globalThis.window;
});

test("modal stack tracks order and the top-most entry", () => {
  const stack = createModalStack();
  const snapshots = [];
  stack.subscribe((entries) => snapshots.push(entries.map((entry) => entry.id)));

  const a = stack.push({ name: "a" });
  const b = stack.push({ name: "b" });
  assert.equal(stack.size, 2);
  assert.equal(stack.isTop(b), true);
  assert.equal(stack.isTop(a), false);

  stack.remove(b);
  assert.equal(stack.top().name, "a");
  assert.equal(stack.remove("missing"), undefined);
  assert.deepEqual(snapshots, [[a], [a, b], [a]]);
});

test("modal routes push history, notify listeners and pop on close", () => {
  const win = installWindow();
  const seen = [];
  const unsubscribe = subscribeModalRoute((name) => seen.push(name));

  openModalRoute("invite-account");
  assert.equal(getModalRoute(), "invite-account");
  assert.equal(win.location.search, "?tab=all&modal=invite-account");

  closeModalRoute();
  assert.equal(getModalRoute(), null);
  assert.equal(win.location.search, "?tab=all");
  assert.deepEqual(seen, ["invite-account", null]);
  unsubscribe();
});

test("deep-linked modal routes are cleaned with replaceState", () => {
  const win = installWindow("https://app.cubyt.co/es/monitor?modal=verify-dns");
  assert.equal(getModalRoute(), "verify-dns");
  closeModalRoute();
  assert.equal(win.location.search, "");
  assert.equal(win.history.entries.length, 0);
});

test("video sources: YouTube/Vimeo become privacy embeds, files stay native", () => {
  installWindow();
  const yt = resolveVideoSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s", {
    autoplay: true,
  });
  assert.equal(yt.kind, "embed");
  assert.equal(yt.provider, "youtube");
  const ytUrl = new URL(yt.src);
  assert.equal(ytUrl.hostname, "www.youtube-nocookie.com");
  assert.equal(ytUrl.pathname, "/embed/dQw4w9WgXcQ");
  assert.equal(ytUrl.searchParams.get("start"), "65");
  assert.equal(ytUrl.searchParams.get("autoplay"), "1");
  assert.equal(ytUrl.searchParams.get("mute"), "1");

  assert.equal(new URL(resolveVideoSource("https://youtu.be/dQw4w9WgXcQ").src).pathname, "/embed/dQw4w9WgXcQ");
  assert.equal(resolveVideoSource("https://vimeo.com/76979871").src, "https://player.vimeo.com/video/76979871?dnt=1");
  assert.deepEqual(resolveVideoSource("https://cdn.cubyt.co/tour.mp4"), {
    kind: "file",
    provider: "file",
    src: "https://cdn.cubyt.co/tour.mp4",
  });
  assert.equal(resolveVideoSource("/media/tour").kind, "file");
});

test("video sources reject unsafe schemes and unknown hosts", () => {
  installWindow();
  assert.throws(() => resolveVideoSource("javascript:alert(1)"), TypeError);
  assert.throws(() => resolveVideoSource("https://evil.example/player"), TypeError);
  assert.throws(() => resolveVideoSource("https://www.youtube.com/watch?v=<script>"), TypeError);
  assert.equal(
    resolveVideoSource("https://video.cubyt.co/embed/1", { allowedHosts: ["*.cubyt.co"] }).kind,
    "embed",
  );
});

test("embed sources require HTTPS and an allowlisted host", () => {
  installWindow();
  assert.equal(resolveEmbedSource("/docs/embed"), "https://app.cubyt.co/docs/embed");
  assert.equal(
    resolveEmbedSource("https://forms.cubyt.co/x", { allowedHosts: ["forms.cubyt.co"] }),
    "https://forms.cubyt.co/x",
  );
  assert.throws(() => resolveEmbedSource("https://other.example/x"), TypeError);
  assert.throws(
    () => resolveEmbedSource("http://forms.cubyt.co/x", { allowedHosts: ["forms.cubyt.co"] }),
    TypeError,
  );
  assert.equal(isHostAllowed("a.cubyt.co", ["*.cubyt.co"]), true);
  assert.equal(isHostAllowed("cubyt.co", ["*.cubyt.co"]), false);
  assert.equal(isHostAllowed("evilcubyt.co", ["*.cubyt.co"]), false);
});

test("image sources accept http(s) and data images only", () => {
  installWindow();
  assert.equal(resolveImageSource("/img/a.png"), "https://app.cubyt.co/img/a.png");
  assert.match(resolveImageSource("data:image/png;base64,AAA"), /^data:image\/png/);
  assert.throws(() => resolveImageSource("javascript:alert(1)"), TypeError);
  assert.throws(() => resolveImageSource("data:text/html,<b>"), TypeError);
});

test("filterCommands ranks by label and ignores accents", () => {
  const items = [
    { id: "billing", label: "Facturación", keywords: ["invoices"] },
    { id: "domains", label: "Dominios", description: "Añadir o verificar" },
    { id: "add-domain", label: "Añadir dominio" },
  ];
  assert.deepEqual(filterCommands(items, "facturacion").map((i) => i.id), ["billing"]);
  assert.deepEqual(filterCommands(items, "dom").map((i) => i.id), ["domains", "add-domain"]);
  assert.deepEqual(filterCommands(items, "invoices").map((i) => i.id), ["billing"]);
  assert.equal(filterCommands(items, "").length, 3);
  assert.equal(filterCommands(items, "zzz").length, 0);
});

function installDocument() {
  const root = { clientWidth: 1024, dataset: {} };
  globalThis.document = { body: { style: {} }, documentElement: root, activeElement: null };
  globalThis.window = { innerWidth: 1024 };
  return root;
}

function fakeDialog() {
  const listeners = new Map();
  return {
    open: false,
    queueCloseEvents: false,
    isConnected: true,
    dataset: {},
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
      if (this.queueCloseEvents) queueMicrotask(() => this.fire("close"));
    },
    querySelector: () => null,
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    fire(type) {
      listeners.get(type)?.({ type, preventDefault() {} });
    },
    has: (type) => listeners.has(type),
  };
}

test("manager dismisses the top modal on cancel and handles native close requests", async () => {
  const root = installDocument();
  try {
    const manager = createModalManager();
    const reasons = [];
    let accept = false;
    const dialog = fakeDialog();
    const id = manager.mount(dialog, {
      onDismiss: (reason) => {
        reasons.push(reason);
        return accept;
      },
    });
    assert.equal(dialog.open, true);
    assert.equal(root.dataset.cubytModalOpen, "true");

    dialog.fire("cancel");
    assert.deepEqual(reasons, ["escape"]);
    assert.equal(dialog.open, true);

    // Browser closed it without a cancelable `cancel`; the owner declines, so it re-opens.
    dialog.close();
    dialog.fire("close");
    assert.equal(dialog.open, true);

    accept = true;
    dialog.close();
    dialog.fire("close");
    assert.equal(dialog.open, false);
    assert.deepEqual(reasons, ["escape", "escape", "escape"]);

    await manager.unmount(id, { immediate: true });
    assert.equal(dialog.has("close"), false);
    assert.equal(root.dataset.cubytModalOpen, undefined);
    assert.equal(manager.size, 0);

    const orphan = fakeDialog();
    manager.mount(orphan);
    orphan.close();
    orphan.fire("close");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(manager.size, 0);
    assert.equal(root.dataset.cubytModalOpen, undefined);
  } finally {
    delete globalThis.document;
  }
});

test("manager ignores a stale close event after the same dialog is remounted", async () => {
  installDocument();
  try {
    const manager = createModalManager();
    const dialog = fakeDialog();
    dialog.queueCloseEvents = true;
    const reasons = [];
    const firstId = manager.mount(dialog, { onDismiss: (reason) => reasons.push(reason) });
    const closing = manager.unmount(firstId, { immediate: true });
    const secondId = manager.mount(dialog, { onDismiss: (reason) => reasons.push(reason) });
    await closing;
    await Promise.resolve();

    assert.equal(dialog.open, true);
    assert.deepEqual(reasons, []);
    assert.equal(manager.size, 1);
    await manager.unmount(secondId, { immediate: true });
  } finally {
    delete globalThis.document;
  }
});

test("promo dismissal is persisted per key", () => {
  const data = new Map();
  const storage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
  assert.equal(shouldShowPromo("v2-launch", storage), true);
  dismissPromo("v2-launch", storage);
  assert.equal(shouldShowPromo("v2-launch", storage), false);
  assert.equal(shouldShowPromo("other", storage), true);
});
