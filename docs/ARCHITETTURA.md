# Tekkin Site v2 – Architettura Analyzer (mappa definitiva)

Questo documento è una **mappa mentale tecnica** del sottosistema **Tekkin Analyzer**:  
descrive cosa fa ogni parte, dove vive e come i dati scorrono dal file audio alla dashboard artista.

Non è documentazione marketing. È orientamento interno per sviluppo e manutenzione.

---

## 1. Obiettivo del Tekkin Analyzer

Analizzare una **versione di progetto** (`project_versions`), produrre metriche tecniche e valutazioni di genere, salvarle in Supabase in forma strutturata e mostrarle in modo chiaro nella dashboard **Tekkin Artist**.

### Principio guida

- Python **analizza**
- TypeScript **mappa**
- Supabase **conserva**
- UI **mostra**
- Nessuna logica duplicata

---

## 2. Flow end-to-end (Analyzer)

### 2.1 Trigger lato UI

1. L’artista è nella pagina progetto  
   `app/artist/projects/[id]/page.tsx`

2. Clicca **Analyze** su una versione (`project_versions.id`)

3. Il client chiama  
   `POST /api/projects/run-analyzer`

---

### 2.2 API Route Next.js

**File**
- `app/api/projects/run-analyzer/route.ts`

**Responsabilità**

1. Autentica l’utente con Supabase  
2. Legge `version_id` dal body  
3. Recupera la versione da `project_versions`  
4. Risolve l’audio:
   - se `audio_url` è una path del bucket `tracks` → genera signed URL
   - se è già una URL valida → la usa direttamente
5. Chiama il backend Python Tekkin Analyzer passando:
   - `version_id`
   - `project_id`
   - `audio_url`
6. Riceve un JSON tipizzato come `AnalyzerResult`
7. Passa il risultato a  
   `buildAnalyzerUpdatePayload(result)`
8. Aggiorna `project_versions` con il payload normalizzato
9. Ritorna una risposta di successo

Nota:  
la UI **non fa merge locale** della versione aggiornata, ma ricarica i dati tramite `loadProject()`.

---

## 3. Backend Python Tekkin Analyzer

**Entrypoint**
- `tekkin_analyzer_api.py`

**Responsabilità**

- caricare l’audio
- estrarre finestre significative
- calcolare metriche tecniche
- confrontare con modelli di riferimento di genere
- generare suggerimenti e valutazioni

**Moduli principali**

- `analyze_master_web.py`
- `tekkin_analyzer_v4_extras.py`
- moduli di supporto (reference models, matematica, ecc.)

**Output**

- un JSON strutturato (`AnalyzerResult`)
- nessuna conoscenza di Supabase o del database

---

## 4. Normalizzazione e mapping (cuore del sistema)

**File**
- `lib/analyzer/handleAnalyzerResult.ts`

**Funzione chiave**
- `buildAnalyzerUpdatePayload(result: AnalyzerResult)`

**Responsabilità**

- mappare il JSON Python → colonne Supabase
- centralizzare tutta la logica di adattamento
- gestire `null`, default e compatibilità futura

**Campi principali gestiti**

- `analyzer_json` (snapshot completo)
- `analyzer_reference_ai`
- `analyzer_bpm`
- metriche spettrali (`spectral_*`)
- `fix_suggestions`

Regola fondamentale:

> Nessun altro file dell’app deve mappare il JSON dell’analyzer.

---

## 5. Persistenza dati (Supabase)

### Tabella: `project_versions`

**Colonne principali**

- `lufs`
- `sub_clarity`
- `hi_end`
- `dynamics`
- `stereo_image`
- `tonality`
- `overall_score`
- `feedback`

**Colonne Analyzer / JSON**

- `analyzer_json` (JSONB)
- `analyzer_reference_ai` (JSONB)
- `fix_suggestions` (JSONB)
- `analyzer_bpm`
- `analyzer_spectral_centroid_hz`
- `analyzer_spectral_rolloff_hz`
- `analyzer_spectral_bandwidth_hz`
- `analyzer_spectral_flatness`
- `analyzer_zero_crossing_rate`

Il payload prodotto da `buildAnalyzerUpdatePayload` viene passato **direttamente** a `.update()`.

---

## 6. Visualizzazione lato UI

### Pagina progetto

**File**
- `app/artist/projects/[id]/page.tsx`

**Responsabilità**

- caricare project e versioni
- gestire upload, delete e rename
- lanciare l’analisi
- ricaricare i dati dal DB
- passare i dati all’Analyzer UI

---

### Pannello Analyzer

**File**
- `app/artist/components/AnalyzerProPanel.tsx`

**Responsabilità**

- mostrare dati già normalizzati
- Tekkin Score e readiness
- loudness, BPM, spettro
- Reference AI match
- fix suggestions
- AI Coach

Nessuna logica di calcolo o mapping.

---

## 7. AI Layer (Tekkin AI Coach)

### 7.1 AI Summary

- Route: `POST /api/analyzer/ai-summary`
- Legge i dati da `project_versions`
- Costruisce un payload minimale per il modello
- Genera:
  - `analyzer_ai_summary`
  - `analyzer_ai_actions`
  - `analyzer_ai_meta`
- Salva tutto in Supabase

---

### 7.2 AI Q&A

- Route: `POST /api/analyzer/ask`
- Usa solo i dati già presenti
- Risponde a domande puntuali
- **Non salva nulla**

---

## 8. Estendere il Tekkin Analyzer (regola d’oro)

Quando il backend Python aggiunge nuove metriche:

1. Aggiorni solo:
   - `types/analyzer.ts`
   - `buildAnalyzerUpdatePayload`

2. Se servono nuove colonne:
   - crei una migration Supabase

3. La UI le legge automaticamente

Nessun refactor a cascata.

---

## 9. Stato attuale del sistema

- Analyzer legacy V1: **non parte del flow attivo**
- Analyzer moderno (V4 extras + Reference AI): **unica fonte di verità**
- Mapping centralizzato
- UI sottile
- Architettura stabile e scalabile

---

Documento pensato per crescere insieme a Tekkin Artist, mantenendo semplicità, chiarezza e controllo del percorso per l’artista.
