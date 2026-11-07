// Original cat drawings, built from parts: eyes, mouth, paws, extras, tilt.
// Every meme is one combination. viewBox 0 0 200 200.

export const PALETTES = {
  ginger: { fur: "#f2a65a", dark: "#c46b27", inner: "#f7c6c7", belly: "#fbe3c4", line: "#3b2416" },
  smoke:  { fur: "#9aa3ad", dark: "#6b737c", inner: "#f2c4c9", belly: "#d9dee3", line: "#22272c" },
  ink:    { fur: "#2b2b30", dark: "#151518", inner: "#d98b9a", belly: "#3d3d44", line: "#0a0a0c" },
  cream:  { fur: "#f4ece1", dark: "#d8c3a5", inner: "#f5b8c0", belly: "#ffffff", line: "#4a3b2c" },
};

const eyesSVG = {
  normal: (p) => `
    <ellipse cx="72" cy="104" rx="9" ry="11" fill="${p.line}"/><circle cx="75" cy="100" r="3" fill="#fff"/>
    <ellipse cx="128" cy="104" rx="9" ry="11" fill="${p.line}"/><circle cx="131" cy="100" r="3" fill="#fff"/>`,
  wide: (p) => `
    <circle cx="70" cy="102" r="15" fill="#fff" stroke="${p.line}" stroke-width="2.5"/><circle cx="70" cy="103" r="4.5" fill="${p.line}"/>
    <circle cx="130" cy="102" r="15" fill="#fff" stroke="${p.line}" stroke-width="2.5"/><circle cx="130" cy="103" r="4.5" fill="${p.line}"/>`,
  closed: (p) => `
    <path d="M60 106 Q72 116 84 106" fill="none" stroke="${p.line}" stroke-width="4" stroke-linecap="round"/>
    <path d="M116 106 Q128 116 140 106" fill="none" stroke="${p.line}" stroke-width="4" stroke-linecap="round"/>`,
  happy: (p) => `
    <path d="M60 108 Q72 94 84 108" fill="none" stroke="${p.line}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M116 108 Q128 94 140 108" fill="none" stroke="${p.line}" stroke-width="4.5" stroke-linecap="round"/>`,
  smug: (p) => `
    <path d="M61 104 L84 104" stroke="${p.line}" stroke-width="4" stroke-linecap="round"/>
    <path d="M64 104 Q72 114 82 104" fill="${p.line}"/>
    <path d="M116 104 L139 104" stroke="${p.line}" stroke-width="4" stroke-linecap="round"/>
    <path d="M118 104 Q128 114 136 104" fill="${p.line}"/>`,
  teary: (p) => `
    <circle cx="72" cy="104" r="13" fill="${p.line}"/><circle cx="76" cy="99" r="4.5" fill="#fff"/><circle cx="67" cy="109" r="2.2" fill="#fff"/>
    <circle cx="128" cy="104" r="13" fill="${p.line}"/><circle cx="132" cy="99" r="4.5" fill="#fff"/><circle cx="123" cy="109" r="2.2" fill="#fff"/>
    <path d="M62 116 Q60 128 64 134 Q69 128 66 117 Z" fill="#7cc7ff" opacity=".9"/>
    <path d="M138 116 Q140 128 136 134 Q131 128 134 117 Z" fill="#7cc7ff" opacity=".9"/>`,
  side: (p) => `
    <ellipse cx="72" cy="104" rx="12" ry="9" fill="#fff" stroke="${p.line}" stroke-width="2"/><circle cx="64" cy="104" r="5" fill="${p.line}"/>
    <ellipse cx="128" cy="104" rx="12" ry="9" fill="#fff" stroke="${p.line}" stroke-width="2"/><circle cx="120" cy="104" r="5" fill="${p.line}"/>`,
  stare: (p) => `
    <circle cx="72" cy="104" r="11" fill="#e8d36a" stroke="${p.line}" stroke-width="2"/><rect x="70" y="95" width="4" height="18" rx="2" fill="${p.line}"/>
    <circle cx="128" cy="104" r="11" fill="#e8d36a" stroke="${p.line}" stroke-width="2"/><rect x="126" y="95" width="4" height="18" rx="2" fill="${p.line}"/>`,
};

const mouthSVG = {
  w: (p) => `<path d="M88 130 Q94 138 100 130 Q106 138 112 130" fill="none" stroke="${p.line}" stroke-width="3" stroke-linecap="round"/>`,
  scream: (p) => `<ellipse cx="100" cy="144" rx="17" ry="23" fill="${p.line}"/><ellipse cx="100" cy="157" rx="10" ry="7" fill="#e86a7a"/>`,
  smirk: (p) => `<path d="M88 132 Q102 136 114 126" fill="none" stroke="${p.line}" stroke-width="3.2" stroke-linecap="round"/>`,
  frown: (p) => `<path d="M88 138 Q100 128 112 138" fill="none" stroke="${p.line}" stroke-width="3.2" stroke-linecap="round"/>`,
  flat: (p) => `<path d="M90 133 L110 133" stroke="${p.line}" stroke-width="3" stroke-linecap="round"/>`,
  open: (p) => `<path d="M86 130 Q100 152 114 130 Z" fill="${p.line}"/><path d="M92 138 Q100 148 108 138 Z" fill="#e86a7a"/>`,
};

const paw = (p, x, y, r = 15) => `
  <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.85}" fill="${p.fur}" stroke="${p.line}" stroke-width="2.5"/>
  <circle cx="${x}" cy="${y + r * 0.18}" r="${r * 0.32}" fill="${p.inner}"/>
  <circle cx="${x - r * 0.45}" cy="${y - r * 0.32}" r="${r * 0.15}" fill="${p.inner}"/>
  <circle cx="${x}" cy="${y - r * 0.48}" r="${r * 0.15}" fill="${p.inner}"/>
  <circle cx="${x + r * 0.45}" cy="${y - r * 0.32}" r="${r * 0.15}" fill="${p.inner}"/>`;

const arm = (p, d, w = 22) => `<path d="${d}" fill="none" stroke="${p.line}" stroke-width="${w + 5}" stroke-linecap="round"/>
  <path d="${d}" fill="none" stroke="${p.fur}" stroke-width="${w}" stroke-linecap="round"/>`;

const pawsSVG = {
  none: () => "",
  chin: (p) => `${arm(p, "M150 212 Q142 182 124 168")}${paw(p, 120, 164, 16)}`,
  thumbs: (p) => `
    ${arm(p, "M182 212 Q176 186 166 166", 24)}
    <rect x="148" y="146" width="34" height="28" rx="12" fill="${p.fur}" stroke="${p.line}" stroke-width="2.5"/>
    <rect x="152" y="118" width="13" height="34" rx="6.5" fill="${p.fur}" stroke="${p.line}" stroke-width="2.5"/>
    <circle cx="165" cy="161" r="5" fill="${p.inner}"/>`,
  point: (p) => `
    ${arm(p, "M196 212 Q186 182 168 164", 22)}
    <ellipse cx="166" cy="160" rx="17" ry="14" fill="${p.fur}" stroke="${p.line}" stroke-width="2.5"/>
    <rect x="120" y="153" width="40" height="11" rx="5.5" fill="${p.fur}" stroke="${p.line}" stroke-width="2.5"/>
    <circle cx="124" cy="158.5" r="3.2" fill="${p.inner}"/>`,
  stop: (p) => `${arm(p, "M196 212 Q184 180 166 150", 26)}${paw(p, 160, 132, 28)}`,
  up: (p) => `
    ${arm(p, "M52 96 L40 40", 13)}${arm(p, "M148 96 L160 40", 13)}
    ${paw(p, 38, 32, 13)}${paw(p, 162, 32, 13)}`,
  cheeks: (p) => `${paw(p, 44, 128, 15)}${paw(p, 156, 128, 15)}`,
};

const extrasSVG = {
  none: () => "",
  question: (p) => `<text x="166" y="58" font-family="Anton, Impact, sans-serif" font-size="46" fill="${p.line}">?</text>`,
  zzz: (p) => `<text x="148" y="54" font-family="Anton, Impact, sans-serif" font-size="22" fill="${p.line}">z</text>
                <text x="162" y="38" font-family="Anton, Impact, sans-serif" font-size="30" fill="${p.line}">Z</text>`,
  sparkle: () => `<g fill="#ffd84a"><path d="M20 120 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4z"/>
                  <path d="M178 116 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z"/><path d="M100 18 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z"/></g>`,
  sweat: () => `<path d="M150 62 Q160 78 152 86 Q142 80 150 62 Z" fill="#7cc7ff"/>`,
  blush: () => `<ellipse cx="58" cy="124" rx="10" ry="5" fill="#ff8fa3" opacity=".55"/><ellipse cx="142" cy="124" rx="10" ry="5" fill="#ff8fa3" opacity=".55"/>`,
  shock: (p) => `<path d="M28 60 L40 72 M22 80 L38 84 M172 60 L160 72 M178 80 L162 84" stroke="${p.line}" stroke-width="3" stroke-linecap="round"/>`,
};

export function catSVG({ eyes = "normal", mouth = "w", paws = "none", extras = "none", tilt = 0 }, palette = "ginger") {
  const p = PALETTES[palette] || PALETTES.ginger;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="cat">
  <g transform="rotate(${tilt} 100 115)">
    <path d="M38 88 L46 22 L92 58 Z" fill="${p.fur}" stroke="${p.line}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M48 72 L52 38 L78 58 Z" fill="${p.inner}"/>
    <path d="M162 88 L154 22 L108 58 Z" fill="${p.fur}" stroke="${p.line}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M152 72 L148 38 L122 58 Z" fill="${p.inner}"/>
    <ellipse cx="100" cy="112" rx="74" ry="62" fill="${p.fur}" stroke="${p.line}" stroke-width="3"/>
    <path d="M88 56 Q92 70 90 80 M100 52 L100 78 M112 56 Q108 70 110 80" stroke="${p.dark}" stroke-width="4" stroke-linecap="round" fill="none"/>
    <ellipse cx="100" cy="140" rx="34" ry="24" fill="${p.belly}" opacity=".85"/>
    ${eyesSVG[eyes](p)}
    <path d="M94 120 L106 120 L100 127 Z" fill="${p.inner}" stroke="${p.line}" stroke-width="1.5" stroke-linejoin="round"/>
    ${mouthSVG[mouth](p)}
    <g stroke="${p.line}" stroke-width="1.8" stroke-linecap="round" opacity=".75">
      <path d="M70 126 L28 118"/><path d="M70 131 L26 132"/><path d="M71 136 L30 146"/>
      <path d="M130 126 L172 118"/><path d="M130 131 L174 132"/><path d="M129 136 L170 146"/>
    </g>
    ${(extrasSVG[extras] || extrasSVG.none)(p)}
  </g>
  ${(pawsSVG[paws] || pawsSVG.none)(p)}
</svg>`;
}
