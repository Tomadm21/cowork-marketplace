#!/usr/bin/env bun
/**
 * Trendfinder — Trend-Briefing live-artifact generator (dependency-free, NETWORK-FREE).
 *
 * Renders ONE self-contained HTML file from a pre-fetched data snapshot.
 * This script makes NO network requests and reads NO config/API key — it runs
 * inside the Cowork bash sandbox, whose egress allowlist blocks the backend.
 * Claude fetches the data host-side via the trendfinder MCP server
 * (tf_request), writes it to a snapshot JSON, and passes it here. Niche
 * selection (incl. tenant-isolation: only slugs from this tenant's
 * GET /api/niches/config) happens in Claude BEFORE the snapshot is written.
 *
 *   bun briefing.ts --data <snapshot.json> <workspace_root>
 *
 * snapshot.json shape — "trends"/"velocity" are the RAW response bodies of the
 * named tf_request calls (bare list or wrapped-list object, both tolerated);
 * "niche" is required, everything else optional and defaults to empty:
 *
 *   {
 *     "niche":    <der Eintrag der Ziel-Nische aus GET /api/niches/config>,
 *     "trends":   <GET /api/trends/{niche_id}>,
 *     "velocity": <GET /api/trends/{niche_id}/velocity>,
 *     "warnings": ["<Hinweis>", …]
 *   }
 *
 * Output: <workspace_root>/Trend-Briefing.html (visible on purpose —
 * dot-folders are hidden in the Cowork file panel).
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
  cluster_id?: string;
  trend_label?: string;
  label?: string;
  name?: string;
  topic?: string;
  trend_score?: unknown;
  video_count?: unknown;
  video_count_delta?: unknown;
  description?: unknown;
  hook_type?: unknown;
  hook_examples?: unknown;
  visual_style?: unknown;
  avg_engagement_rate?: unknown;
  scripted_count?: unknown;
  dismissed?: unknown;
  dominant_hashtags?: unknown;
  dominant_audio_type?: unknown;
  top_sounds?: unknown;
  lifecycle?: unknown;
  velocity?: unknown;
  trajectory_counts?: unknown;
  [k: string]: unknown;
}

interface VelocityEntry {
  cluster_id?: string;
  trend_label?: string;
  label?: string;
  name?: string;
  topic?: string;
  lifecycle?: unknown;
  velocity?: unknown;
  trajectory?: unknown;
  [k: string]: unknown;
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
  niche?: unknown;
  trends?: unknown;
  velocity?: unknown;
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
  const score = t.trend_score;
  if (typeof score === "number" && isFinite(score)) {
    return score.toFixed(1);
  }
  return "—";
}

function trendScoreNum(t: TrendCluster): number {
  const score = t.trend_score;
  return typeof score === "number" && isFinite(score) ? score : 0;
}

// The API returns lifecycle as an object {stage, age_days, days_since_peak};
// older payloads may carry a bare string. Real stages: unknown/emerging/rising/peak/declining.
function lifecycleStage(lc: unknown): string {
  const stage =
    lc != null && typeof lc === "object" ? (lc as Record<string, unknown>).stage : lc;
  return String(stage ?? "").toLowerCase();
}

function lifecycleBadge(lc: unknown): string {
  const s = lifecycleStage(lc);
  if (s === "emerging") return "neu";
  if (s === "rising" || s === "growing") return "steigt";
  if (s === "peak") return "Peak";
  if (s === "declining") return "sinkend";
  if (s === "stable") return "stabil";
  if (s === "unknown") return "—";
  return s || "—";
}

function lifecycleClass(lc: unknown): string {
  const s = lifecycleStage(lc);
  if (s === "emerging" || s === "rising" || s === "growing") return "lc-growing";
  if (s === "peak") return "lc-peak";
  if (s === "declining") return "lc-declining";
  return "lc-stable";
}

function hookExampleStr(he: unknown): string {
  if (!he) return "";
  if (typeof he === "string") return he;
  if (Array.isArray(he) && he.length > 0) return String(he[0]);
  return String(he);
}

function hashtagStr(h: unknown): string {
  if (!h) return "";
  if (Array.isArray(h)) {
    return h
      .slice(0, 3)
      .map((t) => `#${String(t).replace(/^#/, "")}`)
      .join("  ");
  }
  if (typeof h === "string") return h;
  return "";
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
  niche: Niche,
  trends: TrendCluster[],
  velocity: VelocityEntry[],
  warnings: string[]
): string {
  // Build velocity map by cluster_id or trend_label
  const velMap = new Map<string, VelocityEntry>();
  for (const v of velocity) {
    const byId = v.cluster_id ? String(v.cluster_id) : null;
    const byLabel = v.trend_label ?? v.label ?? v.name ?? v.topic;
    if (byId) velMap.set(byId, v);
    if (byLabel) velMap.set(String(byLabel), v);
  }

  // Sort by trend_score desc (skip dismissed by default)
  const sorted = [...trends]
    .filter((t) => !t.dismissed)
    .sort((a, b) => trendScoreNum(b) - trendScoreNum(a));

  // Top clusters (up to 5)
  const top = sorted.slice(0, 5);

  // Rising sleepers: not in top5, positive velocity, growing lifecycle
  const risingIds = new Set(
    top.map((t) => t.cluster_id ?? trendTitle(t))
  );
  const rising = sorted
    .filter((t) => {
      if (risingIds.has(t.cluster_id ?? trendTitle(t))) return false;
      const vel = velMap.get(t.cluster_id ? String(t.cluster_id) : trendTitle(t));
      const v = vel?.velocity ?? t.velocity;
      return typeof v === "number" && v > 0;
    })
    .slice(0, 3);

  // Declining: lifecycle stage === declining AND negative velocity
  const declining = sorted
    .filter((t) => {
      const lc = lifecycleStage(t.lifecycle);
      const vel = velMap.get(t.cluster_id ? String(t.cluster_id) : trendTitle(t));
      const v = vel?.velocity ?? t.velocity;
      return lc === "declining" && typeof v === "number" && v < 0;
    })
    .slice(0, 3);

  // ── Warnings HTML ─────────────────────────────────────────────────────────

  const warningsHtml =
    warnings.length > 0
      ? `<div class="warnings">
          <ul>${warnings.map((w) => `<li>⚠️ ${esc(w)}</li>`).join("")}</ul>
        </div>`
      : "";

  // ── Main content ──────────────────────────────────────────────────────────

  let mainHtml: string;

  if (trends.length === 0) {
    // Action-first cold-start
    mainHtml = `<div class="cold-start">
      <div class="cold-icon">📊</div>
      <h2>Noch keine Trend-Daten</h2>
      <p>Für <strong>${esc(niche.display_name)}</strong> liegen noch keine Cluster vor.<br>
         Starte einen Scrape: „Scrape jetzt“ — danach kannst du das Briefing erneut generieren.</p>
    </div>`;
  } else {
    // Helper: render one cluster card
    const renderCard = (t: TrendCluster, rank?: number): string => {
      const title = trendTitle(t);
      const score = trendScore(t);
      const vel = velMap.get(t.cluster_id ? String(t.cluster_id) : title);
      const velocityVal = vel?.velocity ?? t.velocity;
      const velocityStr =
        typeof velocityVal === "number"
          ? (velocityVal >= 0 ? "+" : "") + velocityVal.toFixed(2)
          : "—";

      const lc = t.lifecycle ?? null;
      const lcLabel = lc ? lifecycleBadge(lc) : "";
      const lcClass = lc ? lifecycleClass(lc) : "";

      const videoCount =
        typeof t.video_count === "number" ? String(t.video_count) : null;
      const delta =
        typeof t.video_count_delta === "number" && t.video_count_delta !== 0
          ? `+${t.video_count_delta}`
          : null;

      const hookType = t.hook_type ? String(t.hook_type) : null;
      const hookEx = hookExampleStr(t.hook_examples);
      const visualStyle = t.visual_style ? String(t.visual_style) : null;
      const audioType = t.dominant_audio_type ? String(t.dominant_audio_type) : null;
      const hashtags = hashtagStr(t.dominant_hashtags);
      const desc = t.description ? String(t.description) : null;
      const scripted =
        typeof t.scripted_count === "number" && t.scripted_count > 0
          ? t.scripted_count
          : null;

      const rankBadge =
        rank != null
          ? `<span class="rank-badge">#${rank}</span>`
          : "";

      return `<div class="trend-card">
        <div class="trend-card-header">
          <div class="trend-title">${rankBadge}${esc(title)}</div>
          <div class="trend-badges">
            <span class="score-badge">Score ${esc(score)}</span>
            <span class="vel-badge">Velocity ${esc(velocityStr)}</span>
            ${lcLabel ? `<span class="lc-badge ${esc(lcClass)}">${esc(lcLabel)}</span>` : ""}
            ${scripted ? `<span class="scripted-badge">📝 ${esc(String(scripted))} Skript${Number(scripted) !== 1 ? "e" : ""}</span>` : ""}
          </div>
        </div>
        ${desc ? `<p class="trend-desc">${esc(desc)}</p>` : ""}
        <div class="trend-details">
          ${videoCount !== null ? `<div class="detail-row"><span class="detail-label">Videos</span><span class="detail-val">${esc(videoCount)}${delta ? ` <span class="delta">${esc(delta)}</span>` : ""}</span></div>` : ""}
          ${hookType ? `<div class="detail-row"><span class="detail-label">Hook-Typ</span><span class="detail-val">${esc(hookType)}</span></div>` : ""}
          ${hookEx ? `<div class="detail-row"><span class="detail-label">Hook-Beispiel</span><span class="detail-val hook-example">&ldquo;${esc(hookEx)}&rdquo;</span></div>` : ""}
          ${visualStyle ? `<div class="detail-row"><span class="detail-label">Format</span><span class="detail-val">${esc(visualStyle)}</span></div>` : ""}
          ${audioType ? `<div class="detail-row"><span class="detail-label">Audio</span><span class="detail-val">${esc(audioType)}</span></div>` : ""}
          ${hashtags ? `<div class="detail-row"><span class="detail-label">Hashtags</span><span class="detail-val hashtags">${esc(hashtags)}</span></div>` : ""}
        </div>
      </div>`;
    };

    // Top trends section
    const topCards = top
      .map((t, i) => renderCard(t, i + 1))
      .join("");

    // Rising sleepers section
    const risingSection =
      rising.length > 0
        ? `<section class="briefing-section">
            <h2 class="section-title">Schnellste Aufsteiger <span class="section-sub">Hohe Velocity, nicht in Top-5</span></h2>
            <div class="trend-list">${rising.map((t) => renderCard(t)).join("")}</div>
          </section>`
        : "";

    // Declining section
    const decliningSection =
      declining.length > 0
        ? `<section class="briefing-section">
            <h2 class="section-title declining-title">Auslaufende Trends <span class="section-sub">Lifecycle sinkend + negative Velocity</span></h2>
            <div class="trend-list">${declining.map((t) => renderCard(t)).join("")}</div>
          </section>`
        : "";

    mainHtml = `
      <section class="briefing-section">
        <h2 class="section-title">Aktuelle Top-Trends <span class="section-sub">${esc(niche.display_name)} · ${top.length} von ${sorted.length} Clustern</span></h2>
        <div class="trend-list">${topCards}</div>
      </section>
      ${risingSection}
      ${decliningSection}
    `;
  }

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trend-Briefing — ${esc(niche.display_name)}</title>
<style>
:root{color-scheme:light;--tx:#1b1f24;--mu:#6b7280;--bd:#e7e9ed;--ac:#2563cc;--sf:#f7f8fa;--gn:#15803d;--gnb:#eaf6ee;--gnbd:#bfe3c9;--am:#b45309;--amb:#fdf2e3;--red:#b42318;--redb:#fde8e8;--bg:#fff;--pu:#7c3aed;--pub:#f3f0ff;--pubd:#c4b5fd}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--tx);background:var(--bg);line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:840px;margin:0 auto;padding:20px 20px 56px}
.hd{display:flex;align-items:flex-start;gap:14px;margin-bottom:24px}
.hd .mark{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#a78bfa);flex-shrink:0;margin-top:2px}
.hd-text h1{font-size:22px;font-weight:700;margin:0 0 2px;letter-spacing:-.01em}
.hd-text .niche-label{font-size:13px;color:var(--mu)}
.hd .stand{margin-left:auto;font-size:12px;color:var(--mu);white-space:nowrap;padding-top:4px}
.warnings{background:var(--amb);border:1px solid #f3d9a6;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--am)}
.warnings ul{margin:0;padding-left:18px}
.warnings li{margin:2px 0}
.cold-start{text-align:center;padding:56px 24px;background:var(--sf);border:1px dashed var(--bd);border-radius:16px}
.cold-icon{font-size:44px;margin-bottom:12px}
.cold-start h2{font-size:20px;font-weight:700;margin:0 0 10px}
.cold-start p{color:var(--mu);max-width:52ch;margin:0 auto;font-size:14px;line-height:1.6}
.briefing-section{margin-bottom:32px}
.section-title{font-size:16px;font-weight:700;margin:0 0 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.section-sub{font-size:12px;font-weight:400;color:var(--mu)}
.declining-title{color:var(--red)}
.trend-list{display:flex;flex-direction:column;gap:14px}
.trend-card{background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:16px 18px}
.trend-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;flex-wrap:wrap}
.trend-title{font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px}
.rank-badge{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;border-radius:50%;font-size:11px;font-weight:700;flex-shrink:0}
.trend-badges{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.score-badge{background:var(--pub);border:1px solid var(--pubd);color:var(--pu);font-size:12px;border-radius:20px;padding:2px 9px;font-weight:500;white-space:nowrap}
.vel-badge{background:#f0f9f4;border:1px solid var(--gnbd);color:var(--gn);font-size:12px;border-radius:20px;padding:2px 9px;font-weight:500;white-space:nowrap}
.lc-badge{font-size:12px;border-radius:20px;padding:2px 9px;font-weight:500;white-space:nowrap}
.lc-growing{background:var(--gnb);border:1px solid var(--gnbd);color:var(--gn)}
.lc-peak{background:#fefce8;border:1px solid #fde68a;color:#92400e}
.lc-declining{background:var(--redb);border:1px solid #fca5a5;color:var(--red)}
.lc-stable{background:var(--sf);border:1px solid var(--bd);color:var(--mu)}
.scripted-badge{background:#fff7ed;border:1px solid #fed7aa;color:#c2410c;font-size:12px;border-radius:20px;padding:2px 9px;font-weight:500;white-space:nowrap}
.trend-desc{font-size:13.5px;color:#3a3f47;margin:0 0 10px;line-height:1.55}
.trend-details{display:flex;flex-direction:column;gap:5px;font-size:13px}
.detail-row{display:flex;gap:10px;align-items:baseline}
.detail-label{color:var(--mu);min-width:110px;flex-shrink:0;font-size:12px}
.detail-val{color:var(--tx);word-break:break-word}
.hook-example{font-style:italic;color:#374151}
.hashtags{color:var(--ac);letter-spacing:.01em}
.delta{color:var(--gn);font-size:12px;font-weight:500}
.foot{font-size:12px;color:var(--mu);margin-top:32px;border-top:1px solid var(--bd);padding-top:10px;line-height:1.6}
.foot strong{color:var(--tx)}
</style>
</head>
<body><div class="wrap">
  <div class="hd">
    <div class="mark"></div>
    <div class="hd-text">
      <h1>Trend-Briefing</h1>
      <div class="niche-label">${esc(niche.display_name)}</div>
    </div>
    <div class="stand">Stand: ${esc(stand)}</div>
  </div>

  ${warningsHtml}

  ${mainHtml}

  <div class="foot">
    <strong>Trend-Briefing</strong> · Nische: ${esc(niche.display_name)} (${esc(niche.niche_id)}) ·
    Daten zum Zeitpunkt der Generierung abgerufen · Keine Laufzeit-Requests ·
    Aktualisieren: „zeig das Trend-Briefing“
  </div>
</div>
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
      "Fehler: Aufruf: bun briefing.ts --data <snapshot.json> <workspace_root>\n"
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

  // ── Ziel-Nische aus dem Snapshot (Auswahl + Tenant-Check macht Claude) ────
  const targetNiche = snap.niche as Niche | undefined;
  if (!targetNiche || typeof targetNiche !== "object" || !targetNiche.niche_id) {
    process.stderr.write(
      "Snapshot-Fehler: \"niche\" fehlt oder hat keine niche_id — die Ziel-Nische muss vor der Generierung über GET /api/niches/config aufgelöst werden.\n"
    );
    process.exit(1);
  }

  const stand = berlinStand();
  const warnings: string[] = Array.isArray(snap.warnings)
    ? (snap.warnings as unknown[]).map(String)
    : [];

  // No persona_id in the snapshot data: the briefing is deliberately niche-level.
  // Avatar-personalised output is done natively in Claude via the script-studio skill.
  const trends = extractList(snap.trends) as TrendCluster[];
  const velocity = extractList(snap.velocity) as VelocityEntry[];

  // ── Build + write HTML ────────────────────────────────────────────────────
  const html = buildHtml(stand, targetNiche, trends, velocity, warnings);

  // VISIBLE path in the workspace root — Cowork's file panel hides dot-folders,
  // so an HTML inside .trendfinder/ can neither be seen nor manually opened
  // when the artifact panel fails to render.
  const outPath = path.join(ws, "Trend-Briefing.html");

  try {
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
