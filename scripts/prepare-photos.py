#!/usr/bin/env python3
"""
Prepare downloaded photos for the portfolio:
- Convert HEIC/JPG to JPEG
- Sort by EXIF DateTimeOriginal (fallback: mtime)
- Rename sequentially: <slug>-001.jpg, -002.jpg, ...
- Write manifest.json per folder
- Skip any source file over 100 MB
- Resize to 4000px on long edge if needed (keep original)

Usage:
  python scripts/prepare-photos.py
"""

import os
import shutil
import json
import re
from datetime import datetime
from pathlib import Path

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    print("WARNING: pillow_heif not installed, HEIC files won't decode")

from PIL import Image
import exifread

SOURCE_BASE = Path(__file__).parent.parent / "src" / "assets" / "photos" / "Portfolio Inbox"
DEST_BASE   = Path(__file__).parent.parent / "src" / "assets" / "photos"
MAX_BYTES   = 100 * 1024 * 1024  # 100 MB
MAX_LONG_EDGE = 4000

SLUG_MAP = {
    "1958 Alfa Romeo Giulietta Spyder Veloce": "giulietta-spyder-veloce",
    "Welding and Fabrication": "welding-fabrication",
    "1990 Mazda Miata": "1990-miata",
    "2001 Mazda Miata": "2001-miata",
    "Engine Work": "engine-work",
}


def slugify(name: str) -> str:
    return SLUG_MAP.get(name, re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"))


def get_exif_datetime(path: Path):
    """Return datetime from EXIF DateTimeOriginal, or None."""
    try:
        with open(path, "rb") as f:
            tags = exifread.process_file(f, stop_tag="EXIF DateTimeOriginal", details=False)
        tag = tags.get("EXIF DateTimeOriginal")
        if tag:
            return datetime.strptime(str(tag), "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass
    return None


def sort_key(path: Path):
    dt = get_exif_datetime(path)
    if dt:
        return (0, dt)
    return (1, datetime.fromtimestamp(path.stat().st_mtime))


def process_folder(src_dir: Path, slug: str):
    dest_dir = DEST_BASE / slug
    dest_dir.mkdir(parents=True, exist_ok=True)

    supported_exts = {".heic", ".jpg", ".jpeg", ".png", ".webp"}
    photos = sorted(
        [p for p in src_dir.iterdir() if p.suffix.lower() in supported_exts],
        key=sort_key,
    )

    manifest = []
    count = 0
    skipped = 0

    for photo in photos:
        if photo.stat().st_size > MAX_BYTES:
            print(f"  SKIP (>100MB): {photo.name}")
            skipped += 1
            continue

        count += 1
        new_name = f"{slug}-{count:03d}.jpg"
        dest_path = dest_dir / new_name

        exif_dt = get_exif_datetime(photo)

        try:
            img = Image.open(photo)
            img = img.convert("RGB")

            long_edge = max(img.width, img.height)
            if long_edge > MAX_LONG_EDGE:
                scale = MAX_LONG_EDGE / long_edge
                new_w = int(img.width * scale)
                new_h = int(img.height * scale)
                orig_name = f"{slug}-{count:03d}-orig{photo.suffix}"
                shutil.copy2(photo, dest_dir / orig_name)
                img = img.resize((new_w, new_h), Image.LANCZOS)
                print(f"  Resized {photo.name}: {img.width}x{img.height}")

            img.save(dest_path, "JPEG", quality=88, optimize=True)

            manifest.append({
                "original_filename": photo.name,
                "new_filename": new_name,
                "exif_timestamp": exif_dt.isoformat() if exif_dt else None,
                "width": img.width,
                "height": img.height,
                "sort_basis": "exif" if exif_dt else "mtime",
            })
            print(f"  {photo.name} -> {new_name}")

        except Exception as e:
            print(f"  ERROR converting {photo.name}: {e}")
            count -= 1

    manifest_path = dest_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump({"slug": slug, "count": count, "skipped": skipped, "photos": manifest}, f, indent=2)

    print(f"  Wrote {count} photos + manifest.json ({skipped} skipped)")
    return count


def main():
    if not SOURCE_BASE.exists():
        print(f"Source not found: {SOURCE_BASE}")
        return

    total = 0
    for folder in sorted(SOURCE_BASE.iterdir()):
        if not folder.is_dir():
            continue
        slug = slugify(folder.name)
        files = list(folder.iterdir())
        if not files:
            print(f"SKIP (empty): {folder.name}")
            continue
        print(f"\nProcessing: {folder.name} -> {slug}/")
        total += process_folder(folder, slug)

    print(f"\nTotal: {total} photos processed")


if __name__ == "__main__":
    main()
