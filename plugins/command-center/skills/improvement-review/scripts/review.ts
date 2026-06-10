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

export function parsePatterns(md: string): Pattern[] {
  const out: Pattern[] = [];
  const blocks = md.split(/^##\s+/m).slice(1); // each block starts right after "## "
  for (const b of blocks) {
    const name = (b.split("\n", 1)[0] || "").trim();
    const field = (n: string): string => {
      const m = b.match(new RegExp(`^[-*]\\s*${n}\\s*:\\s*(.+)$`, "im"));
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
