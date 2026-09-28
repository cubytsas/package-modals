/** Ordered stack of open modals. The last entry is the top-most (interactive) modal. */
export function createModalStack() {
  const entries = [];
  const listeners = new Set();
  let counter = 0;

  const emit = () => {
    const snapshot = entries.slice();
    for (const listener of listeners) listener(snapshot);
  };

  return {
    push(data = {}) {
      const id = `cubyt-modal-${++counter}`;
      entries.push({ ...data, id });
      emit();
      return id;
    },
    remove(id) {
      const index = entries.findIndex((entry) => entry.id === id);
      if (index === -1) return undefined;
      const [entry] = entries.splice(index, 1);
      emit();
      return entry;
    },
    get(id) {
      return entries.find((entry) => entry.id === id);
    },
    top() {
      return entries.at(-1);
    },
    isTop(id) {
      return entries.at(-1)?.id === id;
    },
    list() {
      return entries.slice();
    },
    get size() {
      return entries.length;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
