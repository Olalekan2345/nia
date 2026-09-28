# Brand — Nia

_Status: active_ (derived from the build specification’s visual direction; source of truth for colours, type and voice)

## Personality
Trust · simplicity · warmth · intelligence · commerce · premium quality. Fintech-grade calm with a friendly companion. No neon, no purple AI gradients, no crypto clichés; Walrus is infrastructure, visible on request.

## Palette (tokens in `apps/web/app/globals.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| background | `#f7f6f2` warm off-white | `#0b0e13` graphite | page |
| surface / surface-2 | `#ffffff` / `#f0efea` | `#12161d` / `#181d26` | cards / fills |
| foreground | `#0e1116` | `#e8ebef` | text |
| muted-foreground | `#5b6472` (5.5:1) | `#9aa3b2` | secondary text |
| primary | `#11151c` | `#e8ebef` | primary buttons |
| accent (tide) | `#0a7a89` (5.0:1 w/ white) | `#3cc7d7` | links, selection, focus |
| memory (mint-green) | `#177a53` | `#4fd39f` | memory receipts |
| info (cobalt) | `#2f54eb` | `#8ea5ff` | info states |
| warning / danger | `#9a5a06` / `#c8323a` | `#f0b45b` / `#f2777c` | status |
| chart-1 | `#0b8fa1` | `#1fa2b4` | single-series charts (validated) |

Brand ramp: tide 50–700 (`#ecfafb` → `#086a77`), mint 100–500, graphite 300–950. Gradients only as soft washes (`.nia-wash`).

## Typography
Manrope (UI, headings — tight tracking, extrabold for display) and JetBrains Mono (blob IDs, codes). Tabular numerals for money.

## Mascot
Original small AI walrus: pearl rounded body, graphite visor with glowing aqua eyes, whisker pads, ivory tusks, status LED. States: idle, greeting, thinking, remembering, recalling, order_success, booking_success, privacy, warning (`packages/ui/src/mascot-svg.ts`). Motion is subtle and disabled for reduced-motion users.

## Voice
Warm, concise, specific, never pushy. Honest about uncertainty (“availability isn’t confirmed yet”). Evidence-sized claims (“you’ve chosen blue twice”, never “you love blue”). Nia says “Noted”; the app says “Got it — I’ll remember that” only after Walrus confirms.
