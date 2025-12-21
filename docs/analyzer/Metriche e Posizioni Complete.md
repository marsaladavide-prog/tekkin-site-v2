---

## 7) Metriche disponibili e roadmap (Essentia + Derived)

Questa sezione elenca **tutte le metriche rilevanti per Tekkin**, indicando:
- cosa significano (in modo leggibile)
- stato (attiva, dormiente, pianificata)
- dove si trovano nella pipeline (path dati e file)
- dove vengono renderizzate in UI

### Legenda stato
- ✅ ATTIVA: presente, stabile, usata in UI
- ⚠️ DORMIENTE: presente ma non affidabile o poco valorizzata
- ⏳ PIANIFICATA: da implementare
- ❌ ESCLUSA: non prevista ora

### File pipeline di riferimento
- Analyzer Python: `tekkin_analyzer_core.py`, `tekkin_analyzer_api.py`
- API Next run-analyzer: `app/api/projects/run-analyzer/route.ts`
- Mapper DB: `lib/analyzer/handleAnalyzerResult.ts`
- Mapper UI V2: `lib/analyzer/mapVersionToAnalyzerCompareModel.ts`
- UI: `AnalyzerV2Panel.tsx`, `AnalyzerV2ProPanel.tsx`, `types.ts`

---

## 7.1 Loudness e dinamica

### 🔹 Integrated LUFS
**Descrizione**  
Loudness medio percepito della traccia.

**Per Tekkin**
- troppo basso: non compete con le reference del genere
- troppo alto: rischio limiter distruttivo e fatica d’ascolto

**Stato**: ✅ ATTIVA  
**Dati**
- scalare: `analyzer_json.loudness_stats.integrated_lufs`
- DB: `project_versions.lufs`

**Passa per**
- `lib/analyzer/handleAnalyzerResult.ts` (salvataggio su DB)
- `lib/analyzer/mapVersionToAnalyzerCompareModel.ts` (model.loudness)

**UI**
- Header: `model.loudness.integrated_lufs`
- Loudness card

---

### 🔹 Momentary LUFS (array)
**Descrizione**  
Loudness istantaneo nel tempo.

**Per Tekkin**
- mostra se drop e momenti chiave spingono davvero
- evidenzia sezioni troppo vuote o troppo dense

**Stato**: ✅ ATTIVA  
**Dati**
- arrays: `arrays.json.loudness_stats.momentary_lufs`

**Passa per**
- `app/api/projects/run-analyzer/route.ts` (arrays blob)
- `lib/analyzer/mapVersionToAnalyzerCompareModel.ts` (model.momentaryLufs)

**UI**
- Grafico loudness: `model.momentaryLufs`

---

### 🔹 Short-term LUFS (array)
**Descrizione**  
Loudness medio su finestre brevi, più stabile del momentary.

**Per Tekkin**
- coerenza tra sezioni
- “potenza” percepita più credibile

**Stato**: ✅ ATTIVA  
**Dati**
- arrays: `arrays.json.loudness_stats.short_term_lufs`

**Passa per**
- `lib/analyzer/mapVersionToAnalyzerCompareModel.ts` (model.shortTermLufs)

**UI**
- Grafico loudness: `model.shortTermLufs`

---

### 🔹 LRA
**Descrizione**  
Range dinamico globale.

**Per Tekkin**
- troppo basso: traccia schiacciata, poca vita
- troppo alto: inconsistente, drop meno compatti

**Stato**: ✅ ATTIVA  
**Dati**
- scalare: `analyzer_json.loudness_stats.lra`

**Passa per**
- `lib/analyzer/handleAnalyzerResult.ts` (analyzer_json)
- `lib/analyzer/mapVersionToAnalyzerCompareModel.ts` (model.loudness.lra)

**UI**
- Quick facts / Loudness card

---

### 🔹 Sample Peak dB
**Descrizione**  
Picco massimo digitale.

**Per Tekkin**
- clipping risk e headroom
- controllo tecnico prima del master

**Stato**: ✅ ATTIVA  
**Dati**
- scalare: `analyzer_json.loudness_stats.sample_peak_db`

**Passa per**
- `lib/analyzer/mapVersionToAnalyzerCompareModel.ts` (levels summary se presente)

**UI**
- Levels card (insieme agli arrays levels)

---

### 🔹 True Peak
**Descrizione**  
Picco inter-sample percepito in conversione.

**Per Tekkin**
- utile per export e streaming safety

**Stato**: ❌ ESCLUSA (ora)  
**Note**
- non risulta presente nel tuo output attuale
- se lo aggiungi, va calcolato in Analyzer Python e salvato in `analyzer_json.loudness_stats.true_peak_db`

---

## 7.2 Timbro e spettro

### 🔹 Bands Norm (sub, low, lowmid, mid, presence, high, air)
**Descrizione**  
Energia normalizzata per banda, base del “Tonal Balance”.

**Per Tekkin**
- mostra dove manca o eccede energia rispetto al genere
- guida EQ e bilanciamento

**Stato**: ✅ ATTIVA  
**Dati**
- DB: `project_versions.analyzer_bands_norm`
- fallback: `analyzer_json.band_energy_norm` oppure `analyzer_json.spectral.band_norm`

**Passa per**
- `lib/analyzer/handleAnalyzerResult.ts` (persist)
- `lib/analyzer/mapVersionToAnalyzerCompareModel.ts` (model.bandsNorm)

**UI**
- Tonal Balance: `model.bandsNorm`

---

### 🔹 Bands percentiles (reference)
**Descrizione**  
Finestre target per banda del genere (p10, p50, p90 o simili).

**Per Tekkin**
- “in target” vs “troppo alto/basso” per banda

**Stato**: ✅ ATTIVA (ma UX da migliorare)  
**Dati**
- reference model: `referenceModel.bands_norm_percentiles`

**Passa per**
- `lib/analyzer/mapVersionToAnalyzerCompareModel.ts` (model.referenceBandsPercentiles)

**UI**
- Tonal Balance (confronto)

---

### 🔹 Spectral Centroid
**Descrizione**  
Brillantezza media del segnale.

**Per Tekkin**
- alto: possibile harsh e hi-hat aggressivi
- basso: mix chiuso, poco “air”

**Stato**: ✅ ATTIVA  
**Dati**
- `analyzer_json.spectral.spectral_centroid_hz`

**Passa per**
- `lib/analyzer/mapVersionToAnalyzerCompareModel.ts` (model.spectral)

**UI**
- Quick facts

---

### 🔹 Spectral Rolloff
**Descrizione**  
Estensione percepita sulle alte.

**Per Tekkin**
- alto: tanta aria o tanto rumore
- basso: scuro, manca top-end

**Stato**: ✅ ATTIVA  
**Dati**
- `analyzer_json.spectral.spectral_rolloff_hz`

**UI**
- Quick facts

---

### 🔹 Spectral Bandwidth
**Descrizione**  
Quanto è “larga” la distribuzione dello spettro.

**Per Tekkin**
- alta: suono pieno o dispersivo
- bassa: suono concentrato (a volte “boxy”)

**Stato**: ✅ ATTIVA  
**Dati**
- `analyzer_json.spectral.spectral_bandwidth_hz`

**UI**
- Quick facts

---

### 🔹 Spectral Flatness
**Descrizione**  
Tonalità vs rumore.

**Per Tekkin**
- alta: noise, distorsione, fruscio
- bassa: più tonale e pulito

**Stato**: ✅ ATTIVA  
**Dati**
- `analyzer_json.spectral.spectral_flatness`

**UI**
- Quick facts

---

### 🔹 Zero Crossing Rate
**Descrizione**  
Indicatore di contenuto rumoroso o aggressivo.

**Per Tekkin**
- alto: harsh/noise potenziale
- basso: più smooth

**Stato**: ✅ ATTIVA  
**Dati**
- `analyzer_json.spectral.zero_crossing_rate`

**UI**
- Quick facts

---

### 🔹 Spectrum (frequency curve)
**Descrizione**  
Curva in dB vs Hz (downsampled).

**Per Tekkin**
- confronto immediato col genere
- guida EQ (macro)

**Stato**: ✅ ATTIVA  
**Dati**
- traccia: `arrays.json.spectrum_db.hz`, `arrays.json.spectrum_db.track_db`
- reference: `referenceModel.spectrum_db.hz`, `referenceModel.spectrum_db.ref_db`

**Passa per**
- `app/api/projects/run-analyzer/route.ts` (patch arrays)
- `lib/analyzer/mapVersionToAnalyzerCompareModel.ts` (model.spectrumTrack / model.spectrumRef)

**UI**
- Frequency Balance / Spectrum compare

---

## 7.3 Stereo

### 🔹 Stereo width (globale)
**Descrizione**  
Ampiezza stereo media complessiva.

**Per Tekkin**
- troppo bassa: mix stretto
- troppo alta: rischio fase (dipende dal genere)

**Stato**: ✅ ATTIVA  
**Dati**
- `analyzer_json.stereo_width` (o equivalente)

**UI**
- Quick facts / score (se usato)

---

### 🔹 Sound Field (polar)
**Descrizione**  
Impronta stereo nel tempo (angolo e raggio).

**Per Tekkin**
- capire se è centro-dominante o largo
- base per confronto col genere

**Stato**: ⚠️ DORMIENTE (manca linea reference in card)  
**Dati**
- traccia: `arrays.json.sound_field`

**Passa per**
- `app/api/projects/run-analyzer/route.ts` (patch arrays)
- `lib/analyzer/mapVersionToAnalyzerCompareModel.ts` (model.soundField)

**UI**
- Sound Field card

---

### 🔹 StereoCorrelation
**Descrizione**  
Quanto L e R sono coerenti tra loro.

**Per Tekkin**
- bassa o negativa: rischio mono
- troppo alta: stereo “finto” o stretto

**Stato**: ⏳ PIANIFICATA  
**Dove metterla**
- scalare o per banda in `analyzer_json.stereo.correlation` o arrays dedicati
- opzionale percentili in reference model

---

### 🔹 StereoWidth per banda
**Descrizione**  
Ampiezza stereo per banda (sub deve essere più stretto).

**Per Tekkin**
- low largo: warning club/mono
- high largo: ok se controllato

**Stato**: ⏳ PIANIFICATA  
**Dove metterla**
- arrays: `arrays.json.stereo.width_by_band`
- reference: già esiste in `referenceModel.stereo_percentiles.width_by_band` (se vuoi usare percentili)

---

## 7.4 Transienti

### 🔹 Crest factor dB
**Descrizione**  
Punch globale: quanto i picchi emergono rispetto al livello medio.

**Per Tekkin**
- basso: mix schiacciato
- alto: spiky, potenziale fatica

**Stato**: ⚠️ DORMIENTE (manca interpretazione stabile)  
**Dati**
- arrays: `arrays.json.transients.crest_factor_db`

**Passa per**
- `lib/analyzer/mapVersionToAnalyzerCompareModel.ts` (model.transients)

**UI**
- Transients card

---

### 🔹 Transient strength
**Descrizione**  
Forza stimata dei transienti.

**Per Tekkin**
- capire se kick e percussioni bucano

**Stato**: ⚠️ DORMIENTE (spesso 0, warning transients_failed)  
**Dati**
- arrays: `arrays.json.transients.strength`

---

### 🔹 Transient density
**Descrizione**  
Quanti transienti per unità di tempo.

**Per Tekkin**
- densità e “busy-ness” della traccia

**Stato**: ⚠️ DORMIENTE  
**Dati**
- arrays: `arrays.json.transients.density`

---

### 🔹 LogAttackTime
**Descrizione**  
Velocità d’attacco (scala log) più stabile dell’attack time raw.

**Per Tekkin**
- attacco lento: punch perso
- attacco veloce: più incisivo

**Stato**: ⏳ PIANIFICATA  
**Dove metterla**
- `analyzer_json.transients.log_attack_time` oppure `arrays.json.transients.log_attack_time`

---

## 7.5 Ritmo

### 🔹 BPM
**Descrizione**  
Tempo.

**Per Tekkin**
- match col genere
- coerenza per reference models

**Stato**: ✅ ATTIVA  
**Dati**
- `analyzer_json.bpm` e DB `version.analyzer_bpm`

**UI**
- Header

---

### 🔹 RhythmDescriptors
**Descrizione**  
Indicatori di stabilità e regolarità del beat.

**Per Tekkin**
- groove instabile
- drop non consistente

**Stato**: ⏳ PIANIFICATA  
**Dove metterla**
- `analyzer_json.rhythm.*` (scalari) o arrays se serve

---

### 🔹 Danceability
**Descrizione**  
Indice di “ballabilità” (indicatore, non verità assoluta).

**Per Tekkin**
- per house/tech-house può aiutare a capire se il groove regge
- da usare solo come INFO

**Stato**: ⏳ PIANIFICATA  
**Dove metterla**
- `analyzer_json.rhythm.danceability`

---

## 7.6 Timbro avanzato (backend only)

### 🔹 MFCC
**Descrizione**  
Firma timbrica compatta per similarity/clustering.

**Per Tekkin**
- “tracce simili”
- recommendations
- clustering per reference models

**Stato**: ⏳ PIANIFICATA (non UI)  
**Dove metterla**
- `analyzer_json.mfcc` (array) o file separato in arrays blob

---

## 7.7 Extra spectral (pianificate)

### 🔹 SpectralContrast
**Descrizione**  
Contrasto tra picchi e valli nello spettro.

**Per Tekkin**
- basso: mix impastato/noisy
- alto: definizione e separazione

**Stato**: ⏳ PIANIFICATA  
**Dove metterla**
- `analyzer_json.spectral.spectral_contrast` oppure `analyzer_json.spectral.contrast_bands`

---

### 🔹 HFC (High Frequency Content)
**Descrizione**  
Energia pesata sulle alte frequenze.

**Per Tekkin**
- troppo alta: harsh/fischi/hi-hat aggressivi
- troppo bassa: mix chiuso/spento

**Molto utile per**
- harshness detection
- bilanciare hi-end rispetto al genere

**Stato**: ⏳ PIANIFICATA  
**Dove metterla**
- `analyzer_json.spectral.hfc`

---

### 🔹 SpectralPeaks + SpectralPeaksEnergy
**Descrizione**  
Picchi dominanti dello spettro e loro energia.

**Per Tekkin**
- tanti picchi irregolari: noise/distorsione possibile
- picchi controllati: suono più tonale e definito

**Stato**: ⏳ PIANIFICATA  
**Dove metterla**
- `analyzer_json.spectral.peaks` (array) o arrays blob se grande
- `analyzer_json.spectral.peaks_energy`

---
