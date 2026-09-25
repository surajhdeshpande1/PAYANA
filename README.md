# PAYANA (ಪಯಣ) — AI Heritage Companion for Bagalkote

A multilingual, crowd-aware heritage companion that guides tourists, spreads footfall across
Bagalkote's lesser-known sites, and connects them to local artisans.

Built for **AI to Redesign Tourism — Bagalkote 2026** (Dept. of Tourism, Bagalkote × BVVS BEC).

| Layer | What it does | Poster themes |
| --- | --- | --- |
| **AI Guide** | Photo → monument recognition, voice & text Q&A in ಕನ್ನಡ / हिंदी / English, spoken replies, grounded in a verified knowledge base | Smart Technology (#1, #2, #6, #11) |
| **Crowd-smart trips** | Transparent crowd model + live visitor reports → itinerary optimiser that shifts peak-hour visits and adds hidden gems; CO₂ score | Sustainable Planning (#3, #4, #5, #14, #17, #20) |
| **Artisans & stays** | Ilkal sarees, Guledgudda khana, Amingad karadantu, homestays, guides; self-registration + Tourism Dept approval | Inclusive Growth (#8, #9, #12) |
| **Extras** | Heritage Passport, Accessibility mode, Safety & SOS, offline PWA, live Tourism Dept dashboard, QR share, 3-minute demo tour | #10, #13, Open Innovation |

## Tech (100% free tier)

- **Next.js 16** (App Router, Turbopack) + **Tailwind CSS v4**, deployed on **Vercel Hobby**
- **Google Gemini** (free tier) for vision, audio understanding and multilingual answers, with automatic
  model fallback → **Groq** (free Llama 4 Scout vision + Whisper) → **offline grounded answers**
- **Supabase** free Postgres for crowd reports, anonymous analytics and artisan registrations (RLS on every table)
- **Leaflet + OpenStreetMap/CARTO** maps, **OSRM** road routing
- Browser **Web Speech API** for spoken replies, Gemini TTS fallback when a phone lacks a Kannada voice
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

## Deploy to Vercel

1. Push this folder to a new GitHub repo.
2. vercel.com → **Add New… → Project** → import the repo (framework auto-detected: Next.js).
3. Add `GEMINI_API_KEY` and `GROQ_API_KEY` under **Environment Variables** → **Deploy**.
4. Every `git push` redeploys in ~1 minute.

## Admin

- Dashboard: `/admin` (live, auto-refreshes every 8 s)
- Artisan approval PIN: `2509` (change in Supabase: `update private.settings set value='NEWPIN' where key='admin_pin';`)

## Data & honesty notes

- Heritage facts were researched from ASI, UNESCO, Karnataka Tourism, IP India GI registry and Wikipedia;
  sources are listed on every site page. Step counts and some timings are approximate.
- Crowd levels are **model estimates** (day, hour, season, holidays, festivals) blended with live visitor reports —
  there is no public live crowd feed for these sites.
- Artisan listings marked **Sample listing** are illustrative until real businesses register and are approved.
- Photos: Wikimedia Commons (credited on each page, see `src/data/photos.json`).
