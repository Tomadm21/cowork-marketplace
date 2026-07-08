#!/usr/bin/env python3
"""Command Center apply engine (pure Python 3, stdlib only).

Canonical, workspace-resident review-queue engine — the ONLY engine that
applies approvals (apply.ts is a read-only lister). Idempotent + atomic + contained:
- content dedupe (md5): an identical file is never copied again as _2;
- journal guard: a (runid,id,target-dir) already applied is skipped;
- per-action atomic queue removal: a re-run after a crash is safe;
- containment: sources/relative targets/filenames must stay inside the
  workspace; absolute targets only if configured in _firma/config/*.json
  (output_paths) — anything else errors or falls back to _ausgang/<process>;
- verified writes: chunked copy to <name>.part, fsync, byte-size check, then
  atomic rename — a partial copy never sits under the final name;
- source binding: an action carrying source_md5 is applied only while the
  source file still has exactly that content (no look-alike path mix-ups).

Usage:
  python3 apply.py <workspace_root> list
  python3 apply.py <workspace_root> approve <runid> <action_id> [--dry]
  python3 apply.py <workspace_root> approve-run <runid> [id1 id2 ...] [--dry]
  python3 apply.py <workspace_root> reject  <runid> <action_id> [--dry]
  python3 apply.py <workspace_root> approve-safe [--dry]
  python3 apply.py <workspace_root> manual-confirm <runid> <action_id>
Contract: reference/review-queue.md.
"""
import sys, os, json, hashlib, shutil, datetime, glob

def ws_paths(root):
    f = os.path.join(root, "_firma")
    return {
        "review": os.path.join(f, "_review"),
        "erledigt": os.path.join(f, "_review", "_erledigt"),
        "preview": os.path.join(f, "_review", "_preview"),
        "journal": os.path.join(f, "_journal"),
        "state": os.path.join(f, "_state"),
    }

def now_iso():
    return datetime.datetime.now().isoformat(timespec="seconds")

def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def copy_verified(src, dest, chunk=1 << 20):
    """Chunked copy via .part + size check + atomic rename.

    shutil.copy2 on a slow network share is one long blocking call (plus
    copystat metadata round-trips) that can outlive an execution window and
    leave a plausible-looking partial file under the FINAL name. Here the
    bytes go to <dest>.part first; only after fsync AND a byte-size match is
    the file renamed into place. An aborted run leaves at most a .part file,
    which is unmistakably "not finished" and gets cleaned up on retry."""
    part = dest + ".part"
    want = os.path.getsize(src)
    try:
        with open(src, "rb") as s, open(part, "wb") as d:
            while True:
                b = s.read(chunk)
                if not b:
                    break
                d.write(b)
            d.flush()
            os.fsync(d.fileno())
        got = os.path.getsize(part)
        if got != want:
            raise IOError("Teilkopie: %d von %d Bytes geschrieben" % (got, want))
        os.replace(part, dest)
    except Exception:
        try:
            if os.path.exists(part):
                os.remove(part)
        except Exception:
            pass
        raise
    try:
        shutil.copystat(src, dest)   # metadata is best-effort — never fatal
    except Exception:
        pass

def load_queues(P):
    """Returns (queues, queue_warnings). A garbled queue must never vanish
    silently — its warning travels in the stdout JSON of every command."""
    out, warns = [], []
    if not os.path.isdir(P["review"]):
        return out, warns
    for fp in sorted(glob.glob(os.path.join(P["review"], "R-*.json"))):
        try:
            # utf-8-sig: Windows PowerShell writes a BOM by default; plain utf-8
            # would make such a queue invisible (json.load chokes on the BOM)
            with open(fp, encoding="utf-8-sig") as fh:
                q = json.load(fh)
            q["_path"] = fp
            out.append(q)
        except Exception as e:
            msg = "Queue %s unlesbar (%s) — wird ignoriert, bitte reparieren" % (os.path.basename(fp), e)
            warns.append(msg)
            sys.stderr.write("WARN bad queue %s: %s\n" % (fp, e))
    return out, warns

def eff_tier(a):
    # confidence:"prüfen" overrides a sicher tier for display/bulk
    if a.get("tier") == "sicher" and a.get("confidence") == "prüfen":
        return "pruefen"
    return {"sicher": "sicher", "prüfen": "pruefen", "folgenreich": "folgenreich"}.get(a.get("tier"), "pruefen")

def title_of(a):
    v = a.get("values", {}) or {}
    parts = [v.get("lieferant"), v.get("nummer"), v.get("betrag")]
    parts = [p for p in parts if p]
    if parts:
        return " · ".join(parts)
    if v.get("belegtyp") == "LF":
        return "Lieferschein " + (v.get("nummer") or "")
    return a.get("filename", "Posten")

def cmd_list(P):
    qs, qwarns = load_queues(P)
    groups, total, ns, np, nf = [], 0, 0, 0, 0
    for q in qs:
        acts = q.get("actions", []) or []
        if not acts:
            continue
        rows = []
        for a in acts:
            t = eff_tier(a)
            ns += t == "sicher"; np += t == "pruefen"; nf += t == "folgenreich"
            rows.append({"id": a.get("id"), "tier": a.get("tier"), "confidence": a.get("confidence"),
                         "title": title_of(a), "reason": a.get("reason"),
                         "filename": a.get("filename"), "targets": a.get("targets", []),
                         "values": a.get("values", {})})
        total += len(rows)
        # headline derived from len(actions) — never trust a stale stored counter
        groups.append({"process": q.get("process"), "runid": q.get("runid"),
                       "headline": "%d %s" % (len(rows), q.get("process", "Posten")),
                       "count": len(rows), "actions": rows})
    print(json.dumps({"ok": True, "stand": now_iso(), "total": total,
                      "ns": ns, "np": np, "nf": nf, "groups": groups,
                      "queue_warnings": qwarns}, ensure_ascii=False))

def norm_dir(p):
    # normcase: on case-insensitive filesystems (Windows, default macOS)
    # "Belege" and "belege" are the same directory — compare accordingly
    return os.path.normcase(os.path.normpath(p)).replace("\\", "/")

def inside(root, p):
    """True if p (absolute or root-relative) resolves inside the workspace tree."""
    try:
        r = os.path.normcase(os.path.abspath(root))
        q = os.path.normcase(os.path.abspath(p if os.path.isabs(p) else os.path.join(root, p)))
        return os.path.commonpath([r, q]) == r
    except ValueError:      # different drives on Windows
        return False

def _collect_strings(x, out):
    if isinstance(x, str):
        out.append(x)
    elif isinstance(x, list):
        for v in x:
            _collect_strings(v, out)
    elif isinstance(x, dict):
        for v in x.values():
            _collect_strings(v, out)

def allowed_abs_dirs(root):
    """Absolute target dirs the firm has configured (output_paths etc. in
    _firma/config/*.json). Only these may be written to outside the workspace —
    an arbitrary absolute path in a queue is NOT a delivery destination."""
    out = []
    for fp in glob.glob(os.path.join(root, "_firma", "config", "*.json")):
        try:
            vals = []
            _collect_strings(json.load(open(fp, encoding="utf-8-sig")), vals)
            out += [os.path.normcase(os.path.normpath(v)) for v in vals if os.path.isabs(v)]
        except Exception:
            pass
    return out

def load_journal_index(P):
    """One pass over all journal files -> set of (runid, id, norm target-dir).

    The old per-target journal_has() re-read every journal line over the
    (network) drive for EVERY target of EVERY action — O(actions x lines).
    Building the index once per engine run makes batch approvals O(lines)."""
    idx = set()
    for jf in glob.glob(os.path.join(P["journal"], "*.jsonl")):
        try:
            fh = open(jf, encoding="utf-8-sig")
        except Exception:
            continue
        with fh:
            for line in fh:
                # per-line guard: one truncated line (crash mid-append) must not
                # blind the replay guard for every entry written after it
                try:
                    line = line.strip()
                    if not line:
                        continue
                    r = json.loads(line)
                    idx.add((r.get("runid"), r.get("id"),
                             norm_dir(os.path.dirname(r.get("target", "")))))
                except Exception:
                    continue
    return idx

def append_journal(P, rec):
    os.makedirs(P["journal"], exist_ok=True)
    month = datetime.date.today().strftime("%Y-%m")
    with open(os.path.join(P["journal"], month + ".jsonl"), "a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

def record_filed_md5(P, m):
    os.makedirs(P["state"], exist_ok=True)
    fp = os.path.join(P["state"], "filed-md5.json")
    try:
        data = json.load(open(fp, encoding="utf-8-sig")) if os.path.exists(fp) else []
    except Exception:
        data = []
    if m not in data:
        data.append(m)
        tmp = fp + ".tmp"
        json.dump(data, open(tmp, "w", encoding="utf-8"))
        os.replace(tmp, fp)

def resolve_target_dir(root, target, allowed_abs):
    """Returns (dir, status): status "ok" | "fallback" | "unsafe".
    - relative: must stay inside the workspace (no ../ escape) — else unsafe
    - absolute (e.g. connected N:/S:): must exist AND be under a dir the firm
      configured in _firma/config/*.json (output_paths). An unconfigured or
      disconnected absolute path falls back to _ausgang/<process> (visible,
      inside the workspace) instead of writing to an arbitrary location."""
    if os.path.isabs(target):
        t = os.path.normcase(os.path.normpath(target))
        configured = any(t == a or t.startswith(a + os.sep) for a in allowed_abs)
        if configured and os.path.isdir(target):
            return target, "ok"
        return target, "fallback"
    tdir = os.path.join(root, target)
    if not inside(root, tdir):
        return tdir, "unsafe"
    return tdir, "ok"

def collision_safe(dest):
    if not os.path.exists(dest):
        return dest
    base, ext = os.path.splitext(dest)
    i = 2
    while os.path.exists("%s_%d%s" % (base, i, ext)):
        i += 1
    return "%s_%d%s" % (base, i, ext)

def apply_action(root, P, q, a, dry, allowed_abs, jidx):
    src = os.path.join(root, a["source"]) if not os.path.isabs(a["source"]) else a["source"]
    # containment: queue JSON is AI-authored — never let it read or write
    # outside the workspace (sources are always workspace files)
    if not inside(root, src):
        return [{"status": "error", "detail": "source außerhalb des Workspace: " + a["source"]}]
    if not os.path.exists(src):
        return [{"status": "error", "detail": "source fehlt: " + a["source"]}]
    # md5 of the source is a full read — expensive on a network drive. Compute
    # lazily and at most once: a re-run whose targets are all journaled
    # (yesterday's crash-recovery case) reads zero source bytes.
    _m = []
    def src_md5():
        if not _m:
            _m.append(md5(src))
        return _m[0]
    want = a.get("source_md5")
    if want and src_md5() != want:
        # source binding: the card was built for a specific file CONTENT — a
        # swapped look-alike path or an edited source must never be filed here
        return [{"status": "error",
                 "detail": "Quelle stimmt nicht mit der Queue überein (source_md5) — Zuordnung prüfen, Posten bleibt offen"}]
    src_size = os.path.getsize(src)
    fname = a.get("filename") or os.path.basename(src)
    # filename must be a plain name — no path separators, no ".." (it is joined
    # onto the target dir, so anything else would bypass the target containment)
    if os.path.basename(fname) != fname or fname in ("", ".", ".."):
        return [{"status": "error", "detail": "unsicherer Dateiname: " + repr(fname)}]
    results = []
    for target in a.get("targets", []):
        tdir, st = resolve_target_dir(root, target, allowed_abs)
        if st == "unsafe":
            results.append({"status": "skipped-unsafe", "target": target,
                            "detail": "Ziel verlässt den Workspace — nicht kopiert, Posten bleibt offen"})
            continue
        if st == "fallback":
            # external drive not connected / absolute dir not configured
            # -> fall back to workspace _ausgang/<process>
            fb = os.path.join(root, "_ausgang", q.get("process", "sonstiges"))
            results.append({"status": "fallback", "intended": target, "dir": fb})
            tdir = fb
        # journal guard (atomic re-run safety) — keyed by target DIR so every
        # target of a multi-target action gets delivered (BV + Buchhaltung)
        tdir_rel = os.path.relpath(tdir, root) if inside(root, tdir) else tdir
        if (q.get("runid"), a.get("id"), norm_dir(tdir_rel)) in jidx:
            results.append({"status": "already-journaled", "target": os.path.join(target, fname)})
            continue
        dest = os.path.join(tdir, fname)
        status = "copied"
        # size first: unequal size is a cheap, certain "not identical" — the
        # expensive md5 over the network runs only when the sizes match
        if os.path.exists(dest) and os.path.getsize(dest) == src_size and md5(dest) == src_md5():
            status = "skipped-identical"            # P1: content idempotency — no _2 clone
            final = dest
        else:
            final = collision_safe(dest)
        if dry:
            results.append({"status": "DRY:" + status, "target": final})
            continue
        if status == "copied":
            try:
                os.makedirs(tdir, exist_ok=True)
                copy_verified(src, final)
            except Exception as e:
                # structured error instead of a raw traceback (read-only drive,
                # permission denied, path too long …) — action stays in the queue
                results.append({"status": "error", "target": target,
                                "detail": "Kopieren fehlgeschlagen: %s" % e})
                continue
            if a.get("verify") == "md5":
                # belt-and-braces end check for money-critical processes; on
                # mismatch the copy is removed so no broken file looks filed
                try:
                    end_ok = md5(final) == src_md5()
                except Exception:
                    end_ok = False
                if not end_ok:
                    try:
                        os.remove(final)
                    except Exception:
                        pass
                    results.append({"status": "error", "target": target,
                                    "detail": "md5-Endkontrolle fehlgeschlagen — Kopie entfernt, Posten bleibt offen"})
                    continue
        rel = os.path.relpath(final, root) if inside(root, final) else final
        append_journal(P, {"ts": datetime.datetime.now().isoformat(),
                           "runid": q.get("runid"), "id": a.get("id"), "verb": a.get("verb", "kopieren"),
                           "source": a.get("source"), "target": rel, "md5": src_md5(),
                           "status": status, "reversible": True})
        jidx.add((q.get("runid"), a.get("id"), norm_dir(tdir_rel)))
        record_filed_md5(P, src_md5())
        results.append({"status": status, "target": rel})
    return results

def action_done(res):
    """An action may leave the queue only if nothing failed AND at least one
    target was actually delivered (copied / identical / already journaled)."""
    if any(r["status"].startswith(("error", "skipped-unsafe")) for r in res):
        return False
    return any(r["status"] in ("copied", "copied-manually", "skipped-identical", "already-journaled") for r in res)

def remove_action_atomic(q, aid):
    q["actions"] = [x for x in q.get("actions", []) if x.get("id") != aid]
    tmp = q["_path"] + ".tmp"
    data = {k: v for k, v in q.items() if k != "_path"}
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, q["_path"])   # atomic

def archive_if_empty(P, q):
    if q.get("actions"):
        return False
    os.makedirs(P["erledigt"], exist_ok=True)
    dest = os.path.join(P["erledigt"], os.path.basename(q["_path"]))
    try:
        os.replace(q["_path"], dest)
    except Exception as e:
        sys.stderr.write("WARN archive failed (ok to retry): %s\n" % e)
        return False
    # staging/preview cleanup for this runid (best-effort). Guard: an empty/
    # missing runid substring-matches EVERY file — never wipe previews then.
    try:
        rid = str(q.get("runid") or "")
        pv = P["preview"]
        if rid and os.path.isdir(pv):
            for f in os.listdir(pv):
                if rid in f:
                    try: os.remove(os.path.join(pv, f))
                    except Exception: pass
    except Exception:
        pass
    return True

def find_queue(qs, runid):
    for q in qs:
        if q.get("runid") == runid:
            return q
    return None

def cmd_approve(P, root, runid, aid, dry):
    qs, qwarns = load_queues(P); q = find_queue(qs, runid)
    if not q:
        print(json.dumps({"ok": False, "error": "runid nicht gefunden: " + runid, "queue_warnings": qwarns})); return
    a = next((x for x in q.get("actions", []) if str(x.get("id")) == str(aid)), None)
    if not a:
        print(json.dumps({"ok": False, "error": "action nicht gefunden", "queue_warnings": qwarns})); return
    res = apply_action(root, P, q, a, dry, allowed_abs_dirs(root), load_journal_index(P))
    if not dry and action_done(res):
        remove_action_atomic(q, a.get("id"))
        archive_if_empty(P, q)
    print(json.dumps({"ok": action_done(res) or dry, "runid": runid, "id": aid, "results": res,
                      "dry": dry, "queue_warnings": qwarns}, ensure_ascii=False))

def cmd_approve_run(P, root, runid, ids, dry):
    """Batch approval for one run — the board's "Freigeben (Prozess)" button.
    One engine start, one journal read, one config parse for ALL cards of the
    run, instead of a full process spawn + journal scan per card. Optional ids
    restrict the batch (edited/rejected cards stay untouched)."""
    qs, qwarns = load_queues(P); q = find_queue(qs, runid)
    if not q:
        print(json.dumps({"ok": False, "error": "runid nicht gefunden: " + runid, "queue_warnings": qwarns})); return
    wanted = set(str(i) for i in ids) if ids else None
    allowed = allowed_abs_dirs(root)
    jidx = load_journal_index(P)
    applied, all_ok, matched = [], True, 0
    for a in list(q.get("actions", [])):
        if wanted is not None and str(a.get("id")) not in wanted:
            continue
        matched += 1
        res = apply_action(root, P, q, a, dry, allowed, jidx)
        applied.append({"runid": runid, "id": a.get("id"), "results": res})
        done = action_done(res)
        all_ok = all_ok and (done or dry)
        if not dry and done:
            remove_action_atomic(q, a.get("id"))
    if wanted is not None and matched < len(wanted):
        # a mistyped id must not drown silently in a bulk "ok"
        all_ok = False
        applied.append({"error": "ids nicht gefunden: %d von %d angefragten" % (len(wanted) - matched, len(wanted))})
    if not dry:
        archive_if_empty(P, q)
    print(json.dumps({"ok": all_ok, "applied": applied, "dry": dry,
                      "queue_warnings": qwarns}, ensure_ascii=False))

def cmd_reject(P, runid, aid, dry):
    qs, qwarns = load_queues(P); q = find_queue(qs, runid)
    if not q:
        print(json.dumps({"ok": False, "error": "runid nicht gefunden", "queue_warnings": qwarns})); return
    # find like approve does (str-compare) — a silent no-op "success" on a
    # mistyped id would let the user believe the Posten is gone
    a = next((x for x in q.get("actions", []) if str(x.get("id")) == str(aid)), None)
    if not a:
        print(json.dumps({"ok": False, "error": "action nicht gefunden: " + str(aid), "queue_warnings": qwarns})); return
    if dry:
        print(json.dumps({"ok": True, "dry": True, "would_reject": [runid, aid]})); return
    remove_action_atomic(q, a.get("id"))
    archive_if_empty(P, q)
    print(json.dumps({"ok": True, "rejected": [runid, aid], "queue_warnings": qwarns}, ensure_ascii=False))

def cmd_approve_safe(P, root, dry):
    qs, qwarns = load_queues(P); applied = []
    allowed = allowed_abs_dirs(root)
    jidx = load_journal_index(P)
    all_ok = True
    for q in qs:
        for a in list(q.get("actions", [])):
            if eff_tier(a) == "sicher":
                res = apply_action(root, P, q, a, dry, allowed, jidx)
                applied.append({"runid": q.get("runid"), "id": a.get("id"), "results": res})
                done = action_done(res)
                all_ok = all_ok and (done or dry)
                if not dry and done:
                    remove_action_atomic(q, a.get("id"))
        if not dry:
            archive_if_empty(P, q)
    print(json.dumps({"ok": all_ok, "applied": applied, "dry": dry,
                      "queue_warnings": qwarns}, ensure_ascii=False))

def cmd_manual_confirm(P, root, runid, aid):
    """Official path for "the user copied the file himself" (structurally slow
    target, blocked write window …): verifies the file really arrived — byte
    size AND md5 against the source — journals it as copied-manually and
    clears the card. Exactly the bookkeeping approve would have done, except
    the engine writes nothing itself. Turns yesterday's improvised journal
    back-fill into a first-class, repeatable intent."""
    qs, qwarns = load_queues(P); q = find_queue(qs, runid)
    if not q:
        print(json.dumps({"ok": False, "error": "runid nicht gefunden: " + runid, "queue_warnings": qwarns})); return
    a = next((x for x in q.get("actions", []) if str(x.get("id")) == str(aid)), None)
    if not a:
        print(json.dumps({"ok": False, "error": "action nicht gefunden: " + str(aid), "queue_warnings": qwarns})); return
    src = os.path.join(root, a["source"]) if not os.path.isabs(a["source"]) else a["source"]
    if not inside(root, src) or not os.path.exists(src):
        print(json.dumps({"ok": False, "error": "source fehlt oder außerhalb des Workspace: " + a["source"],
                          "queue_warnings": qwarns})); return
    fname = a.get("filename") or os.path.basename(src)
    if os.path.basename(fname) != fname or fname in ("", ".", ".."):
        print(json.dumps({"ok": False, "error": "unsicherer Dateiname: " + repr(fname), "queue_warnings": qwarns})); return
    src_size, src_hash = os.path.getsize(src), md5(src)
    want = a.get("source_md5")
    if want and src_hash != want:
        print(json.dumps({"ok": False, "error": "Quelle stimmt nicht mit der Queue überein (source_md5) — Zuordnung prüfen",
                          "queue_warnings": qwarns})); return
    allowed = allowed_abs_dirs(root)
    jidx = load_journal_index(P)
    results = []
    for target in a.get("targets", []):
        tdir, st = resolve_target_dir(root, target, allowed)
        if st == "unsafe":
            results.append({"status": "skipped-unsafe", "target": target,
                            "detail": "Ziel verlässt den Workspace — nicht bestätigbar"})
            continue
        # where may the user have put it? the resolved dir — or, on fallback,
        # the originally intended absolute dir (that IS where he copied to)
        cands = [tdir] if st == "ok" else [target, os.path.join(root, "_ausgang", q.get("process", "sonstiges"))]
        hit = next((c for c in cands if os.path.isfile(os.path.join(c, fname))), None)
        if hit is None:
            results.append({"status": "error", "target": target,
                            "detail": "Zieldatei nicht gefunden — bitte erst manuell kopieren nach: " +
                                      os.path.join(cands[0], fname)})
            continue
        tdir_rel = os.path.relpath(hit, root) if inside(root, hit) else hit
        if (q.get("runid"), a.get("id"), norm_dir(tdir_rel)) in jidx:
            results.append({"status": "already-journaled", "target": os.path.join(hit, fname)})
            continue
        dest = os.path.join(hit, fname)
        # confirm CONTENT, not existence: a fragment or a wrong file under the
        # right name (yesterday's two failure modes) must not be journaled
        if os.path.getsize(dest) != src_size or md5(dest) != src_hash:
            results.append({"status": "error", "target": target,
                            "detail": "Zieldatei weicht von der Quelle ab (Größe/md5) — nicht bestätigt"})
            continue
        rel = os.path.relpath(dest, root) if inside(root, dest) else dest
        append_journal(P, {"ts": datetime.datetime.now().isoformat(),
                           "runid": q.get("runid"), "id": a.get("id"), "verb": a.get("verb", "kopieren"),
                           "source": a.get("source"), "target": rel, "md5": src_hash,
                           "status": "copied-manually", "reversible": True})
        jidx.add((q.get("runid"), a.get("id"), norm_dir(tdir_rel)))
        record_filed_md5(P, src_hash)
        results.append({"status": "copied-manually", "target": rel})
    done = action_done(results)
    if done:
        remove_action_atomic(q, a.get("id"))
        archive_if_empty(P, q)
    print(json.dumps({"ok": done, "runid": runid, "id": aid, "results": results,
                      "queue_warnings": qwarns}, ensure_ascii=False))

def main():
    # Windows: stdout defaults to the console codepage (cp1252) — umlauts in
    # values would garble the JSON for the caller. Force UTF-8.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    args = [x for x in sys.argv[1:] if x != "--dry"]
    dry = "--dry" in sys.argv
    if len(args) < 2:
        print(__doc__); sys.exit(1)
    root, cmd = args[0], args[1]
    P = ws_paths(root)
    def need(n):
        if len(args) < n:
            print(json.dumps({"ok": False, "error": "zu wenige Argumente für " + cmd})); sys.exit(1)
    if cmd == "list": cmd_list(P)
    elif cmd == "approve": need(4); cmd_approve(P, root, args[2], args[3], dry)
    elif cmd == "approve-run": need(3); cmd_approve_run(P, root, args[2], args[3:], dry)
    elif cmd == "reject": need(4); cmd_reject(P, args[2], args[3], dry)
    elif cmd == "approve-safe": cmd_approve_safe(P, root, dry)
    elif cmd == "manual-confirm": need(4); cmd_manual_confirm(P, root, args[2], args[3])
    else:
        print(json.dumps({"ok": False, "error": "unknown command: " + cmd})); sys.exit(1)

if __name__ == "__main__":
    main()
