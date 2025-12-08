# Tekkin Site v2 – Architettura (mappa veloce)

Questo documento serve solo come “mappa mentale esterna” del progetto: dove stanno le cose e come parlano tra loro.

---

## 1. Flow Tekkin Analyzer

### 1.1. Panoramica

Obiettivo: analizzare una versione di un progetto (project_versions) e salvare i risultati strutturati in Supabase, poi mostrarli nella dashboard artista.

Flow end-to-end:

1. L’utente è nella pagina progetto:
   - `app/artist/projects/[id]/page.tsx`
   - clicca “Analizza versione” (o pulsante equivalente).

2. Il client chiama la route API:
   - `POST /api/projects/run-analyzer`
   - file: `app/api/projects/run-analyzer/route.ts`

3. La route:
   - verifica l’utente con Supabase (`createClient().auth.getUser()`).
   - legge `version_id` dal body.
   - recupera la versione da `project_versions` (Supabase).
   - genera una signed URL dal bucket `tracks` se `audio_url` non è già http/https.
   - chiama il backend Python Tekkin Analyzer con:
     - `version_id`
     - `project_id`
     - `audio_url` firmata.

4. Il backend Python:
   - entrypoint: `tekkin_analyzer_api.py`
   - usa:
     - `analyze_master_web.py`
     - `tekkin_analyzer_v4_extras.py`
     - `reference_ai.py`
     - (in futuro: `tekkin_analyzer_v1.py`, modelli, reference models, ecc.)
   - restituisce un JSON di tipo **AnalyzerResult**.

5. La route Next:
   - legge il JSON dell’analyzer.
   - lo tipizza come `AnalyzerResult`.
   - passa il risultato a:
     - `buildAnalyzerUpdatePayload(result)` in `lib/analyzer/handleAnalyzerResult.ts`
   - aggiorna la riga di `project_versions` con il payload generato.
   - ritorna al client:
     - `version` aggiornata
     - `analyzer_result` (raw JSON).

6. Il frontend:
   - file principale: `app/artist/projects/[id]/page.tsx`
   - salva nel proprio stato React la `version` aggiornata.
   - passa i dati di analisi al componente:
     - `app/artist/components/AnalyzerProPanel.tsx`
   - `AnalyzerProPanel` mostra:
     - metri principali (LUFS, score, ecc.)
     - extra (BPM, spettro, zero crossing, ecc.)
     - Reference AI
     - Tekkin Analyzer V1 (mix_v1)
     - fix_suggestions.

---

### 1.2. File chiave Analyzer (Next.js / TS)

- **API Route (HTTP entrypoint)**  
  - `app/api/projects/run-analyzer/route.ts`  
  - Responsabilità:
    - auth utente
    - fetch versione
    - generare signed URL audio
    - chiamare il Python Tekkin Analyzer
    - cast JSON → `AnalyzerResult`
    - chiamare `buildAnalyzerUpdatePayload`
    - fare `update` di `project_versions`
    - rispondere al client con:
      - `version` aggiornata
      - `analyzer_result` grezzo (debug/uso futuro)

- **Logica di mapping e normalizzazione**  
  - `lib/analyzer/handleAnalyzerResult.ts`  
  - Funzione principale:
    - `buildAnalyzerUpdatePayload(result: AnalyzerResult)`  
  - Responsabilità:
    - prendere il JSON del Tekkin Analyzer (Python)
    - mappare i campi sulle colonne di `project_versions`
    - gestire `null`/default
    - centralizzare:
      - `analyzer_json`
      - `analyzer_reference_ai`
      - `analyzer_mix_v1`
      - `analyzer_bpm`
      - campi `spectral_*`
      - `fix_suggestions`

- **Tipi condivisi**  
  - `types/analyzer.ts`  
  - Definisce:
    - `FixSuggestion`
    - `ReferenceAi`, `ReferenceAiBandStatus`, ecc.
    - `AnalyzerV1Result` (Tekkin Analyzer V1)
    - `AnalyzerResult` (shape del JSON restituito dal Python)

- **UI / Frontend**  
  - `app/artist/projects/[id]/page.tsx`
    - gestisce il dettaglio del progetto
    - lista versioni
    - bottone “Analizza”
    - chiama `POST /api/projects/run-analyzer`
    - aggiorna lo stato locale delle versioni
    - passa i dati di analisi a `AnalyzerProPanel`
  - `app/artist/components/AnalyzerProPanel.tsx`
    - riceve i dati da `project_versions` (compresi `analyzer_reference_ai`, `analyzer_mix_v1`, fix_suggestions, extra metrics)
    - mostra il blocco Analyzer Pro:
      - readiness / score
      - Reference AI match
      - Tekkin Analyzer V1 (profili, lufs target, note)
      - suggerimenti di mix/master

---

### 1.3. Tabelle e colonne Supabase usate dall’Analyzer

- Tabella: `project_versions`
  - ID: `id` (uuid)
  - Colonne principali letti/scritti dall’Analyzer:
    - `lufs`
    - `sub_clarity`
    - `hi_end`
    - `dynamics`
    - `stereo_image`
    - `tonality`
    - `overall_score`
    - `feedback`
  - Colonne “Analyzer extras / JSON”:
    - `analyzer_json` (JSONB, snapshot completo della risposta Python)
    - `analyzer_reference_ai` (JSONB)
    - `analyzer_mix_v1` (JSONB)
    - `fix_suggestions` (JSONB)
    - `analyzer_bpm` (numeric)
    - `analyzer_spectral_centroid_hz`
    - `analyzer_spectral_rolloff_hz`
    - `analyzer_spectral_bandwidth_hz`
    - `analyzer_spectral_flatness`
    - `analyzer_zero_crossing_rate`

L’oggetto ritornato da `buildAnalyzerUpdatePayload` viene passato direttamente a `.update()` su `project_versions`.

---

### 1.4. Come si estende il Tekkin Analyzer in futuro

Quando il backend Python aggiunge nuovi campi:

1. Aggiorni **solo**:
   - `types/analyzer.ts` → aggiungi il campo al tipo `AnalyzerResult`.
   - `lib/analyzer/handleAnalyzerResult.ts` → mappa i nuovi campi sulle nuove colonne Supabase (o dentro `analyzer_json`).

2. Se servono nuove colonne in `project_versions`:
   - crei una migration Supabase per aggiungere le colonne
   - aggiorni il payload in `buildAnalyzerUpdatePayload`.

3. La route `run-analyzer` e l’UI (`AnalyzerProPanel`) restano sottili:
   - leggono solo quello che gli serve da `project_versions`
   - non hanno logica di mapping JSON → DB.

---

## TODO – Altre sezioni da compilare

- **Artist Discovery**
  - API, UI, tabelle `artists`, ecc.
- **Mentoring / Tekkin 250**
  - `mentoring_clients`, `mentoring_cycles`, dashboard, ecc.
- **Auth & Onboarding**
  - flusso di registrazione artista, `users_profile`, ecc.
