# PAYANA (ಪಯಣ) — AI Heritage Companion for Bagalkote

A multilingual, crowd-aware heritage companion that guides tourists, spreads footfall across
Bagalkote's lesser-known sites, and connects them to local artisans.

Built for **AI to Redesign Tourism — Bagalkote 2026** (Dept. of Tourism, Bagalkote × BVVS BEC).

**Live app:** https://payana-chi.vercel.app

| Layer | What it does | Poster themes |
| --- | --- | --- |
| **AI Guide** | Photo → monument recognition, voice & text Q&A in ಕನ್ನಡ / हिंदी / English, spoken replies, grounded in a verified knowledge base | Smart Technology (#1, #2, #6, #11) |
| **Crowd-smart trips** | Transparent crowd model + live visitor reports → itinerary optimiser that shifts peak-hour visits and adds hidden gems; CO₂ score | Sustainable Planning (#3, #4, #5, #14, #17, #20) |
| **Artisans & stays** | Ilkal sarees, Guledgudda khana, Amingad karadantu, homestays, guides; self-registration + Tourism Dept approval | Inclusive Growth (#8, #9, #12) |
| **Extras** | 7-second heritage opening film, tourist accounts with a per-user Heritage Passport, 1–10 live crowd ratings, Accessibility mode, Safety & SOS, offline PWA, live Tourism Dept dashboard, QR share | #10, #13, Open Innovation |

## Tech (100% free tier)

- **Next.js 16** (App Router, Turbopack) + **Tailwind CSS v4**, deployed on **Vercel Hobby**
- **Google Gemini** (free tier) for vision, audio understanding and multilingual answers, with automatic
  model fallback → **Groq** (free Llama 4 Scout vision + Whisper) → **offline grounded answers**
- **Supabase** free Postgres for crowd reports, anonymous analytics and artisan registrations (RLS on every table)
- **Leaflet + OpenStreetMap** maps, **OSRM** road routing, **Photon** geocoding for any place in Karnataka
- Natural **Gemini TTS** narration (chunked, with speed control), falling back to the phone's own Web Speech voice
- Service worker for offline use; installable to the home screen

## Run locally

```bash
npm install
cp .env.example .env.local   # then paste your free keys
npm run dev
```

Open http://localhost:3000 (use your phone on the same Wi‑Fi via your PC's IP for camera/mic testing —
camera & mic need HTTPS or localhost).

### Environment variables

| Name | Where to get it (free) | Required |
| --- | --- | --- |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | Recommended |
| `GROQ_API_KEY` | https://console.groq.com/keys | Recommended (fallback) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API | Pre-filled |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key | Pre-filled |

Without AI keys the app still works: the guide answers from the saved knowledge base and sample photos use
verified cached narrations.

## Deployment

The Vercel project `payana` is connected to this GitHub repo, so every `git push` builds automatically:
production from the production branch, and preview URLs for other branches and pull requests.
`GEMINI_API_KEY` and `GROQ_API_KEY` are set under the project's **Environment Variables**; never commit them.

## Admin

- Dashboard: `/admin` (live, refreshes every 5 s; CSV / print report for the District Administrator)
- Admin tools (approve / remove artisans, tourist list) need the admin PIN. It is stored only in the
  database (`private.settings`, key `admin_pin`); ask the project owner, and never write it in the repo.

## Data & honesty notes

- Heritage facts were researched from ASI, UNESCO, Karnataka Tourism, IP India GI registry and Wikipedia;
  sources are listed on every site page. Step counts and some timings are approximate.
- Crowd levels are **model estimates** (day, hour, season, holidays, festivals) blended with live visitor reports —
  there is no public live crowd feed for these sites.
- Artisan listings marked **Sample listing** are illustrative until real businesses register and are approved.
- Photos: Wikimedia Commons (credited on each page, see `src/data/photos.json`).
