import json
from pathlib import Path
from statistics import mean

import numpy as np

# Provo a usare librosa (più facile e stabile).
# Non posso confermare che sia installato nel tuo ambiente: se manca, lo script te lo dice chiaramente.
try:
    import librosa
except Exception as e:
    raise SystemExit(
        "librosa non disponibile. Esegui lo script dentro il container analyzer oppure installa librosa.\n"
        f"Errore import: {e}"
    )

ROOT = Path(__file__).resolve().parents[1]
REF_MODELS_DIR = ROOT / "reference_models"

# Griglia identica alla tua UI attuale: 10 punti log-spaced 20..20000
# Se vuoi usare esattamente la griglia che usi in analyzer, puoi leggerla da un arrays.json reale.
HZ_GRID = np.geomspace(20.0, 20000.0, 10).astype(float)

def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))

def save_json(path: Path, data: dict):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def iter_jsonl(path: Path):
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        yield json.loads(line)

def compute_spectrum_db_10bins(audio_path: Path, sr_target: int = 44100) -> np.ndarray:
    y, sr = librosa.load(str(audio_path), sr=sr_target, mono=True)
    if y.size == 0:
        raise ValueError("audio vuoto")

    # STFT
    n_fft = 4096
    hop = 1024
    S = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop, window="hann")) + 1e-12
    # power -> dB
    S_db = librosa.amplitude_to_db(S, ref=np.max)

    # Frequenze dei bin FFT
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)

    # Media nel tempo per ogni bin frequenza
    mean_db_by_freq = np.mean(S_db, axis=1)

    # Ora riduco a 10 punti:
    # per ogni HZ_GRID[i], faccio media dei bin compresi tra geometric midpoints adiacenti
    edges = []
    for i in range(len(HZ_GRID)):
        if i == 0:
            lo = 0.0
        else:
            lo = np.sqrt(HZ_GRID[i - 1] * HZ_GRID[i])
        if i == len(HZ_GRID) - 1:
            hi = sr / 2.0
        else:
            hi = np.sqrt(HZ_GRID[i] * HZ_GRID[i + 1])
        edges.append((lo, hi))

    out = []
    for lo, hi in edges:
        idx = np.where((freqs >= lo) & (freqs < hi))[0]
        if idx.size == 0:
            out.append(float("nan"))
        else:
            out.append(float(np.mean(mean_db_by_freq[idx])))

    # Se qualche bin è nan (raro), lo riempio con il valore valido più vicino
    arr = np.array(out, dtype=float)
    if np.any(np.isnan(arr)):
        good = np.where(~np.isnan(arr))[0]
        if good.size == 0:
            raise ValueError("spectrum tutto nan")
        for i in range(arr.size):
            if np.isnan(arr[i]):
                nearest = good[np.argmin(np.abs(good - i))]
                arr[i] = arr[nearest]

    return arr

def main():
    model_files = sorted([p for p in REF_MODELS_DIR.glob("*.json") if not p.name.endswith(".bak")])

    for model_path in model_files:
        key = model_path.stem
        tracks_path = REF_MODELS_DIR / f"{key}.tracks.jsonl"
        if not tracks_path.exists():
            print(f"[skip] {key}: manca {tracks_path.name}")
            continue

        model = load_json(model_path)
        sr = int(model.get("sr", 44100))

        spectra = []
        missing = 0

        for row in iter_jsonl(tracks_path):
            rel = row.get("path")
            if not rel:
                missing += 1
                continue

            audio_path = (ROOT / rel).resolve()
            if not audio_path.exists():
                missing += 1
                continue

            try:
                db10 = compute_spectrum_db_10bins(audio_path, sr_target=sr)
                spectra.append(db10)
            except Exception:
                missing += 1

        if not spectra:
            print(f"[warn] {key}: nessun file analizzato. missing={missing}")
            continue

        # Media per bin
        ref_db = np.mean(np.vstack(spectra), axis=0)

        model["spectrum_db"] = {
            "hz": [float(x) for x in HZ_GRID.tolist()],
            "ref_db": [float(x) for x in ref_db.tolist()],
            "computed_from_tracks": len(spectra),
            "missing_tracks": int(missing),
        }

        save_json(model_path, model)
        print(f"[ok] {key}: spectrum_db scritto. analyzed={len(spectra)} missing={missing}")

if __name__ == "__main__":
    main()
