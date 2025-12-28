# Tekkin Analyzer V2 – Mappatura dati completa

Questo documento descrive **la mappatura attuale reale** dell’Analyzer V2 di Tekkin.
È pensato come **single source of truth**: da dove nasce ogni valore, in quale file passa e dove viene renderizzato.

---

## 0) Pipeline dati (overview)

### A) Analyzer – Python

**File**
- tekkin_analyzer_core.py
- tekkin_analyzer_api.py

**Responsabilità**
- Calcolo metriche audio (BPM, Key, Loudness, Spectral, Bands, Transients)
- Costruzione `arrays.json` (timeline loudness, spectrum, sound field, transients)
- Upload su storage se `upload_arrays_blob = true`

**Output**
- JSON scalari (analyzer_json)
- arrays_blob_path
- arrays_blob_size_bytes

---

### B) API Next – run analyzer

**File**
- app/api/projects/run-analyzer/route.ts

**Responsabilità**
1. Genera signed URL audio
2. Chiama analyzer Python
3. Costruisce payload DB (campi scalari)
4. Upload `arrays.json` su storage
5. Salva path e size su DB

---

### C) Mapper DB (light)

**File**
- lib/analyzer/handleAnalyzerResult.ts

**Responsabilità**
- Normalizza output analyzer
- Scrive su `project_versions`
- Campi salvati:
  - analyzer_json
  - analyzer_bpm
  - analyzer_key
  - analyzer_bands_norm
  - lufs
  - overall_score
  - arrays_blob_path
  - arrays_blob_size_bytes

---

### D) Mapper UI V2

**File**
- lib/analyzer/mapVersionToAnalyzerCompareModel.ts

**Responsabilità**
- Input:
  - riga `project_versions`
  - analyzer_arrays (arrays.json scaricato)
  - referenceModel
- Output:
  - AnalyzerCompareModel (modello unico per UI V2)

---

### E) UI

**File**
- AnalyzerV2Panel.tsx
- AnalyzerV2ProPanel.tsx
- types.ts

---

## 1) Hero / Header

| UI field | Source |
|--------|--------|
| projectTitle | version.project.title |
| versionName | version.version_name |
| mixType | hardcoded: MASTER |
| bpm | version.analyzer_bpm → analyzer_json.bpm |
| key | version.analyzer_key → analyzer_json.key |
| loudness.integrated_lufs | version.lufs → analyzer_json.loudness_stats.integrated_lufs |
| overallScore | version.overall_score |

---

## 2) Tonal Balance

### Bands Norm – Track
**UI**: model.bandsNorm  
**Source priority**
1. version.analyzer_bands_norm
2. analyzer_json.band_energy_norm
3. analyzer_json.spectral.band_norm

### Bands Norm – Reference
**UI**: model.referenceBandsNorm  
**Source**: referenceModel.bands_norm

### Bands Percentiles – Reference
**UI**: model.referenceBandsPercentiles  
**Source**: referenceModel.bands_norm_percentiles

---

## 3) Grafici (arrays.json)

Tutti i grafici V2 derivano esclusivamente da `arrays.json`.

### Spectrum (frequency balance)
- UI: model.spectrumTrack
- Source:
  - arrays.spectrum_db.hz
  - arrays.spectrum_db.track_db

### Spectrum – Reference
- UI: model.spectrumRef
- Source:
  - referenceModel.spectrum_db.hz
  - referenceModel.spectrum_db.ref_db

### Sound Field (Stereo)
- UI: model.soundField
- Source: arrays.sound_field
```json
{
  "angle_deg": [...],
  "radius": [...]
}
```

### Levels (per canale)
- UI: model.levels
- Source:
  - arrays.levels.channels
  - arrays.levels.rms_db
  - arrays.levels.peak_db

### Loudness timeline
- UI:
  - model.momentaryLufs
  - model.shortTermLufs
- Source:
  - arrays.loudness_stats.momentary_lufs
  - arrays.loudness_stats.short_term_lufs

---

## 4) Quick Facts

### Spectral
- UI: model.spectral.*
- Source: analyzer_json.spectral
  - centroid
  - rolloff
  - bandwidth
  - flatness
  - zero_crossing_rate

### LRA
- UI: model.loudness.lra
- Source: analyzer_json.loudness_stats.lra

---

## 5) Transients

### Transients model
- UI: model.transients
- Source priority:
  1. arrays.transients
  2. analyzer_json.transients

### Fallback rule (critica)
Se:
- strength === 0
- density === 0
- crestFactorDb > 0

Allora:
- strength → null
- density → null

Motivo: indica calcolo fallito, non valore reale.

---

## 6) Flags UI (LIVE / DATA / REF)

Questi **non sono dati persistiti**.

- REF: referenceModel presente
- LIVE / DATA: presenza reale di array (spectrum, soundField, levels)

Nota: se vengono usati fallback MOCK, i badge possono risultare fuorvianti.

---

## TL;DR

- Scalari DB → handleAnalyzerResult.ts
- Grafici → arrays.json via arrays_blob_path
- UI V2 → mapVersionToAnalyzerCompareModel.ts
- Reference → referenceModel

Questo documento rappresenta lo stato reale, coerente e aggiornato dell’Analyzer V2.
