#!/usr/bin/env bun
/**
 * Trendfinder — Cockpit live-artifact generator (dependency-free).
 *
 * Fetches all tenant data at generation time, then emits ONE self-contained
 * HTML file with all data inlined. No fetch() inside the HTML.
 *
 *   bun cockpit.ts <workspace_root>
 *
 * Config resolution:
 *   1. env TRENDFINDER_CONFIG (absolute path to config.json)
 *   2. <workspace_root>/.trendfinder/config.json
 *   3. Walk up from cwd until / looking for .trendfinder/config.json
 *
 * Output: <workspace_root>/.trendfinder/cockpit.html
 * Last stdout line = absolute path to the written file.
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ── types ──────────────────────────────────────────────────────────────────────

interface Config {
  base_url: string;
  api_key: string;
}

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

// ── config loading ─────────────────────────────────────────────────────────────

function loadConfig(ws: string): Config {
  // 1. env override
  const envPath = process.env.TRENDFINDER_CONFIG;
  if (envPath) {
    try {
      const raw = fs.readFileSync(envPath, "utf8");
      const cfg = JSON.parse(raw) as Config;
      if (cfg.base_url && cfg.api_key) return cfg;
    } catch {
      // fall through
    }
  }

  // 2. workspace-relative
  const wsPath = path.join(ws, ".trendfinder", "config.json");
  try {
    const raw = fs.readFileSync(wsPath, "utf8");
    const cfg = JSON.parse(raw) as Config;
    if (cfg.base_url && cfg.api_key) return cfg;
  } catch {
    // fall through
  }

  // 3. walk up from cwd
  let dir = process.cwd();
  while (true) {
    const candidate = path.join(dir, ".trendfinder", "config.json");
    try {
      const raw = fs.readFileSync(candidate, "utf8");
      const cfg = JSON.parse(raw) as Config;
      if (cfg.base_url && cfg.api_key) return cfg;
    } catch {
      // ignore
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    "Konfiguration nicht gefunden. Lege .trendfinder/config.json mit base_url + api_key an."
  );
}

// ── API client ─────────────────────────────────────────────────────────────────

async function apiFetch(cfg: Config, endpoint: string): Promise<unknown> {
  const url = `${cfg.base_url.replace(/\/$/, "")}${endpoint}`;
  const res = await fetch(url, {
    headers: { "X-API-Key": cfg.api_key },
  });
  if (res.status === 401) {
    throw new Error(
      "API-Authentifizierung fehlgeschlagen (401). Prüfe den api_key in der Konfiguration."
    );
  }
  if (!res.ok && res.status !== 404) {
    throw new Error(`API-Fehler ${res.status} für ${endpoint}`);
  }
  if (res.status === 404) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
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
            return `<div class="avatar-card">
              <div class="avatar-name">${esc(name)}</div>
              <div class="avatar-brand">${esc(brandName(bd.brand))}</div>
              ${dna ? `<div class="avatar-dna">${esc(dna)}</div>` : ""}
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
                const meta = [piece.pillar, piece.format].filter(Boolean).map((x) => esc(String(x)));
                return `<div class="content-row">
                  <div class="content-title">${esc(title)}</div>
                  ${meta.length ? `<div class="content-meta">${meta.map((m) => `<span class="meta-tag">${m}</span>`).join("")}</div>` : ""}
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
  const ws = process.argv[2];
  if (!ws) {
    process.stderr.write(
      "Fehler: Workspace-Verzeichnis fehlt. Aufruf: bun cockpit.ts <workspace_root>\n"
    );
    process.exit(1);
  }

  let cfg: Config;
  try {
    cfg = loadConfig(ws);
  } catch (e) {
    process.stderr.write(`Konfigurationsfehler: ${(e as Error).message}\n`);
    process.exit(1);
  }

  // ── Auth/health gate via niches ──────────────────────────────────────────
  let niches: Niche[];
  try {
    const raw = await apiFetch(cfg, "/api/niches/config");
    niches = extractList(raw) as Niche[];
  } catch (e) {
    process.stderr.write(
      `Trendfinder API nicht erreichbar: ${(e as Error).message}\n`
    );
    process.exit(1);
  }

  const stand = berlinStand();
  const warnings: string[] = [];

  // ── Per-niche trend + velocity fetch ─────────────────────────────────────
  const nicheData: NicheData[] = [];
  for (const niche of niches) {
    const id = niche.niche_id;
    if (!id) {
      warnings.push(`Nische ohne niche_id übersprungen`);
      continue;
    }
    try {
      const rawTrends = await apiFetch(cfg, `/api/trends/${id}`);
      const trends = extractList(rawTrends) as TrendCluster[];

      let velocity: VelocityEntry[] = [];
      if (trends.length > 0) {
        try {
          const rawVel = await apiFetch(cfg, `/api/trends/${id}/velocity`);
          velocity = extractList(rawVel) as VelocityEntry[];
        } catch {
          // velocity is optional — ignore failure
        }
      }

      nicheData.push({ niche, trends, velocity });
    } catch (e) {
      warnings.push(`${niche.display_name} konnte nicht geladen werden`);
      nicheData.push({ niche, trends: [], velocity: [], error: String((e as Error).message) });
    }
  }

  // ── Brands + personas fetch (tenant-scoped since 2026-06-16) ──────────────
  // /api/brands und /api/brands/{id}/personas sind serverseitig tenant-gescoped:
  // diese Tenant sieht ausschließlich die eigenen Avatare (das frühere
  // Cross-Tenant-Leck ist geschlossen). avatar-studio legt sie an, hier werden
  // sie gerendert. Bei null Avataren bleibt der Cold-Start-Zustand erhalten.
  const brandData: BrandData[] = [];
  try {
    const rawBrands = await apiFetch(cfg, "/api/brands");
    const brands = extractList(rawBrands) as Brand[];
    for (const brand of brands) {
      const bid = brandId(brand);
      if (!bid) continue;
      let personas: Persona[] = [];
      try {
        const rawP = await apiFetch(cfg, `/api/brands/${bid}/personas`);
        const slim = extractList(rawP) as Persona[];
        // The list endpoint returns only {id, persona_id, display_name} — no DNA.
        // Enrich each persona with its detail (GET /api/personas/{id}) so the
        // Avatare tab can render persona_profile / tone_of_voice / pillars.
        for (const p of slim) {
          const pid = String(p.persona_id ?? p.id ?? "");
          if (!pid) {
            personas.push(p);
            continue;
          }
          try {
            const full = await apiFetch(cfg, `/api/personas/${pid}`);
            personas.push(
              full && typeof full === "object" ? (full as Persona) : p
            );
          } catch {
            personas.push(p); // fall back to the slim list item
          }
        }
      } catch {
        warnings.push(`Avatare für ${brandName(brand)} konnten nicht geladen werden`);
      }
      brandData.push({ brand, personas });
    }
  } catch {
    warnings.push("Avatare konnten nicht geladen werden");
  }

  // ── Content pieces per persona (tenant-scoped CRUD, SP1) ──────────────────
  const personaContent: PersonaContent[] = [];
  for (const bd of brandData) {
    for (const p of bd.personas) {
      const pid = String(p.persona_id ?? p.id ?? "");
      if (!pid) continue;
      try {
        const raw = await apiFetch(cfg, `/api/personas/${pid}/content-pieces`);
        const pieces = extractList(raw) as ContentPiece[];
        if (pieces.length > 0) {
          personaContent.push({
            personaName: String(p.display_name ?? p.name ?? pid),
            brandName: brandName(bd.brand),
            pieces,
          });
        }
      } catch {
        warnings.push(`Content für ${String(p.display_name ?? pid)} konnte nicht geladen werden`);
      }
    }
  }

  // ── Schedules fetch ───────────────────────────────────────────────────────
  let schedules: Schedule[] = [];
  try {
    const rawSchedules = await apiFetch(cfg, "/api/schedules");
    schedules = extractList(rawSchedules) as Schedule[];
  } catch {
    warnings.push("Zeitpläne konnten nicht geladen werden");
  }

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
