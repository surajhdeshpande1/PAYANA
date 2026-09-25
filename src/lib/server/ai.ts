import { SAMPLE_ARTISANS } from "../artisans";
import { LANG_NAME } from "../i18n";
import { crowdSnapshotText, offlineAnswer, type CrowdSnapshot } from "../offline";
import { SITES, getSite } from "../sites";
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
  process.env.GEMINI_MODELS || "gemini-2.5-flash,gemini-flash-latest,gemini-2.5-flash-lite,gemini-2.0-flash"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const GROQ_VISION = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_TEXT = process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile";
const GROQ_STT = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";

export const aiStatus = () => ({ gemini: Boolean(GEMINI_KEY), groq: Boolean(GROQ_KEY) });

/* ---------------- Grounding knowledge base ---------------- */

let KB_CACHE = "";
function knowledgeBase() {
  if (KB_CACHE) return KB_CACHE;
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
  const artisans = SAMPLE_ARTISANS.map(
    (a) => `- ${a.name.en}: ${a.craft.en} in ${a.town} (near ${a.nearSite}); ${a.priceHint}`,
  ).join("\n");
  KB_CACHE = `## HERITAGE SITES\n${sites}\n\n## LOCAL ARTISANS, FOOD & STAYS (listed in the app's Artisans tab)\n${artisans}\n\n## HELPLINES\nEmergency 112 · Ambulance 108 · Women 1091 / 181 · Tourist helpline 1363 (1800-11-1363) · Elderline 14567`;
  return KB_CACHE;
}

function systemPrompt(lang: Lang) {
  const L = LANG_NAME[lang];
  const script = lang === "kn" ? "Kannada script" : lang === "hi" ? "Devanagari script" : "English";
  return `You are "Payana" (ಪಯಣ), a warm, knowledgeable local heritage guide for Bagalkote district, Karnataka, India — Badami, Aihole, Pattadakal and nearby places. You help tourists explore, avoid crowds and support local artisans.

RULES
1. For facts about places, history, dates, rulers, timings and fees use ONLY the KNOWLEDGE BASE and LIVE CONTEXT. If something is not covered, say you don't have verified information on that and suggest asking at the site or calling the tourist helpline 1363. Never invent dates, names, numbers or legends.
2. Always reply in ${L} (${script}) — natural and fluent — even if the visitor writes or speaks another language. Keep place names recognisable.
3. Be concise and easy to listen to: 50–110 words unless the visitor asks for more detail. No markdown headings, tables or emojis. Short sentences that sound good read aloud.
4. When helpful, suggest a less-crowded hidden gem nearby or a local artisan/food/stay from the list — this spreads footfall and supports local families. Use the live crowd snapshot for crowd questions.
5. In an emergency, tell them to call 112 immediately.
6. Output JSON only, with keys: site_id (knowledge-base id or null), confidence (0-1), transcript (only for voice input), answer.

KNOWLEDGE BASE
${knowledgeBase()}`;
}

function taskText(req: GuideRequest, lastUser: string) {
  const L = LANG_NAME[req.lang];
  const focus = getSite(req.siteId);
  const ctx = `LIVE CONTEXT — local time: ${req.localTime || new Date().toISOString()}; crowd now: ${crowdSnapshotText(
    req.crowd,
  )}${focus ? `; the visitor is currently looking at: ${focus.id} (${focus.name.en})` : ""}.`;
  if (req.mode === "scan") {
    return `${ctx}
TASK: Identify which knowledge-base site this photo most likely shows, using each site's "Looks like" description. Set site_id to that id and confidence 0–1. If it is not clearly one of them (confidence below 0.45), set site_id to null, briefly say what you see and that you cannot confirm it is a Bagalkote heritage site. If identified, write "answer" as an engaging 90–130 word guide narration in ${L}: what the visitor is looking at, its history, and one detail to look for.${
      lastUser ? `\nThe visitor also asks: ${lastUser}` : ""
    }`;
  }
  if (req.mode === "voice") {
    return `${ctx}
TASK: The visitor asked a question by voice (audio attached; it may be Kannada, Hindi or English). Put an exact transcript in "transcript" (in the language and script spoken), then answer it in "answer" in ${L}.`;
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
  const history = req.messages.slice(-7, -1);
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

  let lastErr: unknown;
  for (const model of GEMINI_MODELS) {
    for (const thinking of [true, false]) {
      const generationConfig: Record<string, unknown> = {
        temperature: 0.4,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: schema,
      };
      if (thinking && model.includes("2.5")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
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
          lastErr = new Error(`gemini ${model} ${res.status}: ${body.slice(0, 300)}`);
          // Bad config for this model → retry once without thinkingConfig; otherwise next model.
          if (res.status === 400 && thinking && /thinking/i.test(body)) continue;
          break;
        }
        const json = await res.json();
        const text: string = (json.candidates?.[0]?.content?.parts || [])
          .map((p: { text?: string }) => p.text || "")
          .join("");
        return normalise(parseJson(text), "gemini", model);
      } catch (e) {
        lastErr = e;
        break;
      }
    }
  }
  throw lastErr ?? new Error("gemini failed");
}

/* ---------------- Groq (fallback) ---------------- */

async function groqTranscribe(audio: { data: string; mime: string }) {
  const form = new FormData();
  const bytes = Buffer.from(audio.data, "base64");
  form.append("file", new Blob([bytes], { type: audio.mime }), "question.wav");
  form.append("model", GROQ_STT);
  form.append("response_format", "json");
  const res = await withTimeout(25000, (signal) =>
    fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${GROQ_KEY}` },
      body: form,
    }),
  );
  if (!res.ok) throw new Error(`groq stt ${res.status}`);
  const j = await res.json();
  return String(j.text || "").trim();
}

async function callGroq(req: GuideRequest): Promise<GuideResponse> {
  let transcript: string | undefined;
  const msgs = [...req.messages];
  if (req.audio) {
    transcript = await groqTranscribe(req.audio);
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
  const model = req.image ? GROQ_VISION : GROQ_TEXT;
  const body: Record<string, unknown> = {
    model,
    temperature: 0.4,
    max_tokens: 1500,
    messages: [{ role: "system", content: systemPrompt(req.lang) }, ...history, { role: "user", content }],
  };
  if (!req.image) body.response_format = { type: "json_object" };
  const res = await withTimeout(28000, (signal) =>
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify(body),
    }),
  );
  if (!res.ok) throw new Error(`groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const out = normalise(parseJson(j.choices?.[0]?.message?.content || ""), "groq", model);
  if (transcript) out.transcript = transcript;
  return out;
}

/* ---------------- Orchestration ---------------- */

export async function runGuide(req: GuideRequest): Promise<GuideResponse> {
  const errors: string[] = [];
  if (GEMINI_KEY) {
    try {
      return await callGemini(req);
    } catch (e) {
      errors.push(String(e));
    }
  }
  if (GROQ_KEY) {
    try {
      return await callGroq(req);
    } catch (e) {
      errors.push(String(e));
    }
  }
  if (errors.length) console.error("[guide] all providers failed:", errors.join(" | "));
  const lastUser = req.messages.filter((m) => m.role === "user").at(-1)?.text || "";
  return offlineAnswer(lastUser, req.lang, { siteId: req.siteId, crowd: req.crowd, image: Boolean(req.image || req.audio) });
}

/* ---------------- Text-to-speech (Gemini TTS) ---------------- */

const TTS_MODELS = (process.env.GEMINI_TTS_MODELS || "gemini-2.5-flash-preview-tts,gemini-2.5-flash-tts")
  .split(",")
  .map((s) => s.trim());
const ttsCache = new Map<string, Buffer>();

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

export async function synthesize(text: string, lang: Lang): Promise<Buffer | null> {
  if (!GEMINI_KEY) return null;
  const key = `${lang}:${text}`;
  const hit = ttsCache.get(key);
  if (hit) return hit;
  for (const model of TTS_MODELS) {
    try {
      const res = await withTimeout(30000, (signal) =>
        fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Read this aloud warmly, like a friendly tour guide, in ${LANG_NAME[lang]}: ${text}` }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
            },
          }),
        }),
      );
      if (!res.ok) continue;
      const j = await res.json();
      const part = j.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData);
      if (!part) continue;
      const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || "")?.[1] || 24000);
      const wav = pcmToWav(Buffer.from(part.inlineData.data, "base64"), rate);
      if (ttsCache.size > 50) ttsCache.clear();
      ttsCache.set(key, wav);
      return wav;
    } catch {}
  }
  return null;
}
