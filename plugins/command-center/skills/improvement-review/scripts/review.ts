#!/usr/bin/env bun
/**
 * Command Center — operator review report generator (deterministic, dependency-free).
 * Mirrors dashboard.ts: best-effort, never crashes on missing/partial state.
 *   bun review.ts <workspace_root> [output.md]
 */

export type SignalType = "correction" | "recurring_check" | "observation" | "fact" | "tech_change";
export interface Signal { ts: string; process: string; type: SignalType; key: string; detail?: string; }
export interface Pattern {
  name: string; keys: string[]; beleg: string;
  impact: "hoch" | "mittel" | "niedrig"; aufwand?: string; empfehlung?: string;
}

export function loadSignals(raw: string): Signal[] {
  const out: Signal[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let e: any;
    try { e = JSON.parse(t); } catch { continue; }
    if (!e || typeof e !== "object") continue;
    if (typeof e.key !== "string" || typeof e.type !== "string") continue;
    out.push({
      ts: String(e.ts ?? ""), process: String(e.process ?? ""),
      type: e.type as SignalType, key: e.key,
      detail: e.detail != null ? String(e.detail) : undefined,
    });
  }
  return out;
}

// Assumes the signals.md contract: UTC Z-suffixed timestamps, which compare correctly lexically.
export function windowSignals(signals: Signal[], watermarkTs: string): Signal[] {
  if (!watermarkTs) return signals;
  return signals.filter((s) => s.ts > watermarkTs);
}

export interface Cluster {
  key: string; count: number; type: SignalType; details: string[];
  pattern?: Pattern; rank: number;
}
export interface GateResult {
  stapel: Cluster[]; geparkt: Cluster[]; candidates: Cluster[];
  facts: Signal[]; tech: Cluster[];
}

const IMPACT_WEIGHT: Record<Pattern["impact"], number> = { hoch: 3, mittel: 2, niedrig: 1 };

export function gate(signals: Signal[], patterns: Pattern[], threshold = 3): GateResult {
  const patternForKey = (key: string): Pattern | undefined =>
    patterns.find((p) => p.keys.includes(key));

  const facts = signals.filter((s) => s.type === "fact");

  const techMap = new Map<string, Cluster>();
  for (const s of signals.filter((s) => s.type === "tech_change")) {
    const c = techMap.get(s.key) ?? { key: s.key, count: 0, type: "tech_change" as SignalType, details: [], rank: 0 };
    c.count++; if (s.detail) c.details.push(s.detail);
    techMap.set(s.key, c);
  }
  const tech = [...techMap.values()];

  const clusterMap = new Map<string, Cluster>();
  for (const s of signals) {
    if (!(s.type === "correction" || s.type === "recurring_check" || s.type === "observation")) continue;
    const c = clusterMap.get(s.key) ?? { key: s.key, count: 0, type: s.type, details: [], rank: 0 };
    c.count++; if (s.detail) c.details.push(s.detail);
    clusterMap.set(s.key, c);
  }

  const stapel: Cluster[] = [], geparkt: Cluster[] = [], candidates: Cluster[] = [];
  for (const c of clusterMap.values()) {
    const p = patternForKey(c.key);
    c.pattern = p;
    c.rank = c.count * (p ? IMPACT_WEIGHT[p.impact] : 1);
    const isObservation = c.type === "observation";
    if (!isObservation && c.count < threshold) continue; // below recurrence → dropped
    if (!p) { geparkt.push(c); continue; }                // no evidence → parked
    if (isObservation) candidates.push(c); else stapel.push(c);
  }
  const byRank = (a: Cluster, b: Cluster) => b.rank - a.rank;
  stapel.sort(byRank); candidates.sort(byRank); geparkt.sort(byRank);
  return { stapel, geparkt, candidates, facts, tech };
}

export function parsePatterns(md: string): Pattern[] {
  const out: Pattern[] = [];
  const blocks = md.split(/^##\s+/m).slice(1); // each block starts right after "## "
  for (const b of blocks) {
    const name = (b.split("\n", 1)[0] || "").trim();
    const field = (n: string): string => {
      const m = b.match(new RegExp(`^[-*]\\s*${n}[ \\t]*:[ \\t]*(.+)$`, "im"));
      return m ? m[1].trim() : "";
    };
    const keysRaw = field("keys");
    if (!keysRaw) continue; // not a machine pattern
    const keys = keysRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const impactRaw = field("impact").toLowerCase();
    const impact = (["hoch", "mittel", "niedrig"].includes(impactRaw) ? impactRaw : "mittel") as Pattern["impact"];
    out.push({ name, keys, beleg: field("beleg"), impact, aufwand: field("aufwand"), empfehlung: field("empfehlung") });
  }
  return out;
}
