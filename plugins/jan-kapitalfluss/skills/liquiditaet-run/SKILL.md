---
name: liquiditaet-run
description: Use this for the monthly Kapitalfluss/Liquiditätsplanung run — when the user has a Commerzbank CSV export ready and wants every income and expense transferred into the Vektonce-Kapitalflusstabelle and the Liquiditätsplanung. Plans the writes, shows a change-overview, and STOPS for approval before writing anything.
---

# Monatlicher Kapitalfluss-Lauf

This skill drives the monthly transfer for the one Commerzbank business account. It NEVER writes without explicit approval.

## When to use

The user exported the monthly Commerzbank movements as a CSV from the online banking and dropped the file in the watched folder, and wants every income and expense transferred into the Kapitalflusstabelle + Liquiditätsplanung.

## Steps

1. **Plan.** Call the `kapitalfluss` MCP tool `plan_run` with `{ csvPath }`. This ingests the CSV, sorts every movement into the Kapitalflusstabelle by sign (credit → Einnahmen, debit → Ausgaben), and returns the change-overview (`runId`, `changesetHash`, summary, planned writes, any needs-review items). **Nothing is written.**
2. **Show the change-overview.** Open the live artifact `change-overview` with the `plan_run` payload so the user sees: the summary line (`N Buchungen · M Werte ändern sich · K brauchen Review`), the grouped table (Blatt · Zelle · Bisher · Neu · Kategorie · Quelle), the NEU rows, and (normally empty) the **„Review nötig"** section. Make clear: *Es wird nichts gebucht und nichts versendet — geschrieben wird nur nach Freigabe.*
3. **Wait for the human.** The user reviews, optionally toggles `ignorieren` on individual rows, and clicks **„Freigeben & schreiben"** or **„Verwerfen"**. The artifact posts an `ApprovalDecision` (`runId`, `changesetHash`, `approver`, `excludedRowKeys`).
4. **Commit only on approval.** If approved, call `commit_writes` with that decision. The gate verifies the `changesetHash` matches the planned run, appends the values into copies of the Vektonce + Liquiditätsplanung workbooks, asserts the Vektonce structure is unchanged, and writes the GoBD archive record. If rejected, write nothing and record the rejection.
5. **Confirm.** Report what was written, where, and the archive record id. With the simple income/expense split the review bucket is normally empty; if anything DID land there (e.g. an odd zero-amount row) and was not excluded, name it explicitly.

## Hard rules

- Never call `commit_writes` before the user has approved in the artifact. The pre-write hook will block it anyway, but do not try.
- Never alter the structure of the user's Excel files. The engine appends/sets values only.
- Never auto-send anything to the bank, the tax advisor, or anyone.
- If the CSV header does not match the configured profile, STOP and report — do not guess. (The format is reconciled at the workshop; a mismatch means the bank changed the export.)
