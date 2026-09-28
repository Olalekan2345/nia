/**
 * Nia mascot — an original small AI walrus companion.
 *
 * Pearl body, graphite visor with softly glowing eyes, whisker pads and
 * ivory tusks. One SVG source feeds the React component (animated via CSS
 * classes) and the static brand assets (Telegram avatar, favicon).
 */

export const MASCOT_STATES = [
  "idle",
  "greeting",
  "thinking",
  "remembering",
  "recalling",
  "order_success",
  "booking_success",
  "privacy",
  "warning",
] as const;
export type MascotState = (typeof MASCOT_STATES)[number];

export interface MascotSvgOptions {
  state?: MascotState;
  /** Unique prefix for gradient/filter ids (multiple mascots per page). */
  id?: string;
  /** Include the square brand background (for avatars / icons). */
  background?: boolean;
  title?: string;
}

const EYE = { idle: "#7BE8F2", warm: "#FFC46B" };

function eyes(state: MascotState, id: string): string {
  const glow = `filter="url(#${id}-glow)"`;
  const color = state === "warning" ? EYE.warm : EYE.idle;
  switch (state) {
    case "greeting":
    case "remembering":
    case "order_success":
    case "booking_success":
      // Happy, softly closed arcs.
      return `<g class="nia-eyes" ${glow} fill="none" stroke="${color}" stroke-width="6.5" stroke-linecap="round">
        <path d="M89 96 Q97 85 105 96"/><path d="M135 96 Q143 85 151 96"/></g>`;
    case "thinking":
      return `<g class="nia-eyes nia-eyes-thinking" ${glow} fill="${color}">
        <rect x="93" y="80" width="13" height="18" rx="6.5"/><rect x="139" y="80" width="13" height="18" rx="6.5"/></g>`;
    case "privacy":
      return `<g class="nia-eyes" ${glow} fill="none" stroke="${color}" stroke-opacity=".75" stroke-width="5" stroke-linecap="round">
        <path d="M89 93 H105"/><path d="M135 93 H151"/></g>`;
    case "warning":
      return `<g class="nia-eyes" ${glow} fill="${color}">
        <path d="M90 91 L104 86 V103 Q104 108 97 108 Q90 108 90 103 Z"/>
        <path d="M150 91 L136 86 V103 Q136 108 143 108 Q150 108 150 103 Z"/></g>`;
    default:
      return `<g class="nia-eyes" ${glow} fill="${color}">
        <rect x="90" y="83" width="14" height="22" rx="7"/><rect x="136" y="83" width="14" height="22" rx="7"/></g>`;
  }
}

function badge(state: MascotState): string {
  const ring = (fill: string, inner: string) =>
    `<g class="nia-badge"><circle cx="186" cy="58" r="19" fill="${fill}" stroke="#FFFFFF" stroke-width="4"/>${inner}</g>`;
  switch (state) {
    case "order_success":
      return ring("#23B07D", `<path d="M177 58.5 L183.5 65 L195.5 52" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
    case "booking_success":
      return ring(
        "#2F54EB",
        `<rect x="176.5" y="50" width="19" height="17" rx="3.5" fill="none" stroke="#fff" stroke-width="3"/><path d="M176.5 56 H195.5 M181 46.5 V51.5 M191 46.5 V51.5" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
      );
    case "privacy":
      return ring("#1B2230", `<path d="M186 47 L195 50.5 V57 Q195 65 186 69 Q177 65 177 57 V50.5 Z" fill="none" stroke="#7BE8F2" stroke-width="3" stroke-linejoin="round"/>`);
    case "warning":
      return ring("#E2A43B", `<path d="M186 49 V60" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="186" cy="66.5" r="2.4" fill="#fff"/>`);
    default:
      return "";
  }
}

function overlays(state: MascotState, id: string): string {
  if (state === "thinking") {
    return `<g class="nia-thinking-dots" fill="#0FA3B5">
      <circle class="nia-dot nia-dot-1" cx="166" cy="30" r="4.5"/><circle class="nia-dot nia-dot-2" cx="180" cy="20" r="5.5"/><circle class="nia-dot nia-dot-3" cx="196" cy="12" r="6.5"/></g>`;
  }
  if (state === "remembering") {
    return `<g class="nia-ripples" fill="none" stroke="#2FBF8F" stroke-width="2.5">
      <circle class="nia-ripple nia-ripple-1" cx="120" cy="120" r="92"/><circle class="nia-ripple nia-ripple-2" cx="120" cy="120" r="92"/></g>`;
  }
  if (state === "recalling") {
    return `<g clip-path="url(#${id}-visor-clip)"><rect class="nia-scan" x="60" y="62" width="26" height="62" fill="url(#${id}-scan)"/></g>`;
  }
  return "";
}

const LED: Partial<Record<MascotState, string>> = {
  remembering: "#2FBF8F",
  order_success: "#2FBF8F",
  booking_success: "#6F8BFF",
  warning: "#E2A43B",
  privacy: "#5B6472",
};

export function mascotSvg({ state = "idle", id = "nia", background = false, title = "Nia" }: MascotSvgOptions = {}): string {
  const led = LED[state] ?? "#2EC4D6";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="${title}" class="nia-mascot" data-state="${state}">
  <title>${title}</title>
  <defs>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#EEF3F5"/><stop offset="1" stop-color="#D3DEE3"/>
    </linearGradient>
    <linearGradient id="${id}-flipper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E7EEF1"/><stop offset="1" stop-color="#C5D3D9"/>
    </linearGradient>
    <linearGradient id="${id}-visor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#232B38"/><stop offset="1" stop-color="#0B0E13"/>
    </linearGradient>
    <linearGradient id="${id}-muzzle" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E6ECEF"/>
    </linearGradient>
    <linearGradient id="${id}-tusk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F1EBDA"/>
    </linearGradient>
    <radialGradient id="${id}-halo" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#6FE3EE" stop-opacity=".55"/><stop offset=".6" stop-color="#6FE3EE" stop-opacity=".12"/><stop offset="1" stop-color="#6FE3EE" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}-scan" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#7BE8F2" stop-opacity="0"/><stop offset=".5" stop-color="#7BE8F2" stop-opacity=".55"/><stop offset="1" stop-color="#7BE8F2" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#E6F8FA"/><stop offset="1" stop-color="#CDEFF3"/>
    </linearGradient>
    <filter id="${id}-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="240" height="240">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    <clipPath id="${id}-visor-clip"><rect x="60" y="62" width="120" height="62" rx="31"/></clipPath>
  </defs>
  ${background ? `<rect width="240" height="240" fill="url(#${id}-bg)"/>` : ""}
  <circle class="nia-halo" cx="120" cy="120" r="104" fill="url(#${id}-halo)"/>
  ${overlays(state, id).includes("nia-ripples") ? overlays(state, id) : ""}
  <ellipse cx="120" cy="214" rx="58" ry="8" fill="#0B0E13" opacity=".16" filter="url(#${id}-soft)"/>
  <g class="nia-body-group">
    <g class="nia-flipper nia-flipper-left"><path d="M52 150 C34 158 26 178 32 192 C44 196 58 186 64 170 Z" fill="url(#${id}-flipper)"/></g>
    <g class="nia-flipper nia-flipper-right"><path d="M188 150 C206 158 214 178 208 192 C196 196 182 186 176 170 Z" fill="url(#${id}-flipper)"/></g>
    <path class="nia-body" d="M120 30 C177 30 204 76 204 128 C204 180 170 208 120 208 C70 208 36 180 36 128 C36 76 63 30 120 30 Z" fill="url(#${id}-body)" stroke="#C3D1D7" stroke-width="1.5"/>
    <ellipse cx="90" cy="58" rx="30" ry="12" fill="#FFFFFF" opacity=".85" transform="rotate(-22 90 58)"/>
    <circle class="nia-led" cx="120" cy="44" r="4.5" fill="${led}" filter="url(#${id}-glow)"/>
    <rect x="60" y="62" width="120" height="62" rx="31" fill="url(#${id}-visor)"/>
    <rect x="61" y="63" width="118" height="60" rx="30" fill="none" stroke="#6FE3EE" stroke-opacity=".28" stroke-width="1.5"/>
    <path d="M76 76 Q92 67 116 67" fill="none" stroke="#FFFFFF" stroke-opacity=".14" stroke-width="5" stroke-linecap="round"/>
    ${eyes(state, id)}
    ${state === "recalling" ? overlays(state, id) : ""}
    <path d="M110 156 C109 170 106 181 101 190 C107 189 113 178 116 158 Z" fill="url(#${id}-tusk)" stroke="#DCD3BC" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M130 156 C131 170 134 181 139 190 C133 189 127 178 124 158 Z" fill="url(#${id}-tusk)" stroke="#DCD3BC" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="106" cy="145" r="17" fill="url(#${id}-muzzle)" stroke="#D5DEE2" stroke-width="1.2"/>
    <circle cx="134" cy="145" r="17" fill="url(#${id}-muzzle)" stroke="#D5DEE2" stroke-width="1.2"/>
    <ellipse cx="120" cy="133" rx="8" ry="5" fill="#2A3342"/>
    <g fill="#9AA8B1"><circle cx="98" cy="142" r="1.7"/><circle cx="104" cy="149" r="1.7"/><circle cx="96" cy="152" r="1.7"/><circle cx="142" cy="142" r="1.7"/><circle cx="136" cy="149" r="1.7"/><circle cx="144" cy="152" r="1.7"/></g>
  </g>
  ${state === "thinking" ? overlays(state, id) : ""}
  ${badge(state)}
</svg>`;
}
