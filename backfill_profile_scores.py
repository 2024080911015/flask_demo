import argparse
import random
import sqlite3
from datetime import datetime
from pathlib import Path


PROFILE_PREFIX = "\u753b\u50cf\u5206:"
SOCIAL_TENDENCY_PREFIX = "\u793e\u4ea4\u503e\u5411:"
TAG_PREFIX = "\u6807\u7b7e:"
DEFAULT_TAG = "\u840c\u65b0"

PROFILE_KEYS = [
    "\u793e\u4ea4",
    "\u534f\u4f5c",
    "\u5b66\u4e60",
    "\u5f00\u653e",
    "\u6c9f\u901a",
    "\u4f5c\u606f",
]

TENDENCY_LABELS = [
    "\u4e00\u5bf9\u4e00\u6162\u70ed",
    "\u5c0f\u7fa4\u4f53\u6d3b\u52a8",
    "\u516c\u5f00\u6d3b\u52a8\u578b",
    "\u7ec4\u7ec7\u63a8\u8fdb",
    "\u4e13\u4e1a\u653b\u575a",
    "\u7a33\u5b9a\u8865\u4f4d",
    "\u7ade\u8d5b\u79d1\u7814",
    "\u8bfe\u7a0b\u4e92\u52a9",
    "\u751f\u6d3b\u5174\u8da3",
    "\u65e9\u7761\u65e9\u8d77",
    "\u89c4\u5f8b\u5728\u7ebf",
    "\u591c\u95f4\u6d3b\u8dc3",
    "\u76f4\u63a5\u6c9f\u901a",
    "\u534f\u8c03\u6298\u4e2d",
    "\u4f4e\u51b2\u7a81\u6162\u8c03",
    "\u6587\u5b57\u7834\u51b0",
    "\u4efb\u52a1\u7834\u51b0",
    "\u719f\u4eba\u4ecb\u7ecd",
    "\u8fd0\u52a8\u6237\u5916",
    "\u6280\u672f\u5171\u521b",
    "\u6587\u827a\u5174\u8da3",
]

DERIVED_TAGS = {
    "\u793e\u4ea4\u725b\u903c\u75c7",
    "\u793e\u6050\u661f\u4eba",
    "\u793e\u4ea4\u666e\u901a\u578b",
    "\u6e29\u548c",
    "\u6280\u672f\u5927\u725b",
    "\u65e9\u7761\u65e9\u8d77",
    "\u71ac\u591c\u7684\u795e",
    "\u9547\u5708\u5927\u4f6c",
}


def build_random_scores(rng):
    return {
        "\u793e\u4ea4": rng.randint(35, 90),
        "\u534f\u4f5c": rng.randint(45, 90),
        "\u5b66\u4e60": rng.randint(45, 95),
        "\u5f00\u653e": rng.randint(35, 90),
        "\u6c9f\u901a": rng.randint(45, 90),
        "\u4f5c\u606f": rng.randint(30, 90),
    }


def derive_tags(scores):
    tags = []
    if scores["\u793e\u4ea4"] >= 75:
        tags.append("\u793e\u4ea4\u725b\u903c\u75c7")
    elif scores["\u793e\u4ea4"] <= 45:
        tags.append("\u793e\u6050\u661f\u4eba")
    else:
        tags.append("\u793e\u4ea4\u666e\u901a\u578b")

    if scores["\u534f\u4f5c"] >= 75:
        tags.append("\u6e29\u548c")
    if scores["\u5b66\u4e60"] >= 75:
        tags.append("\u6280\u672f\u5927\u725b")
    if scores["\u4f5c\u606f"] >= 80:
        tags.append("\u65e9\u7761\u65e9\u8d77")
    elif scores["\u4f5c\u606f"] <= 45:
        tags.append("\u71ac\u591c\u7684\u795e")
    if scores["\u5f00\u653e"] >= 75:
        tags.append("\u9547\u5708\u5927\u4f6c")
    return tags


def build_profile_parts(rng):
    scores = build_random_scores(rng)
    score_text = "|".join(f"{key}{scores[key]}" for key in PROFILE_KEYS)
    tendencies = " ".join(rng.sample(TENDENCY_LABELS, k=5))
    return [f"{PROFILE_PREFIX}{score_text}", f"{SOCIAL_TENDENCY_PREFIX}{tendencies}"], derive_tags(scores)


def merge_profile(info, profile_parts, derived_tags):
    parts = [part for part in (info or "").split(",") if part]
    filtered = [
        part
        for part in parts
        if not (part.startswith(PROFILE_PREFIX) or part.startswith(SOCIAL_TENDENCY_PREFIX))
    ]

    tag_index = next((i for i, part in enumerate(filtered) if part.startswith(TAG_PREFIX)), None)
    if tag_index is None:
        merged_tags = " ".join(dict.fromkeys([DEFAULT_TAG] + derived_tags))
        filtered.append(f"{TAG_PREFIX}{merged_tags}")
    else:
        tag_text = filtered[tag_index].split(":", 1)[1] if ":" in filtered[tag_index] else ""
        existing_tags = [tag for tag in tag_text.split() if tag not in DERIVED_TAGS]
        merged_tags = " ".join(dict.fromkeys(existing_tags + derived_tags))
        filtered[tag_index] = f"{TAG_PREFIX}{merged_tags or DEFAULT_TAG}"

    return ",".join(filtered + profile_parts)


def backup_database(db_path):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = db_path.with_name(f"{db_path.stem}.profile_backfill_{timestamp}.bak")
    with sqlite3.connect(db_path) as source, sqlite3.connect(backup_path) as target:
        source.backup(target)
    return backup_path


def backfill(db_path, apply_changes=False, seed=None, limit=None, force=False):
    rng = random.Random(seed)
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            "SELECT uid, info FROM users WHERE uid > 0 ORDER BY uid ASC"
        ).fetchall()

        updates = []
        for uid, info in rows:
            if not force and info and PROFILE_PREFIX in info:
                continue
            profile_parts, derived_tags = build_profile_parts(rng)
            new_info = merge_profile(info, profile_parts, derived_tags)
            updates.append((new_info, uid))
            if limit and len(updates) >= limit:
                break

        backup_path = None
        if apply_changes and updates:
            backup_path = backup_database(db_path)
            conn.executemany("UPDATE users SET info = ? WHERE uid = ?", updates)
            conn.commit()

    return len(rows), len(updates), backup_path


def main():
    parser = argparse.ArgumentParser(
        description="Backfill random questionnaire profile scores into users.info."
    )
    parser.add_argument("--db", default="campus_social.db", help="SQLite database path.")
    parser.add_argument("--apply", action="store_true", help="Write changes. Default is dry-run.")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducible output.")
    parser.add_argument("--limit", type=int, default=None, help="Only update the first N matched users.")
    parser.add_argument("--force", action="store_true", help="Regenerate even if the user already has profile scores.")
    args = parser.parse_args()

    db_path = Path(args.db).resolve()
    total, update_count, backup_path = backfill(
        db_path,
        apply_changes=args.apply,
        seed=args.seed,
        limit=args.limit,
        force=args.force,
    )

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"[{mode}] users scanned: {total}")
    print(f"[{mode}] users matched for profile backfill: {update_count}")
    if backup_path:
        print(f"[APPLY] backup written: {backup_path}")
    if not args.apply:
        print("[DRY-RUN] rerun with --apply to update the database.")


if __name__ == "__main__":
    main()
