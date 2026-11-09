# Money Personality — 60-second research game (unbranded)

A tiny standalone web game: 7 "this or that" money dilemmas + 4 quick research questions →
a shareable personality result (🧭 Planner · 🐿️ Squirrel · 🎯 Smart Spender · 🎢 YOLO Dreamer).
English + Hindi. No sign-up, no income question, **no PayWatch branding anywhere**.

## What it collects (anonymous) → your Google Sheet
| Column | Meaning |
|---|---|
| `event` | `start` / `complete` / `share` / `optin` (gives you a funnel) |
| `src` | where they came from — from the link's `?src=` (e.g. `?src=wa-college`) |
| `p_*` | the 7 this-or-that picks (a/b) |
| `type` | their personality |
| `dream` | #1 dream for the next 2 years |
| `how` | how they're getting there today (bank / SIP-FD / loan / parents / not started) |
| `blocker` | what's stopping them |
| `would_use` | **demand signal**: yes even if paid / yes if free / maybe / no |
| `contact` | only on `optin` rows — email/WhatsApp they chose to leave for early access |
| `secs`, `device`, `lang` | time taken, mobile/desktop, language |

## Set up (15 minutes, once)
1. **Sheet:** make a new Google Sheet → Extensions → Apps Script → paste `apps-script.gs` → Save →
   Deploy → New deployment → Web app → Execute as *Me*, access *Anyone* → Deploy → copy the `/exec` URL.
2. **Connect:** open `index.html`, find `const ENDPOINT = '';` near the top of the script, paste the URL between the quotes.
3. **Host it (free, unbranded):** Vercel → Add New → Project → import the GitHub repo → **Root Directory: `money-personality`**,
   Framework: *Other* → Deploy. Rename the project (Settings → General) to something neutral like `money-personality`
   → you get `money-personality.vercel.app`. (Or drag the folder onto app.netlify.com/drop.)
4. **Test:** play once on your phone in EN and HI → check a `start` and a `complete` row appear in the Sheet.

## Share it
Use a different `?src=` per channel so you know what works:
- `…vercel.app/?src=wa-college` · `?src=wa-family` · `?src=insta-story` · `?src=linkedin` · `?src=xelevate`

Message: *"Took this 60-sec money personality game — I'm a 🐿️ Squirrel 😂 what are you? 👉 link"* (share your own result first — people copy).

## Numbers to show investors (pivot table on the Sheet)
- Plays (`start`), completion rate (`complete` ÷ `start`), shares (`share`), early-access sign-ups (`optin`)
- % `would_use` = yes (split paid vs free) — the demand signal
- Dream mix, "how are you getting there" mix, top blocker — the user insight
- Breakdown by `src` — which channel works
