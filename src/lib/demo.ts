export interface DemoStep {
  id: "intro" | "scan" | "trip" | "artisans" | "passport" | "admin";
  route: string;
  title: string;
  body: string;
}

/** The 3-minute pitch story, playable offline with cached AI answers. */
export const DEMO_STEPS: DemoStep[] = [
  {
    id: "intro",
    route: "/",
    title: "Sunday, 12 noon · Badami",
    body: "The Kulkarni family from Hubballi reaches Badami. PAYANA's crowd model shows the caves are packed — and suggests a calm hidden gem nearby.",
  },
  {
    id: "scan",
    route: "/scan",
    title: "Point, snap, listen",
    body: "At Mahakuta they point the camera at the temple. PAYANA recognises it and tells its story in their language — out loud.",
  },
  {
    id: "trip",
    route: "/trip",
    title: "A crowd-smart day",
    body: "PAYANA re-plans the day: the caves move to the evening when crowds thin, with hidden gems and an artisan stop in between.",
  },
  {
    id: "artisans",
    route: "/artisans",
    title: "Money stays local",
    body: "On the way they buy an Ilkal saree directly from a weaver family — no middlemen.",
  },
  {
    id: "passport",
    route: "/passport",
    title: "Hidden gems, double points",
    body: "Mahakuta earns double points in their Heritage Passport, nudging visitors beyond the crowded icons.",
  },
  {
    id: "admin",
    route: "/admin",
    title: "Impact, live",
    body: "The Tourism Department sees scans, reroutes and artisan contacts in real time — impact numbers you can defend.",
  },
];

export const DEMO_SCAN_SITE = "mahakuta";
