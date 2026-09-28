# Brand — Nia

_Status: active_ — the palette and mascot come from the Nia artwork (`brand/nia-mascot.jpg`). Source of truth for colours, type and voice.

## Personality
Warm · playful · trustworthy · premium. A friendly companion with a soft, holographic, pastel look (aqua walrus, periwinkle sky, lavender hair, blush hearts) on calm, readable surfaces. Walrus is infrastructure, visible on request.

## Palette (tokens in `apps/web/app/globals.css`, checked by `pnpm exec tsx scripts/check-contrast.ts`)

| Token | Light | Dark | Use |
|---|---|---|---|
| background | `#f6f5fd` lavender-white | `#0f0e26` indigo night | page |
| surface / surface-2 | `#ffffff` / `#efeefb` | `#17163a` / `#1f1e4a` | cards / fills |
| foreground | `#1b1a4b` deep indigo ink | `#eeedff` | text |
| muted-foreground | `#58577e` (6.3:1) | `#a9a8d6` | secondary text |
| primary | `#2a2670` | `#eeedff` | primary buttons, user chat bubbles |
| accent (periwinkle) | `#5352e0` (5.8:1 w/ white) | `#9fa4ff` | links, selection, focus |
| memory (aqua) | `#086a82` on `#dcf6fb` | `#6fe3f2` on `#0d2f3b` | memory chips and receipts |
| success / warning / danger / info | `#177a53` / `#9a5a06` / `#c8323a` / `#2f54eb` | `#4fd39f` / `#f0b45b` / `#f2777c` / `#8ea5ff` | status |
| chart-1 | `#5352e0` | `#9fa4ff` | single-series charts |

Decorative only (never text): aqua `#6bdee6`, periwinkle `#9fb8fc`, lavender `#ce93e3`, blush `#f5b3dc` — the soft `.nia-wash` background and the holographic `.nia-holo-border` / mascot ring. Ramps: ink, periwinkle 50–700, aqua 50–700, lavender, blush.

## Typography
Manrope (UI, headings — tight tracking, extrabold for display) and JetBrains Mono (blob IDs, codes). Tabular numerals for money.

## Mascot
Nia the walrus: aqua, winking, lavender hair, holographic visor, ivory tusks. Artwork in `brand/nia-mascot.jpg`; `pnpm brand:icons` builds every asset (face-crop mascot sizes, full art, favicon.ico, app icons, Telegram avatar, 1200×630 social card) into `apps/web/public/brand/`.

- `<Mascot>` (packages/ui): the face in a holographic ring. States show through the ring and a badge — idle, greeting (a small bob), thinking (spinning ring), recalling and remembering (glow; remembering adds a sparkle), order/booking success (check), privacy (lock), warning (amber). Motion only when the user allows it.
- `<MascotArt>` (apps/web): the full artwork for large placements.
- Landing scenes (`brand/landing/` → `pnpm brand:landing` → `<SceneArt scene="…">`): full-body illustrations, always shown whole in rounded frames (never cropped to a circle). `brand/README.md` lists which picture each section uses.
- Telegram bot photo: upload `apps/web/public/brand/nia-telegram-avatar.jpg` via @BotFather → /setuserpic.

## Voice
Warm, concise, specific, never pushy. Honest about uncertainty (“availability isn’t confirmed yet”). Evidence-sized claims (“you’ve chosen blue twice”, never “you love blue”). Nia says “Noted”; the app says “Got it — I’ll remember that” only after Walrus confirms.
