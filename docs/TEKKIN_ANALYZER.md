# Tekkin Site v2 – Analyzer Architecture

Questo documento descrive l’architettura **attiva e reale** del sottosistema **Tekkin Analyzer**.

Non è documentazione marketing.  
È una mappa tecnica interna per sviluppo, debug, estensione e manutenzione.

---

## 1. Scopo del Tekkin Analyzer

Il Tekkin Analyzer analizza una **versione di progetto** (`project_versions`) e produce:

- metriche tecniche audio
- valutazioni di coerenza con un genere
- suggerimenti operativi
- dati strutturati persistiti in Supabase

Questi dati vengono poi visualizzati nella dashboard **Tekkin Artist** e utilizzati dal layer AI.

---

## 2. Principi architetturali

- Python **analizza**
- TypeScript **normalizza**
- Supabase **conserva**
- UI **mostra**
- Un solo punto di mapping
- Nessuna logica duplicata
- Nessun calcolo in UI

---

## 3. Flow end-to-end

### 3.1 Trigger lato UI

1. L’artista è nella pagina progetto  
   `app/artist/projects/[id]/page.tsx`

2. Seleziona una versione (`project_versions.id`)

3. Clicca **Analyze**

4. Il client invia:
POST /api/projects/run-analyzer

markdown
Copia codice

La UI **non aggiorna localmente** la versione.  
Dopo l’analisi ricarica i dati dal database.

---

### 3.2 API Route Next.js

**File**
- `app/api/projects/run-analyzer/route.ts`

**Responsabilità**

1. Autenticare l’utente (Supabase)
2. Validare `version_id`
3. Recuperare la riga `project_versions`
4. Risolvere l’audio (ordine vincolante):
- se `audio_path` è presente → signed URL dal bucket `tracks`
- altrimenti se `audio_url` è una URL valida → usare quella
- altrimenti → errore 400
5. Chiamare il backend Python Tekkin Analyzer passando:
- `version_id`
- `project_id`
- `audio_url`
6. Ricevere un JSON `AnalyzerResult`
7. Normalizzare i dati tramite:
buildAnalyzerUpdatePayload(result)

markdown
Copia codice
8. Aggiornare `project_versions`
9. Restituire successo

Nota:
- L’API non interpreta i dati dell’analyzer
- Nessuna trasformazione fuori dal mapper centrale

---

## 4. Backend Python Tekkin Analyzer

### 4.1 Componenti attivi

**Entrypoint**
- `tekkin_analyzer_api.py`

**Core**
- `tekkin_analyzer_core.py`

**Reference models**
- `reference_models/<profile_key>.json`

**Responsabilità**

- caricare l’audio
- estrarre segmenti rilevanti
- calcolare metriche stabili
- confrontare con modelli di riferimento
- produrre suggerimenti e score

**Output**

- JSON strutturato (`AnalyzerResult`)
- nessuna conoscenza di Supabase

---

### 4.2 Componenti legacy

- `analyze_master_web.py`
- Analyzer V1

Non fanno parte del flow attivo.  
Sono mantenuti solo come riferimento storico.

---

## 5. Normalizzazione e mapping (cuore del sistema)

**File**
- `lib/analyzer/handleAnalyzerResult.ts`

**Funzione**
- `buildAnalyzerUpdatePayload(result: AnalyzerResult)`

**Responsabilità**

- mappare il JSON Python → colonne Supabase
- gestire `null`, default e compatibilità futura
- isolare completamente l’output Python dal resto dell’app

### Regola assoluta

> Nessun altro file dell’app può mappare o interpretare il JSON dell’analyzer.

Se cambia l’analyzer, cambia **solo questo file**.

---

## 6. Persistenza dati (Supabase)

### Tabella: `project_versions`

#### Campi sintetici

- `lufs`
- `sub_clarity`
- `hi_end`
- `dynamics`
- `stereo_image`
- `tonality`
- `overall_score`
- `feedback`

#### Campi Analyzer

- `analyzer_json` (JSONB, snapshot completo)
- `analyzer_reference_ai` (JSONB)
- `fix_suggestions` (JSONB)
- `analyzer_bpm`
- `analyzer_spectral_centroid_hz`
- `analyzer_spectral_rolloff_hz`
- `analyzer_spectral_bandwidth_hz`
- `analyzer_spectral_flatness`
- `analyzer_zero_crossing_rate`

#### Waveform (se abilitato)

- `waveform_peaks`
- `waveform_duration`

Il payload del mapper viene passato **direttamente** a `.update()`.

---

## 7. UI Layer

### 7.1 Pagina progetto

**File**
- `app/artist/projects/[id]/page.tsx`

**Responsabilità**

- caricare progetto e versioni
- upload, rename, delete
- trigger analisi
- reload dati
- passare i dati all’Analyzer UI

Nessun calcolo, nessun mapping.

---

### 7.2 Analyzer UI

**File**
- `app/artist/components/AnalyzerProPanel.tsx`

**Responsabilità**

- visualizzare dati persistiti
- Tekkin Score e readiness
- loudness, BPM, spettro
- Reference AI match
- fix suggestions
- AI Coach

La UI **consuma**, non interpreta.

---

## 8. AI Layer (Tekkin AI Coach)

### 8.1 AI Summary

**Route**
- `POST /api/analyzer/ai-summary`

**Funzionamento**

- legge da `project_versions`
- costruisce un payload minimale
- genera:
- `analyzer_ai_summary`
- `analyzer_ai_actions`
- `analyzer_ai_meta`
- salva tutto in Supabase

---

### 8.2 AI Q&A

**Route**
- `POST /api/analyzer/ask`

**Regole**

- usa solo dati esistenti
- risponde a domande puntuali
- non salva nulla

---

## 9. Estendere il sistema (regola d’oro)

Quando il backend Python introduce nuove metriche:

1. Aggiornare:
- `types/analyzer.ts`
- `lib/analyzer/handleAnalyzerResult.ts`

2. Se servono nuove colonne:
- creare migration Supabase

3. La UI le legge automaticamente

Zero refactor a cascata.

---

## 10. Stato del sistema

- Legacy Analyzer: escluso dal flow
- Analyzer moderno: unica fonte di verità
- Mapping centralizzato
- UI sottile
- Architettura stabile e scalabile

---

Questo documento rappresenta lo **standard architetturale** del Tekkin Analyzer.