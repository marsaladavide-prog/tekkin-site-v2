# Tekkin Analyzer UX Spec (v1)

## Goal (first 5 seconds)
L’artista deve percepire subito:
- Tekkin ha capito la traccia
- c’è una direzione chiara
- anche con dati parziali il report è utile

## Hard rules
- Niente “n.a.” o placeholder visibili
- Niente card che spiegano cosa manca
- QuickReport deve funzionare sempre (hero line + 2-3 insight + next step)
- ProReport appare solo se ha insight forti (altrimenti non si vede)

## Experience hierarchy
### 1) Overview (sempre)
- Hero line non tecnica (frase guida)
- Readiness label semplice (Da rinforzare / Buona / Forte)
- 2-3 insights max, linguaggio umano
- Una sola CTA chiara

### 2) Critical signals (solo PRO e solo se presenti)
- Max 3 segnali
- Ogni segnale: cosa succede, perché conta, impatto

### 3) Positioning (solo se utile)
- Posizionamento rispetto al profilo Tekkin
- No numeri grezzi o std-dev in faccia

### 4) Breakdown (collassabile, opzionale)
- Solo per power user
- Qui possono stare numeri/grafici/dettagli

## Visibility mapping
### readyLevel = none
- Mostra Overview “Start” (promessa + CTA)
- Non mostrare dettagli

### readyLevel = quick
- Mostra Overview completa
- Non mostrare Critical signals / Positioning / Breakdown
- CTA: completa analisi per deep insights (beneficio, non mancanze)

### readyLevel = pro
- Mostra Overview completa
- Mostra Critical signals solo se hasStrongPro = true
- Mostra Positioning solo se hasPositioning = true
- Breakdown collassabile solo se hasBreakdown = true

## Gating (regole minime)
### hasStrongPro vero se almeno uno:
- bandCompare ha almeno 2 voci con status off/warn
- momentary LUFS timeline ha range ampio (max-min >= 6 LUFS)
- matchPercent molto basso (< 55) o molto alto (> 85) e possiamo dire qualcosa di utile
- overallScore estremo (< 45 o > 75)

### hasPositioning vero se:
- esiste profileLabel e matchPercent

### hasBreakdown vero se:
- abbiamo almeno uno tra momentary timeline, bandCompare
