# Access checklist

- Nuovo utente: completa register/login, verifica riga `artist_access` creata con `access_status=inactive` e `plan=free`.
- Redeem code: usa `/pricing`, inserisci codice valido, verifica `artist_access.access_status=active` e redirect a `/artist`.
- Artist gate: visita `/artist` con accesso inattivo o nullo e verifica che venga mostrata la pagina "Upgrade Tekkin Artist".
- Pagine pubbliche: verifica che `/discovery` e `/charts` siano accessibili senza login.
