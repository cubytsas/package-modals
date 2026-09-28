import { resolveRedirectTarget } from "@cubyt/navigation/redirect";

export const DEFAULT_VIDEO_HOSTS = Object.freeze([
  "www.youtube-nocookie.com",
  "player.vimeo.com",
]);

const VIDEO_FILE = /\.(mp4|webm|ogv|ogg|mov|m4v)$/i;
const YOUTUBE_ID = /^[\w-]{6,20}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const YOUTUBE_NOCOOKIE_HOSTS = new Set([
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const currentOrigin = () =>
  typeof window === "undefined" ? undefined : window.location.origin;

/** Exact host match, or a `*.example.com` wildcard for subdomains. */
export function isHostAllowed(hostname, allowedHosts = []) {
  return allowedHosts.some((pattern) =>
    pattern.startsWith("*.")
      ? hostname.endsWith(pattern.slice(1)) && hostname !== pattern.slice(2)
      : hostname === pattern,
  );
}

function youtubeId(url) {
  if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
  if (YOUTUBE_HOSTS.has(url.hostname)) {
    if (url.pathname === "/watch") return url.searchParams.get("v");
    return url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1];
  }
  if (YOUTUBE_NOCOOKIE_HOSTS.has(url.hostname)) {
    return url.pathname.match(/^\/embed\/([^/?#]+)/)?.[1];
  }
  return undefined;
}

function vimeoId(url) {
  if (url.hostname === "vimeo.com" || url.hostname === "www.vimeo.com") {
    return url.pathname.match(/^\/(\d+)/)?.[1];
  }
  if (url.hostname === "player.vimeo.com") {
    return url.pathname.match(/^\/video\/(\d+)/)?.[1];
  }
  return undefined;
}

const parseStart = (value) => {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return value;
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return undefined;
  const [, hours = 0, minutes = 0, seconds = 0] = match.map((part) => Number(part ?? 0));
  return String(hours * 3600 + minutes * 60 + seconds);
};

/**
 * Normalize a video URL. YouTube and Vimeo links become privacy-friendly embeds,
 * direct files (`.mp4`, `.webm`, ...) or same-origin URLs play in `<video>`,
 * and anything else must be listed in `allowedHosts`.
 */
export function resolveVideoSource(src, options = {}) {
  const { allowedHosts = [], autoplay = false, muted = autoplay, loop = false } = options;
  const url = resolveRedirectTarget(src);

  const ytId = youtubeId(url);
  if (ytId !== undefined) {
    if (!YOUTUBE_ID.test(ytId ?? "")) throw new TypeError("Invalid YouTube video id.");
    const embed = new URL(`https://www.youtube-nocookie.com/embed/${ytId}`);
    embed.searchParams.set("rel", "0");
    embed.searchParams.set("modestbranding", "1");
    const start = parseStart(url.searchParams.get("t") ?? url.searchParams.get("start"));
    if (start) embed.searchParams.set("start", start);
    if (autoplay) embed.searchParams.set("autoplay", "1");
    if (muted) embed.searchParams.set("mute", "1");
    if (loop) {
      embed.searchParams.set("loop", "1");
      embed.searchParams.set("playlist", ytId);
    }
    return { kind: "embed", provider: "youtube", src: embed.href };
  }

  const vmId = vimeoId(url);
  if (vmId) {
    const embed = new URL(`https://player.vimeo.com/video/${vmId}`);
    embed.searchParams.set("dnt", "1");
    if (autoplay) embed.searchParams.set("autoplay", "1");
    if (muted) embed.searchParams.set("muted", "1");
    if (loop) embed.searchParams.set("loop", "1");
    return { kind: "embed", provider: "vimeo", src: embed.href };
  }

  if (isHostAllowed(url.hostname, allowedHosts)) {
    if (url.protocol !== "https:") throw new TypeError("Video embeds must use HTTPS.");
    return { kind: "embed", provider: "custom", src: url.href };
  }

  if (VIDEO_FILE.test(url.pathname) || url.origin === currentOrigin()) {
    return { kind: "file", provider: "file", src: url.href };
  }

  throw new TypeError(
    `Video source ${url.hostname} is not a supported provider, an allowed host, or a direct video file.`,
  );
}

/** Validate an `<iframe>` URL: same-origin, or HTTPS on an allowlisted host. */
export function resolveEmbedSource(src, options = {}) {
  const { allowedHosts = [] } = options;
  const url = resolveRedirectTarget(src);
  if (url.origin === currentOrigin()) return url.href;
  if (url.protocol !== "https:") throw new TypeError("Embeds must use HTTPS.");
  if (!isHostAllowed(url.hostname, allowedHosts)) {
    throw new TypeError(`Embed host is not allowed: ${url.hostname}`);
  }
  return url.href;
}

/** Validate an image URL (HTTP(S), same-origin relative paths, or `data:image/*`). */
export function resolveImageSource(src) {
  if (typeof src === "string" && /^data:image\/(png|jpe?g|gif|webp|avif);/i.test(src)) {
    return src;
  }
  if (typeof src === "string" && /^blob:/i.test(src)) return src;
  return resolveRedirectTarget(src).href;
}

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Rank command palette items by label, description and keyword matches. */
export function filterCommands(items, query) {
  const needle = normalize(query);
  if (!needle) return items.slice();
  const terms = needle.split(/\s+/);

  return items
    .map((item, index) => {
      const label = normalize(item.label);
      const extra = normalize(
        [item.description, item.group, ...(item.keywords ?? [])].join(" "),
      );
      let score = 0;
      for (const term of terms) {
        if (label.startsWith(term)) score += 4;
        else if (label.split(/\s+/).some((word) => word.startsWith(term))) score += 3;
        else if (label.includes(term)) score += 2;
        else if (extra.includes(term)) score += 1;
        else return null;
      }
      return { item, index, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}

const PROMO_PREFIX = "cubyt:promo:";

const safeStorage = (storage) => {
  try {
    return storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
  } catch {
    return undefined;
  }
};

/** False once the user chose "don't show again" for a promo key. */
export function shouldShowPromo(key, storage) {
  const store = safeStorage(storage);
  if (!store) return true;
  try {
    return store.getItem(PROMO_PREFIX + key) === null;
  } catch {
    return true;
  }
}

/** Remember that a promo was dismissed permanently. */
export function dismissPromo(key, storage) {
  const store = safeStorage(storage);
  try {
    store?.setItem(PROMO_PREFIX + key, new Date().toISOString());
  } catch {
    /* storage can be full or blocked; the promo will simply show again */
  }
}
