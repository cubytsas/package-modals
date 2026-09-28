import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ActionsModal,
  AlertModal,
  CodeModal,
  CommandModal,
  ConfirmModal,
  DangerModal,
  DetailsModal,
  EmbedModal,
  FormModal,
  GalleryModal,
  ImageModal,
  LightboxModal,
  ListModal,
  Modal,
  ModalProvider,
  ProgressModal,
  PromoModal,
  PromptModal,
  ResultModal,
  SelectModal,
  StepsModal,
  VideoModal,
} from "../src/react/index.js";

const render = (Component, props) =>
  renderToStaticMarkup(h(Component, { open: true, inline: true, ...props }));

test("Modal renders the standard anatomy with ARIA wiring", () => {
  const html = render(Modal, {
    title: "Invitar cuenta",
    lead: "Envía un acceso al workspace.",
    footer: h("button", null, "OK"),
    tone: "danger",
    size: "lg",
    children: "Cuerpo",
  });
  assert.match(html, /^<dialog class="cubyt-modal" data-size="lg" data-tone="danger" data-placement="center" data-inline="true" open=""/);
  const titleId = html.match(/aria-labelledby="([^"]+)"/)[1];
  assert.match(html, new RegExp(`<h2 id="${titleId}" class="cubyt-modal__title">Invitar cuenta</h2>`));
  assert.match(html, /cubyt-modal__accent/);
  assert.match(html, /aria-label="Cerrar"/);
  assert.match(html, /cubyt-modal__body">Cuerpo/);
  assert.match(html, /cubyt-modal__footer/);
});

test("Modal renders nothing on the server unless inline", () => {
  assert.equal(renderToStaticMarkup(h(Modal, { open: true, title: "X" })), "");
  assert.equal(renderToStaticMarkup(h(ModalProvider, null, "app")), "app");
});

test("confirmation presets", () => {
  assert.match(render(ConfirmModal, { title: "Pausar dominio", confirmLabel: "Pausar" }), /Pausar<\/button>/);
  const danger = render(DangerModal, { title: "Remover", confirmText: "REMOVER", confirmLabel: "Remover cuenta" });
  assert.match(danger, /data-tone="danger"/);
  assert.match(danger, /Escribe REMOVER para confirmar/);
  assert.match(danger, /<button[^>]*disabled=""[^>]*>Remover cuenta/);
  assert.match(render(AlertModal, { title: "Hecho" }), /Entendido/);
});

test("form presets wire the submit button to the form", () => {
  const html = render(FormModal, { title: "Editar nombre", children: h("input", { name: "name" }) });
  const formId = html.match(/<form id="([^"]+)"/)[1];
  assert.match(html, new RegExp(`<button form="${formId}" type="submit"`));
  assert.match(render(PromptModal, { title: "Nombre", label: "Nombre" }), /<label[^>]*>Nombre<\/label>/);
});

test("data presets render their content", () => {
  assert.match(
    render(DetailsModal, {
      title: "Activo",
      items: [{ label: "IP", value: "104.21.32.14", mono: true }],
      notice: { tone: "success", text: "Todo bien" },
      primaryAction: { label: "Ver en mapa", icon: "arrow-right" },
    }),
    /104\.21\.32\.14[\s\S]*cubyt-notice--success[\s\S]*Ver en mapa/,
  );
  assert.match(
    render(ActionsModal, {
      title: "Acciones",
      actions: [
        { id: "edit", label: "Editar" },
        { id: "remove", label: "Remover", tone: "danger" },
      ],
    }),
    /role="menu"[\s\S]*role="menuitem"[\s\S]*cubyt-list-item--danger/,
  );
  const select = render(SelectModal, {
    title: "Idioma",
    value: "es",
    options: [
      { value: "es", label: "Español" },
      { value: "en", label: "English" },
    ],
  });
  assert.match(select, /role="listbox"/);
  assert.match(select, /role="option"[^>]*aria-selected="true"/);
  assert.match(render(CodeModal, { title: "Códigos", codes: ["9F2A-441C", "B7E1-90D3"] }), /cubyt-code-grid[\s\S]*9F2A-441C/);
  assert.match(
    render(ListModal, { title: "Facturas", items: [{ id: "mar", title: "Mar 2026", meta: "$49" }] }),
    /Mar 2026[\s\S]*\$49/,
  );
  assert.match(render(ListModal, { title: "Vacío" }), /No hay elementos/);
});

test("progress and result presets", () => {
  assert.match(render(ProgressModal, { title: "Exportando", progress: 42 }), /aria-valuenow="42"[\s\S]*|42%/);
  assert.match(render(ProgressModal, { title: "Exportando", status: "success", successTitle: "Exportado" }), /cubyt-result[\s\S]*Exportado/);
  assert.match(render(ProgressModal, { status: "error", onRetry() {} }), /data-tone="danger"[\s\S]*Reintentar/);
  assert.match(render(ResultModal, { title: "Guardado", message: "Listo" }), /cubyt-result__title[^>]*>Guardado/);
});

test("media modals validate sources", () => {
  const image = render(ImageModal, { src: "https://cdn.cubyt.co/hero.png", alt: "Hero", title: "Nuevo" });
  assert.match(image, /data-variant="image"[\s\S]*<img src="https:\/\/cdn.cubyt.co\/hero.png" alt="Hero"/);

  const video = render(VideoModal, { title: "Tour", src: "https://youtu.be/dQw4w9WgXcQ" });
  assert.match(video, /<iframe src="https:\/\/www.youtube-nocookie.com\/embed\/dQw4w9WgXcQ\?/);

  const file = render(VideoModal, {
    title: "Tour",
    src: "https://cdn.cubyt.co/tour.mp4",
    tracks: [{ src: "https://cdn.cubyt.co/tour.vtt", srclang: "es", label: "Español" }],
  });
  assert.match(file, /<video[^>]+src="https:\/\/cdn.cubyt.co\/tour.mp4"[\s\S]*<track/);

  assert.match(render(VideoModal, { title: "X", src: "javascript:alert(1)" }), /role="alert"/);
  assert.match(render(EmbedModal, { title: "Docs", src: "https://evil.example/x" }), /role="alert"/);
  assert.match(
    render(EmbedModal, { title: "Docs", src: "https://docs.cubyt.co/x", allowedHosts: ["docs.cubyt.co"] }),
    /<iframe src="https:\/\/docs.cubyt.co\/x"[^>]*sandbox=/,
  );
});

test("gallery, steps, promo and command modals", () => {
  const images = [
    { src: "https://cdn.cubyt.co/1.png", alt: "Uno", caption: "Primera" },
    { src: "https://cdn.cubyt.co/2.png", alt: "Dos" },
  ];
  const gallery = render(GalleryModal, { title: "Capturas", images });
  assert.match(gallery, /1 \/ 2/);
  assert.match(gallery, /Primera/);
  assert.match(gallery, /cubyt-gallery__thumb/);
  assert.match(render(LightboxModal, { images }), /data-variant="lightbox"/);

  const steps = render(StepsModal, {
    steps: [
      { id: "a", title: "Bienvenido", content: "Hola" },
      { id: "b", title: "Dominio", content: "Añade" },
    ],
  });
  assert.match(steps, /Paso 1 de 2[\s\S]*Bienvenido[\s\S]*Siguiente/);

  const promo = render(PromoModal, {
    title: "Cubyt v2",
    media: { type: "image", src: "https://cdn.cubyt.co/v2.png", alt: "" },
    primaryAction: { label: "Probar", href: "https://app.cubyt.co/v2" },
    dismissKey: "v2",
  });
  assert.match(promo, /cubyt-promo[\s\S]*Cubyt v2[\s\S]*href="https:\/\/app.cubyt.co\/v2"[\s\S]*No volver a mostrar/);

  const command = render(CommandModal, {
    items: [
      { id: "billing", label: "Facturación", group: "Cuenta", shortcut: ["G", "B"] },
      { id: "domains", label: "Dominios", group: "Monitor" },
    ],
  });
  assert.match(command, /role="combobox"[\s\S]*role="listbox"[\s\S]*Cuenta[\s\S]*Facturación[\s\S]*Monitor/);
});
