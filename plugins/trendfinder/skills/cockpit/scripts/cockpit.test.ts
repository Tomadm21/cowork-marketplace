/**
 * Cockpit-Generator-Tests — führt cockpit.ts als Subprozess gegen einen
 * Fixture-Snapshot aus und prüft die erzeugte HTML-Datei.
 *
 *   bun test skills/cockpit/scripts/cockpit.test.ts
 */
import { describe, test, expect, beforeAll } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const SCRIPT = path.join(import.meta.dir, "cockpit.ts");

// Origin-Story > 240 Zeichen — beweist, dass die volle DNA nicht abgeschnitten wird.
const ORIGIN_STORY =
  "Lena wuchs in einem kleinen Friseursalon auf und verbrachte jede freie Minute zwischen " +
  "Haarfarben und Kundengesprächen. Nach ihrer Ausbildung zur Trichologin spezialisierte " +
  "sie sich auf Kopfhautgesundheit und baute nebenbei einen TikTok-Kanal auf, der ehrliche " +
  "Pflege-Routinen ohne Marketing-Versprechen zeigt.";

const SNAPSHOT = {
  niches: [{ niche_id: "lena-beauty", display_name: "Lena Beauty" }],
  trends: {
    "lena-beauty": [
      {
        cluster_id: 1,
        trend_label: "Evening Skincare Routines",
        trend_score: 0.91,
        video_count: 12,
        description: "Ruhige Abendroutinen mit Fokus auf Barriere-Pflege dominieren das Cluster",
        hook_type: "How-To",
        hook_examples: ["POV: deine Abendroutine in 60 Sekunden", "Das mache ich jeden Abend vor dem Schlafen"],
        visual_style: "warmes Badezimmerlicht, Nahaufnahmen",
        dominant_hashtags: ["skincareroutine", "eveningroutine"],
        dominant_audio_type: "voiceover",
        avg_engagement_rate: 0.083,
        lifecycle: { stage: "rising" },
      },
    ],
  },
  velocity: {},
  errors: {},
  brands: [{ brand_id: "lena", name: "Lena Beauty" }],
  personas: {
    lena: [
      {
        persona_id: "lena-p1",
        display_name: "Lena",
        persona_profile: {
          name: "Lena",
          age: 27,
          background: "Trichologin mit Salon-Erfahrung",
          location: "Hamburg",
          personality: "locker-expertenhaft",
          style: "clean girl",
        },
        tone_of_voice: {
          tone: "warm, direkt",
          energy: "ruhig",
          language: "de",
          avoid_words: ["Wundermittel", "garantiert"],
          example_openers: ["Okay, ehrlich:"],
        },
        content_pillars: [
          { name: "K-Beauty Abendroutine", description: "Schritt-für-Schritt-Routinen am Abend" },
        ],
        interests: "Kopfhautpflege, Inhaltsstoffe",
        origin_story: ORIGIN_STORY,
        system_prompt: "Du schreibst als Lena: nahbar, evidenzbasiert, nie marktschreierisch.",
      },
    ],
  },
  content_pieces: {
    "lena-p1": [
      {
        id: 7,
        title: "Abendroutine mit 3 Produkten",
        stage: "script",
        pillar: "K-Beauty Abendroutine",
        format: "talking-head",
        script_data: {
          hook: 'Diese 3 Produkte <script>alert(1)</script> reichen wirklich',
          hooks: ["Hör auf, 10 Produkte zu benutzen", "Deine Kopfhaut braucht nur das hier"],
          body: "Beat 1: Problem zeigen.\nBeat 2: Die 3 Produkte im Einsatz.\nBeat 3: Ergebnis nach 2 Wochen.",
          cta: "Speicher dir das für deine nächste Abendroutine",
          caption: "Weniger ist mehr — deine Abendroutine in 3 Schritten",
          hashtags: ["kopfhautpflege", "abendroutine"],
          ziel: "reichweite",
          visual_notes: "Nahaufnahme Badezimmerregal, warmes Licht",
          audio: "trending-sound",
        },
      },
      { id: 8, title: "Idee ohne Skript", stage: "idea", pillar: "Inhaltsstoffe" },
    ],
  },
  schedules: [],
  warnings: [],
};

let html = "";
let outPath = "";
let ws = "";

beforeAll(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), "cockpit-test-"));
  const snapPath = path.join(ws, "snapshot.json");
  fs.writeFileSync(snapPath, JSON.stringify(SNAPSHOT), "utf8");
  const r = Bun.spawnSync(["bun", SCRIPT, "--data", snapPath, ws]);
  expect(r.exitCode).toBe(0);
  outPath = r.stdout.toString().trim().split("\n").pop()!;
  html = fs.readFileSync(outPath, "utf8");
});

describe("Artifact-Pfad: sichtbar, nicht in Dot-Ordner", () => {
  test("HTML liegt als Trendfinder-Cockpit.html direkt im Workspace-Root", () => {
    expect(path.basename(outPath)).toBe("Trendfinder-Cockpit.html");
    expect(path.dirname(outPath)).toBe(path.resolve(ws));
    expect(outPath).not.toContain("/.trendfinder/");
  });
});

describe("Content-Tab: Skripte im Volltext", () => {
  test("Haupt-Hook, Beats, CTA, Caption stehen vollständig im HTML", () => {
    expect(html).toContain("reichen wirklich");
    expect(html).toContain("Beat 2: Die 3 Produkte im Einsatz.");
    expect(html).toContain("Speicher dir das für deine nächste Abendroutine");
    expect(html).toContain("Weniger ist mehr — deine Abendroutine in 3 Schritten");
  });

  test("alternative Hooks, Hashtags, Ziel, Dreh-Notizen sind sichtbar", () => {
    expect(html).toContain("Hör auf, 10 Produkte zu benutzen");
    expect(html).toContain("#kopfhautpflege");
    expect(html).toContain("#abendroutine");
    expect(html).toMatch(/Reichweite/);
    expect(html).toContain("Nahaufnahme Badezimmerregal, warmes Licht");
    expect(html).toContain("trending-sound");
  });

  test("Skript-Inhalte sind HTML-escaped (keine Injection)", () => {
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("Idea-Piece ohne script_data rendert weiterhin (nur Titel)", () => {
    expect(html).toContain("Idee ohne Skript");
  });
});

describe("Avatare-Tab: volle DNA", () => {
  test("Origin-Story steht ungekürzt im HTML (>240 Zeichen)", () => {
    expect(ORIGIN_STORY.length).toBeGreaterThan(240);
    expect(html).toContain(ORIGIN_STORY);
  });

  test("Profil, Ton (inkl. avoid_words), Pillar-Beschreibung, System-Prompt sichtbar", () => {
    expect(html).toContain("Trichologin mit Salon-Erfahrung");
    expect(html).toContain("Wundermittel");
    expect(html).toContain("Schritt-für-Schritt-Routinen am Abend");
    expect(html).toContain("Du schreibst als Lena: nahbar, evidenzbasiert, nie marktschreierisch.");
  });
});

describe("Trends-Tab: volle Cluster-Details", () => {
  test("Beschreibung, Hook-Typ, Hook-Beispiele, Visual-Style sichtbar", () => {
    expect(html).toContain("Ruhige Abendroutinen mit Fokus auf Barriere-Pflege dominieren das Cluster");
    expect(html).toContain("How-To");
    expect(html).toContain("POV: deine Abendroutine in 60 Sekunden");
    expect(html).toContain("warmes Badezimmerlicht, Nahaufnahmen");
  });

  test("dominante Hashtags, Audio-Typ, Engagement-Rate sichtbar", () => {
    expect(html).toContain("#skincareroutine");
    expect(html).toContain("#eveningroutine");
    expect(html).toContain("voiceover");
    expect(html).toMatch(/8[.,]3\s?%/);
  });
});

describe("Bestehendes Verhalten bleibt", () => {
  test("Trends-Tab rendert Label + Score", () => {
    expect(html).toContain("Evening Skincare Routines");
    expect(html).toContain("0.91");
  });
});
