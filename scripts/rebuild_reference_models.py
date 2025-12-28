#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

def run(cmd: list[str]) -> None:
    print("\n> " + " ".join(cmd), flush=True)
    p = subprocess.run(cmd, check=False)
    if p.returncode != 0:
        raise SystemExit(p.returncode)

def main() -> None:
    repo = Path(__file__).resolve().parents[1]

    ap = argparse.ArgumentParser()
    ap.add_argument("--genres", nargs="+", required=True)
    ap.add_argument("--in-dir", default="references")
    ap.add_argument("--out-dir", default="reference_models")
    ap.add_argument("--sr", type=int, default=44100)

    ap.add_argument("--with-stereo", action="store_true", default=True)
    ap.add_argument("--with-spectrum", action="store_true", default=True)

    ap.add_argument("--core-path", default="tekkin_analyzer_core.py")
    ap.add_argument("--overwrite-stereo", action="store_true", default=True)

    args = ap.parse_args()

    py = sys.executable

    # 1) Build base reference models (json + tracks.jsonl)
    run([
        py,
        str(repo / "reference_builder_v2.py"),
        "--in", args.in_dir,
        "--out", args.out_dir,
        "--sr", str(args.sr),
        "--genres", *args.genres,
    ])

    # 2) Enrich stereo (patch jsonl + model json)
    if args.with_stereo:
        cmd = [
            py,
            str(repo / "agg_stereo_refs.py"),
            "--repo", str(repo),
            "--reference-models-dir", args.out_dir,
            "--core-path", args.core_path,
        ]
        if args.overwrite_stereo:
            cmd.append("--overwrite-stereo")
        run(cmd)

    # 3) Spectrum db (optional, only if you still need spectrum_db in model json)
    if args.with_spectrum:
        run([py, str(repo / "add_spectrum_db_to_reference_models.py")])

    print("\nOK: reference_models aggiornati.", flush=True)

if __name__ == "__main__":
    main()
