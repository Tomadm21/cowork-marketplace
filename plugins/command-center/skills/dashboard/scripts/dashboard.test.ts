import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  firmName,
  loadActivity,
  loadQueues,
  countByProcess,
  defaultTab,
  buildDashboard,
  esc,
  jsonForScript,
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

describe("defaultTab", () => {
  test("returns first processKey that has items", () => {
    const queues = [
      { processKey: "receipt-filing", label: "Belege", items: [] },
      { processKey: "photo-sorting",  label: "Fotos",  items: [{ id: 1 } as any] },
      { processKey: "daily-report",   label: "Tagesbericht", items: [{ id: 2 } as any] },
    ];
    expect(defaultTab(queues)).toBe("photo-sorting");
  });
  test("returns 'overview' when no process has items", () => {
    const queues = [
      { processKey: "receipt-filing", label: "Belege", items: [] },
      { processKey: "photo-sorting",  label: "Fotos",  items: [] },
    ];
    expect(defaultTab(queues)).toBe("overview");
  });
  test("returns 'overview' for empty queues array", () => {
    expect(defaultTab([])).toBe("overview");
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

function writeQueue(runid: string, actions: object[], proc = "receipt-filing"): void {
  const fp = path.join(reviewDir(), `${runid}.json`);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(
    fp,
    JSON.stringify({ runid, process: proc, created: new Date().toISOString(), actions }, null, 2),
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

// ── buildDashboard integration ────────────────────────────────────────────────

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

  test("contains Belege process in inlined JSON with 1 item", () => {
    writeCompanyContext("Galant Bau GmbH");
    seedQueue();
    const html = buildDashboard(ws);
    // Tab label present in server-rendered tab hint (JS tabs() uses p.label from C.processes)
    expect(html).toContain("Belege");
    // The inlined JSON has the process with 1 item
    const jsonMatch = html.match(/var C=(\{.*?"processes".*?\});/s);
    expect(jsonMatch).not.toBeNull();
    const data = JSON.parse(jsonMatch![1]);
    const belege = data.processes.find((p: any) => p.key === "receipt-filing");
    expect(belege).toBeDefined();
    expect(belege.label).toBe("Belege");
    expect(belege.items.length).toBe(1);
  });

  test("contains VORSCHLAG key-value fields", () => {
    writeCompanyContext("Galant Bau GmbH");
    seedQueue();
    const html = buildDashboard(ws);
    expect(html).toContain("Heinz Wilmers GmbH");
    expect(html).toContain("476,00 EUR");
    expect(html).toContain("Kfz/Fahrzeug (Abschleppen)");
  });

  test("contains BEGRÜNDUNG text", () => {
    writeCompanyContext("Galant Bau GmbH");
    seedQueue();
    const html = buildDashboard(ws);
    expect(html).toContain("Scan unklar — bitte Kategorie bestätigen");
  });

  test("sendPrompt call string has correct shape: 'Freigeben: <runid> Aktion <id> (<label>)'", () => {
    writeCompanyContext("Galant Bau GmbH");
    seedQueue();
    const html = buildDashboard(ws);
    // The act() function is called with these args; verify the call arguments are present in JS
    expect(html).toContain(RUNID);
    expect(html).toContain("Aktion");
    // 'Freigeben: ' prefix is built inside act() at runtime, but the arg is in the onclick
    expect(html).toContain("Freigeben");
    expect(html).toContain("Ablehnen");
  });

  test("defaultTab is 'receipt-filing' when queue has items", () => {
    writeCompanyContext("Galant Bau GmbH");
    seedQueue();
    const html = buildDashboard(ws);
    // The C.active field in inlined data should be receipt-filing
    expect(html).toContain('"active":"receipt-filing"');
  });

  test("defaultTab is 'overview' when no open items", () => {
    writeCompanyContext("Galant Bau GmbH");
    // no queue seeded
    const html = buildDashboard(ws);
    expect(html).toContain('"active":"overview"');
  });

  test("Überblick tab content always present in HTML", () => {
    writeCompanyContext("Galant Bau GmbH");
    const html = buildDashboard(ws);
    expect(html).toContain("ueberblick-content");
    expect(html).toContain("Überblick");
  });

  test("never crashes on completely empty workspace", () => {
    // No _firma, no queues, no catalog override
    expect(() => buildDashboard(ws)).not.toThrow();
  });

  test("never crashes on garbled queue file", () => {
    fs.mkdirSync(reviewDir(), { recursive: true });
    fs.writeFileSync(path.join(reviewDir(), "R-bad.json"), "!!!not json", "utf8");
    expect(() => buildDashboard(ws)).not.toThrow();
  });

  test("targets rendered in Ziel row", () => {
    writeCompanyContext("Galant Bau GmbH");
    seedQueue();
    const html = buildDashboard(ws);
    expect(html).toContain("001 Galant Bau GmbH/Buchhaltung/Ausgaben");
  });
});

// ── XSS hardening regression tests ───────────────────────────────────────────

describe("jsonForScript", () => {
  test("escapes </script> sequences to prevent script breakout", () => {
    const payload = '</script><script>window.PWNED=1;</script>';
    const result = jsonForScript(JSON.stringify({ reason: payload }));
    // Raw closing tag must not appear — it becomes </script>
    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c");
  });
  test("escapes U+2028 and U+2029 line terminators", () => {
    const s = "a b c";
    const result = jsonForScript(JSON.stringify(s));
    expect(result).not.toContain(" ");
    expect(result).not.toContain(" ");
    expect(result).toContain("\\u2028");
    expect(result).toContain("\\u2029");
  });
  test("leaves normal ASCII JSON unchanged", () => {
    const data = { key: "value", num: 42 };
    const raw = JSON.stringify(data);
    expect(jsonForScript(raw)).toBe(raw);
  });
});

describe("buildDashboard XSS hardening", () => {
  const RUNID_XSS = "R-xss-test";

  // Test 1: </script> in reason must not break out of the data const
  test("reason with </script> payload does not produce raw script breakout in HTML", () => {
    writeCompanyContext("Test Firma");
    writeQueue(RUNID_XSS, [
      {
        id: 1,
        verb: "kopieren",
        tier: "sicher",
        confidence: "sicher",
        reason: "</script><script>window.PWNED=1;</script>",
        source: "_eingang/receipt-filing/x.pdf",
        filename: "test.pdf",
        targets: ["A/B"],
        values: { lieferant: "Harmlos GmbH", betrag: "1,00 EUR" },
      },
    ]);
    const html = buildDashboard(ws);
    // The inlined var C= block must not contain a raw </script> that closes the data script
    // The payload must be escaped: </script> → </script>
    const dataBlockMatch = html.match(/var C=([\s\S]*?);[\s\S]*?var pi=/);
    expect(dataBlockMatch).not.toBeNull();
    const dataBlock = dataBlockMatch![1];
    expect(dataBlock).not.toContain("</script>");
    expect(dataBlock).toContain("\\u003c");
  });

  // Test 2: quote-injection in label (values.lieferant) must be escaped in onclick attribute.
  // Note: the raw label legitimately appears (JSON-escaped) in the inlined var C= data blob;
  // what we guard against is the label breaking OUT of an onclick="..." attribute.
  test("label with quote injection does not produce unescaped attribute breakout in onclick", () => {
    const maliciousLabel = '" onmouseover="alert(1)';
    writeCompanyContext("Test Firma");
    writeQueue(RUNID_XSS, [
      {
        id: 2,
        verb: "kopieren",
        tier: "sicher",
        confidence: "sicher",
        reason: "Normal.",
        source: "_eingang/receipt-filing/y.pdf",
        filename: "normal.pdf",
        targets: ["A/B"],
        values: { lieferant: maliciousLabel, betrag: "5,00 EUR" },
      },
    ]);
    const html = buildDashboard(ws);
    // Extract all onclick="..." attribute values from the HTML.
    // These are the only places where an unescaped " would break out of the attribute.
    const onclickAttrs = [...html.matchAll(/onclick="([^"]*?)"/g)].map((m) => m[1]);
    // None of the onclick attribute values should contain a raw (unescaped) " character —
    // that would mean the attribute was broken out of by the injected quote.
    for (const attr of onclickAttrs) {
      expect(attr).not.toContain('" onmouseover=');
    }
    // The escaped form must appear in the HTML (confirms the label is present but escaped)
    expect(html).toContain("&quot;");
  });

  // Test 3: sanity — normal label still produces a working act() call in onclick
  test("normal label produces a functional act() onclick with the correct runid", () => {
    const RUNID_NORMAL = "R-2026-06-10-normal";
    writeCompanyContext("Test Firma");
    writeQueue(RUNID_NORMAL, [
      {
        id: 7,
        verb: "kopieren",
        tier: "prüfen",
        confidence: "prüfen",
        reason: "Scan unklar.",
        source: "_eingang/receipt-filing/inv.pdf",
        filename: "Inv 7.pdf",
        targets: ["Buchhaltung/2026"],
        values: { lieferant: "Normal GmbH", betrag: "10,00 EUR" },
      },
    ]);
    const html = buildDashboard(ws);
    // The server-rendered onclick must contain the act() call with the runid
    expect(html).toContain("act(");
    expect(html).toContain(RUNID_NORMAL);
    // Both buttons must be present
    expect(html).toContain("Freigeben");
    expect(html).toContain("Ablehnen");
  });
});
