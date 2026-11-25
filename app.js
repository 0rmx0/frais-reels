// ============================================
// CALCULATEUR FRAIS RÉELS — app.js (couche DOM)
// La logique de calcul pure vit dans calculs.js (window.Calculs)
// La configuration des barèmes vit dans config.js
// ============================================

// --- VARIABLES GLOBALES ---
let currentYear = (typeof getLatestOfficialYear === 'function') ? getLatestOfficialYear() : 2026;
let currentTransport = 'voiture';
let currentRepasType = 'classique';
let currentMutuelle = 'entreprise_fiche';

const STATE_KEY = 'frais-reels-state-v1';
const FIELD_IDS = [
  'salaire', 'nombre_parts', 'situation',
  'jours_ouvres', 'jours_arret', 'jours_teletravail',
  'dist_aller', 'cv', 'energie', 'cout_abonnement', 'frais_velo',
  'peage', 'parking', 'interets',
  'nb_repas_classique', 'cout_repas_classique',
  'nb_tickets', 'valeur_ticket', 'part_employeur_ticket',
  'nb_repas_mixte', 'cout_repas_mixte', 'nb_tickets_mixte', 'valeur_ticket_mixte', 'part_employeur_ticket_mixte',
  'frais_teletravail', 'frais_formation', 'frais_doc', 'frais_autres',
  'frais_syndicat', 'frais_ordre', 'frais_assurance_pro', 'frais_habillement',
  'frais_materiel', 'frais_materiel_amorti', 'frais_telephone', 'frais_double_residence',
  'frais_demenagement', 'frais_sejour_etranger', 'frais_local_pro', 'frais_interets_titres',
  'frais_representation', 'frais_juridiques',
  'remb_ik', 'remb_carburant', 'remb_mobilite', 'remb_autres',
  'mutuelle_6dd', 'mutuelle_madelin'
];
const CHECKBOX_IDS = ['circonstances', 'forfait_tt', 'alloc_tt'];

const $ = (id) => document.getElementById(id);

// --- Ligne de statut (remplace alert/confirm/prompt : aucun dialogue bloquant) ---
const ICON_INFO = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
const ICON_WARN = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
const ICON_OK = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';

function status(msg) {
  const line = $('status-line');
  if (!line) return;
  const div = document.createElement('div');
  div.className = 'status-msg';
  div.textContent = msg;
  line.appendChild(div);
  while (line.children.length > 2) line.removeChild(line.firstChild);
}

// --- DOM READY ---
document.addEventListener('DOMContentLoaded', function () {
  initYearSelector();
  initInputListeners();
  initButtons();
  initImport();
  restoreState();
  registerSW();
});

// --- BOUTONS (CSP script-src 'self' : aucun gestionnaire inline dans le HTML) ---
function initButtons() {
  document.querySelectorAll('.card-header[aria-controls]').forEach(h => {
    h.addEventListener('click', () => toggleCard(h.getAttribute('aria-controls').replace(/^body-/, '')));
  });
  const bindToggleGroup = (groupId, handler) => {
    document.querySelectorAll(`#${groupId} .toggle-btn`).forEach(b => {
      b.addEventListener('click', () => handler(b.dataset.type, b));
    });
  };
  bindToggleGroup('transport-type', setTransport);
  bindToggleGroup('repas-type', setRepasType);
  bindToggleGroup('mutuelle-type', setMutuelle);
  const ddBtn = document.querySelector('.export-dropdown-btn');
  if (ddBtn) ddBtn.addEventListener('click', showExportMenu);
  document.querySelectorAll('#export-menu .export-btn').forEach(b => {
    b.addEventListener('click', () => { exportCalculs(b.dataset.format || 'txt'); showExportMenu(); });
  });
  const onClick = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
  onClick('btn-print', () => window.print());
  onClick('btn-share', copyShareLink);
  onClick('btn-import', () => { const fi = $('file-import'); if (fi) fi.click(); });
  onClick('btn-reset', resetState);
}

// --- SÉLECTEUR D'ANNÉE ---
function initYearSelector() {
  const select = $('year-selector');
  if (!select) return;
  getAvailableYears().forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = FISCAL_CONFIG[year].label;
    select.appendChild(option);
  });
  select.value = String(currentYear);
  select.addEventListener('change', function () {
    currentYear = parseInt(this.value, 10);
    updateYearDisplay();
    calc();
  });
  updateYearDisplay();
}

function updateYearDisplay() {
  const config = getConfig(currentYear);
  document.querySelectorAll('[data-year-display]').forEach(el => { el.textContent = config.label; });
  const note = $('year-note');
  if (note) note.classList.toggle('hidden', !config.provisoire);
  const footer = $('footer-version');
  if (footer) {
    footer.textContent = `v${VERSION} · Barème ${currentYear} (revenus ${config.revenusYear})` + (config.provisoire ? ' · provisoire' : '');
  }
  // Montants affichés dans les textes d'aide
  const fr2 = (x) => x.toFixed(2).replace('.', ',');
  document.querySelectorAll('[data-forfait-repas]').forEach(el => { el.textContent = fr2(config.forfaitRepas); });
  document.querySelectorAll('[data-plafond-repas]').forEach(el => { el.textContent = fr2(config.plafondRepas); });
  document.querySelectorAll('[data-plafond-repas-max]').forEach(el => { el.textContent = fr2(config.plafondRepas - config.forfaitRepas); });
  document.querySelectorAll('[data-plafond-employeur]').forEach(el => { el.textContent = fr2(config.plafondPartEmployeur); });
  document.querySelectorAll('[data-forfait-tt]').forEach(el => { el.textContent = fr2(config.forfaitTeletravailJour); });
  document.querySelectorAll('[data-plafond-tt]').forEach(el => { el.textContent = fr2(config.plafondTeletravail); });
}

// --- ÉCOUTE DES CHAMPS (une seule fois : plus d'handlers inline) ---
function initInputListeners() {
  document.querySelectorAll('input, select').forEach(el => {
    if (el.id === 'file-import') return;
    el.addEventListener('input', onFieldChange);
    el.addEventListener('change', onFieldChange);
  });
}

function onFieldChange(e) {
  if (e.target && e.target.id === 'forfait_tt') syncForfaitTT();
  calc();
}

function syncForfaitTT() {
  const tt = $('forfait_tt');
  const field = $('frais_teletravail');
  if (tt && field) field.disabled = tt.checked;
}

// --- CARTES PLIANTES ---
function toggleCard(id) {
  const body = $(`body-${id}`);
  const toggle = $(`toggle-${id}`);
  if (!body) return;
  body.classList.toggle('open');
  if (toggle) toggle.classList.toggle('open', body.classList.contains('open'));
  const header = document.querySelector(`.card-header[aria-controls="body-${id}"]`);
  if (header) header.setAttribute('aria-expanded', body.classList.contains('open') ? 'true' : 'false');
}

// --- TOGGLES ---
function activateToggle(groupId, type) {
  document.querySelectorAll(`#${groupId} .toggle-btn`).forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });
}

const CV_OPTIONS = {
  voiture: [['', '— CV fiscaux —'], ['3', '3 CV et moins'], ['4', '4 CV'], ['5', '5 CV'], ['6', '6 CV'], ['7', '7 CV et plus']],
  moto: [['', '— CV fiscaux —'], ['1-2', '1 ou 2 CV'], ['3-5', '3 à 5 CV'], ['5+', 'Plus de 5 CV']],
  cyclomoteur: [['', '— sans objet —']]
};

function fillCvOptions(type) {
  const cvSel = $('cv');
  if (!cvSel) return;
  const prev = cvSel.value;
  const options = CV_OPTIONS[type] || CV_OPTIONS.voiture;
  cvSel.innerHTML = options.map(([v, label]) => `<option value="${v}">${label}</option>`).join('');
  if (options.some(([v]) => v === prev)) cvSel.value = prev;
}

function setTransport(type, btn) {
  currentTransport = type;
  activateToggle('transport-type', type);
  const isVehicule = (type === 'voiture' || type === 'moto' || type === 'cyclomoteur');
  $('block-vehicule').style.display = isVehicule ? 'block' : 'none';
  $('block-tc').style.display = (type === 'tc') ? 'block' : 'none';
  $('block-velo').style.display = (type === 'velo') ? 'block' : 'none';
  $('field-cv').style.display = (type === 'cyclomoteur') ? 'none' : '';
  fillCvOptions(type);
  calc();
}

function setRepasType(type, btn) {
  currentRepasType = type;
  activateToggle('repas-type', type);
  const showClassique = (type === 'classique');
  const showTickets = (type === 'tickets');
  const showMixte = (type === 'mixte');
  $('block-repas-classique').style.display = showClassique ? 'block' : 'none';
  $('block-repas-tickets').style.display = showTickets ? 'block' : 'none';
  $('block-repas-mixte').style.display = showMixte ? 'block' : 'none';
  calc();
}

function setMutuelle(type, btn) {
  currentMutuelle = type;
  activateToggle('mutuelle-type', type);
  $('block-mutuelle-fiche').classList.toggle('hidden', type !== 'entreprise_fiche');
  $('block-mutuelle-6dd').classList.toggle('hidden', type !== 'entreprise_6dd');
  $('block-mutuelle-madelin').classList.toggle('hidden', type !== 'madelin');
  $('block-mutuelle-individuelle').classList.toggle('hidden', type !== 'individuelle');
  calc();
}

// --- ÉTAT : lecture / sauvegarde / restauration / partage ---
function readState() {
  const f = {};
  FIELD_IDS.forEach(id => { const el = $(id); if (el) f[id] = el.value; });
  CHECKBOX_IDS.forEach(id => { const el = $(id); if (el) f[id] = el.checked ? 'on' : ''; });
  return {
    year: currentYear,
    transport: currentTransport,
    repasType: currentRepasType,
    mutuelle: currentMutuelle,
    situation: ($('situation') && $('situation').value) || 'celibataire',
    f
  };
}

function applyState(state) {
  if (!state || typeof state !== 'object') return false;
  if (state.year && FISCAL_CONFIG[state.year]) {
    currentYear = parseInt(state.year, 10);
    const ys = $('year-selector');
    if (ys) ys.value = String(currentYear);
  }
  if (state.transport) setTransport(state.transport, null);
  if (state.repasType) setRepasType(state.repasType, null);
  if (state.mutuelle) setMutuelle(state.mutuelle, null);
  if (state.situation) { const s = $('situation'); if (s) s.value = state.situation; }
  const f = state.f || {};
  FIELD_IDS.forEach(id => {
    if (id === 'situation') return;
    if (f[id] !== undefined) { const el = $(id); if (el) el.value = f[id]; }
  });
  CHECKBOX_IDS.forEach(id => {
    if (f[id] !== undefined) { const el = $(id); if (el) el.checked = (f[id] === 'on' || f[id] === true); }
  });
  syncForfaitTT();
  updateYearDisplay();
  calc();
  return true;
}

function defaultState() {
  const f = {};
  FIELD_IDS.forEach(id => { f[id] = ''; });
  CHECKBOX_IDS.forEach(id => { f[id] = ''; });
  return { year: currentYear, transport: 'voiture', repasType: 'classique', mutuelle: 'entreprise_fiche', situation: 'celibataire', f };
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(readState())); } catch (e) { /* stockage indisponible */ }
  }, 300);
}

function restoreState() {
  const params = new URLSearchParams(location.search);
  const s = params.get('s');
  if (s) {
    try {
      if (applyState(JSON.parse(decodeShare(s)))) return;
    } catch (e) { console.warn('Paramètre de partage invalide', e); }
  }
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) applyState(JSON.parse(raw));
  } catch (e) { /* état illisible */ }
}

function encodeShare(state) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeShare(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return decodeURIComponent(bin.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
}

function copyShareLink() {
  const url = location.origin + location.pathname + '?s=' + encodeShare(readState());
  const btn = $('btn-share');
  const done = () => {
    status('Lien de partage copié dans le presse-papiers.');
    if (!btn) return;
    const old = btn.innerHTML;
    btn.textContent = 'Lien copié !';
    setTimeout(() => { btn.innerHTML = old; }, 2000);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(() => { status('Lien à copier : ' + url); });
  } else {
    status('Lien à copier : ' + url);
  }
}

let resetArmed = false;
let resetTimer = null;
function resetState() {
  const btn = $('btn-reset');
  if (!resetArmed) {
    resetArmed = true;
    if (btn) { btn.classList.add('armed'); btn.textContent = 'Confirmer ?'; }
    status('Clique encore sur « Réinitialiser » pour effacer toutes les saisies locales.');
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      resetArmed = false;
      if (btn) { btn.classList.remove('armed'); btn.innerHTML = 'Réinitialiser'; }
    }, 3500);
    return;
  }
  clearTimeout(resetTimer);
  resetArmed = false;
  if (btn) { btn.classList.remove('armed'); }
  try { localStorage.removeItem(STATE_KEY); } catch (e) {}
  history.replaceState(null, '', location.pathname);
  applyState(defaultState());
  status('Saisies effacées — retour à l\'état initial.');
}

function initImport() {
  const input = $('file-import');
  if (!input) return;
  input.addEventListener('change', function () {
    const file = this.files && this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const obj = JSON.parse(reader.result);
        const state = obj && obj.state ? obj.state : obj;
        applyState(state);
      } catch (e) {
        status('Fichier JSON invalide — import annulé.');
      }
      input.value = '';
    };
    reader.readAsText(file);
  });
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* mode non-PWA */ });
  }
}
// --- FORMATAGE ---
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtNumber(n, decimals = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

// --- CALCUL + RENDU ---
function calc() {
  const state = readState();
  const config = getConfig(currentYear);
  const res = Calculs.compute(state, config);
  render(state, config, res);
  scheduleSave();
}

function transportSub(config, res) {
  const d = res.transport.detail;
  if (d.type === 'tc') return 'Abonnement transports en commun';
  if (d.type === 'velo') return 'Vélo / marche — frais réels';
  const parts = [d.label];
  if (d.cv) parts.push(`${d.cv} CV`);
  parts.push(d.energie === 'electrique' ? 'électrique (+20 %)' : 'thermique');
  if (d.bareme && d.bareme.taux) {
    const b = d.bareme;
    let formula = `${fmtNumber(d.kmAnnuel)} km × ${b.taux.toFixed(3).replace('.', ',')} €/km`;
    if (b.fixe) formula += ` + ${fmtNumber(b.fixe)} €`;
    if (b.majoration > 1) formula += ' × 1,20';
    parts.push(formula);
  }
  if (d.depassement40km) parts.push(`⚠ limité à ${config.limiteKmTrajet} km/trajet`);
  const annexes = (d.peage || 0) + (d.parking || 0) + (d.interets || 0);
  if (annexes > 0) parts.push(`+ ${fmt(annexes)} frais annexes`);
  return parts.join(' · ');
}

function repasSub(res) {
  const r = res.repas;
  if (r.type === 'tickets' && r.tickets) {
    const t = r.tickets;
    return `${fmtNumber(t.nb)} tickets × ${fmt(t.valeur)} − part employeur ${fmt(t.partEmployeur)} − forfait ${fmt(r.forfait)}`;
  }
  if (r.type === 'mixte') {
    return `${fmtNumber(r.repas.nb)} repas (${fmt(r.repas.deductible)}) + ${fmtNumber(r.tickets.nb)} tickets (${fmt(r.tickets.deductible)})`;
  }
  const p = r.repas;
  return `${fmtNumber(p.nb)} repas × ${fmt(p.cout)}${p.plafonne ? ' (plafonné à ' + fmt(r.plafond) + ')' : ''} − forfait ${fmt(r.forfait)}`;
}

function render(state, config, res) {
  // Jours & km
  $('res-jours').textContent = fmtNumber(res.jours.joursBureau);
  $('res-jours-sub').textContent = `${res.jours.joursBureau} jours · ${res.jours.joursBureau * 2} trajets`;
  const kmEl = $('km_annuel');
  if (kmEl) kmEl.value = res.kmAnnuel ? Math.round(res.kmAnnuel) : '';
  $('res-km-annuel').textContent = fmtNumber(res.kmAnnuel);
  $('res-km-sub').textContent = res.transport.detail.depassement40km
    ? `limité à ${config.limiteKmTrajet} km aller × 2 × jours`
    : 'jours au bureau × distance aller × 2';

  // Frais
  $('res-transport').textContent = fmt(res.transport.frais);
  $('res-transport-sub').textContent = transportSub(config, res);
  $('res-repas').textContent = fmt(res.repas.deductible);
  $('res-repas-sub').textContent = repasSub(res);
  $('res-autres').textContent = fmt(res.autresFrais.total);
  const postesActifs = (res.autresFrais.postes || []).filter(p => p.montant > 0);
  const detailPostes = postesActifs.map(p => `${p.court} ${fmt(p.montant)}`).join(' · ');
  let subAutres = '';
  if (res.autresFrais.forfaitTT !== null) subAutres += `forfait télétravail ${fmt(res.autresFrais.forfaitTT)}`;
  if (detailPostes) subAutres += (subAutres ? ' · ' : '') + detailPostes;
  $('res-autres-sub').textContent = subAutres || 'Télétravail, formation, documentation, autres';

  // Revenu & impôt
  $('res-revenu-net').textContent = fmt(res.revenuNetImposable);
  $('res-impot-brut').textContent = fmt(res.impot.impotBrut);
  $('res-impot-brut-sub').textContent = `Barème ${currentYear} · ${fmtNumber(res.impot.nombreParts, 1)} part(s) · TMI ${res.impot.tranche}`;
  $('res-impot-net').textContent = fmt(res.impot.impotNet);
  $('res-impot-net-sub').textContent = `après décote ${fmt(res.impot.decote)}${res.impot.cehr > 0 ? ' + CEHR ' + fmt(res.impot.cehr) : ''} (estimation)`;

  // Détails
  $('d-total-brut').textContent = fmt(res.totalFraisBruts);
  $('d-remb').textContent = fmt(-res.remboursements.total);
  $('d-total-net').textContent = fmt(res.totalFraisNets);
  $('d-abattement').textContent = fmt(res.abattement10Pct);
  const gainEl = $('d-gain');
  gainEl.textContent = fmt(res.gain);
  gainEl.style.color = res.gain >= 0 ? 'var(--accent2)' : '#ff9a62';
  $('d-revenu-par-part').textContent = fmt(res.impot.revenuParPart);
  $('d-tranche').textContent = res.impot.tranche;
  $('d-decote').textContent = res.impot.decote > 0 ? fmt(-res.impot.decote) : fmt(0);
  const cehrRow = $('d-cehr-row');
  if (cehrRow) cehrRow.style.display = res.impot.cehr > 0 ? 'flex' : 'none';
  $('d-cehr').textContent = fmt(res.impot.cehr);

  // Mutuelle
  const dMut = $('d-mutuelle');
  if (res.mutuelle.deductible > 0) {
    dMut.style.display = 'flex';
    $('d-mutuelle-label').textContent = `Mutuelle déductible (case ${res.mutuelle.case} · ${res.mutuelle.formulaire})`;
    $('d-mutuelle-val').textContent = fmt(res.mutuelle.deductible);
  } else {
    dMut.style.display = 'none';
  }

  // Avertissements
  renderWarnings(res.warnings);

  // Verdict
  const v = res.verdict;
  const box = $('verdict-box');
  box.className = `verdict ${v.kind}`;
  const icon = v.kind === 'good' ? ICON_OK : v.kind === 'bad' ? ICON_WARN : ICON_INFO;
  box.innerHTML = `<div class="verdict-icon">${icon}</div><div class="verdict-text"><strong></strong><br><span></span></div>`;
  box.querySelector('strong').textContent = v.title;
  box.querySelector('.verdict-text span').textContent = v.text;
}

function renderWarnings(warnings) {
  const box = $('warnings');
  const list = $('warnings-list');
  if (!box || !list) return;
  list.innerHTML = '';
  if (!warnings || warnings.length === 0) {
    box.classList.remove('visible');
    return;
  }
  box.classList.add('visible');
  warnings.forEach(w => {
    const item = document.createElement('div');
    item.className = `warning-item ${w.level === 'info' ? 'info' : ''}`;
    const icon = document.createElement('span');
    icon.className = 'warning-icon';
    icon.innerHTML = w.level === 'info' ? ICON_INFO : ICON_WARN;
    const text = document.createElement('span');
    text.textContent = w.text;
    item.appendChild(icon);
    item.appendChild(text);
    list.appendChild(item);
  });
}
// --- EXPORTS ---
function isoDate() { return new Date().toISOString().slice(0, 10); } // 2026-11-04 (pas de séparateurs)
function exportFilename(ext) { return `frais_reels_${currentYear}_${isoDate()}.${ext}`; }

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Construit l'objet de données complet (unique source, partagé par TXT/JSON/CSV)
function buildExportData() {
  const state = readState();
  const config = getConfig(currentYear);
  const res = Calculs.compute(state, config);
  return {
    metadata: {
      calculator: `Calculateur Frais Réels v${VERSION}`,
      fiscalYear: currentYear,
      revenusYear: config.revenusYear,
      baremeProvisoire: !!config.provisoire,
      exportDate: isoDate(),
      disclaimer: 'Simulation indicative — ne remplace pas un conseil fiscal.',
      sources: [
        'impots.gouv.fr — barème kilométrique, frais de repas, tickets restaurant',
        'BOFiP — BOI-RSA-BASE-30-50-30, BOI-IR-LIQ, art. 197 et 223 sexies CGI',
        'service-public.fr — barèmes kilométriques 2026'
      ]
    },
    state, // réimportable via le bouton « Importer JSON »
    situation: {
      salaireNetImposable: res.salaire,
      nombreParts: res.impot.nombreParts,
      situationFamiliale: res.situation,
      joursOuvres: res.jours.joursOuvres,
      joursArret: res.jours.joursArret,
      joursTeletravail: res.jours.joursTeletravail,
      joursBureau: res.jours.joursBureau
    },
    transport: { ...res.transport.detail, fraisTransport: res.transport.frais },
    repas: res.repas,
    autresFrais: res.autresFrais,
    remboursements: res.remboursements,
    mutuelle: res.mutuelle,
    results: {
      totalFraisBruts: res.totalFraisBruts,
      totalFraisNets: res.totalFraisNets,
      abattement10Pct: res.abattement10Pct,
      deductionRetenue: res.deductionRetenue,
      gain: res.gain,
      revenuNetImposable: res.revenuNetImposable,
      revenuParPart: res.impot.revenuParPart,
      tranche: res.impot.tranche,
      impotBrut: res.impot.impotBrut,
      decote: res.impot.decote,
      cehr: res.impot.cehr,
      impotNetEstime: res.impot.impotNet,
      verdict: `${res.verdict.title} — ${res.verdict.text}`
    },
    warnings: res.warnings.map(w => w.text),
    declaration: {
      case1AK_totalFraisReels: fmt(res.declaration.case1AK),
      detailTransport: fmt(res.declaration.detailTransport),
      detailRepas: fmt(res.declaration.detailRepas),
      detailAutres: fmt(res.declaration.detailAutres),
      remboursementsReintegres: fmt(res.declaration.remboursementsReintegres),
      mutuelle: res.declaration.mutuelleCase ? `${res.declaration.mutuelleCase} : ${fmt(res.declaration.mutuelleMontant)}` : res.mutuelle.info
    }
  };
}

function exportCalculs(format = 'txt') {
  const data = buildExportData();
  if (format === 'json') exportJSON(data);
  else if (format === 'csv') exportCSV(data);
  else exportTXT(data);
}

function exportJSON(data) {
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), exportFilename('json'));
}

function exportCSV(data) {
  const headers = ['Catégorie', 'Libellé', 'Valeur', 'Unité', 'Case déclaration'];
  const rows = [
    ['Situation', 'Salaire net imposable annuel', data.situation.salaireNetImposable, '€', '1AJ'],
    ['Situation', 'Nombre de parts fiscales', data.situation.nombreParts, '', ''],
    ['Situation', 'Situation familiale', data.situation.situationFamiliale, '', ''],
    ['Situation', 'Jours au bureau', data.situation.joursBureau, 'jours', ''],
    ['Situation', 'Kilométrage annuel retenu', data.transport.kmAnnuel, 'km', ''],
    ['', '', '', '', ''],
    ['Transport', `${data.transport.label} (détail)`, data.transport.fraisTransport, '€', ''],
    ['Repas', `Type : ${data.repas.type} (détail)`, data.repas.deductible, '€', ''],
    ['Autres frais', 'Total autres frais (détail)', data.autresFrais.total, '€', ''],
    ['Frais réels', 'Total frais réels bruts à reporter (déclarant 1)', data.results.totalFraisBruts, '€', '1AK'],
    ['Frais réels', "Remboursements employeur à réintégrer au revenu (option frais réels)", data.remboursements.total, '€', '1GB-1JB'],
    ['', '', '', '', ''],
    ['Remboursements', 'Total remboursements employeur', -data.remboursements.total, '€', ''],
    ['', '', '', '', ''],
    ['Résultats', 'Total frais réels bruts', data.results.totalFraisBruts, '€', ''],
    ['Résultats', 'Total frais réels nets', data.results.totalFraisNets, '€', ''],
    ['Résultats', 'Abattement forfaitaire 10 % (borné)', data.results.abattement10Pct, '€', ''],
    ['Résultats', 'Gain/perte vs abattement', data.results.gain, '€', ''],
    ['Résultats', 'Revenu net imposable', data.results.revenuNetImposable, '€', ''],
    ['Résultats', 'Impôt brut', data.results.impotBrut, '€', ''],
    ['Résultats', 'Décote', -data.results.decote, '€', ''],
    ['Résultats', 'CEHR', data.results.cehr, '€', ''],
    ['Résultats', 'Impôt net estimé', data.results.impotNetEstime, '€', ''],
    ['Résultats', 'Tranche fiscale', data.results.tranche, '', ''],
    ['', '', '', '', ''],
    ['Déclaration', 'Case 1AK — total des frais réels (déclarant 1)', data.declaration.case1AK_totalFraisReels, '', '1AK'],
    ['Déclaration', 'Détail transport', data.declaration.detailTransport, '', ''],
    ['Déclaration', 'Détail repas', data.declaration.detailRepas, '', ''],
    ['Déclaration', 'Détail autres frais', data.declaration.detailAutres, '', ''],
    ['Déclaration', 'Remboursements à réintégrer (1GB-1JB)', data.declaration.remboursementsReintegres, '', '1GB-1JB'],
    ['Déclaration', 'Mutuelle', data.declaration.mutuelle, '', ''],
    ['', '', '', '', ''],
    ['Conseil', data.results.verdict, '', '', '']
  ];
  let csv = headers.join(';') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => {
      const str = String(cell ?? '');
      const esc = str.replace(/"/g, '""');
      return /[;"\n]/.test(str) ? `"${esc}"` : esc;
    }).join(';') + '\n';
  });
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), exportFilename('csv'));
}

function exportTXT(data) {
  const c = getConfig(currentYear);
  const t = data.transport, r = data.repas, res = data.results, d = data.declaration;
  const postesTxt = (data.autresFrais.postes || [])
    .filter(p => p.montant > 0)
    .map(p => `${p.label} : ${fmt(p.montant)}`)
    .join('\n   ');
  const baremeLine = (t.bareme && t.bareme.taux)
    ? `   Barème : ${fmtNumber(t.kmAnnuel)} km × ${t.bareme.taux.toFixed(3).replace('.', ',')} €/km${t.bareme.fixe ? ' + ' + fmtNumber(t.bareme.fixe) + ' €' : ''}${t.bareme.majoration > 1 ? ' × 1,20 (électrique)' : ''}${t.depassement40km ? ` (limité à ${c.limiteKmTrajet} km/trajet)` : ''}`
    : '';
  const lines = [
    '=======================================',
    `DÉCLARATION D'IMPÔT ${currentYear} — FICHE RÉCAPITULATIVE`,
    `(Revenus ${c.revenusYear}${c.provisoire ? ' — BARÈME PROVISOIRE' : ''} · Frais réels v${VERSION})`,
    '=======================================',
    'Simulateur indicatif — ne remplace pas un conseil fiscal.',
    'Sources : impots.gouv.fr · BOFiP · service-public.fr',
    '',
    '--- SITUATION ---',
    `Salaire net imposable annuel (1AJ) : ${fmt(data.situation.salaireNetImposable)}`,
    `Parts fiscales : ${fmtNumber(data.situation.nombreParts, 1)} · Situation : ${data.situation.situationFamiliale}`,
    `Jours ouvrés ${data.situation.joursOuvres} − arrêts ${data.situation.joursArret} − télétravail ${data.situation.joursTeletravail} = ${data.situation.joursBureau} jours au bureau`,
    `Kilométrage annuel retenu : ${fmtNumber(t.kmAnnuel)} km`,
    '',
    '--- FRAIS DÉDUCTIBLES ---',
    `1. Transport (détail) : ${fmt(t.fraisTransport)}`,
    `   ${t.label}${t.cv ? ' · ' + t.cv + ' CV' : ''}${t.energie === 'electrique' ? ' · électrique +20 %' : ''}`,
    baremeLine,
    `2. Repas (détail) : ${fmt(r.deductible)}  (type : ${r.type} ; forfait repas ${fmt(c.forfaitRepas)} ; plafond ${fmt(c.plafondRepas)}/repas)`,
    `3. Autres frais (détail) : ${fmt(data.autresFrais.total)}`,
    `Total frais réels bruts à reporter en case 1AK (déclarant 1) : ${fmt(res.totalFraisBruts)}`,
    `Remboursements employeur à réintégrer au revenu (cases 1GB-1JB) : ${fmt(data.remboursements.total)}`,
    `   Télétravail ${fmt(data.autresFrais.teletravail)} · Formation ${fmt(data.autresFrais.formation)} · Documentation ${fmt(data.autresFrais.documentation)} · Autres ${fmt(data.autresFrais.autres)}` + (postesTxt ? '\n   ' + postesTxt : ''),
    '',
    `Total frais bruts : ${fmt(res.totalFraisBruts)}`,
    `− Remboursements employeur : ${fmt(-data.remboursements.total)}`,
    `Total frais réels nets : ${fmt(res.totalFraisNets)}`,
    '',
    '--- COMPARAISON ABATTEMENT 10 % ---',
    `Abattement forfaitaire 10 % (min ${fmt(c.abattementMin)}, max ${fmt(c.abattementMax)}) : ${fmt(res.abattement10Pct)}`,
    `Gain/perte avec frais réels : ${fmt(res.gain)}`,
    '',
    '--- IMPÔT (barème ' + currentYear + ') ---',
    `Revenu net imposable : ${fmt(res.revenuNetImposable)}`,
    `Revenu par part : ${fmt(res.revenuParPart)} · Tranche : ${res.tranche}`,
    `Impôt brut : ${fmt(res.impotBrut)}`,
    `Décote : −${fmt(res.decote)}`,
    res.cehr > 0 ? `CEHR : ${fmt(res.cehr)}` : null,
    `Impôt net estimé : ${fmt(res.impotNetEstime)}`,
    '',
    '--- À REPORTER SUR LA 2042 ---',
    `Case 1AK — total des frais réels (déclarant 1) : ${d.case1AK_totalFraisReels}`,
    `   détail : transport ${d.detailTransport} · repas ${d.detailRepas} · autres ${d.detailAutres}`,
    `Remboursements à réintégrer (cases 1GB-1JB) : ${d.remboursementsReintegres}`,
    `Mutuelle : ${d.mutuelle}`,
    '',
    '--- CONSEIL ---',
    res.verdict,
    '',
    ...(data.warnings.length ? ['--- AVERTISSEMENTS ---', ...data.warnings.map(w => '• ' + w), ''] : []),
    `Généré le ${data.metadata.exportDate} — https://github.com/0rmx0/frais-reels`
  ].filter(l => l !== null);
  download(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), `declaration_frais_reels_${currentYear}_${isoDate()}.txt`);
}

// --- MENU D'EXPORT ---
function showExportMenu() {
  const menu = $('export-menu');
  if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

// Ferme le menu d'export au clic ailleurs
document.addEventListener('click', function (e) {
  const menu = $('export-menu');
  const btn = document.querySelector('.export-dropdown-btn');
  if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.style.display = 'none';
  }
});
