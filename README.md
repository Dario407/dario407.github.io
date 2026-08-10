# Reati – Dipartimento di Giustizia di Los Santos

Web app statica (HTML + CSS + JavaScript vanilla) per consultare un database di reati, selezionarne più di uno e calcolare automaticamente fattura minima/massima e mesi di carcere minimi/massimi, con limite massimo di 40 mesi complessivi.

> Progetto non ufficiale per server **FiveM RolePlay**. Nessuna affiliazione con FBI, governo USA o altre autorità reali.

## Struttura del progetto

```
/
├── index.html
├── style.css
├── script.js
├── data/
│   └── reati.json
├── img/
│   └── logo.png   (opzionale)
└── README.md
```

## 1. Come avviare il sito

Il sito è completamente statico: non richiede build, npm, backend o database.

**Opzione A — apertura diretta**
Apri semplicemente `index.html` con il browser. Nota: alcuni browser bloccano le richieste `fetch()` locali (`file://`) per motivi di sicurezza; se il database non si carica, usa l'opzione B.

**Opzione B — server locale (consigliata)**
Dalla cartella del progetto:

```bash
# Python 3
python -m http.server 8080

# oppure con Node.js
npx serve .
```

Poi apri `http://localhost:8080` nel browser.

## 2. Come modificare i reati esistenti

Tutti i reati si trovano in `data/reati.json`. Ogni voce ha questa struttura:

```json
{
  "id": "101",
  "articolo": "Art. 101",
  "nome": "Furto",
  "descrizione": "Descrizione del reato.",
  "fatturaMin": 5000,
  "fatturaMax": 10000,
  "mesiMin": 5,
  "mesiMax": 10,
  "procedura": "Procedura ordinaria",
  "tipo": "ordinario",
  "selezionabile": true,
  "categoria": "Patrimonio"
}
```

Per modificare un reato, cerca il suo `id` nel file e cambia i valori desiderati. Salva il file: non serve alcuna ricompilazione, basta ricaricare la pagina.

## 3. Come aggiungere nuovi reati

1. Apri `data/reati.json`.
2. Copia un blocco `{ ... }` esistente e incollalo come nuovo elemento dell'array (ricordati la virgola tra un elemento e l'altro).
3. Assegna un `id` univoco (stringa), non ancora presente nel file.
4. Compila tutti i campi. Se un valore economico o dei mesi non è applicabile, usa `null` (senza virgolette).
5. Per un reato **selezionabile e conteggiato nei calcoli**, imposta:
   ```json
   "tipo": "ordinario",
   "selezionabile": true
   ```
6. Per un reato di **tipo processo** (non selezionabile, escluso dai calcoli, ma consultabile), imposta:
   ```json
   "tipo": "processo",
   "selezionabile": false,
   "fatturaMin": null,
   "fatturaMax": null,
   "mesiMin": null,
   "mesiMax": null
   ```
7. Se usi una categoria nuova (diversa da quelle esistenti), comparirà automaticamente nel filtro "Categoria" della toolbar.
8. Salva e ricarica la pagina: il nuovo reato è subito disponibile, ricercabile e ordinabile.

Il file deve restare un JSON valido: puoi verificarlo incollandolo in un validatore online prima di pubblicare.

## 4. Come pubblicarlo su GitHub Pages

1. Crea un nuovo repository su GitHub e carica tutti i file del progetto (`index.html`, `style.css`, `script.js`, la cartella `data/`, la cartella `img/`).
2. Vai su **Settings → Pages** del repository.
3. In **Source**, seleziona il branch `main` (o `master`) e la cartella `/root`.
4. Salva: dopo qualche minuto il sito sarà disponibile all'indirizzo `https://<tuo-utente>.github.io/<nome-repository>/`.
5. Ogni modifica futura a `reati.json` o agli altri file, una volta pushata sul branch pubblicato, aggiorna automaticamente il sito online.

In alternativa il progetto è compatibile con qualsiasi hosting statico (Cloudflare Pages, Netlify, Vercel, hosting condiviso tradizionale): basta caricare i file così come sono.

## 5. Come cambiare colori e logo

**Colori**
Tutti i colori sono centralizzati come variabili CSS in cima a `style.css`, dentro il blocco `:root`:

```css
:root {
  --blu-scuro: #073763;
  --blu: #1C4587;
  --blu-header: #003366;
  --oro: #F1C232;
  --bianco: #FFFFFF;
  --grigio-chiaro: #F2F4F7;
  ...
}
```

Modifica questi valori esadecimali per cambiare la palette in tutto il sito in un solo punto.

**Logo**
Sostituisci il file `img/logo.png` con la tua immagine (formato quadrato consigliato, es. 128×128px). Se il file non esiste o non si carica, il sito mostra automaticamente un placeholder testuale ("DGLS") al posto del logo, senza generare errori.

## Funzionalità principali

- Ricerca full-text multi-parola su articolo, nome, ID, categoria e descrizione.
- Filtro per categoria e opzione "Mostra solo selezionati" (combinabili con la ricerca).
- Ordinamento per articolo, nome, fattura minima/massima, mesi minimi/massimi, con inversione crescente/decrescente.
- Calcolo automatico di fattura minima/massima e mesi minimi/massimi, ricalcolato da zero ad ogni modifica della selezione, con limite massimo di 40 mesi.
- Reati di tipo "processo" (non selezionabili, esclusi dai calcoli, ma sempre consultabili).
- Modal di dettaglio per ogni reato, chiudibile con overlay, pulsante "Chiudi" o tasto `ESC`.
- Copia degli articoli selezionati negli appunti (con notifica toast, non `alert()`), con fallback per browser meno recenti.
- Persistenza della selezione in `localStorage`, con verifica automatica degli ID ancora esistenti al ricaricamento.
- Link diretto a un reato tramite URL, es. `index.html?reato=101`.
- Interfaccia responsive: tabella con scroll orizzontale su schermi medi, card impilate su smartphone.
- Gestione degli errori di caricamento del database, con pulsante "Riprova", e fallback `—` per dati mancanti nei singoli reati.
