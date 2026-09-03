/* =========================================================
   Dipartimento di Giustizia di Los Santos — script.js
   Applicazione statica per la consultazione dei reati.
   ========================================================= */

(function () {
  "use strict";

  // ---------- Costanti ----------
  const DATA_URL = "data/reati.json";
  const STORAGE_KEY_SELECTION = "selectedCrimeIds";
  const MESI_LIMITE = 40;

  // ---------- Stato applicativo ----------
  let allCrimes = [];          // database completo, invariato dopo il caricamento
  let selectedIds = new Set(); // ID dei reati attualmente selezionati
  let currentSort = { field: "articolo", dir: "asc" };
  let searchTerm = "";
  let categoriaFiltro = "";
  let onlySelected = false;

  // ---------- Riferimenti DOM ----------
  const els = {
    loadingState: document.getElementById("loading-state"),
    errorState: document.getElementById("error-state"),
    emptyState: document.getElementById("empty-state"),
    retryBtn: document.getElementById("retry-btn"),
    table: document.getElementById("crimes-list"),
    list: document.getElementById("crimes-list"),
    searchInput: document.getElementById("search-input"),
    categoriaSelect: document.getElementById("categoria-select"),
    sortSelect: document.getElementById("sort-select"),
    sortDirBtn: document.getElementById("sort-dir-btn"),
    sortDirIcon: document.getElementById("sort-dir-icon"),
    onlySelectedCheckbox: document.getElementById("only-selected-checkbox"),
    copyBtn: document.getElementById("copy-btn"),
    copySelectedBtn: document.getElementById("copy-selected-btn"),
    resetBtn: document.getElementById("reset-btn"),
    clearStorageBtn: document.getElementById("clear-storage-btn"),
    statDisponibili: document.getElementById("stat-disponibili"),
    statSelezionati: document.getElementById("stat-selezionati"),
    valFattura: document.getElementById("val-fattura"),
    valCauzione: document.getElementById("val-cauzione"),
    valMesi: document.getElementById("val-mesi"),
    selectedList: document.getElementById("selected-list"),
    logoImg: document.getElementById("logo-img"),
    logoFallback: document.getElementById("logo-fallback"),
    // Modal dettaglio
    modalOverlay: document.getElementById("modal-overlay"),
    modalCloseBtn: document.getElementById("modal-close-btn"),
    modalCloseBtn2: document.getElementById("modal-close-btn-2"),
    modalNome: document.getElementById("modal-nome"),
    modalArticolo: document.getElementById("modal-articolo"),
    modalDescrizione: document.getElementById("modal-descrizione"),
    modalFattura: document.getElementById("modal-fattura"),
    modalCauzione: document.getElementById("modal-cauzione"),
    modalCarcere: document.getElementById("modal-carcere"),
    modalCategoria: document.getElementById("modal-categoria"),
    // Toast
    toast: document.getElementById("toast"),
    sideAlertContainer: document.getElementById("side-alert-container"),
  };

  let lastFocusedElement = null;
  let toastTimeoutId = null;

  // =========================================================
  // CARICAMENTO DATI
  // =========================================================

  function loadCrimes() {
    showState("loading");
    fetch(DATA_URL, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Risposta di rete non valida: " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) {
          throw new Error("Formato dati non valido.");
        }
        allCrimes = data.map(normalizeCrime);
        populateCategorie(allCrimes);
        loadSelection();
        showState("ready");
        renderCrimes();
        handleDirectLinkParam();
      })
      .catch(function (err) {
        console.error("Errore nel caricamento del database dei reati:", err);
        showState("error");
      });
  }

  // Garantisce che ogni reato abbia tutti i campi attesi, con fallback sicuri.
  function normalizeCrime(raw) {
    return {
      id: safeString(raw.id),
      articolo: safeString(raw.articolo),
      nome: safeString(raw.nome),
      descrizione: safeString(raw.descrizione),
      fatturaMin: safeNumberOrNull(raw.fatturaMin),
      fatturaMax: safeNumberOrNull(raw.fatturaMax),
      cauzione: safeNumberOrNull(raw.cauzione),
      mesiMin: safeNumberOrNull(raw.mesiMin),
      mesiMax: safeNumberOrNull(raw.mesiMax),
      tipo: "reato",
      tipologia: safeString(raw.tipologia),
      selezionabile: raw.selezionabile !== false,
      categoria: safeString(raw.categoria) || "Altro",
    };
  }

  function safeString(value) {
    return (typeof value === "string" && value.trim() !== "") ? value : "";
  }

  function safeNumberOrNull(value) {
    return (typeof value === "number" && !Number.isNaN(value)) ? value : null;
  }

  function showState(state) {
    els.loadingState.hidden = state !== "loading";
    els.errorState.hidden = state !== "error";
    els.list.hidden = state === "loading" || state === "error";
  }

  function populateCategorie(crimes) {
    const categorie = Array.from(new Set(crimes.map(function (c) { return c.categoria; })))
      .filter(Boolean)
      .sort(function (a, b) { return a.localeCompare(b, "it"); });

    els.categoriaSelect.innerHTML = '<option value="">Tutte</option>';
    categorie.forEach(function (cat) {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      els.categoriaSelect.appendChild(opt);
    });
  }

  // =========================================================
  // FILTRO, RICERCA, ORDINAMENTO
  // =========================================================

  function filterCrimes() {
    const words = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return allCrimes.filter(function (crime) {
      if (categoriaFiltro && crime.categoria !== categoriaFiltro) {
        return false;
      }

      if (onlySelected) {
        if (!selectedIds.has(crime.id)) {
          return false;
        }
      }

      if (words.length === 0) {
        return true;
      }

      const haystack = [
        crime.articolo,
        crime.nome,
        crime.id,
        crime.categoria,
        crime.tipologia,
        crime.descrizione,
      ].join(" ").toLowerCase();

      return words.every(function (word) {
        return haystack.indexOf(word) !== -1;
      });
    });
  }

  function sortCrimes(crimes) {
    const field = currentSort.field;
    const dir = currentSort.dir === "asc" ? 1 : -1;

    const sorted = crimes.slice().sort(function (a, b) {
      let valA = a[field];
      let valB = b[field];

      if (valA === null && valB === null) return 0;
      if (valA === null) return 1;  // valori nulli sempre in fondo
      if (valB === null) return -1;

      if (typeof valA === "string") {
        return valA.localeCompare(valB, "it", { numeric: true }) * dir;
      }
      return (valA - valB) * dir;
    });

    return sorted;
  }

  // =========================================================
  // RENDER TABELLA
  // =========================================================

  function renderCrimes() {
    const filtered = filterCrimes();
    const sorted = sortCrimes(filtered);

    els.list.innerHTML = "";

    if (sorted.length === 0) {
      els.emptyState.hidden = false;
      els.list.hidden = true;
    } else {
      els.emptyState.hidden = true;
      els.list.hidden = false;
      sorted.forEach(function (crime) {
        els.list.appendChild(buildCard(crime));
      });
    }

    updateStats();
  }

  function buildCard(crime) {
    const li = document.createElement("li");
    li.className = "crime-card";
    li.dataset.id = crime.id;

    if (selectedIds.has(crime.id)) {
      li.classList.add("is-selected");
    }

    // Riga superiore: casella di selezione + articolo + nome + categoria
    const top = document.createElement("div");
    top.className = "crime-card-top";

    if (crime.selezionabile) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "row-checkbox";
      checkbox.id = "check-" + crime.id;
      checkbox.checked = selectedIds.has(crime.id);
      checkbox.setAttribute("aria-label", "Seleziona " + crime.nome);
      checkbox.addEventListener("change", function () {
        toggleCrime(crime.id, checkbox.checked);
      });
      top.appendChild(checkbox);
    } else {
      const badge = document.createElement("span");
      badge.className = "processo-badge";
      badge.textContent = "TIPOLOGIA";
      top.appendChild(badge);
    }

    const titleWrap = document.createElement("div");
    titleWrap.className = "crime-card-title";

    const artSpan = document.createElement("span");
    artSpan.className = "crime-art-badge";
    artSpan.textContent = crime.articolo || "—";
    titleWrap.appendChild(artSpan);

    const nomeBtn = document.createElement("button");
    nomeBtn.type = "button";
    nomeBtn.className = "crime-name-btn";
    nomeBtn.textContent = crime.nome || "—";
    nomeBtn.setAttribute("aria-label", "Leggi tutti i dettagli di " + (crime.nome || "questo reato"));
    nomeBtn.addEventListener("click", function () {
      openCrimeModal(crime.id);
    });
    titleWrap.appendChild(nomeBtn);

    top.appendChild(titleWrap);

    if (crime.categoria) {
      const catTag = document.createElement("span");
      catTag.className = "crime-category-tag";
      catTag.textContent = crime.categoria;
      top.appendChild(catTag);
    }

    if (crime.tipologia) {
      const tipoTag = document.createElement("span");
      tipoTag.className = "crime-category-tag";
      tipoTag.textContent = crime.tipologia;
      top.appendChild(tipoTag);
    }

    li.appendChild(top);

    // Descrizione del reato, sempre visibile
    if (crime.descrizione) {
      const desc = document.createElement("p");
      desc.className = "crime-desc";
      desc.textContent = crime.descrizione;
      li.appendChild(desc);
    }

    // Badge con multa e ore di arresto
    const badgesRow = document.createElement("div");
    badgesRow.className = "crime-badges";

    const fatturaText = formatRange(crime.fatturaMin, crime.fatturaMax, formatCurrency);
    if (fatturaText !== "—") {
      const badgeFattura = document.createElement("span");
      badgeFattura.className = "crime-badge badge-multa";
      badgeFattura.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>';
      badgeFattura.appendChild(document.createTextNode("Multa: " + fatturaText));
      badgesRow.appendChild(badgeFattura);
    }

    const mesiText = formatRange(crime.mesiMin, crime.mesiMax, function (n) { return String(n); }, "ore");
    if (mesiText !== "—") {
      const badgeMesi = document.createElement("span");
      badgeMesi.className = "crime-badge badge-ore";
      badgeMesi.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      badgeMesi.appendChild(document.createTextNode("Arresto: " + mesiText));
      badgesRow.appendChild(badgeMesi);
    }

    if (crime.cauzione !== null) {
      const badgeCauzione = document.createElement("span");
      badgeCauzione.className = "crime-badge badge-cauzione";
      badgeCauzione.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2v20M17 6.5c0-1.9-2.2-3.5-5-3.5s-5 1.4-5 3.2c0 3.8 10 1.8 10 5.9 0 1.9-2.2 3.4-5 3.4s-5-1.5-5-3.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      badgeCauzione.appendChild(document.createTextNode("Cauzione: " + formatCurrency(crime.cauzione)));
      badgesRow.appendChild(badgeCauzione);
    }

    if (badgesRow.childElementCount > 0) {
      li.appendChild(badgesRow);
    }

    return li;
  }

  function formatRange(min, max, formatter, suffix) {
    if (min === null && max === null) {
      return "—";
    }
    const suff = suffix ? (" " + suffix) : "";
    if (min === null) return formatter(max) + suff;
    if (max === null) return formatter(min) + suff;
    if (min === max) return formatter(min) + suff;
    return formatter(min) + " – " + formatter(max) + suff;
  }

  // Formato italiano con punto come separatore delle migliaia: 10.000 €
  function formatCurrency(n) {
    const rounded = Math.round(n);
    const withSeparators = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return withSeparators + " €";
  }

  // =========================================================
  // SELEZIONE / CALCOLO TOTALI
  // =========================================================

  function toggleCrime(id, isChecked) {
    if (isChecked) {
      selectedIds.add(id);
      const crime = allCrimes.find(function (c) { return c.id === id; });
      if (crime && crime.cauzione === 0) {
        showSideAlert((crime.articolo || "Reato") + " cauzione non disponibile");
      }
    } else {
      selectedIds.delete(id);
    }
    saveSelection();
    calculateTotals();
    updateSummary();
    updateSelectedList();
    renderCrimes();
  }

  function calculateTotals() {
    let fatturaMinTot = 0;
    let fatturaMaxTot = 0;
    let cauzioneTot = 0;
    let mesiMinTot = 0;
    let mesiMaxTot = 0;
    let hasFattura = false;
    let hasCauzione = false;
    let hasMesi = false;

    // Ricalcola SEMPRE da zero, partendo dalla selezione effettiva.
    selectedIds.forEach(function (id) {
      const crime = allCrimes.find(function (c) { return c.id === id; });
      if (!crime || !crime.selezionabile) return;

      if (crime.fatturaMin !== null && crime.fatturaMax !== null) {
        fatturaMinTot += crime.fatturaMin;
        fatturaMaxTot += crime.fatturaMax;
        hasFattura = true;
      }
      if (crime.cauzione !== null) {
        cauzioneTot += crime.cauzione;
        hasCauzione = true;
      }
      if (crime.mesiMin !== null && crime.mesiMax !== null) {
        mesiMinTot += crime.mesiMin;
        mesiMaxTot += crime.mesiMax;
        hasMesi = true;
      }
    });

    if (hasMesi) {
      mesiMinTot = Math.min(mesiMinTot, MESI_LIMITE);
      mesiMaxTot = Math.min(mesiMaxTot, MESI_LIMITE);
    }

    return {
      fatturaMin: hasFattura ? fatturaMinTot : null,
      fatturaMax: hasFattura ? fatturaMaxTot : null,
      cauzione: hasCauzione ? cauzioneTot : null,
      mesiMin: hasMesi ? mesiMinTot : null,
      mesiMax: hasMesi ? mesiMaxTot : null,
    };
  }

  function updateSummary() {
    const totals = calculateTotals();
    setSummaryRange(els.valFattura, totals.fatturaMin, totals.fatturaMax, formatCurrency);
    setSummaryValue(els.valCauzione, totals.cauzione, formatCurrency);
    setSummaryRange(els.valMesi, totals.mesiMin, totals.mesiMax, function (n) { return String(n); }, "ore");
  }

  function setSummaryRange(el, min, max, formatter, suffix) {
    if (min === null && max === null) {
      el.textContent = "Nessun Valore";
      el.classList.remove("has-value");
    } else {
      el.textContent = formatRange(min, max, formatter, suffix);
      el.classList.add("has-value");
    }
  }

  function setSummaryValue(el, value, formatter) {
    if (value === null) {
      el.textContent = "Nessun Valore";
      el.classList.remove("has-value");
    } else {
      el.textContent = formatter(value);
      el.classList.add("has-value");
    }
  }

  function updateStats() {
    const filtered = filterCrimes();
    els.statDisponibili.textContent = String(filtered.length);
    els.statSelezionati.textContent = String(selectedIds.size);
  }

  // =========================================================
  // PANNELLO "REATI SELEZIONATI"
  // =========================================================

  function updateSelectedList() {
    els.selectedList.innerHTML = "";

    const selectedCrimes = Array.from(selectedIds)
      .map(function (id) { return allCrimes.find(function (c) { return c.id === id; }); })
      .filter(Boolean)
      .sort(function (a, b) { return a.articolo.localeCompare(b.articolo, "it", { numeric: true }); });

    if (selectedCrimes.length === 0) {
      const li = document.createElement("li");
      li.className = "selected-empty";
      li.id = "selected-empty";
      li.textContent = "Nessun reato selezionato.";
      els.selectedList.appendChild(li);
      return;
    }

    selectedCrimes.forEach(function (crime) {
      const li = document.createElement("li");

      const label = document.createElement("span");
      label.className = "selected-item-label";
      label.textContent = crime.articolo + " – " + crime.nome;
      li.appendChild(label);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-item-btn";
      removeBtn.setAttribute("aria-label", "Rimuovi " + crime.nome + " dalla selezione");
      removeBtn.textContent = "\u00d7";
      removeBtn.addEventListener("click", function () {
        toggleCrime(crime.id, false);
      });
      li.appendChild(removeBtn);

      els.selectedList.appendChild(li);
    });
  }

  // =========================================================
  // COPIA NEGLI APPUNTI
  // =========================================================

  function copySelectedCrimes() {
    if (selectedIds.size === 0) {
      showToast("Nessun reato selezionato.", true);
      return;
    }

    const selectedCrimes = Array.from(selectedIds)
      .map(function (id) { return allCrimes.find(function (c) { return c.id === id; }); })
      .filter(Boolean)
      .sort(function (a, b) { return a.articolo.localeCompare(b.articolo, "it", { numeric: true }); });

    const text = selectedCrimes.map(function (c) { return c.articolo + " CP"; }).join(", ");

    copyTextToClipboard(text)
      .then(function () {
        showToast("Reati copiati negli appunti!");
      })
      .catch(function () {
        showToast("Impossibile copiare automaticamente. Seleziona e copia manualmente.", true);
      });
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback per browser meno recenti
    return new Promise(function (resolve, reject) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (successful) {
          resolve();
        } else {
          reject(new Error("execCommand copy fallito"));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  // =========================================================
  // MODAL DETTAGLIO REATO
  // =========================================================

  function openCrimeModal(id) {
    const crime = allCrimes.find(function (c) { return c.id === id; });
    if (!crime) return;

    els.modalNome.textContent = crime.nome || "—";
    els.modalArticolo.textContent = crime.articolo || "—";
    els.modalDescrizione.textContent = crime.descrizione || "—";
    els.modalFattura.textContent = formatRange(crime.fatturaMin, crime.fatturaMax, formatCurrency);
    els.modalCauzione.textContent = crime.cauzione !== null ? formatCurrency(crime.cauzione) : "—";
    els.modalCarcere.textContent = formatRange(crime.mesiMin, crime.mesiMax, function (n) { return String(n); }, "ore");
    els.modalCategoria.textContent = crime.categoria || "—";

    lastFocusedElement = document.activeElement;
    els.modalOverlay.hidden = false;
    els.modalCloseBtn.focus();

    // Aggiorna l'URL per consentire il link diretto, senza ricaricare la pagina.
    const url = new URL(window.location.href);
    url.searchParams.set("reato", crime.id);
    window.history.replaceState({}, "", url);
  }

  function closeCrimeModal() {
    if (els.modalOverlay.hidden) return;
    els.modalOverlay.hidden = true;

    const url = new URL(window.location.href);
    url.searchParams.delete("reato");
    window.history.replaceState({}, "", url);

    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  function handleDirectLinkParam() {
    const params = new URLSearchParams(window.location.search);
    const reatoId = params.get("reato");
    if (reatoId) {
      const crime = allCrimes.find(function (c) { return c.id === reatoId; });
      if (crime) {
        openCrimeModal(crime.id);
      }
    }
  }

  // =========================================================
  // RESET SELEZIONE
  // =========================================================

  function resetSelection() {
    selectedIds.clear();
    onlySelected = false;
    els.onlySelectedCheckbox.checked = false;
    saveSelection();
    calculateTotals();
    updateSummary();
    updateSelectedList();
    renderCrimes();
    showToast("Selezione reimpostata.");
  }

  // =========================================================
  // PERSISTENZA (localStorage)
  // =========================================================

  function saveSelection() {
    try {
      window.localStorage.setItem(STORAGE_KEY_SELECTION, JSON.stringify(Array.from(selectedIds)));
    } catch (err) {
      console.warn("Impossibile salvare la selezione in localStorage:", err);
    }
  }

  function loadSelection() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_SELECTION);
      if (!raw) return;
      const ids = JSON.parse(raw);
      if (!Array.isArray(ids)) return;

      const validIds = ids.filter(function (id) {
        return allCrimes.some(function (c) { return c.id === id && c.selezionabile; });
      });
      selectedIds = new Set(validIds);
      updateSummary();
      updateSelectedList();
    } catch (err) {
      console.warn("Impossibile leggere la selezione da localStorage:", err);
    }
  }

  function clearStoredSelection() {
    try {
      window.localStorage.removeItem(STORAGE_KEY_SELECTION);
    } catch (err) {
      console.warn("Impossibile cancellare la selezione da localStorage:", err);
    }
    selectedIds.clear();
    onlySelected = false;
    els.onlySelectedCheckbox.checked = false;
    calculateTotals();
    updateSummary();
    updateSelectedList();
    renderCrimes();
    showToast("Selezione cancellata dalla memoria del browser.");
  }

  // =========================================================
  // TOAST
  // =========================================================

  function showToast(message, isError) {
    window.clearTimeout(toastTimeoutId);
    els.toast.textContent = message;
    els.toast.classList.toggle("toast-error", Boolean(isError));
    els.toast.hidden = false;
    // Forza reflow per riavviare l'animazione della transizione.
    void els.toast.offsetWidth;
    els.toast.classList.add("toast-visible");

    toastTimeoutId = window.setTimeout(function () {
      els.toast.classList.remove("toast-visible");
      window.setTimeout(function () {
        els.toast.hidden = true;
      }, 220);
    }, 2600);
  }

  // =========================================================
  // AVVISI LATERALI (es. cauzione non disponibile)
  // =========================================================

  function showSideAlert(message) {
    const alert = document.createElement("div");
    alert.className = "side-alert";
    alert.setAttribute("role", "alert");
    alert.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.29 3.86l-8.48 14.7A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.72-3.03L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const span = document.createElement("span");
    span.textContent = message;
    alert.appendChild(span);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "side-alert-close";
    closeBtn.setAttribute("aria-label", "Chiudi avviso");
    closeBtn.textContent = "\u00D7";
    closeBtn.addEventListener("click", function () {
      dismissSideAlert(alert);
    });
    alert.appendChild(closeBtn);

    els.sideAlertContainer.appendChild(alert);

    window.setTimeout(function () {
      dismissSideAlert(alert);
    }, 5000);
  }

  function dismissSideAlert(alert) {
    if (!alert.parentNode) return;
    alert.classList.add("side-alert-hide");
    window.setTimeout(function () {
      if (alert.parentNode) alert.parentNode.removeChild(alert);
    }, 220);
  }

  // =========================================================
  // GESTIONE LOGO PLACEHOLDER
  // =========================================================

  function setupLogoFallback() {
    els.logoFallback.style.display = "none";
    els.logoImg.addEventListener("error", function () {
      els.logoImg.style.display = "none";
      els.logoFallback.style.display = "flex";
    });
  }

  // =========================================================
  // EVENT LISTENERS
  // =========================================================

  function setupEventListeners() {
    els.retryBtn.addEventListener("click", loadCrimes);

    els.searchInput.addEventListener("input", function () {
      searchTerm = els.searchInput.value;
      renderCrimes();
    });

    els.categoriaSelect.addEventListener("change", function () {
      categoriaFiltro = els.categoriaSelect.value;
      renderCrimes();
    });

    els.sortSelect.addEventListener("change", function () {
      currentSort.field = els.sortSelect.value;
      renderCrimes();
    });

    els.sortDirBtn.addEventListener("click", function () {
      currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
      els.sortDirIcon.textContent = currentSort.dir === "asc" ? "\u2191" : "\u2193";
      els.sortDirBtn.setAttribute(
        "aria-label",
        currentSort.dir === "asc" ? "Ordine crescente attivo, clicca per invertire" : "Ordine decrescente attivo, clicca per invertire"
      );
      renderCrimes();
    });

    els.onlySelectedCheckbox.addEventListener("change", function () {
      onlySelected = els.onlySelectedCheckbox.checked;
      renderCrimes();
    });

    els.copyBtn.addEventListener("click", copySelectedCrimes);
    els.copySelectedBtn.addEventListener("click", copySelectedCrimes);

    els.resetBtn.addEventListener("click", resetSelection);

    els.clearStorageBtn.addEventListener("click", clearStoredSelection);

    els.modalCloseBtn.addEventListener("click", closeCrimeModal);
    els.modalCloseBtn2.addEventListener("click", closeCrimeModal);
    els.modalOverlay.addEventListener("click", function (e) {
      if (e.target === els.modalOverlay) closeCrimeModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (!els.modalOverlay.hidden) closeCrimeModal();
      }
    });
  }

  // =========================================================
  // AVVIO
  // =========================================================

  function init() {
    setupLogoFallback();
    setupEventListeners();
    loadCrimes();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
