// Generates PWA icons from an inline SVG (gold Chalukya-style vimana on maroon).
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const temple = (s = 1, dy = 0) => `
  <g transform="translate(256 ${256 + dy}) scale(${s}) translate(-256 -256)" fill="url(#gold)">
    <rect x="130" y="388" width="252" height="22" rx="4"/>
    <rect x="150" y="372" width="212" height="18" rx="3"/>
    <path d="M168 372 V296 H344 V372 Z M236 372 V330 a20 20 0 0 1 40 0 V372 Z" fill-rule="evenodd"/>
    <rect x="176" y="276" width="160" height="22" rx="3"/>
    <rect x="192" y="252" width="128" height="26" rx="3"/>
    <rect x="210" y="230" width="92" height="24" rx="3"/>
    <rect x="226" y="212" width="60" height="20" rx="3"/>
    <path d="M216 214 a40 34 0 0 1 80 0 Z"/>
    <rect x="251" y="160" width="10" height="24" rx="3"/>
    <circle cx="256" cy="156" r="10"/>
    <circle cx="190" cy="286" r="5"/><circle cx="322" cy="286" r="5"/>
  </g>`;

const svg = (pad = 0, ring = true) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="70%">
      <stop offset="0" stop-color="#7a3220"/><stop offset="0.6" stop-color="#3b140e"/><stop offset="1" stop-color="#1a0806"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff1c9"/><stop offset="0.45" stop-color="#f7d997"/><stop offset="1" stop-color="#c9923f"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="url(#bg)"/>
  ${ring ? `<circle cx="256" cy="272" r="${190 - pad}" fill="none" stroke="url(#gold)" stroke-width="10" opacity="0.9"/>
  <circle cx="256" cy="272" r="${172 - pad}" fill="none" stroke="#e8b45a" stroke-width="2" opacity="0.5"/>` : ""}
  <circle cx="256" cy="120" r="30" fill="#f08a3c" opacity="0.85"/>
  ${temple(pad ? 0.78 : 1, pad ? 10 : 0)}
</svg>`;

mkdirSync("public/icons", { recursive: true });
await sharp(Buffer.from(svg())).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(svg())).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(svg(40))).resize(512, 512).png().toFile("public/icons/maskable-512.png");
await sharp(Buffer.from(svg(40))).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
await sharp(Buffer.from(svg())).resize(48, 48).png().toFile("public/icons/favicon-48.png");
console.log("icons done");
