import { SAMPLE_ARTISANS } from "../artisans";
import { LANG_NAME } from "../i18n";
import { crowdSnapshotText, offlineAnswer, type CrowdSnapshot } from "../offline";
import { SITES, findSiteInText, getSite } from "../sites";
import { sbSelect } from "../supabase";
import type { GuideResponse, Lang } from "../types";

export interface GuideRequest {
  mode: "chat" | "scan" | "voice";
  lang: Lang;
  messages: { role: "user" | "assistant"; text: string }[];
  image?: { data: string; mime: string };
  audio?: { data: string; mime: string };
  siteId?: string | null;
  crowd?: CrowdSnapshot;
  localTime?: string;
}

const env = (...names: string[]) => names.map((n) => process.env[n]?.trim()).find(Boolean) || "";
const GEMINI_KEY = env("GEMINI_API_KEY", "GOOGLE_API_KEY", "GEMINI", "gemini", "Gemini");
const GROQ_KEY = env("GROQ_API_KEY", "GROQ", "groq", "Groq", "grok", "GROK");
const GEMINI_MODELS = (
  process.env.GEMINI_MODELS || "gemini-3.8-flash,gemini-flash-latest,gemini-2.5-flash,gemini-flash-lite-latest"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const GROQ_VISION = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_TEXT = process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile";
const GROQ_STT = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";

const PLACE_NAMES =
  "Badami, Aihole, Pattadakal, Mahakuta, Banashankari, Kudalasangama, Bagalkote, Ilkal, Guledgudda, Amingad, Almatti, Siddanakolla, Hunagund, Jamkhandi, Mudhol, Chalukya, Durga temple, Agastya lake, Bhutanatha, Virupaksha, Ravanaphadi, Meguti";

/** Language of a text by its script (used to answer a spoken question in the language spoken). */
function scriptLang(text: string): Lang | null {
  const kn = (text.match(/[\u0C80-\u0CFF]/g) || []).length;
  const hi = (text.match(/[\u0900-\u097F]/g) || []).length;
  const en = (text.match(/[A-Za-z]/g) || []).length;
  const total = kn + hi + en;
  if (!total) return null;
  if (kn / total > 0.3) return "kn";
  if (hi / total > 0.3) return "hi";
  return "en";
}

export const aiStatus = () => ({ gemini: Boolean(GEMINI_KEY), groq: Boolean(GROQ_KEY) });

/* ---------------- Grounding knowledge base ---------------- */

/* Built-in artisan listings the admin removed (refreshed at most once a minute). */
let HIDDEN: { at: number; keys: string[] } = { at: 0, keys: [] };
async function refreshHidden() {
  if (Date.now() - HIDDEN.at < 60_000) return;
  try {
    const rows = await sbSelect<{ artisan_key: string }>("removed_artisans", "select=artisan_key");
    HIDDEN = { at: Date.now(), keys: rows.map((r) => r.artisan_key) };
  } catch {
    HIDDEN = { ...HIDDEN, at: Date.now() - 45_000 }; // retry soon
  }
}
const listedArtisans = () => SAMPLE_ARTISANS.filter((a) => !HIDDEN.keys.includes(a.id));

let KB_CACHE = { key: "", text: "" };
function knowledgeBase() {
  const cacheKey = HIDDEN.keys.join(",");
  if (KB_CACHE.text && KB_CACHE.key === cacheKey) return KB_CACHE.text;
  const sites = SITES.map((s) => {
    const tags = [s.unesco ? "UNESCO World Heritage" : "", s.lesserKnown ? "hidden gem / less crowded" : ""]
      .filter(Boolean)
      .join(", ");
    return [
      `### ${s.id} — ${s.name.en} (${s.town})${tags ? ` [${tags}]` : ""}`,
      `Names: English "${s.name.en}", Kannada "${s.name.kn}", Hindi "${s.name.hi}"`,
      `Summary: ${s.summary.en}`,
      `Facts:\n${s.facts.map((f) => `- ${f}`).join("\n")}`,
      `Visit: timings ${s.timings}; entry ${s.entryFee}; best time ${s.bestTime}; typical visit ${s.visitMinutes} min.`,
      `Accessibility: ${s.accessibility.level}, about ${s.accessibility.steps} steps. ${s.accessibility.notes}`,
      s.festivals?.length ? `Festivals: ${s.festivals.map((f) => f.name).join(", ")}` : "",
      `Coordinates: ${s.lat}, ${s.lng}`,
      `Looks like (for photo recognition): ${s.visualCues}`,
    ]
      .filter(Boolean)
      .join("\n");
  }).join("\n\n");
  const artisans = listedArtisans().map(
    (a) => `- ${a.name.en}: ${a.craft.en} in ${a.town} (near ${a.nearSite}); ${a.priceHint}`,
  ).join("\n");
  KB_CACHE.key = cacheKey;
  KB_CACHE.text = `## HERITAGE SITES\n${sites}\n\n## LOCAL ARTISANS, FOOD & STAYS (listed in the app's Artisans tab)\n${artisans}\n\n## HELPLINES\nEmergency 112 · Ambulance 108 · Women 1091 / 181 · Tourist helpline 1363 (1800-11-1363) · Elderline 14567`;
  return KB_CACHE.text;
}

/**
 * Compact grounding for small-context/low-quota providers (Groq free tier: 8k TPM):
 * one-line summary per site + full facts only for the site(s) the question is about.
 */
function compactKnowledgeBase(query: string, focusId?: string | null) {
  const focus = new Set<string>();
  const hit = findSiteInText(query);
  if (hit) focus.add(hit.id);
  if (focusId && getSite(focusId)) focus.add(focusId);
  const lines = SITES.map((s) => {
    const tags = [s.unesco ? "UNESCO" : "", s.lesserKnown ? "hidden gem" : ""].filter(Boolean).join(", ");
    const head = `### ${s.id} — ${s.name.en} (${s.town})${tags ? ` [${tags}]` : ""}: ${s.summary.en}`;
    if (!focus.has(s.id)) return head;
    return `${head}\nFacts:\n${s.facts.map((f) => `- ${f}`).join("\n")}\nVisit: ${s.timings}; entry ${s.entryFee}; best ${s.bestTime}.\nAccessibility: ${s.accessibility.level}, ~${s.accessibility.steps} steps. ${s.accessibility.notes}`;
  }).join("\n");
  const artisans = listedArtisans().slice(0, 10)
    .map((a) => `- ${a.name.en}: ${a.craft.en}, ${a.town}`)
    .join("\n");
  return `## HERITAGE SITES\n${lines}\n\n## LOCAL ARTISANS & FOOD\n${artisans}\n\n## HELPLINES\nEmergency 112 · Tourist helpline 1363`;
}

function systemPrompt(lang: Lang, kb: string = knowledgeBase()) {
  const L = LANG_NAME[lang];
  const script = lang === "kn" ? "Kannada script" : lang === "hi" ? "Devanagari script" : "English";
  return `You are "Payana" (ಪಯಣ), a warm, knowledgeable local heritage guide for Bagalkote district, Karnataka, India — Badami, Aihole, Pattadakal and nearby places. You help tourists explore, avoid crowds and support local artisans.

RULES
1. For facts about places, history, dates, rulers, timings and fees use ONLY the KNOWLEDGE BASE and LIVE CONTEXT. If something is not covered, say you don't have verified information on that and suggest asking at the site or calling the tourist helpline 1363. Never invent dates, names, numbers or legends.
2. Reply in ${L} (${script}) — natural and fluent — even if the visitor writes in another language. Exception: a SPOKEN question is answered in the language the visitor actually spoke (Kannada → Kannada script, English → English, Hindi → Devanagari). Keep place names recognisable.
3. Be concise and easy to listen to: 50–110 words unless the visitor asks for more detail. No markdown headings, tables or emojis. Short sentences that sound good read aloud.
4. When helpful, suggest a less-crowded hidden gem nearby or a local artisan/food/stay from the list — this spreads footfall and supports local families. Use the live crowd snapshot for crowd questions.
5. In an emergency, tell them to call 112 immediately.
6. Output JSON only, with keys: site_id (knowledge-base id or null), confidence (0-1), transcript (only for voice input), answer.

KNOWLEDGE BASE
${kb}`;
}

function taskText(req: GuideRequest, lastUser: string) {
  const L = LANG_NAME[req.lang];
  // A site named in the question always wins over the page/chat focus.
  const named = findSiteInText(lastUser);
  const focus = named ?? getSite(req.siteId);
  const ctx = `LIVE CONTEXT — local time: ${req.localTime || new Date().toISOString()}; crowd now: ${crowdSnapshotText(
    req.crowd,
  )}${focus ? `; earlier context was about: ${focus.id} (${focus.name.en})` : ""}.
IMPORTANT: Answer exactly what the visitor asks. If the question names a site, answer about THAT site even if the earlier context was about another one.`;
  if (req.mode === "scan") {
    return `${ctx}
TASK: Identify which knowledge-base site this photo most likely shows, using each site's "Looks like" description. Set site_id to that id and confidence 0–1. If it is not clearly one of them (confidence below 0.45), set site_id to null, briefly say what you see and that you cannot confirm it is a Bagalkote heritage site. If identified, write "answer" as an engaging 90–130 word guide narration in ${L}: what the visitor is looking at, its history, and one detail to look for.${
      lastUser ? `\nThe visitor also asks: ${lastUser}` : ""
    }`;
  }
  if (req.mode === "voice") {
    return `${ctx}
TASK: The visitor asked a question by voice (audio attached). They may speak Kannada, English or Hindi, or mix them (for example Kannada with English words) — listen carefully to the whole clip. Place names you may hear: ${PLACE_NAMES}.
1. "transcript": exactly what they said, in the script of the language spoken (Kannada in Kannada script, Hindi in Devanagari, English in English). Spell place names correctly. Do not translate.
2. "answer": answer that question in the SAME language they spoke (Kannada question → Kannada answer; English → English; Hindi → Hindi). If the audio is silent or unclear, say briefly (in ${L}) that you couldn't hear it and ask them to try again.`;
  }
  return `${ctx}\nVisitor: ${lastUser}`;
}

/* ---------------- Parsing ---------------- */

function parseJson(text: string): Partial<{ site_id: string | null; confidence: number; transcript: string; answer: string }> {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
    }
    return { answer: t };
  }
}

function normalise(raw: ReturnType<typeof parseJson>, provider: GuideResponse["provider"], model: string): GuideResponse {
  const siteId = raw.site_id && getSite(raw.site_id) ? raw.site_id : null;
  const answer = (raw.answer || "").trim();
  if (!answer) throw new Error("empty answer");
  return {
    answer,
    siteId,
    confidence: typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : undefined,
    transcript: raw.transcript?.trim() || undefined,
    provider,
    model,
  };
}

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- Gemini ---------------- */

async function callGemini(req: GuideRequest): Promise<GuideResponse> {
  // Voice questions are standalone: prior text turns made the model answer the old question.
  const history = req.mode === "voice" ? [] : req.messages.slice(-7, -1);
  const lastUser = req.messages.filter((m) => m.role === "user").at(-1)?.text || "";
  const contents: { role: string; parts: Record<string, unknown>[] }[] = [];
  for (const m of history) {
    const role = m.role === "assistant" ? "model" : "user";
    if (!contents.length && role === "model") continue;
    const prev = contents[contents.length - 1];
    if (prev && prev.role === role) prev.parts.push({ text: m.text });
    else contents.push({ role, parts: [{ text: m.text }] });
  }
  const parts: Record<string, unknown>[] = [{ text: taskText(req, lastUser) }];
  if (req.image) parts.push({ inlineData: { mimeType: req.image.mime, data: req.image.data } });
  if (req.audio) parts.push({ inlineData: { mimeType: req.audio.mime, data: req.audio.data } });
  if (contents.length && contents[contents.length - 1].role === "user") contents[contents.length - 1].parts.push(...parts);
  else contents.push({ role: "user", parts });

  const schema = {
    type: "OBJECT",
    properties: {
      site_id: { type: "STRING", nullable: true },
      confidence: { type: "NUMBER" },
      transcript: { type: "STRING" },
      answer: { type: "STRING" },
    },
    required: ["answer"],
  };

  // Try each model with progressively simpler configs: a model that rejects a
  // config (400) gets a simpler one; a missing/busy model (404/429/5xx) is skipped.
  const configs = [
    { thinking: true, schema: true },
    { thinking: false, schema: true },
    { thinking: false, schema: false },
  ];
  const errors: string[] = [];
  for (const model of await geminiModels()) {
    for (const cfg of configs) {
      const generationConfig: Record<string, unknown> = {
        temperature: 0.4,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      };
      if (cfg.schema) generationConfig.responseSchema = schema;
      if (cfg.thinking && model.includes("2.5")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
      if (cfg.thinking && !model.includes("2.5")) continue; // thinking tweak only applies to 2.5 models
      try {
        const res = await withTimeout(28000, (signal) =>
          fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: "POST",
            signal,
            headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt(req.lang) }] },
              contents,
              generationConfig,
            }),
          }),
        );
        if (!res.ok) {
          const body = await res.text();
          errors.push(`${model} ${res.status}: ${body.replace(/\s+/g, " ").slice(0, 180)}`);
          if (res.status === 400) continue;
          break;
        }
        const json = await res.json();
        const text: string = (json.candidates?.[0]?.content?.parts || [])
          .map((p: { text?: string }) => p.text || "")
          .join("");
        return normalise(parseJson(text), "gemini", model);
      } catch (e) {
        errors.push(`${model}: ${String(e).slice(0, 120)}`);
        break;
      }
    }
  }
  throw new Error(`gemini failed → ${errors.join(" | ")}`);
}

/* Discover which Flash models this key can use (Google retires model names over time). */
let MODEL_CACHE: { at: number; models: string[] } | null = null;

async function geminiModels(): Promise<string[]> {
  if (process.env.GEMINI_MODELS) return GEMINI_MODELS;
  if (MODEL_CACHE && Date.now() - MODEL_CACHE.at < 3600_000) return MODEL_CACHE.models;
  const fallback = ["gemini-flash-latest", ...GEMINI_MODELS];
  try {
    const res = await withTimeout(8000, (signal) =>
      fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
        headers: { "x-goog-api-key": GEMINI_KEY },
        signal,
      }),
    );
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const names = (j.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      .filter((n) => /flash/.test(n) && !/(tts|image|live|audio|embed|exp|robotics|computer)/.test(n));
    const score = (n: string) => {
      const v = parseFloat(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] || "0");
      return (/latest/.test(n) ? 1000 : 0) + v * 10 - (/lite/.test(n) ? 4 : 0) - (/preview/.test(n) ? 2 : 0) - (/\d{3}$/.test(n) ? 1 : 0);
    };
    names.sort((a, b) => score(b) - score(a));
    const models = [...new Set([...names.slice(0, 5), ...fallback])].slice(0, 7);
    MODEL_CACHE = { at: Date.now(), models };
    return models;
  } catch {
    return fallback;
  }
}

/* ---------------- Groq (fallback) ---------------- */

async function whisper(audio: { data: string; mime: string }, opts: { language?: string; prompt: string }) {
  const form = new FormData();
  const bytes = Buffer.from(audio.data, "base64");
  form.append("file", new Blob([bytes], { type: audio.mime }), "question.wav");
  form.append("model", (await groqModels()).stt);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  form.append("prompt", opts.prompt);
  if (opts.language) form.append("language", opts.language);
  const res = await withTimeout(25000, (signal) =>
    fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${GROQ_KEY}` },
      body: form,
    }),
  );
  if (!res.ok) throw new Error(`groq stt ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return { text: String(j.text || "").trim(), language: String(j.language || "").toLowerCase() };
}

/**
 * Speech → text. Whisper auto-detects the language; if it hears something other
 * than Kannada/English/Hindi (Kannada is often mistaken for Telugu or Tamil),
 * transcribe again with the language forced.
 */
async function groqTranscribe(audio: { data: string; mime: string }, lang: Lang) {
  const first = await whisper(audio, { prompt: `Tourist question about ${PLACE_NAMES}.` });
  const ok = ["english", "en", "kannada", "kn", "hindi", "hi"];
  if (!first.text || ok.includes(first.language)) return first.text;
  const hindiLike = ["urdu", "ur", "marathi", "mr", "nepali", "ne", "punjabi", "pa"];
  const forced = hindiLike.includes(first.language) && lang === "hi" ? "hi" : "kn";
  const prompts: Record<string, string> = {
    kn: "ಬಾದಾಮಿ, ಐಹೊಳೆ, ಪಟ್ಟದಕಲ್ಲು, ಮಹಾಕೂಟ, ಬನಶಂಕರಿ, ಕೂಡಲಸಂಗಮ, ಬಾಗಲಕೋಟೆ, ಇಳಕಲ್ ಬಗ್ಗೆ ಪ್ರಶ್ನೆ.",
    hi: "बादामी, ऐहोले, पट्टदकल, बागलकोट के बारे में सवाल।",
  };
  try {
    const again = await whisper(audio, { language: forced, prompt: prompts[forced] });
    return again.text || first.text;
  } catch {
    return first.text;
  }
}

async function callGroq(req: GuideRequest): Promise<GuideResponse> {
  let transcript: string | undefined;
  const msgs = [...req.messages];
  if (req.audio) {
    transcript = await groqTranscribe(req.audio, req.lang);
    msgs.push({ role: "user", text: transcript });
  }
  const lastUser = msgs.filter((m) => m.role === "user").at(-1)?.text || "";
  const history = msgs.slice(-7, -1).map((m) => ({ role: m.role, content: m.text }));
  const task = taskText({ ...req, mode: req.mode === "voice" ? "chat" : req.mode }, lastUser);
  const content = req.image
    ? [
        { type: "text", text: task },
        { type: "image_url", image_url: { url: `data:${req.image.mime};base64,${req.image.data}` } },
      ]
    : task;
  const replyLang = (transcript && scriptLang(transcript)) || req.lang;
  const available = await groqModels();
  const candidates = req.image ? (available.vision ? [available.vision] : []) : available.texts;
  if (!candidates.length) throw new Error("groq: no suitable model available");
  const errors: string[] = [];
  for (const model of candidates) {
    const body: Record<string, unknown> = {
      model,
      temperature: 0.4,
      max_tokens: 1400,
      messages: [
        { role: "system", content: systemPrompt(replyLang, compactKnowledgeBase(lastUser, req.siteId)) },
        ...history,
        { role: "user", content },
      ],
    };
    if (!req.image) body.response_format = { type: "json_object" };
    if (/gpt-oss|qwen3|reason/i.test(model)) body.reasoning_effort = "low"; // keep tokens for the answer
    try {
      const res = await withTimeout(28000, (signal) =>
        fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
          body: JSON.stringify(body),
        }),
      );
      if (!res.ok) {
        errors.push(`groq ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
        continue; // rate-limited / too large / bad JSON → next model
      }
      const j = await res.json();
      const out = normalise(parseJson(j.choices?.[0]?.message?.content || ""), "groq", model);
      if (transcript) out.transcript = transcript;
      return out;
    } catch (e) {
      errors.push(`groq ${model}: ${String(e).slice(0, 120)}`);
    }
  }
  throw new Error(errors.join(" | "));
}

/* Discover Groq models (Groq also retires model names over time). */
let GROQ_CACHE: { at: number; text?: string; texts: string[]; vision?: string; stt: string } | null = null;

async function groqModels() {
  if (GROQ_CACHE && Date.now() - GROQ_CACHE.at < 3600_000) return GROQ_CACHE;
  const pick = (ids: string[], patterns: RegExp[]) => {
    for (const p of patterns) {
      const hit = ids.find((id) => p.test(id));
      if (hit) return hit;
    }
    return undefined;
  };
  let ids: string[] = [];
  try {
    const res = await withTimeout(8000, (signal) =>
      fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${GROQ_KEY}` }, signal }),
    );
    if (res.ok) {
      const j = (await res.json()) as { data?: { id: string; active?: boolean }[] };
      ids = (j.data || []).filter((m) => m.active !== false).map((m) => m.id);
    }
  } catch {}
  const chatIds = ids.filter((id) => !/(whisper|guard|tts|orpheus|playai|distil|prompt|safeguard|compound)/i.test(id));
  // Up to three distinct chat models in preference order, so one busy model doesn't sink the fallback.
  const textPrefs = [/gpt-oss-120b/, /llama-3\.3-70b/, /llama-4-maverick/, /kimi-k2/, /gpt-oss-20b/, /qwen/, /llama-3\.1-8b/, /llama/];
  const texts = [...new Set(textPrefs.map((p) => chatIds.find((id) => p.test(id))).filter((x): x is string => Boolean(x)))].slice(0, 3);
  if (process.env.GROQ_TEXT_MODEL) texts.unshift(process.env.GROQ_TEXT_MODEL);
  if (!texts.length) texts.push(GROQ_TEXT);
  GROQ_CACHE = {
    at: Date.now(),
    texts,
    text:
      process.env.GROQ_TEXT_MODEL ||
      pick(chatIds, [/gpt-oss-120b/, /llama-3\.3-70b/, /llama-4-maverick/, /kimi-k2/, /qwen3?-.*32b/, /llama-4/, /gpt-oss/, /llama/, /./]) ||
      GROQ_TEXT,
    vision:
      process.env.GROQ_VISION_MODEL ||
      pick(chatIds, [/llama-4-(scout|maverick)/, /vision/, /qwen.*vl/i, /-vl-/i, /llama-4/]) ||
      (ids.length ? undefined : GROQ_VISION),
    stt: pick(ids, [/whisper-large-v3-turbo/, /whisper-large-v3/, /whisper/]) || GROQ_STT,
  };
  return GROQ_CACHE;
}

/* ---------------- Orchestration ---------------- */

export async function runGuide(req: GuideRequest, force?: "gemini" | "groq"): Promise<GuideResponse> {
  await refreshHidden();
  const errors: string[] = [];
  if (GEMINI_KEY && force !== "groq") {
    try {
      return await callGemini(req);
    } catch (e) {
      errors.push(String(e));
    }
  }
  if (GROQ_KEY && force !== "gemini") {
    try {
      return await callGroq(req);
    } catch (e) {
      errors.push(String(e));
    }
  }
  if (errors.length) console.error("[guide] all providers failed:", errors.join(" | "));
  const lastUser = req.messages.filter((m) => m.role === "user").at(-1)?.text || "";
  return offlineAnswer(lastUser, req.lang, { siteId: req.siteId, crowd: req.crowd, image: Boolean(req.image), audio: Boolean(req.audio), hidden: HIDDEN.keys });
}

/* ---------------- Text-to-speech (Gemini TTS) ---------------- */

const TTS_MODELS = (process.env.GEMINI_TTS_MODELS || "gemini-2.5-flash-preview-tts,gemini-2.5-flash-tts")
  .split(",")
  .map((s) => s.trim());
const ttsCache = new Map<string, Buffer>();
let TTS_CACHE: string[] | null = null;

async function ttsModels(): Promise<string[]> {
  if (process.env.GEMINI_TTS_MODELS) return TTS_MODELS;
  if (TTS_CACHE) return TTS_CACHE;
  try {
    const res = await withTimeout(8000, (signal) =>
      fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": GEMINI_KEY }, signal }),
    );
    const j = (await res.json()) as { models?: { name: string }[] };
    const names = (j.models || []).map((m) => m.name.replace(/^models\//, "")).filter((n) => /tts/.test(n) && /flash/.test(n));
    names.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    TTS_CACHE = [...new Set([...names.slice(0, 3), ...TTS_MODELS])];
  } catch {
    TTS_CACHE = TTS_MODELS;
  }
  return TTS_CACHE;
}

function pcmToWav(pcm: Buffer, rate = 24000) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const TTS_VOICES = [...new Set([process.env.GEMINI_TTS_VOICE || "Sulafat", "Kore"])];

/** Returns WAV audio, or the HTTP status to report (429 = rate-limited, 503 = unavailable). */
export async function synthesize(text: string, lang: Lang): Promise<Buffer | number> {
  if (!GEMINI_KEY) return 503;
  const key = `${lang}:${text}`;
  const hit = ttsCache.get(key);
  if (hit) return hit;
  let limited = false;
  for (const model of await ttsModels()) {
    for (const voiceName of TTS_VOICES) {
      try {
        const res = await withTimeout(30000, (signal) =>
          fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: "POST",
            signal,
            headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
            body: JSON.stringify({
              // Send only the text: TTS models may read any instruction prefix aloud.
              contents: [{ parts: [{ text }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
              },
            }),
          }),
        );
        if (res.status === 429) limited = true;
        if (!res.ok) {
          if (res.status === 400) continue; // e.g. voice not offered by this model → next voice
          break; // rate-limited / missing model → next model
        }
        const j = await res.json();
        const part = j.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData);
        if (!part) continue;
        const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || "")?.[1] || 24000);
        const wav = pcmToWav(Buffer.from(part.inlineData.data, "base64"), rate);
        if (ttsCache.size > 80) ttsCache.clear();
        ttsCache.set(key, wav);
        return wav;
      } catch {
        break;
      }
    }
  }
  return limited ? 429 : 503;
}

/** Which models this deployment will use (for /api/health?models=1). */
export async function aiModels() {
  return {
    gemini: GEMINI_KEY ? await geminiModels() : [],
    groq: GROQ_KEY ? await groqModels() : null,
  };
}
