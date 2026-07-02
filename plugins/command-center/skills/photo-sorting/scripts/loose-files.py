#!/usr/bin/env python3
"""Loose-file maintenance for the Baustellen-Doku skill (Modus C) — pure Python 3, stdlib only.

Ports Phil's find-loose-files.ps1 + sort-by-isoweek.ps1 + rename-with-tempnames.ps1 to a
cross-platform helper. Two modes, always gated by an explicit human approval between them:

  plan  --root <dir> [--ext .jpg,.jpeg,...] [--prefix "KW "]   -> writes/prints a JSON plan
  apply --root <dir> --plan <plan.json> [--dry]                -> executes an approved plan

Loose files = files sitting directly in <root> (NOT already inside a subfolder).
Each loose file is classified against the SHA-256 hashes of all files in <root>'s subfolders:
  * duplicate -> the same content already lives in a subfolder            -> DELETE the loose copy
  * unique    -> content not found in any subfolder                       -> MOVE into KW<iso-week>/

SAFETY INVARIANTS (do not weaken):
  * apply DELETES only files the plan marked `duplicate` AND whose hash still matches a
    subfolder file at apply time (re-verified). A unique file is NEVER deleted.
  * moves are collision-safe (append _2, _3, ...); originals are never overwritten.
  * --dry reports what would happen and touches nothing.
"""
import sys, os, json, hashlib, shutil, argparse, re, datetime, glob

DEFAULT_EXT = [".jpg", ".jpeg", ".png", ".mp4", ".mov", ".heic"]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_date(name):
    """Return date (YYYY, MM, DD) from a filename, or None. Order matches rules.md."""
    m = re.search(r"IMG-(\d{4})(\d{2})(\d{2})", name)          # IMG-YYYYMMDD-WA####
    if not m:
        m = re.search(r"(\d{4})-(\d{2})-(\d{2})", name)         # WhatsApp / plain ISO
    if not m:
        m = re.search(r"(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)", name)  # YYYYMMDD
    if not m:
        return None
    try:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return datetime.date(y, mo, d)
    except ValueError:
        return None


def iso_week_folder(date, prefix):
    """ISO-8601 week number, zero-padded, e.g. 'KW 09'."""
    week = date.isocalendar()[1]
    return "%s%02d" % (prefix, week)


def list_loose(root, exts):
    exts = tuple(e.lower() for e in exts)
    out = []
    for entry in sorted(os.listdir(root)):
        p = os.path.join(root, entry)
        if os.path.isfile(p) and os.path.splitext(entry)[1].lower() in exts:
            out.append(p)
    return out


def subfolder_hash_index(root, exts):
    exts = tuple(e.lower() for e in exts)
    index = {}
    for entry in os.listdir(root):
        sub = os.path.join(root, entry)
        if not os.path.isdir(sub):
            continue
        for dirpath, _dirs, files in os.walk(sub):
            for f in files:
                if os.path.splitext(f)[1].lower() in exts:
                    fp = os.path.join(dirpath, f)
                    try:
                        index.setdefault(sha256(fp), []).append(fp)
                    except OSError:
                        pass
    return index


def collision_safe(dest):
    if not os.path.exists(dest):
        return dest
    base, ext = os.path.splitext(dest)
    i = 2
    while os.path.exists("%s_%d%s" % (base, i, ext)):
        i += 1
    return "%s_%d%s" % (base, i, ext)


def cmd_plan(root, exts, prefix):
    if not os.path.isdir(root):
        return {"ok": False, "error": "root not a directory: %s" % root}
    loose = list_loose(root, exts)
    index = subfolder_hash_index(root, exts)
    items, dups, uniques, undated = [], 0, 0, 0
    for lf in loose:
        h = sha256(lf)
        name = os.path.basename(lf)
        if h in index:
            dups += 1
            items.append({"file": name, "hash": h, "action": "duplicate",
                          "matches": [os.path.relpath(m, root) for m in index[h]]})
        else:
            date = parse_date(name)
            if date is None:
                undated += 1
                items.append({"file": name, "hash": h, "action": "unique",
                              "target_folder": None, "note": "kein Datum im Namen — Ziel manuell"})
            else:
                uniques += 1
                items.append({"file": name, "hash": h, "action": "unique",
                              "target_folder": iso_week_folder(date, prefix),
                              "date": date.isoformat()})
    return {"ok": True, "root": root, "prefix": prefix, "counts":
            {"loose": len(loose), "duplicate": dups, "unique": uniques, "undated": undated,
             "subfolder_files": sum(len(v) for v in index.values())},
            "items": items}


def cmd_apply(root, plan_path, dry):
    if not os.path.isfile(plan_path):
        return {"ok": False, "error": "plan not found: %s" % plan_path}
    plan = json.load(open(plan_path, encoding="utf-8"))
    if plan.get("root") and os.path.abspath(plan["root"]) != os.path.abspath(root):
        return {"ok": False, "error": "root mismatch plan(%s) vs arg(%s)" % (plan.get("root"), root)}
    exts = DEFAULT_EXT
    index = subfolder_hash_index(root, exts)          # re-built fresh for safety re-verification
    prefix = plan.get("prefix", "KW ")
    results = []
    for it in plan.get("items", []):
        src = os.path.join(root, it["file"])
        if not os.path.isfile(src):
            results.append({"file": it["file"], "status": "missing"}); continue
        cur = sha256(src)
        if it["action"] == "duplicate":
            # SAFETY: only delete if the content STILL exists elsewhere right now.
            if cur in index and index[cur]:
                if dry:
                    results.append({"file": it["file"], "status": "DRY:delete-duplicate"})
                else:
                    os.remove(src)
                    results.append({"file": it["file"], "status": "deleted-duplicate"})
            else:
                results.append({"file": it["file"], "status": "kept-not-verified-duplicate"})
        elif it["action"] == "unique":
            folder = it.get("target_folder")
            if not folder:
                results.append({"file": it["file"], "status": "skipped-no-target"}); continue
            tdir = os.path.join(root, folder)
            dest = collision_safe(os.path.join(tdir, it["file"]))
            if dry:
                results.append({"file": it["file"], "status": "DRY:move", "target": os.path.relpath(dest, root)})
            else:
                os.makedirs(tdir, exist_ok=True)
                shutil.move(src, dest)
                results.append({"file": it["file"], "status": "moved", "target": os.path.relpath(dest, root)})
        else:
            results.append({"file": it["file"], "status": "unknown-action"})
    return {"ok": True, "root": root, "dry": dry, "results": results}


def main():
    ap = argparse.ArgumentParser(description="Loose-file dedupe + ISO-week sorting (Modus C).")
    sub = ap.add_subparsers(dest="cmd", required=True)
    pp = sub.add_parser("plan"); pp.add_argument("--root", required=True)
    pp.add_argument("--ext", default=",".join(DEFAULT_EXT)); pp.add_argument("--prefix", default="KW ")
    pp.add_argument("--out", default=None)
    ap2 = sub.add_parser("apply"); ap2.add_argument("--root", required=True)
    ap2.add_argument("--plan", required=True); ap2.add_argument("--dry", action="store_true")
    args = ap.parse_args()
    if args.cmd == "plan":
        exts = [e if e.startswith(".") else "." + e for e in args.ext.split(",") if e]
        res = cmd_plan(args.root, exts, args.prefix)
        out = json.dumps(res, ensure_ascii=False, indent=2)
        if args.out:
            open(args.out, "w", encoding="utf-8").write(out)
        print(out)
    elif args.cmd == "apply":
        print(json.dumps(cmd_apply(args.root, args.plan, args.dry), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
