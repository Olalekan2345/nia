# Brand source art

- `nia-mascot.png|jpg|webp` — the mascot artwork (square, ideally >= 1024 px). Run `pnpm brand:icons` after replacing it: it rebuilds the mascot, favicon, app icons, Telegram avatar and social card in `apps/web/public/brand/`.
- `landing/` — the landing page's scene illustrations. `pnpm brand:landing` turns them into `apps/web/public/landing/nia-<scene>.webp` (≤ 1600 px, ~150–200 KB each).

## Landing scenes

The mapping lives in `scripts/landing-assets.ts` (`SCENES`). To swap a picture, point its scene at another file in `landing/` and run `pnpm brand:landing`.

| Scene | Section | Picture |
|---|---|---|
| `hero` | Hero | full body, peace sign, memory orb, phone |
| `remembers` | The problem → “Nia remembers.” | a confused chatbot beside Nia with the right product |
| `memory-orb` | Memory story | holding a glowing memory orb |
| `businesses` | Nia sells more than products | surrounded by fashion, beauty, electronics, food, home, bookings |
| `market` | Walrus Market band | in a shop with bags |
| `dashboard` | For merchants | beside a laptop dashboard and phone |
| `telegram` | Telegram | winking, holding a phone |
| `cta` | Final call to action | peace sign under a bright arch |

The Telegram orbit's floating objects (`orbit-bag`, `orbit-sneaker`, `orbit-beauty`, `orbit-headphones`) are soft-edged crops of these pictures; their boxes are in `OBJECTS` in the same script.

Unused for now: `000_E9351B81…` (shopping bags + Telegram icon), `001_6BF5B3C2…` (walking, phone), `002_BEF57865…` (web chat → memory → Telegram; only its handbag is used, in the orbit). `85900A11…` is an exact copy of `004_79358D62…`.
