import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  firmName,
  loadActivity,
  loadJournal,
  loadQueues,
  countByProcess,
  buildDashboard,
  esc,
} from "./dashboard.ts";

// ── Pure unit tests ───────────────────────────────────────────────────────────

describe("esc", () => {
  test("escapes ampersand, angle brackets, quotes", () => {
    expect(esc(`<b>AT&T</b> "ok"`)).toBe("&lt;b&gt;AT&amp;T&lt;/b&gt; &quot;ok&quot;");
  });
  test("handles null/undefined gracefully", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });
});

describe("countByProcess", () => {
  test("sums items correctly per process", () => {
    const queues = [
      { processKey: "receipt-filing", label: "Belege", items: [{} as any, {} as any] },
      { processKey: "photo-sorting",  label: "Fotos",  items: [] },
    ];
    const counts = countByProcess(queues);
    expect(counts["receipt-filing"]).toBe(2);
    expect(counts["photo-sorting"]).toBe(0);
  });
});

// ── Integration tests with tmp workspace ──────────────────────────────────────

let ws: string;

beforeEach(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), "dashboard-test-"));
});
afterEach(() => {
  fs.rmSync(ws, { recursive: true, force: true });
});

function reviewDir(): string { return path.join(ws, "_firma", "_review"); }
function journalDir(): string { return path.join(ws, "_firma", "_journal"); }

function writeQueue(runid: string, actions: object[], proc = "receipt-filing"): void {
  const fp = path.join(reviewDir(), `${runid}.json`);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(
    fp,
    JSON.stringify({ runid, process: proc, created: new Date().toISOString(), actions }, null, 2),
    "utf8",
  );
}

function writeJournal(name: string, lines: object[]): void {
  fs.mkdirSync(journalDir(), { recursive: true });
  fs.writeFileSync(
    path.join(journalDir(), name),
    lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
    "utf8",
  );
}

function writeCompanyContext(name: string): void {
  const dir = path.join(ws, "_firma");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "company-context.md"), `# ${name}\n`, "utf8");
}

// ── firmName ────────────────────────────────────────────────────────────────

describe("firmName", () => {
  test("reads H1 from company-context.md", () => {
    writeCompanyContext("Galant Bau GmbH");
    expect(firmName(ws)).toBe("Galant Bau GmbH");
  });
  test("falls back to 'Dein Betrieb' when file missing", () => {
    expect(firmName(ws)).toBe("Dein Betrieb");
  });
  test("ignores template placeholders ({{...}})", () => {
    fs.mkdirSync(path.join(ws, "_firma"), { recursive: true });
    fs.writeFileSync(
      path.join(ws, "_firma", "company-context.md"),
      "# Firmenkontext — {{FIRM_NAME}}\n",
      "utf8",
    );
    expect(firmName(ws)).toBe("Dein Betrieb");
  });
});

// ── loadActivity ─────────────────────────────────────────────────────────────

describe("loadActivity", () => {
  test("returns empty array when file missing", () => {
    expect(loadActivity(ws)).toEqual([]);
  });
  test("dedupes by run_id (last write wins)", () => {
    const dir = path.join(ws, "_firma", "_state");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "activity.jsonl"),
      [
        JSON.stringify({ run_id: "R-001", ts: "2026-06-01T10:00:00Z", process: "receipt-filing", items: 1 }),
        JSON.stringify({ run_id: "R-001", ts: "2026-06-01T11:00:00Z", process: "receipt-filing", items: 3 }),
      ].join("\n"),
      "utf8",
    );
    const entries = loadActivity(ws);
    const r001 = entries.filter((e) => e.run_id === "R-001");
    expect(r001.length).toBe(1);
    expect(r001[0].items).toBe(3); // last write wins
  });
  test("skips garbled lines", () => {
    const dir = path.join(ws, "_firma", "_state");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "activity.jsonl"),
      "{ not json\n" + JSON.stringify({ run_id: "R-002", ts: "2026-06-01T10:00:00Z" }) + "\n",
      "utf8",
    );
    const entries = loadActivity(ws);
    expect(entries.length).toBe(1);
    expect(entries[0].run_id).toBe("R-002");
  });
});

// ── loadJournal ──────────────────────────────────────────────────────────────

describe("loadJournal", () => {
  test("returns empty array when journal dir missing", () => {
    expect(loadJournal(ws)).toEqual([]);
  });
  test("reads entries across multiple jsonl files", () => {
    writeJournal("2026-06.jsonl", [
      { ts: "2026-06-10T09:00:00", runid: "R-a", id: 1, target: "Buchhaltung/2026/06/beleg.pdf", status: "copied" },
    ]);
    writeJournal("2026-07.jsonl", [
      { ts: "2026-07-01T09:00:00", runid: "R-b", id: 1, target: "BV/Projekt/foto.jpg", status: "copied" },
    ]);
    const j = loadJournal(ws);
    expect(j.length).toBe(2);
    expect(j.map((e) => e.runid).sort()).toEqual(["R-a", "R-b"]);
  });
  test("tolerates a UTF-8 BOM and skips garbled lines", () => {
    fs.mkdirSync(journalDir(), { recursive: true });
    fs.writeFileSync(
      path.join(journalDir(), "bom.jsonl"),
      "﻿" + JSON.stringify({ ts: "2026-07-01T09:00:00", target: "A/b.pdf", status: "copied" }) + "\n{garbled\n",
      "utf8",
    );
    const j = loadJournal(ws);
    expect(j.length).toBe(1);
    expect(j[0].target).toBe("A/b.pdf");
  });
});

// ── loadQueues ────────────────────────────────────────────────────────────────

describe("loadQueues", () => {
  test("returns processes in ICON order, each with items from the queue", () => {
    const RUNID = "R-2026-06-08-belege-a";
    writeQueue(RUNID, [
      {
        id: 1,
        verb: "kopieren",
        tier: "prüfen",
        reason: "Bitte kontrollieren",
        source: "_eingang/receipt-filing/invoice.pdf",
        filename: "Heinz Wilmers GmbH RG 2605176 von 11.05.2026 - 476,00 EUR.pdf",
        targets: ["001 Galant Bau GmbH/001. Buchhaltung/Buchhaltung 2026/05-26/Ausgaben"],
        values: { lieferant: "Heinz Wilmers GmbH", betrag: "476,00 EUR", belegtyp: "RG" },
      },
    ]);
    const queues = loadQueues(ws);
    const belege = queues.find((q) => q.processKey === "receipt-filing");
    expect(belege).toBeDefined();
    expect(belege!.label).toBe("Belege");
    expect(belege!.items.length).toBe(1);
    const it = belege!.items[0];
    expect(it.id).toBe(1);
    expect(it.runid).toBe(RUNID);
    expect(it.tier).toBe("p");
    expect(it.title).toContain("Heinz Wilmers");
    expect(it.reason).toBe("Bitte kontrollieren");
    expect(it.values["lieferant"]).toBe("Heinz Wilmers GmbH");
    expect(it.targets[0]).toContain("Buchhaltung");
  });

  test("skips garbled queue files", () => {
    fs.mkdirSync(reviewDir(), { recursive: true });
    fs.writeFileSync(path.join(reviewDir(), "R-garbled.json"), "{not json!!!", "utf8");
    const queues = loadQueues(ws);
    const total = queues.reduce((s, pq) => s + pq.items.length, 0);
    expect(total).toBe(0);
  });

  test("empty _review dir → all items empty", () => {
    fs.mkdirSync(reviewDir(), { recursive: true });
    const queues = loadQueues(ws);
    expect(queues.every((q) => q.items.length === 0)).toBe(true);
  });

  test("missing _review dir → no crash, all items empty", () => {
    const queues = loadQueues(ws);
    expect(queues.every((q) => q.items.length === 0)).toBe(true);
  });
});

// ── buildDashboard integration (stats & history only) ────────────────────────

describe("buildDashboard integration", () => {
  const RUNID = "R-2026-06-08-belege-a";

  function seedQueue() {
    writeQueue(RUNID, [
      {
        id: 7,
        verb: "kopieren",
        tier: "prüfen",
        reason: "Scan unklar — bitte Kategorie bestätigen",
        source: "_eingang/receipt-filing/invoice.pdf",
        filename: "Heinz Wilmers GmbH RG 2605176.pdf",
        targets: ["001 Galant Bau GmbH/Buchhaltung/Ausgaben"],
        values: {
          lieferant: "Heinz Wilmers GmbH",
          betrag: "476,00 EUR",
          belegtyp: "RG",
          kategorie: "Kfz/Fahrzeug (Abschleppen)",
        },
      },
    ]);
  }

  test("contains firm name from company-context.md", () => {
    writeCompanyContext("Galant Bau GmbH");
    seedQueue();
    const html = buildDashboard(ws);
    expect(html).toContain("Galant Bau GmbH");
  });

  test("statistics-only: no open-item content leaks into the artifact", () => {
    writeCompanyContext("Galant Bau GmbH");
    seedQueue();
    const html = buildDashboard(ws);
    // The pending item's data must NOT be rendered — items live in chat review
    expect(html).not.toContain("Heinz Wilmers");
    expect(html).not.toContain("476,00 EUR");
    expect(html).not.toContain("Scan unklar");
    expect(html).not.toContain(RUNID);
    // Only the COUNT of waiting items surfaces, with the chat hint
    expect(html).toContain("wartet auf deine Freigabe");
    expect(html).toContain("zeig offene Freigaben");
  });

  test("fully static: no script block, no buttons, no onclick", () => {
    writeCompanyContext("Galant Bau GmbH");
    seedQueue();
    const html = buildDashboard(ws);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("onclick=");
    expect(html).not.toContain(">Freigeben<");
    expect(html).not.toContain(">Ablehnen<");
  });

  test("open count appears on the process card", () => {
    writeCompanyContext("Galant Bau GmbH");
    seedQueue();
    const html = buildDashboard(ws);
    expect(html).toContain("1 Vorschlag wartet");
  });

  test("header names the artifact Statistik & Verlauf", () => {
    writeCompanyContext("Galant Bau GmbH");
    const html = buildDashboard(ws);
    expect(html).toContain("Statistik &amp; Verlauf");
    expect(html).toContain("Freigaben laufen im Chat");
  });

  test("Verlauf renders activity entries with summary and savings", () => {
    writeCompanyContext("Galant Bau GmbH");
    const dir = path.join(ws, "_firma", "_state");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "activity.jsonl"),
      JSON.stringify({
        run_id: "R-100", ts: "2026-06-20T10:00:00Z", process: "receipt-filing",
        summary: "3 Belege abgelegt", items: 3, minutes_saved: 30, status: "done",
      }) + "\n",
      "utf8",
    );
    const html = buildDashboard(ws);
    expect(html).toContain("3 Belege abgelegt");
    expect(html).toContain("20.06.2026");
    expect(html).toContain("+0,5 Std");
  });

  test("Zuletzt abgelegt renders journal entries with file and target dir", () => {
    writeCompanyContext("Galant Bau GmbH");
    writeJournal("2026-07.jsonl", [
      {
        ts: "2026-07-01T09:00:00", runid: "R-x", id: 1,
        target: "Buchhaltung/2026/07/2026-07-01_Beleg_4711.pdf", status: "copied",
      },
      {
        ts: "2026-07-01T09:00:01", runid: "R-x", id: 1,
        target: "BV/Testprojekt/Belege/2026-07-01_Beleg_4711.pdf", status: "skipped-identical",
      },
    ]);
    const html = buildDashboard(ws);
    expect(html).toContain("Zuletzt abgelegt");
    expect(html).toContain("2026-07-01_Beleg_4711.pdf");
    expect(html).toContain("Buchhaltung/2026/07");
    expect(html).toContain("abgelegt");
    expect(html).toContain("schon vorhanden");
  });

  test("never crashes on completely empty workspace", () => {
    expect(() => buildDashboard(ws)).not.toThrow();
  });

  test("never crashes on garbled queue and journal files", () => {
    fs.mkdirSync(reviewDir(), { recursive: true });
    fs.writeFileSync(path.join(reviewDir(), "R-bad.json"), "!!!not json", "utf8");
    fs.mkdirSync(journalDir(), { recursive: true });
    fs.writeFileSync(path.join(journalDir(), "bad.jsonl"), "!!!not json", "utf8");
    expect(() => buildDashboard(ws)).not.toThrow();
  });

  test("empty states are friendly (Verlauf + Zuletzt abgelegt)", () => {
    writeCompanyContext("Galant Bau GmbH");
    const html = buildDashboard(ws);
    expect(html).toContain("Noch keine erledigten Vorgänge");
    expect(html).toContain("Noch nichts abgelegt");
  });
});

// ── XSS hardening (server-rendered history is the only data path) ────────────

describe("buildDashboard XSS hardening", () => {
  test("HTML-special activity summary renders escaped, never raw", () => {
    writeCompanyContext("Test Firma");
    const dir = path.join(ws, "_firma", "_state");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "activity.jsonl"),
      JSON.stringify({
        run_id: "R-xss", ts: "2026-06-21T10:00:00Z", process: "receipt-filing",
        summary: '<img src=x onerror=alert(1)> & "quotes"', items: 1, status: "done",
      }) + "\n",
      "utf8",
    );
    const html = buildDashboard(ws);
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot;");
    expect(html).not.toContain("<img src=x onerror=");
  });

  test("HTML-special journal target renders escaped, never raw", () => {
    writeCompanyContext("Test Firma");
    writeJournal("xss.jsonl", [
      { ts: "2026-07-01T09:00:00", target: 'A/<script>alert(1)</script>/"x".pdf', status: "copied" },
    ]);
    const html = buildDashboard(ws);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("HTML-special firm name renders escaped", () => {
    writeCompanyContext('Müller & Söhne <b>"GmbH"</b>');
    const html = buildDashboard(ws);
    expect(html).toContain("Müller &amp; Söhne &lt;b&gt;&quot;GmbH&quot;&lt;/b&gt;");
    expect(html).not.toContain('<b>"GmbH"');
  });
});
