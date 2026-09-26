import { SAMPLE_ARTISANS } from "./artisans";
import { SITES, findSiteInText, getSite } from "./sites";
import type { GuideResponse, Lang } from "./types";

export type CrowdSnapshot = Record<string, { pct: number; level: string }>;

const CROWD_WORDS = ["crowd", "busy", "rush", "least", "quiet", "ಜನ", "ಜನಸಂದಣಿ", "ರಶ್", "भीड़", "भीड", "कम"];
const CRAFT_WORDS = ["saree", "sari", "artisan", "shop", "buy", "weaver", "ಸೀರೆ", "ಕುಶಲ", "ಖರೀದಿ", "साड़ी", "कारीगर", "खरीद"];

const T = {
  leastCrowd: {
    en: (a: string, b: string) => `Right now ${a} is the calmest option. ${b} is the busiest, so visit it early morning or after 4 PM.`,
    kn: (a: string, b: string) => `ಈಗ ${a} ಅತ್ಯಂತ ಶಾಂತವಾಗಿದೆ. ${b} ಹೆಚ್ಚು ಜನಸಂದಣಿಯಿಂದ ಕೂಡಿದೆ, ಆದ್ದರಿಂದ ಅಲ್ಲಿಗೆ ಬೆಳಿಗ್ಗೆ ಬೇಗ ಅಥವಾ ಸಂಜೆ 4ರ ನಂತರ ಹೋಗಿ.`,
    hi: (a: string, b: string) => `अभी ${a} सबसे शांत विकल्प है। ${b} पर सबसे ज़्यादा भीड़ है, इसलिए वहाँ सुबह जल्दी या शाम 4 बजे के बाद जाएँ।`,
  },
  crafts: {
    en: (n: string) => `Visit ${n}. Buying directly from local weavers and makers keeps tourism income in Bagalkote's villages. Open the Artisans tab for more.`,
    kn: (n: string) => `${n} ಗೆ ಭೇಟಿ ನೀಡಿ. ಸ್ಥಳೀಯ ನೇಕಾರರಿಂದ ನೇರವಾಗಿ ಖರೀದಿಸಿದರೆ ಪ್ರವಾಸೋದ್ಯಮದ ಆದಾಯ ಬಾಗಲಕೋಟೆಯ ಹಳ್ಳಿಗಳಲ್ಲೇ ಉಳಿಯುತ್ತದೆ. ಇನ್ನಷ್ಟು ನೋಡಲು ಕುಶಲಕರ್ಮಿ ವಿಭಾಗ ತೆರೆಯಿರಿ.`,
    hi: (n: string) => `${n} जाएँ। स्थानीय बुनकरों से सीधे खरीदने पर पर्यटन की कमाई बागलकोट के गाँवों में ही रहती है। और देखने के लिए कारीगर टैब खोलें।`,
  },
  noVoice: {
    en: "I couldn't process your voice right now. Please type your question or pick a site below.",
    kn: "ಈಗ ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ಗ್ರಹಿಸಲು ಆಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಪ್ರಶ್ನೆಯನ್ನು ಬರೆಯಿರಿ ಅಥವಾ ಕೆಳಗಿನ ತಾಣ ಆಯ್ಕೆಮಾಡಿ.",
    hi: "अभी आपकी आवाज़ समझ नहीं पाया। कृपया सवाल लिखें या नीचे कोई स्थल चुनें।",
  },
  generic: {
    en: "I can tell you about Badami's caves, Aihole, Pattadakal, Mahakuta, Banashankari, Kudalasangama, Ilkal sarees and more. Try asking about one of them.",
    kn: "ಬಾದಾಮಿ ಗುಹೆಗಳು, ಐಹೊಳೆ, ಪಟ್ಟದಕಲ್ಲು, ಮಹಾಕೂಟ, ಬನಶಂಕರಿ, ಕೂಡಲಸಂಗಮ, ಇಳಕಲ್ ಸೀರೆ ಮತ್ತು ಇನ್ನಷ್ಟು ಬಗ್ಗೆ ಹೇಳಬಲ್ಲೆ. ಇವುಗಳಲ್ಲಿ ಒಂದರ ಬಗ್ಗೆ ಕೇಳಿ.",
    hi: "मैं बादामी की गुफाओं, ऐहोले, पट्टदकल, महाकूट, बनशंकरी, कूडलसंगम, इलकल साड़ी और अन्य के बारे में बता सकता हूँ। इनमें से किसी के बारे में पूछें।",
  },
  noPhoto: {
    en: "I can't recognise photos while offline. Please pick the site below and I'll tell you its story.",
    kn: "ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿ ಫೋಟೋ ಗುರುತಿಸಲು ಆಗುವುದಿಲ್ಲ. ಕೆಳಗಿನ ತಾಣವನ್ನು ಆಯ್ಕೆಮಾಡಿ, ಅದರ ಕಥೆ ಹೇಳುತ್ತೇನೆ.",
    hi: "ऑफ़लाइन रहते हुए मैं फोटो नहीं पहचान सकता। नीचे स्थल चुनें, मैं उसकी कहानी सुनाऊँगा।",
  },
};

export function offlineAnswer(
  question: string,
  lang: Lang,
  opts: { siteId?: string | null; crowd?: CrowdSnapshot; image?: boolean; audio?: boolean; hidden?: string[] } = {},
): GuideResponse {
  if (opts.image) return { answer: T.noPhoto[lang], siteId: null, confidence: 0, provider: "offline" };
  if (opts.audio) return { answer: T.noVoice[lang], siteId: null, confidence: 0, provider: "offline" };
  const q = question.toLowerCase();

  if (opts.crowd && CROWD_WORDS.some((w) => q.includes(w))) {
    const entries = Object.entries(opts.crowd).filter(([id]) => getSite(id));
    if (entries.length) {
      entries.sort((a, b) => a[1].pct - b[1].pct);
      const calm = getSite(entries[0][0])!;
      const busy = getSite(entries[entries.length - 1][0])!;
      return { answer: T.leastCrowd[lang](calm.name[lang], busy.name[lang]), siteId: calm.id, provider: "offline" };
    }
  }

  const site = findSiteInText(question) ?? getSite(opts.siteId);
  if (!site && CRAFT_WORDS.some((w) => q.includes(w))) {
    const a = SAMPLE_ARTISANS.find((x) => !opts.hidden?.includes(x.id)) ?? SAMPLE_ARTISANS[0];
    return { answer: T.crafts[lang](a.name[lang]), siteId: "ilkal", provider: "offline" };
  }
  if (site) {
    return { answer: `${site.summary[lang]} ${site.story[lang]}`, siteId: site.id, provider: "offline" };
  }
  return { answer: T.generic[lang], siteId: null, provider: "offline" };
}

export function crowdSnapshotText(c: CrowdSnapshot | undefined) {
  if (!c) return "not available";
  return SITES.filter((s) => c[s.id])
    .map((s) => `${s.id}: ${c[s.id].level} (${c[s.id].pct}%)`)
    .join("; ");
}
