#!/usr/bin/env bun
/**
 * Trendfinder — Cockpit live-artifact generator (dependency-free, NETWORK-FREE).
 *
 * Renders ONE self-contained HTML file from a pre-fetched data snapshot.
 * This script makes NO network requests and reads NO config/API key — it runs
 * inside the Cowork bash sandbox, whose egress allowlist blocks the backend.
 * Claude fetches the data host-side via the trendfinder MCP server
 * (tf_request), writes it to a snapshot JSON, and passes it here.
 *
 *   bun cockpit.ts --data <snapshot.json> <workspace_root>
 *
 * snapshot.json shape — each value is the RAW response body of the named
 * tf_request call (bare list or wrapped-list object, both tolerated); every
 * key except "niches" is optional and defaults to empty:
 *
 *   {
 *     "niches":         <GET /api/niches/config>,
 *     "trends":         { "<niche_id>": <GET /api/trends/{niche_id}> },
 *     "velocity":       { "<niche_id>": <GET /api/trends/{niche_id}/velocity> },
 *     "errors":         { "<niche_id>": "<einzeilige Fehlermeldung>" },
 *     "brands":         <GET /api/brands>,
 *     "personas":       { "<brand_id>": [<GET /api/personas/{persona_id}>, …] },
 *     "content_pieces": { "<persona_id>": <GET /api/personas/{persona_id}/content-pieces?limit=200> },
 *     "schedules":      <GET /api/schedules>,
 *     "warnings":       ["<Hinweis>", …]
 *   }
 *
 * "personas" carries the ENRICHED persona detail objects (full DNA), not the
 * slim {id, persona_id, display_name} list items — the Avatare tab renders
 * the FULL DNA (persona_profile / tone_of_voice / content_pillars / interests /
 * origin_story / system_prompt) expandable per card; the Content tab renders
 * each piece's full script_data (hook, beats, CTA, caption, hashtags, notes)
 * expandable per row. The Cockpit is the frontend replacement: everything the
 * tenant produces must be readable here, not just counted.
 *
 * Output: <workspace_root>/.trendfinder/cockpit.html
 * Last stdout line = absolute path to the written file.
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ── types ──────────────────────────────────────────────────────────────────────

interface Niche {
  niche_id: string;
  display_name: string;
  [k: string]: unknown;
}

interface TrendCluster {
  cluster_id?: string | number;
  trend_label?: string;
  label?: string;
  name?: string;
  topic?: string;
  trend_score?: unknown;
  video_count?: unknown;
  lifecycle?: unknown;
  [k: string]: unknown;
}

interface VelocityEntry {
  cluster_id?: string | number;
  trend_label?: string;
  label?: string;
  name?: string;
  topic?: string;
  lifecycle?: unknown;
  velocity?: unknown;
  [k: string]: unknown;
}

interface Schedule {
  id: string | number;
  type?: string;
  niche_id?: string;
  interval_hours?: number;
  enabled?: boolean;
  last_run_at?: string | null;
}

interface Brand {
  brand_id?: string;
  id?: string;
  name?: string;
  display_name?: string;
  [k: string]: unknown;
}

interface Persona {
  persona_id?: string;
  id?: string;
  name?: string;
  display_name?: string;
  persona_profile?: unknown;
  tone_of_voice?: unknown;
  content_pillars?: unknown;
  system_prompt?: unknown;
  interests?: unknown;
  origin_story?: unknown;
  potential_development?: unknown;
  dna?: unknown;
  persona_dna?: unknown;
  description?: unknown;
  [k: string]: unknown;
}

interface ContentPiece {
  id?: number | string;
  title?: string;
  stage?: string;
  pillar?: string;
  format?: string;
  persona_id?: number | string;
  script_data?: unknown;
  [k: string]: unknown;
}

interface PersonaContent {
  personaName: string;
  brandName: string;
  pieces: ContentPiece[];
}

interface NicheData {
  niche: Niche;
  trends: TrendCluster[];
  velocity: VelocityEntry[];
  error?: string;
}

interface BrandData {
  brand: Brand;
  personas: Persona[];
}

// ── HTML escaping ──────────────────────────────────────────────────────────────

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// ── snapshot loading ────────────────────────────────────────────────────────────

interface Snapshot {
  niches?: unknown;
  trends?: Record<string, unknown>;
  velocity?: Record<string, unknown>;
  errors?: Record<string, string>;
  brands?: unknown;
  personas?: Record<string, unknown>;
  content_pieces?: Record<string, unknown>;
  schedules?: unknown;
  warnings?: unknown;
}

function loadSnapshot(p: string): Snapshot {
  let raw: string;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch {
    throw new Error(`Snapshot-Datei nicht lesbar: ${p}`);
  }
  try {
    return JSON.parse(raw) as Snapshot;
  } catch {
    throw new Error(`Snapshot-Datei ist kein gültiges JSON: ${p}`);
  }
}

// ── data extraction helpers ────────────────────────────────────────────────────

/** The API may return a bare list OR an object wrapping a list — probe defensively. */
function extractList(data: unknown): unknown[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && data !== null) {
    for (const v of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function trendTitle(t: TrendCluster): string {
  const raw = t.trend_label ?? t.label ?? t.name ?? t.topic;
  if (raw != null && String(raw).trim() !== "") return String(raw).trim();
  return "Unbenannter Trend";
}

function trendScore(t: TrendCluster): string {
  if (typeof t.trend_score === "number" && isFinite(t.trend_score)) {
    return t.trend_score.toFixed(2);
  }
  return "—";
}

function personaDna(p: Persona): string {
  // Build a readable DNA summary from the real persona fields the API returns
  // (persona_profile / tone_of_voice / content_pillars / interests). The old
  // p.dna/persona_dna/description fields do not exist on the API response.
  const out: string[] = [];
  const prof = p.persona_profile as Record<string, unknown> | undefined;
  if (prof?.age != null) out.push(String(prof.age));
  if (prof?.location) out.push(String(prof.location));
  if (prof?.personality) out.push(String(prof.personality));
  const tov = p.tone_of_voice as Record<string, unknown> | undefined;
  if (tov?.tone) out.push(`Ton: ${String(tov.tone)}`);
  if (Array.isArray(p.content_pillars) && p.content_pillars.length) {
    const names = (p.content_pillars as Array<Record<string, unknown>>)
      .map((x) => (x && x.name != null ? String(x.name) : ""))
      .filter(Boolean);
    if (names.length) out.push("Pillars: " + names.join(", "));
  }
  if (p.interests) out.push(String(p.interests));
  // Fallback to the legacy free-text fields if no structured DNA is present.
  if (out.length === 0) {
    const raw = p.dna ?? p.persona_dna ?? p.description;
    if (raw != null) out.push(typeof raw === "string" ? raw : JSON.stringify(raw));
  }
  const s = out.join(" · ");
  return s.length > 240 ? s.slice(0, 237) + "…" : s;
}

// ── full-detail renderers (Skripte + DNA im Volltext, aufklappbar) ────────────

const ZIEL_LABEL: Record<string, string> = {
  reichweite: "🚀 Reichweite",
  engagement: "💬 Engagement",
  verkauf: "🛒 Verkauf",
  follower: "➕ Follower",
  vertrauen: "🤝 Vertrauen",
};

const DNA_KEY_LABEL: Record<string, string> = {
  name: "Name",
  age: "Alter",
  background: "Hintergrund",
  location: "Ort",
  appearance: "Aussehen",
  personality: "Persönlichkeit",
  style: "Stil",
  tone: "Ton",
  energy: "Energie",
  language: "Sprache",
  avoid_words: "Vermeiden",
  example_openers: "Beispiel-Opener",
};

function labeledField(label: string, valueHtml: string): string {
  if (!valueHtml) return "";
  return `<div class="sd-field"><div class="sd-label">${esc(label)}</div><div class="sd-value">${valueHtml}</div></div>`;
}

/** Generic pretty renderer for DNA/script values: string → pre-wrap text,
 *  array of objects → list (name/description aware), array → tag badges,
 *  object → key/value lines. Everything escaped. */
function valueHtml(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    const s = String(v).trim();
    return s ? `<span class="pre">${esc(s)}</span>` : "";
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return "";
    const allObjects = v.every((x) => x && typeof x === "object" && !Array.isArray(x));
    if (allObjects) {
      const items = (v as Array<Record<string, unknown>>).map((o) => {
        const name = o.name != null ? String(o.name) : "";
        const rest = Object.entries(o)
          .filter(([k, val]) => k !== "name" && val != null && String(val).trim() !== "")
          .map(([k, val]) =>
            typeof val === "string" || typeof val === "number"
              ? (k === "description" ? String(val) : `${DNA_KEY_LABEL[k] ?? k}: ${String(val)}`)
              : `${DNA_KEY_LABEL[k] ?? k}: ${JSON.stringify(val)}`
          )
          .join(" · ");
        return `<li>${name ? `<strong>${esc(name)}</strong>` : ""}${name && rest ? " — " : ""}${esc(rest)}</li>`;
      });
      return `<ul class="sd-list">${items.join("")}</ul>`;
    }
    return `<div class="sd-tags">${v
      .map((x) => `<span class="meta-tag">${esc(typeof x === "string" ? x : JSON.stringify(x))}</span>`)
      .join("")}</div>`;
  }
  if (typeof v === "object") {
    const rows = Object.entries(v as Record<string, unknown>)
      .filter(([, val]) => val != null && (typeof val !== "string" || val.trim() !== ""))
      .map(([k, val]) => `<div><span class="sd-k">${esc(DNA_KEY_LABEL[k] ?? k)}:</span> ${valueHtml(val)}</div>`);
    return rows.length ? `<div class="sd-kv">${rows.join("")}</div>` : "";
  }
  return "";
}

/** Full script text from a piece's script_data — every field the plugin
 *  persists (script-studio Step 4.5), rendered readably and escaped. */
function scriptDataHtml(sd: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(labeledField("Hook", valueHtml(sd.hook)));
  const mainHook = typeof sd.hook === "string" ? sd.hook : null;
  const altHooks = Array.isArray(sd.hooks)
    ? (sd.hooks as unknown[]).map((h) => String(h)).filter((h) => h.trim() !== "" && h !== mainHook)
    : [];
  if (altHooks.length) {
    parts.push(
      labeledField(
        "Alternative Hooks",
        `<ul class="sd-list">${altHooks.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`
      )
    );
  }
  parts.push(labeledField("Skript", valueHtml(sd.body)));
  parts.push(labeledField("CTA", valueHtml(sd.cta)));
  parts.push(labeledField("Caption", valueHtml(sd.caption)));
  if (Array.isArray(sd.hashtags) && sd.hashtags.length) {
    parts.push(
      labeledField(
        "Hashtags",
        `<div class="sd-tags">${(sd.hashtags as unknown[])
          .map((h) => `<span class="meta-tag">#${esc(String(h).replace(/^#/, ""))}</span>`)
          .join("")}</div>`
      )
    );
  }
  parts.push(labeledField("Dreh-Notizen", valueHtml(sd.visual_notes)));
  parts.push(labeledField("Audio", valueHtml(sd.audio)));
  return parts.filter(Boolean).join("");
}

/** Full avatar DNA — all fields the API carries (contract § Avatare), untruncated. */
function personaDnaFullHtml(p: Persona): string {
  const sections: Array<[string, unknown]> = [
    ["Profil", p.persona_profile],
    ["Ton", p.tone_of_voice],
    ["Content-Pillars", p.content_pillars],
    ["Interessen", p.interests],
    ["Origin-Story", p.origin_story],
    ["Entwicklung", p.potential_development],
    ["System-Prompt (Schreibstimme)", p.system_prompt],
  ];
  return sections
    .map(([label, v]) => labeledField(label, valueHtml(v)))
    .filter(Boolean)
    .join("");
}

/** lifecycle from the trends API is an object {stage, age_days, days_since_peak};
 *  extract + localise the stage. Tolerates a bare string too. */
function lifecycleLabel(lc: unknown): string | null {
  if (lc == null) return null;
  const stage =
    typeof lc === "object" ? (lc as Record<string, unknown>).stage : lc;
  const s = String(stage ?? "").toLowerCase();
  if (!s) return null;
  // Real backend stages: unknown/emerging/rising/peak/declining (temporal.py);
  // growing/stable kept for older payloads.
  if (s === "emerging") return "neu";
  if (s === "rising" || s === "growing") return "steigt";
  if (s === "peak") return "Peak";
  if (s === "declining") return "sinkend";
  if (s === "stable") return "stabil";
  if (s === "unknown") return null;
  return s;
}

function brandId(b: Brand): string {
  return String(b.brand_id ?? b.id ?? "");
}

function brandName(b: Brand): string {
  return String(b.name ?? b.display_name ?? "Unbekannte Marke");
}

// ── Berlin timestamp ───────────────────────────────────────────────────────────

function berlinStand(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "??";
  return `${get("day")}.${get("month")}.${get("year")}, ${get("hour")}:${get("minute")}`;
}

// ── HTML generation ───────────────────────────────────────────────────────────

function buildHtml(
  stand: string,
  niches: NicheData[],
  brandData: BrandData[],
  schedules: Schedule[],
  personaContent: PersonaContent[],
  warnings: string[]
): string {
  const totalPersonas = brandData.reduce((s, b) => s + b.personas.length, 0);

  // Context line
  const contextLine = `${niches.length} Nische${niches.length !== 1 ? "n" : ""} · ${schedules.length} Zeitplan${schedules.length !== 1 ? "e" : ""} · ${totalPersonas} Avatar${totalPersonas !== 1 ? "e" : ""}`;

  // ── Trends tab content ────────────────────────────────────────────────────

  const allTrendsEmpty = niches.every((nd) => nd.trends.length === 0 && !nd.error);

  let trendsHtml: string;
  if (allTrendsEmpty && niches.length > 0) {
    // Action-first cold-start
    let hint: string;
    const enabledSchedules = schedules.filter((s) => s.enabled !== false);
    if (enabledSchedules.length > 0) {
      const sch = enabledSchedules[0];
      const hours = sch.interval_hours ?? 6;
      hint = `dein Zeitplan läuft alle ${esc(String(hours))}h — oder hol dir sofort frische Trends: Sag „jetzt scrapen".`;
    } else if (schedules.length > 0) {
      hint = `du hast Zeitpläne, aber alle sind pausiert — sag „jetzt scrapen" für sofortige Trends, oder reaktiviere einen Zeitplan.`;
    } else {
      hint = `Sag „jetzt scrapen" — dein erster Scrape holt frische Trends für deine Nische.`;
    }
    trendsHtml = `<div class="cold-start">
      <div class="cold-icon">📊</div>
      <h2>Noch keine Trends</h2>
      <p>${hint}</p>
    </div>`;
  } else if (niches.length === 0) {
    trendsHtml = `<div class="cold-start">
      <div class="cold-icon">📊</div>
      <h2>Noch keine Trends</h2>
      <p>Richte zuerst eine Nische ein („richte Trendfinder ein") — danach sag einfach „jetzt scrapen".</p>
    </div>`;
  } else {
    trendsHtml = niches
      .map((nd) => {
        if (nd.error) {
          return `<section class="niche-section">
            <h2 class="niche-title">${esc(nd.niche.display_name)}</h2>
            <p class="niche-error">⚠️ ${esc(nd.error)}</p>
          </section>`;
        }

        if (nd.trends.length === 0) {
          return `<section class="niche-section">
            <h2 class="niche-title">${esc(nd.niche.display_name)}</h2>
            <p class="no-data">Noch keine Daten für diese Nische.</p>
          </section>`;
        }

        // Build velocity map keyed by cluster_id AND trend_label (briefing.ts pattern):
        // cluster_id is the stable join key, trend_label the fallback.
        const velMap = new Map<string, VelocityEntry>();
        for (const v of nd.velocity) {
          const byId = v.cluster_id != null ? String(v.cluster_id) : null;
          const byLabel = v.trend_label ?? v.label ?? v.name ?? v.topic;
          if (byId) velMap.set(byId, v);
          if (byLabel) velMap.set(String(byLabel), v);
        }

        // Sort by trend_score desc
        const sorted = [...nd.trends].sort((a, b) => {
          const sa = typeof a.trend_score === "number" ? a.trend_score : 0;
          const sb = typeof b.trend_score === "number" ? b.trend_score : 0;
          return sb - sa;
        });

        const rows = sorted
          .map((t) => {
            const title = trendTitle(t);
            const score = trendScore(t);
            const videoCount =
              typeof t.video_count === "number" ? String(t.video_count) : null;
            const vel = velMap.get(t.cluster_id != null ? String(t.cluster_id) : title);
            // lifecycle is an object {stage,...} on the trend cluster (contract
            // §trends); lifecycleLabel extracts + localises the stage.
            const lifecycle = lifecycleLabel(t.lifecycle ?? (vel ? vel.lifecycle : null));
            const velocity =
              vel && vel.velocity != null ? String(vel.velocity) : null;

            const extras: string[] = [];
            if (videoCount !== null) extras.push(`${esc(videoCount)} Videos`);
            if (lifecycle !== null) extras.push(`Lifecycle: ${esc(lifecycle)}`);
            if (velocity !== null) extras.push(`Velocity: ${esc(velocity)}`);

            return `<div class="trend-row">
              <div class="trend-title">${esc(title)}</div>
              <div class="trend-meta">
                <span class="score-badge">Score ${esc(score)}</span>
                ${extras.map((x) => `<span class="meta-tag">${x}</span>`).join("")}
              </div>
            </div>`;
          })
          .join("");

        return `<section class="niche-section">
          <h2 class="niche-title">${esc(nd.niche.display_name)} <span class="niche-count">${nd.trends.length} Cluster</span></h2>
          <div class="trend-list">${rows}</div>
        </section>`;
      })
      .join("");
  }

  // ── Avatare tab content ───────────────────────────────────────────────────

  let avatareHtml: string;
  if (totalPersonas === 0) {
    avatareHtml = `<div class="cold-start">
      <div class="cold-icon">🎭</div>
      <h2>Noch kein Avatar</h2>
      <p>Sag „Avatar anlegen" — Marke + Persona mit DNA entstehen in ein paar Minuten, danach schreibe ich Skripte in deiner Stimme.</p>
    </div>`;
  } else {
    avatareHtml = brandData
      .map((bd) => {
        if (bd.personas.length === 0) return "";
        const cards = bd.personas
          .map((p) => {
            const name = String(p.display_name ?? p.name ?? "Unbekannter Avatar");
            const dna = personaDna(p);
            const full = personaDnaFullHtml(p);
            const dnaBlock = full
              ? `<details class="dna-details">
                  <summary>${dna ? esc(dna) : "DNA anzeigen"} <span class="chev">▸ volle DNA</span></summary>
                  <div class="dna-full">${full}</div>
                </details>`
              : dna
                ? `<div class="avatar-dna">${esc(dna)}</div>`
                : "";
            return `<div class="avatar-card">
              <div class="avatar-name">${esc(name)}</div>
              <div class="avatar-brand">${esc(brandName(bd.brand))}</div>
              ${dnaBlock}
            </div>`;
          })
          .join("");
        return `<section class="brand-section">
          <h2 class="brand-title">${esc(brandName(bd.brand))}</h2>
          <div class="avatar-grid">${cards}</div>
        </section>`;
      })
      .filter(Boolean)
      .join("");
  }

  // ── Content tab content (pieces grouped by stage) ─────────────────────────
  const STAGE_LABEL: Record<string, string> = {
    idea: "💡 Ideen",
    script: "✍️ Skripte",
    review: "🔍 In Review",
    rendering: "🎬 Rendering",
    done: "✅ Freigegeben",
  };
  const STAGE_ORDER = ["idea", "script", "review", "rendering", "done"];
  const totalPieces = personaContent.reduce((s, pc) => s + pc.pieces.length, 0);

  let contentHtml: string;
  if (totalPieces === 0) {
    contentHtml = `<div class="cold-start">
      <div class="cold-icon">🗂️</div>
      <h2>Noch kein Content</h2>
      <p>Sag „Content-Plan" für Ideen aus der Avatar-DNA, oder „Skript schreiben" — deine Ideen und Skripte erscheinen hier nach Stufe sortiert.</p>
    </div>`;
  } else {
    contentHtml = personaContent
      .map((pc) => {
        const byStage = new Map<string, ContentPiece[]>();
        for (const piece of pc.pieces) {
          const st = String(piece.stage ?? "idea");
          if (!byStage.has(st)) byStage.set(st, []);
          byStage.get(st)!.push(piece);
        }
        const stageBlocks = STAGE_ORDER.filter((st) => byStage.has(st))
          .map((st) => {
            const rows = byStage
              .get(st)!
              .map((piece) => {
                const title = String(piece.title ?? "Ohne Titel");
                const sd =
                  piece.script_data && typeof piece.script_data === "object" && !Array.isArray(piece.script_data)
                    ? (piece.script_data as Record<string, unknown>)
                    : null;
                const ziel = sd?.ziel ? (ZIEL_LABEL[String(sd.ziel).toLowerCase()] ?? String(sd.ziel)) : null;
                const meta = [piece.pillar, piece.format, ziel].filter(Boolean).map((x) => esc(String(x)));
                const metaHtml = meta.length
                  ? `<div class="content-meta">${meta.map((m) => `<span class="meta-tag">${m}</span>`).join("")}</div>`
                  : "";
                const fullScript = sd ? scriptDataHtml(sd) : "";
                if (fullScript) {
                  return `<details class="content-row">
                    <summary>
                      <div class="content-title">${esc(title)} <span class="chev">▸ Skript ansehen</span></div>
                      ${metaHtml}
                    </summary>
                    <div class="script-full">${fullScript}</div>
                  </details>`;
                }
                return `<div class="content-row">
                  <div class="content-title">${esc(title)}</div>
                  ${metaHtml}
                </div>`;
              })
              .join("");
            return `<div class="stage-group">
              <h3 class="stage-title">${esc(STAGE_LABEL[st] ?? st)} <span class="niche-count">${byStage.get(st)!.length}</span></h3>
              <div class="content-list">${rows}</div>
            </div>`;
          })
          .join("");
        return `<section class="brand-section">
          <h2 class="brand-title">${esc(pc.personaName)} · ${esc(pc.brandName)}</h2>
          ${stageBlocks}
        </section>`;
      })
      .join("");
  }

  // ── Warnings ──────────────────────────────────────────────────────────────

  const warningsHtml =
    warnings.length > 0
      ? `<div class="warnings">
          <ul>${warnings.map((w) => `<li>⚠️ ${esc(w)}</li>`).join("")}</ul>
        </div>`
      : "";

  // ── Schedules summary ─────────────────────────────────────────────────────

  const schedulesHtml =
    schedules.length > 0
      ? `<div class="schedules-bar">
          ${schedules
            .map((s) => {
              const niche = s.niche_id ? esc(s.niche_id) : "?";
              const hours = s.interval_hours ?? "?";
              const enabled = s.enabled !== false;
              const lastRun = s.last_run_at
                ? new Date(s.last_run_at).toLocaleString("de-DE", {
                    timeZone: "Europe/Berlin",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "noch nie";
              return `<div class="sched-chip${enabled ? "" : " disabled"}">
                <span class="sched-dot">${enabled ? "●" : "○"}</span>
                ${niche} alle ${esc(String(hours))}h · zuletzt ${esc(lastRun)}
              </div>`;
            })
            .join("")}
        </div>`
      : "";

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trendfinder-Cockpit</title>
<style>
:root{color-scheme:light;--tx:#1b1f24;--mu:#6b7280;--bd:#e7e9ed;--ac:#2563cc;--sf:#f7f8fa;--gn:#15803d;--gnb:#eaf6ee;--gnbd:#bfe3c9;--am:#b45309;--amb:#fdf2e3;--red:#b42318;--redb:#fde8e8;--bg:#fff}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--tx);background:var(--bg);line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:1040px;margin:0 auto;padding:20px 20px 48px}
.hd{display:flex;align-items:flex-start;gap:14px;margin-bottom:20px}
.hd .mark{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#a78bfa);flex-shrink:0;margin-top:2px}
.hd h1{font-size:22px;font-weight:700;margin:0 0 2px;letter-spacing:-.01em}
.hd .ctx{font-size:13px;color:var(--mu)}
.hd .stand{margin-left:auto;font-size:12px;color:var(--mu);white-space:nowrap;padding-top:4px}
.tabs{display:flex;gap:2px;border-bottom:1px solid var(--bd);margin-bottom:22px}
.tab{appearance:none;border:0;background:none;padding:10px 16px 12px;font:inherit;font-size:14px;color:var(--mu);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}
.tab:hover{color:var(--tx)}.tab.on{color:var(--ac);border-bottom-color:var(--ac);font-weight:500}
.tab-panel{display:none}.tab-panel.on{display:block}
.warnings{background:var(--amb);border:1px solid #f3d9a6;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--am)}
.warnings ul{margin:0;padding-left:18px}
.warnings li{margin:2px 0}
.schedules-bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.sched-chip{background:var(--sf);border:1px solid var(--bd);border-radius:20px;padding:4px 12px;font-size:12.5px;color:var(--tx)}
.sched-chip.disabled{opacity:.55}
.sched-dot{font-size:9px;margin-right:4px;color:var(--gn)}
.sched-chip.disabled .sched-dot{color:var(--mu)}
.cold-start{text-align:center;padding:48px 24px;background:var(--sf);border:1px dashed var(--bd);border-radius:16px}
.cold-icon{font-size:40px;margin-bottom:10px}
.cold-start h2{font-size:20px;font-weight:700;margin:0 0 8px}
.cold-start p{color:var(--mu);max-width:55ch;margin:0 auto;font-size:14px}
.niche-section{margin-bottom:28px}
.niche-title{font-size:16px;font-weight:600;margin:0 0 10px;display:flex;align-items:center;gap:8px}
.niche-count{font-size:12px;font-weight:400;background:#eef1f6;color:#576070;border-radius:20px;padding:2px 8px}
.niche-error{color:var(--am);background:var(--amb);border:1px solid #f3d9a6;border-radius:8px;padding:8px 12px;font-size:13.5px}
.no-data{color:var(--mu);font-size:13.5px;background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:10px 14px}
.trend-list{display:flex;flex-direction:column;gap:8px}
.trend-row{background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:12px 16px}
.trend-title{font-size:14.5px;font-weight:500;margin-bottom:5px}
.trend-meta{display:flex;flex-wrap:wrap;gap:6px}
.score-badge{background:linear-gradient(135deg,#7c3aed22,#a78bfa22);border:1px solid #c4b5fd;color:#6d28d9;font-size:12px;border-radius:20px;padding:2px 9px;font-weight:500}
.meta-tag{background:#eef1f6;color:#576070;font-size:12px;border-radius:20px;padding:2px 8px}
.brand-section{margin-bottom:24px}
.brand-title{font-size:15px;font-weight:600;margin:0 0 10px;color:var(--mu);text-transform:uppercase;letter-spacing:.04em;font-size:12px}
.avatar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.avatar-card{background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:14px 16px}
.avatar-name{font-size:15px;font-weight:600;margin-bottom:3px}
.avatar-brand{font-size:12px;color:var(--mu);margin-bottom:8px}
.avatar-dna{font-size:13px;color:#3a3f47;line-height:1.55;border-top:1px solid var(--bd);padding-top:8px;margin-top:6px;word-break:break-word}
.foot{font-size:12px;color:var(--mu);margin-top:28px;border-top:1px solid var(--bd);padding-top:10px}
.stage-group{margin-bottom:18px}
.stage-title{font-size:13px;font-weight:600;margin:0 0 8px;display:flex;align-items:center;gap:8px}
.content-list{display:flex;flex-direction:column;gap:6px}
.content-row{background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:10px 14px}
.content-title{font-size:14px;font-weight:500;margin-bottom:4px}
.content-meta{display:flex;flex-wrap:wrap;gap:6px}
details.content-row>summary,details.dna-details>summary{cursor:pointer;list-style:none}
details.content-row>summary::-webkit-details-marker,details.dna-details>summary::-webkit-details-marker{display:none}
.chev{font-size:11.5px;font-weight:400;color:var(--ac);white-space:nowrap}
details[open]>summary .chev{opacity:.55}
.script-full,.dna-full{display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--bd);margin-top:10px;padding-top:12px}
.sd-label{font-size:11px;font-weight:600;color:var(--mu);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.sd-value{font-size:13.5px;color:#2a2f36;line-height:1.6}
.pre{white-space:pre-wrap;word-break:break-word}
.sd-list{margin:0;padding-left:18px}
.sd-list li{margin:3px 0}
.sd-tags{display:flex;flex-wrap:wrap;gap:6px}
.sd-kv{display:flex;flex-direction:column;gap:3px}
.sd-k{color:var(--mu);font-weight:500}
details.dna-details{margin-top:6px}
details.dna-details>summary{font-size:13px;color:#3a3f47;line-height:1.55;border-top:1px solid var(--bd);padding-top:8px;word-break:break-word}
.avatar-grid .avatar-card:has(details[open]){grid-column:1/-1}
</style>
</head>
<body><div class="wrap">
  <div class="hd">
    <div class="mark"></div>
    <div>
      <h1>Trendfinder-Cockpit</h1>
      <div class="ctx">${esc(contextLine)}</div>
    </div>
    <div class="stand">Stand: ${esc(stand)}</div>
  </div>

  ${warningsHtml}
  ${schedulesHtml}

  <div class="tabs">
    <button class="tab on" onclick="showTab('trends')">Trends</button>
    <button class="tab" onclick="showTab('avatare')">Avatare</button>
    <button class="tab" onclick="showTab('content')">Content</button>
  </div>

  <div class="tab-panel on" id="tab-trends">
    ${trendsHtml}
  </div>
  <div class="tab-panel" id="tab-avatare">
    ${avatareHtml}
  </div>
  <div class="tab-panel" id="tab-content">
    ${contentHtml}
  </div>

  <div class="foot">Trendfinder-Cockpit · Daten zum Zeitpunkt der Generierung abgerufen · Aktualisieren: „zeig das Cockpit"</div>
</div>
<script>
function showTab(name) {
  var panels = document.querySelectorAll('.tab-panel');
  var tabs = document.querySelectorAll('.tab');
  panels.forEach(function(p) { p.classList.remove('on'); });
  tabs.forEach(function(t) { t.classList.remove('on'); });
  var panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('on');
  var order = { trends: 0, avatare: 1, content: 2 };
  var idx = order[name] != null ? order[name] : 0;
  if (tabs[idx]) tabs[idx].classList.add('on');
}
</script>
</body></html>`;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  // --data <snapshot.json> ist Pflicht; das Positionsargument ist <workspace_root>.
  const argv = process.argv.slice(2);
  let dataPath: string | null = null;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--data") {
      dataPath = argv[++i] ?? null;
    } else {
      positional.push(argv[i]);
    }
  }
  const ws = positional[0];
  if (!ws || !dataPath) {
    process.stderr.write(
      "Fehler: Aufruf: bun cockpit.ts --data <snapshot.json> <workspace_root>\n"
    );
    process.exit(1);
  }

  let snap: Snapshot;
  try {
    snap = loadSnapshot(dataPath);
  } catch (e) {
    process.stderr.write(`Snapshot-Fehler: ${(e as Error).message}\n`);
    process.exit(1);
  }

  const stand = berlinStand();
  const warnings: string[] = Array.isArray(snap.warnings)
    ? (snap.warnings as unknown[]).map(String)
    : [];

  // ── Per-niche trends + velocity aus dem Snapshot ──────────────────────────
  const nicheData: NicheData[] = [];
  for (const niche of extractList(snap.niches) as Niche[]) {
    const id = niche.niche_id;
    if (!id) {
      warnings.push(`Nische ohne niche_id übersprungen`);
      continue;
    }
    const error = snap.errors?.[id];
    nicheData.push({
      niche,
      trends: extractList(snap.trends?.[id]) as TrendCluster[],
      velocity: extractList(snap.velocity?.[id]) as VelocityEntry[],
      ...(error ? { error: String(error) } : {}),
    });
  }

  // ── Brands + angereicherte Personas aus dem Snapshot ──────────────────────
  // snapshot.personas trägt die vollen Persona-Detailobjekte (DNA inklusive) —
  // die Anreicherung slim → voll macht Claude beim Zusammenstellen des
  // Snapshots (GET /api/brands/{id}/personas, dann GET /api/personas/{pid}).
  const brandData: BrandData[] = [];
  for (const brand of extractList(snap.brands) as Brand[]) {
    const bid = brandId(brand);
    if (!bid) continue;
    brandData.push({
      brand,
      personas: extractList(snap.personas?.[bid]) as Persona[],
    });
  }

  // ── Content pieces pro Persona aus dem Snapshot ───────────────────────────
  const personaContent: PersonaContent[] = [];
  for (const bd of brandData) {
    for (const p of bd.personas) {
      const pid = String(p.persona_id ?? p.id ?? "");
      if (!pid) continue;
      const pieces = extractList(snap.content_pieces?.[pid]) as ContentPiece[];
      if (pieces.length > 0) {
        personaContent.push({
          personaName: String(p.display_name ?? p.name ?? pid),
          brandName: brandName(bd.brand),
          pieces,
        });
      }
    }
  }

  const schedules = extractList(snap.schedules) as Schedule[];

  // ── Build + write HTML ────────────────────────────────────────────────────
  const html = buildHtml(stand, nicheData, brandData, schedules, personaContent, warnings);

  const outDir = path.join(ws, ".trendfinder");
  const outPath = path.join(outDir, "cockpit.html");

  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
  } catch (e) {
    process.stderr.write(
      `Ausgabe konnte nicht geschrieben werden: ${(e as Error).message}\n`
    );
    process.exit(1);
  }

  // Last stdout line = absolute path
  process.stdout.write(path.resolve(outPath) + "\n");
}

main().catch((e) => {
  process.stderr.write(`Unerwarteter Fehler: ${(e as Error).message}\n`);
  process.exit(1);
});
