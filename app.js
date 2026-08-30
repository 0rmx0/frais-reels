// ============================================
// CALCULATEUR FRAIS RÉELS
// JavaScript principal - 0rmx0
// ============================================

// --- VARIABLES GLOBALES ---
let currentTransport = 'voiture';
let currentRepasType = 'classique';
let currentMutuelle = 'entreprise_fiche';
let currentYear = 2027;

// --- DOM READY ---
document.addEventListener('DOMContentLoaded', function() {
  initYearSelector();
  initToggleGroups();
  initInputListeners();
  calc();
});

// --- INITIALISATION ---
function initYearSelector() {
  const years = getAvailableYears();
  const select = document.getElementById('year-selector');
  if (select) {
    years.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = FISCAL_CONFIG[year].label;
      if (parseInt(year) === currentYear) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', function() {
      currentYear = parseInt(this.value);
      updateYearDisplay();
      calc();
    });
  }
  updateYearDisplay();
}

function updateYearDisplay() {
  const config = getConfig(currentYear);
  const yearElements = document.querySelectorAll('[data-year-display]');
  yearElements.forEach(el => {
    el.textContent = config.label;
  });
  
  const versionElement = document.querySelector('.footer-version');
  if (versionElement) {
    versionElement.textContent = `v2.0.0 · Barème ${currentYear} (revenus ${config.revenusYear})`;
  }
}

function initToggleGroups() {
  // Transport
  document.querySelectorAll('#transport-type .toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      setTransport(this.dataset.type, this);
    });
  });
  
  // Repas
  document.querySelectorAll('#repas-type .toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      setRepasType(this.dataset.type, this);
    });
  });
  
  // Mutuelle
  document.querySelectorAll('#mutuelle-type .toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      setMutuelle(this.dataset.type, this);
    });
  });
}

function initInputListeners() {
  // Ajouter des écouteurs oninput à tous les inputs
  const inputs = document.querySelectorAll('input[type="number"], input[type="text"], select');
  inputs.forEach(input => {
    input.addEventListener('input', calc);
    input.addEventListener('change', calc);
  });
}

// --- TOGGLE CARDS ---
function toggleCard(id) {
  const body = document.getElementById(`body-${id}`);
  const toggle = document.getElementById(`toggle-${id}`);
  if (body && toggle) {
    body.classList.toggle('open');
    toggle.classList.toggle('open');
  }
}

// --- SET TRANSPORT TYPE ---
function setTransport(type, btn) {
  currentTransport = type;
  document.querySelectorAll('#transport-type .toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  document.getElementById('block-vehicule').style.display = (type === 'voiture' || type === 'moto') ? 'block' : 'none';
  document.getElementById('block-tc').style.display = (type === 'tc') ? 'block' : 'none';
  document.getElementById('block-velo').style.display = (type === 'velo') ? 'block' : 'none';
  calc();
}

// --- SET REPAS TYPE ---
function setRepasType(type, btn) {
  currentRepasType = type;
  document.querySelectorAll('#repas-type .toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  const showClassique = (type === 'classique' || type === 'mixte');
  const showTickets = (type === 'tickets' || type === 'mixte');
  const showMixte = (type === 'mixte');
  
  document.getElementById('block-repas-classique').style.display = showClassique && !showMixte ? 'block' : 'none';
  document.getElementById('block-repas-tickets').style.display = showTickets && !showMixte ? 'block' : 'none';
  document.getElementById('block-repas-mixte').style.display = showMixte ? 'block' : 'none';
  
  calc();
}

// --- SET MUTUELLE TYPE ---
function setMutuelle(type, btn) {
  currentMutuelle = type;
  document.querySelectorAll('#mutuelle-type .toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  document.getElementById('block-mutuelle-fiche').classList.toggle('hidden', type !== 'entreprise_fiche');
  document.getElementById('block-mutuelle-6dd').classList.toggle('hidden', type !== 'entreprise_6dd');
  document.getElementById('block-mutuelle-madelin').classList.toggle('hidden', type !== 'madelin');
  document.getElementById('block-mutuelle-individuelle').classList.toggle('hidden', type !== 'individuelle');
  calc();
}

// --- FORMAT CURRENCY ---
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

// --- FORMAT NUMBER ---
function fmtNumber(n, decimals = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(n);
}

// --- VALIDATION ---
function validateInput(value, min = 0, max = Infinity) {
  if (value === '' || value === null) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

// --- BARÈME FISCAL ---
function calculImpotParTranche(revenuParPart, year) {
  const config = getConfig(year);
  let impot = 0;
  let previousMax = 0;
  
  for (const tranche of config.tranches) {
    if (revenuParPart > tranche.max) {
      impot += (Math.min(revenuParPart, tranche.max) - previousMax) * tranche.rate;
    }
    previousMax = tranche.max;
  }
  
  return impot;
}

function getTranche(revenuParPart, year) {
  const config = getConfig(year);
  
  for (let i = config.tranches.length - 1; i >= 0; i--) {
    if (revenuParPart > config.tranches[i].max) {
      const nextTranche = config.tranches[i + 1] || { max: Infinity };
      const rate = config.tranches[i].rate * 100;
      return `${rate}% (${fmtNumber(config.tranches[i].max + 1)} € – ${nextTranche.max === Infinity ? '> ' : ''}${fmtNumber(nextTranche.max)} €)`;
    }
  }
  return "0% (≤ " + fmtNumber(config.tranches[0].max) + " €)";
}

// --- CALCUL DES FRAIS DE REPAS ---
function calculFraisRepas() {
  const config = getConfig(currentYear);
  
  if (currentRepasType === 'classique') {
    const nbRepas = validateInput(document.getElementById('nb_repas_classique').value, 0);
    const coutRepas = validateInput(document.getElementById('cout_repas_classique').value, 0);
    if (nbRepas === null || coutRepas === null) return 0;
    return Math.max(0, coutRepas - config.forfaitRepas) * nbRepas;
  }
  else if (currentRepasType === 'tickets') {
    const nbTickets = validateInput(document.getElementById('nb_tickets').value, 0);
    const valeurTicket = validateInput(document.getElementById('valeur_ticket').value, 0);
    const partEmployeur = validateInput(document.getElementById('part_employeur_ticket').value, 0);
    if (nbTickets === null || valeurTicket === null || partEmployeur === null) return 0;
    const resteCharge = valeurTicket - partEmployeur;
    return Math.max(0, resteCharge - config.forfaitRepas) * nbTickets;
  }
  else { // Mixte
    const nbRepas = validateInput(document.getElementById('nb_repas_mixte').value, 0);
    const coutRepas = validateInput(document.getElementById('cout_repas_mixte').value, 0);
    const nbTickets = validateInput(document.getElementById('nb_tickets_mixte').value, 0);
    const valeurTicket = validateInput(document.getElementById('valeur_ticket_mixte').value, 0);
    const partEmployeur = validateInput(document.getElementById('part_employeur_ticket_mixte').value, 0);
    
    if (nbRepas === null || coutRepas === null) return 0;
    if (nbTickets === null || valeurTicket === null || partEmployeur === null) return Math.max(0, coutRepas - config.forfaitRepas) * nbRepas;
    
    const fraisRepas = Math.max(0, coutRepas - config.forfaitRepas) * nbRepas;
    const resteCharge = valeurTicket - partEmployeur;
    const fraisTickets = Math.max(0, resteCharge - config.forfaitRepas) * nbTickets;
    
    return fraisRepas + fraisTickets;
  }
}

// --- DÉTAILS DES REPAS ---
function getRepasDetails() {
  const config = getConfig(currentYear);
  
  if (currentRepasType === 'classique') {
    const nbRepas = document.getElementById('nb_repas_classique').value || 0;
    const coutRepas = document.getElementById('cout_repas_classique').value || 0;
    return {
      type: 'Repas classiques',
      nb: nbRepas,
      cout: coutRepas,
      forfait: config.forfaitRepas,
      deductible: Math.max(0, coutRepas - config.forfaitRepas) * nbRepas,
      resteCharge: coutRepas - config.forfaitRepas
    };
  }
  else if (currentRepasType === 'tickets') {
    const nbTickets = document.getElementById('nb_tickets').value || 0;
    const valeurTicket = document.getElementById('valeur_ticket').value || 0;
    const partEmployeur = document.getElementById('part_employeur_ticket').value || 0;
    const resteCharge = valeurTicket - partEmployeur;
    return {
      type: 'Tickets restaurant',
      nb: nbTickets,
      valeur: valeurTicket,
      partEmployeur: partEmployeur,
      resteCharge: resteCharge,
      forfait: config.forfaitRepas,
      deductible: Math.max(0, resteCharge - config.forfaitRepas) * nbTickets,
      plafondTicket: config.plafondTicket,
      plafondEmployeur: config.plafondEmployeur
    };
  }
  else { // Mixte
    const nbRepas = document.getElementById('nb_repas_mixte').value || 0;
    const coutRepas = document.getElementById('cout_repas_mixte').value || 0;
    const nbTickets = document.getElementById('nb_tickets_mixte').value || 0;
    const valeurTicket = document.getElementById('valeur_ticket_mixte').value || 0;
    const partEmployeur = document.getElementById('part_employeur_ticket_mixte').value || 0;
    const resteCharge = valeurTicket - partEmployeur;
    return {
      type: 'Mixte (Repas + Tickets)',
      nbRepas: nbRepas,
      coutRepas: coutRepas,
      nbTickets: nbTickets,
      valeurTicket: valeurTicket,
      partEmployeur: partEmployeur,
      resteCharge: resteCharge,
      forfait: config.forfaitRepas,
      deductibleRepas: Math.max(0, coutRepas - config.forfaitRepas) * nbRepas,
      deductibleTickets: Math.max(0, resteCharge - config.forfaitRepas) * nbTickets,
      deductible: Math.max(0, coutRepas - config.forfaitRepas) * nbRepas + Math.max(0, resteCharge - config.forfaitRepas) * nbTickets,
      plafondTicket: config.plafondTicket,
      plafondEmployeur: config.plafondEmployeur
    };
  }
}

// --- CALCUL DES FRAIS DE TRANSPORT ---
function calculFraisTransport() {
  const config = getConfig(currentYear);
  const joursBureau = Math.max(0,
    (validateInput(document.getElementById('jours_ouvres').value, 0, 366) || 0) -
    (validateInput(document.getElementById('jours_arret').value, 0, 366) || 0) -
    (validateInput(document.getElementById('jours_teletravail').value, 0, 366) || 0)
  );
  
  if (currentTransport === 'voiture' || currentTransport === 'moto') {
    const distAller = validateInput(document.getElementById('dist_aller').value, 0) || 0;
    const cv = document.getElementById('cv').value;
    const energie = document.getElementById('energie').value;
    const kmAnnuel = joursBureau * distAller * 2; // Aller-retour
    
    if (!cv || distAller === 0) return 0;
    
    const baremeType = currentTransport === 'voiture' ? 'voiture' : 'moto';
    const tarif = config.baremeKm[baremeType][cv] || 0;
    const majorationElectrique = energie === 'electrique' ? 1.20 : 1;
    const fraisKm = kmAnnuel * tarif * majorationElectrique;
    
    // Plafond : frais réels limités à 200 €/an si kmAnnuel <= 5000 km (voiture)
    if (currentTransport === 'voiture' && kmAnnuel <= 5000) {
      return Math.min(fraisKm, 200);
    }
    return fraisKm;
  }
  else if (currentTransport === 'tc') {
    return validateInput(document.getElementById('cout_abonnement').value, 0) || 0;
  }
  else if (currentTransport === 'velo') {
    return validateInput(document.getElementById('frais_velo').value, 0) || 0;
  }
  return 0;
}

// --- CALCUL DES AUTRES FRAIS ---
function calculAutresFrais() {
  return (validateInput(document.getElementById('frais_teletravail').value, 0) || 0) +
         (validateInput(document.getElementById('frais_formation').value, 0) || 0) +
         (validateInput(document.getElementById('frais_doc').value, 0) || 0) +
         (validateInput(document.getElementById('frais_autres').value, 0) || 0);
}

// --- CALCUL DES REMBOURSEMENTS ---
function calculRemboursements() {
  return (validateInput(document.getElementById('remb_ik').value, 0) || 0) +
         (validateInput(document.getElementById('remb_carburant').value, 0) || 0) +
         (validateInput(document.getElementById('remb_mobilite').value, 0) || 0) +
         (validateInput(document.getElementById('remb_autres').value, 0) || 0);
}

// --- CALCUL MUTUELLE ---
function calculMutuelle() {
  if (currentMutuelle === 'entreprise_6dd') {
    const montant = validateInput(document.getElementById('mutuelle_6dd').value, 0) || 0;
    return { deductible: montant, case: '6DD', formulaire: '2042 C', info: 'Mutuelle entreprise (non déduite fiche de paie)' };
  }
  if (currentMutuelle === 'madelin') {
    const montant = validateInput(document.getElementById('mutuelle_madelin').value, 0) || 0;
    return { deductible: montant, case: 'BIC/BNC', formulaire: '2035/2031', info: 'Loi Madelin — déduction du bénéfice imposable' };
  }
  return { deductible: 0, case: null, formulaire: null, info: currentMutuelle === 'entreprise_fiche' ? 'Déjà déduite sur fiche de paie' : 'Non déductible' };
}

// --- CALCUL PRINCIPAL ---
function calc() {
  const config = getConfig(currentYear);
  
  // 1. Calcul des jours au bureau
  const joursOuvres = validateInput(document.getElementById('jours_ouvres').value, 0, 366) || 0;
  const joursArret = validateInput(document.getElementById('jours_arret').value, 0, 366) || 0;
  const joursTeletravail = validateInput(document.getElementById('jours_teletravail').value, 0, 366) || 0;
  const joursBureau = Math.max(0, joursOuvres - joursArret - joursTeletravail);
  
  document.getElementById('res-jours').textContent = fmtNumber(joursBureau);
  document.getElementById('res-jours-sub').textContent = `${joursBureau} jours · ${Math.round(joursBureau * 2)} trajets`;
  
  // 2. Calcul automatique du kilométrage annuel
  const distAller = validateInput(document.getElementById('dist_aller').value, 0) || 0;
  const kmAnnuel = joursBureau * distAller * 2;
  
  if (document.getElementById('km_annuel')) {
    document.getElementById('km_annuel').value = kmAnnuel;
  }
  document.getElementById('res-km-annuel').textContent = fmtNumber(kmAnnuel);
  
  // 3. Calcul des frais
  const fraisTransport = calculFraisTransport();
  const fraisRepas = calculFraisRepas();
  const autresFrais = calculAutresFrais();
  const mutuelle = calculMutuelle();
  const totalFraisBruts = fraisTransport + fraisRepas + autresFrais;
  
  // 4. Calcul des remboursements
  const remboursements = calculRemboursements();
  const totalFraisNets = Math.max(0, totalFraisBruts - remboursements);
  
  // 5. Abattement forfaitaire 10%
  const salaireBrut = validateInput(document.getElementById('salaire').value, 0) || 0;
  const abattement10Pct = salaireBrut * config.abattementForfaitaire;
  
  // 6. Revenu net imposable
  const revenuNetImposable = salaireBrut - Math.max(totalFraisNets, abattement10Pct);
  
  // 7. Calcul de l'impôt brut
  const nombreParts = validateInput(document.getElementById('nombre_parts').value, 0.5) || 1;
  const revenuParPart = revenuNetImposable / nombreParts;
  const impotBrut = calculImpotParTranche(revenuParPart, currentYear) * nombreParts;
  const tranche = getTranche(revenuParPart, currentYear);
  
  // 8. Gain/perte frais réels vs abattement
  const gain = totalFraisNets - abattement10Pct;
  
  // --- AFFICHAGE DES RÉSULTATS ---
  const typeTransport = currentTransport === 'voiture' ? 'Voiture' :
                       currentTransport === 'moto' ? 'Moto' :
                       currentTransport === 'tc' ? 'Transports en commun' : 'Vélo/marche';
  const cv = document.getElementById('cv').value || '?';
  const energie = document.getElementById('energie').value === 'electrique' ? 'Électrique (+20%)' : 'Thermique';
  
  // Transport
  document.getElementById('res-transport').textContent = fmt(fraisTransport);
  document.getElementById('res-transport-sub').textContent = currentTransport === 'voiture' ? `Voiture (${cv} CV, ${energie})` : typeTransport;
  
  // Repas
  const repasDetails = getRepasDetails();
  document.getElementById('res-repas').textContent = fmt(fraisRepas);
  
  if (currentRepasType === 'classique') {
    document.getElementById('res-repas-sub').textContent = 
      `${repasDetails.nb} repas × ${fmt(repasDetails.cout)} (Forfait: ${fmt(config.forfaitRepas)})`;
  }
  else if (currentRepasType === 'tickets') {
    document.getElementById('res-repas-sub').textContent = 
      `${repasDetails.nb} tickets × ${fmt(repasDetails.valeur)} (Reste: ${fmt(repasDetails.resteCharge)})`;
  }
  else {
    document.getElementById('res-repas-sub').textContent = 
      `${repasDetails.nbRepas} repas + ${repasDetails.nbTickets} tickets`;
  }
  
  // Autres frais
  document.getElementById('res-autres').textContent = fmt(autresFrais);
  document.getElementById('res-autres-sub').textContent = 'Télétravail, formation, etc.';
  
  // Revenu net et impôt
  document.getElementById('res-revenu-net').textContent = fmt(revenuNetImposable);
  document.getElementById('res-impot-brut').textContent = fmt(impotBrut);
  document.getElementById('res-impot-brut-sub').textContent = `Barème ${currentYear} · ${fmtNumber(nombreParts, 1)} part(s)`;
  
  // Détail des calculs
  document.getElementById('d-total-brut').textContent = fmt(totalFraisBruts);
  document.getElementById('d-remb').textContent = fmt(-remboursements);
  document.getElementById('d-total-net').textContent = fmt(totalFraisNets);
  document.getElementById('d-abattement').textContent = fmt(abattement10Pct);
  document.getElementById('d-gain').textContent = fmt(gain);
  document.getElementById('d-revenu-par-part').textContent = fmt(revenuParPart);
  document.getElementById('d-tranche').textContent = tranche;
  
  // Mutuelle
  const dMutuelle = document.getElementById('d-mutuelle');
  if (mutuelle.deductible > 0) {
    dMutuelle.style.display = 'flex';
    document.getElementById('d-mutuelle-label').textContent = 
      `Mutuelle déductible (case ${mutuelle.case} · ${mutuelle.formulaire})`;
    document.getElementById('d-mutuelle-val').textContent = fmt(mutuelle.deductible);
    document.getElementById('d-mutuelle-val').className = 'detail-value';
  } else {
    dMutuelle.style.display = 'none';
  }
  
  // Verdict
  const verdictBox = document.getElementById('verdict-box');
  if (salaireBrut === 0) {
    verdictBox.className = 'verdict neutral';
    verdictBox.innerHTML = '<div class="verdict-icon">⏳</div><div class="verdict-text"><strong>En attente de données</strong><br>Saisis ton salaire et tes frais pour voir si les frais réels sont avantageux.</div>';
  }
  else if (totalFraisNets > abattement10Pct) {
    verdictBox.className = 'verdict good';
    verdictBox.innerHTML = `<div class="verdict-icon">✅</div><div class="verdict-text"><strong>Les frais réels sont avantageux !</strong><br>Tu économises ${fmt(gain)} par rapport à l'abattement forfaitaire de 10 % (${fmt(abattement10Pct)}).</div>`;
  }
  else {
    verdictBox.className = 'verdict bad';
    verdictBox.innerHTML = `<div class="verdict-icon">⚠️</div><div class="verdict-text"><strong>L'abattement de 10 % est préférable</strong><br>Tes frais réels (${fmt(totalFraisNets)}) sont inférieurs à l'abattement (${fmt(abattement10Pct)}). Garde le forfait automatique.</div>`;
  }
}

// --- EXPORT DES CALCULS ---
function exportCalculs(format = 'txt') {
  const config = getConfig(currentYear);
  const salaireBrut = validateInput(document.getElementById('salaire').value, 0) || 0;
  const nombreParts = validateInput(document.getElementById('nombre_parts').value, 0.5) || 1;
  
  const joursOuvres = validateInput(document.getElementById('jours_ouvres').value, 0, 366) || 0;
  const joursArret = validateInput(document.getElementById('jours_arret').value, 0, 366) || 0;
  const joursTeletravail = validateInput(document.getElementById('jours_teletravail').value, 0, 366) || 0;
  const joursBureau = Math.max(0, joursOuvres - joursArret - joursTeletravail);
  const distAller = validateInput(document.getElementById('dist_aller').value, 0) || 0;
  const kmAnnuel = joursBureau * distAller * 2;
  
  const fraisTransport = calculFraisTransport();
  const repasDetails = getRepasDetails();
  const autresFrais = calculAutresFrais();
  const totalFraisBruts = fraisTransport + repasDetails.deductible + autresFrais;
  const remboursements = calculRemboursements();
  const totalFraisNets = Math.max(0, totalFraisBruts - remboursements);
  const abattement10Pct = salaireBrut * config.abattementForfaitaire;
  const revenuNetImposable = salaireBrut - Math.max(totalFraisNets, abattement10Pct);
  const revenuParPart = revenuNetImposable / nombreParts;
  const tranche = getTranche(revenuParPart, currentYear);
  const impotBrut = calculImpotParTranche(revenuParPart, currentYear) * nombreParts;
  const gain = totalFraisNets - abattement10Pct;
  const mutuelle = calculMutuelle();
  
  const verdictText = document.getElementById('verdict-box').querySelector('.verdict-text').textContent
    .replace(/<br>/g, '\n')
    .replace(/<strong>/g, '')
    .replace(/<\/strong>/g, '');
  
  const typeTransport = currentTransport === 'voiture' ? 'Voiture' :
                       currentTransport === 'moto' ? 'Moto' :
                       currentTransport === 'tc' ? 'Transports en commun' : 'Vélo/marche';
  const cv = document.getElementById('cv').value || 'Non spécifié';
  const energie = document.getElementById('energie').value === 'electrique' ? 'Électrique (+20%)' : 'Thermique';
  
  const baremeType = currentTransport === 'voiture' ? 'voiture' : 'moto';
  const tarifKm = config.baremeKm[baremeType][cv] || 0;
  const majoration = energie === 'Électrique (+20%)' ? 1.20 : 1;
  
  // Données pour export
  const data = {
    metadata: {
      calculator: 'Frais Réels v2.0.0',
      fiscalYear: currentYear,
      revenusYear: config.revenusYear,
      exportDate: new Date().toLocaleDateString('fr-FR'),
      sources: [
        'ESCEC International: https://escec-international.com/fr/faut-il-declarer-les-tickets-restaurant-aux-impots/',
        'impots.gouv.fr: https://www.impots.gouv.fr/particulier/questions/je-beneficie-de-tickets-restaurants-comment-calculer-mes-frais-reels-de'
      ]
    },
    situation: {
      salaireBrut: salaireBrut,
      nombreParts: nombreParts,
      joursOuvres: joursOuvres,
      joursArret: joursArret,
      joursTeletravail: joursTeletravail,
      joursBureau: joursBureau
    },
    transport: {
      type: currentTransport,
      typeLabel: typeTransport,
      cv: cv,
      energie: energie,
      distAller: distAller,
      kmAnnuel: kmAnnuel,
      tarifKm: tarifKm,
      majorationElectrique: majoration,
      fraisTransport: fraisTransport
    },
    repas: {
      type: currentRepasType,
      ...repasDetails,
      forfaitRepas: config.forfaitRepas,
      plafondTicket: config.plafondTicket,
      plafondEmployeur: config.plafondEmployeur
    },
    autresFrais: {
      teletravail: validateInput(document.getElementById('frais_teletravail').value, 0) || 0,
      formation: validateInput(document.getElementById('frais_formation').value, 0) || 0,
      documentation: validateInput(document.getElementById('frais_doc').value, 0) || 0,
      autres: validateInput(document.getElementById('frais_autres').value, 0) || 0,
      total: autresFrais
    },
    remboursements: {
      ik: validateInput(document.getElementById('remb_ik').value, 0) || 0,
      carburant: validateInput(document.getElementById('remb_carburant').value, 0) || 0,
      mobilite: validateInput(document.getElementById('remb_mobilite').value, 0) || 0,
      autres: validateInput(document.getElementById('remb_autres').value, 0) || 0,
      total: remboursements
    },
    mutuelle: mutuelle,
    results: {
      totalFraisBruts: totalFraisBruts,
      totalFraisNets: totalFraisNets,
      abattement10Pct: abattement10Pct,
      gain: gain,
      revenuNetImposable: revenuNetImposable,
      revenuParPart: revenuParPart,
      tranche: tranche,
      impotBrut: impotBrut,
      verdict: verdictText
    },
    declaration: {
      case1AK: fmt(fraisTransport),
      case1BK: fmt(repasDetails.deductible),
      case1CK: fmt(autresFrais),
      mutuelleCase: mutuelle.deductible > 0 ? `${mutuelle.case} (${mutuelle.formulaire})` : 'Aucune'
    }
  };
  
  // Export selon le format
  if (format === 'json') {
    exportJSON(data);
  } else if (format === 'csv') {
    exportCSV(data);
  } else {
    exportTXT(data);
  }
}

function exportJSON(data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `frais_reels_${currentYear}_${new Date().toLocaleDateString('fr-FR')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(data) {
  // Créer un format CSV lisible
  const headers = [
    'Catégorie',
    'Libellé',
    'Valeur',
    'Unité',
    'Case déclaration'
  ];
  
  const rows = [
    // Situation
    ['Situation', 'Salaire brut annuel', data.situation.salaireBrut, '€', ''],
    ['Situation', 'Nombre de parts', data.situation.nombreParts, '', ''],
    ['Situation', 'Jours au bureau', data.situation.joursBureau, 'jours', ''],
    ['', '', '', '', ''],
    
    // Transport
    ['Transport', `Frais ${data.transport.typeLabel}`, data.transport.fraisTransport, '€', '1AK'],
    ['Transport', 'Kilométrage annuel', data.transport.kmAnnuel, 'km', ''],
    ['Transport', 'Tarif kilométrique', data.transport.tarifKm, '€/km', ''],
    ['', '', '', '', ''],
    
    // Repas
    ['Repas', `Type: ${data.repas.type}`, '', '', ''],
    ['Repas', 'Frais repas déductibles', data.repas.deductible, '€', '1BK'],
    ['', '', '', '', ''],
    
    // Autres frais
    ['Autres frais', 'Télétravail', data.autresFrais.teletravail, '€', '1CK'],
    ['Autres frais', 'Formation', data.autresFrais.formation, '€', '1CK'],
    ['Autres frais', 'Documentation', data.autresFrais.documentation, '€', '1CK'],
    ['Autres frais', 'Autres', data.autresFrais.autres, '€', '1CK'],
    ['Autres frais', 'Total autres frais', data.autresFrais.total, '€', '1CK'],
    ['', '', '', '', ''],
    
    // Remboursements
    ['Remboursements', 'Indemnités kilométriques', data.remboursements.ik, '€', ''],
    ['Remboursements', 'Prime carburant', data.remboursements.carburant, '€', ''],
    ['Remboursements', 'Forfait mobilités', data.remboursements.mobilite, '€', ''],
    ['Remboursements', 'Autres', data.remboursements.autres, '€', ''],
    ['Remboursements', 'Total remboursements', data.remboursements.total, '€', ''],
    ['', '', '', '', ''],
    
    // Résultats
    ['Résultats', 'Total frais bruts', data.results.totalFraisBruts, '€', ''],
    ['Résultats', 'Total frais nets (après remboursements)', data.results.totalFraisNets, '€', ''],
    ['Résultats', 'Abattement forfaitaire 10%', data.results.abattement10Pct, '€', ''],
    ['Résultats', 'Gain/Perte vs abattement', data.results.gain, '€', ''],
    ['Résultats', 'Revenu net imposable', data.results.revenuNetImposable, '€', ''],
    ['Résultats', 'Impôt brut', data.results.impotBrut, '€', ''],
    ['Résultats', 'Tranche fiscale', data.results.tranche, '', ''],
    ['', '', '', '', ''],
    
    // Mutuelle
    ['Mutuelle', data.mutuelle.info, data.mutuelle.deductible, '€', data.mutuelle.case || ''],
    ['', '', '', '', ''],
    
    // Conseils
    ['Conseil', data.results.verdict, '', '', '']
  ];
  
  let csv = headers.join(';') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => {
      if (cell === null || cell === undefined) return '';
      const str = String(cell).replace(/"/g, '""');
      return str.includes(';') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
    }).join(';') + '\n';
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `frais_reels_${currentYear}_${new Date().toLocaleDateString('fr-FR')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTXT(data) {
  const config = getConfig(currentYear);
  
  const detail = `
    =======================================
    DÉCLARATION D'IMPÔT SUR LE REVENU ${currentYear}
    (Revenus ${config.revenusYear} - Frais Réels v2.0)
    =======================================
    Sources :
    - ESCEC International : https://escec-international.com/fr/faut-il-declarer-les-tickets-restaurant-aux-impots/
    - impots.gouv.fr : https://www.impots.gouv.fr/particulier/questions/je-beneficie-de-tickets-restaurants-comment-calculer-mes-frais-reels-de

    --- SITUATION FISCALE ---
    Salaire brut annuel : ${fmt(data.situation.salaireBrut)}
    Nombre de parts fiscales : ${fmtNumber(data.situation.nombreParts, 1)}
    Jours ouvrés : ${data.situation.joursOuvres}
    Jours en arrêt maladie : ${data.situation.joursArret}
    Jours en télétravail : ${data.situation.joursTeletravail}
    Jours au bureau : ${data.situation.joursBureau} (${Math.round(data.situation.joursBureau * 2)} trajets)
    Kilométrage annuel : ${data.transport.kmAnnuel} km

    --- DÉTAIL DES FRAIS DÉDUCTIBLES (Case 1AK, 1BK, 1CK) ---
    
    1. Frais de transport (Case 1AK) :
    Type : ${data.transport.typeLabel}
    ${data.transport.type === 'voiture' || data.transport.type === 'moto' ? `CV : ${data.transport.cv}
    Énergie : ${data.transport.energie}
    Distance aller : ${data.transport.distAller} km
    Tarif kilométrique : ${fmt(data.transport.tarifKm)}/km
    Majoration électrique : ${data.transport.majorationElectrique === 1.20 ? 'Oui (+20%)' : 'Non'}` : ''}
    Montant : ${fmt(data.transport.fraisTransport)}

    2. Frais de repas (Case 1BK) :
    ${data.repas.type === 'Repas classiques' ? `
    Type : ${data.repas.type}
    Nombre de repas : ${data.repas.nb}
    Coût moyen par repas : ${fmt(data.repas.cout)}
    Forfait déductible : ${fmt(config.forfaitRepas)}
    Déductible : ${fmt(data.repas.deductible)}` : ''}
    
    ${data.repas.type === 'Tickets restaurant' ? `
    Type : ${data.repas.type}
    Nombre de tickets : ${data.repas.nb}
    Valeur faciale : ${fmt(data.repas.valeur)}
    Part employeur : ${fmt(data.repas.partEmployeur)}
    Reste à charge : ${fmt(data.repas.resteCharge)}
    Forfait déductible : ${fmt(config.forfaitRepas)}
    Plafond ticket : ${fmt(config.plafondTicket)}
    Plafond employeur : ${fmt(config.plafondEmployeur)}
    Déductible : ${fmt(data.repas.deductible)}` : ''}
    
    ${data.repas.type === 'Mixte (Repas + Tickets)' ? `
    Type : ${data.repas.type}
    
    Repas classiques :
    - Nombre : ${data.repas.nbRepas}
    - Coût moyen : ${fmt(data.repas.coutRepas)}
    - Déductible : ${fmt(data.repas.deductibleRepas)}
    
    Tickets restaurant :
    - Nombre : ${data.repas.nbTickets}
    - Valeur faciale : ${fmt(data.repas.valeurTicket)}
    - Part employeur : ${fmt(data.repas.partEmployeur)}
    - Reste à charge : ${fmt(data.repas.resteCharge)}
    - Déductible : ${fmt(data.repas.deductibleTickets)}
    
    Total déductible : ${fmt(data.repas.deductible)}` : ''}

    3. Autres frais professionnels (Case 1CK) :
    Télétravail : ${fmt(data.autresFrais.teletravail)}
    Formation : ${fmt(data.autresFrais.formation)}
    Documentation : ${fmt(data.autresFrais.documentation)}
    Autres : ${fmt(data.autresFrais.autres)}
    Total : ${fmt(data.autresFrais.total)}

    Total frais réels bruts : ${fmt(data.results.totalFraisBruts)}

    --- REMBOURSEMENTS EMPLOYEUR ---
    Indemnités kilométriques : ${fmt(data.remboursements.ik)}
    Prime carburant / mobilité : ${fmt(data.remboursements.carburant)}
    Forfait mobilités durables : ${fmt(data.remboursements.mobilite)}
    Autres remboursements : ${fmt(data.remboursements.autres)}
    Total remboursements : ${fmt(data.remboursements.total)}

    Total frais réels nets : ${fmt(data.results.totalFraisNets)}

    --- COMPARAISON AVEC L'ABATTEMENT FORFAITAIRE ---
    Abattement forfaitaire 10 % : ${fmt(data.results.abattement10Pct)}
    Gain/Perte avec frais réels : ${fmt(data.results.gain)} ${data.results.gain > 0 ? '(Économie)' : '(Moins avantageux)'}

    --- CALCUL DE L'IMPÔT (Barème ${currentYear}) ---
    Revenu net imposable : ${fmt(data.results.revenuNetImposable)}
    Revenu par part : ${fmt(data.results.revenuParPart)}
    Tranche fiscale appliquée : ${data.results.tranche}
    Impôt brut : ${fmt(data.results.impotBrut)}

    --- CONSEIL ---
    ${data.results.verdict}

    =======================================
    À REPORTER SUR VOTRE DÉCLARATION ${currentYear} (2042) :
    - Case 1AK (Frais de transport) : ${fmt(data.declaration.case1AK)}
    - Case 1BK (Frais de repas) : ${fmt(data.declaration.case1BK)}
    - Case 1CK (Autres frais) : ${fmt(data.declaration.case1CK)}
    ${data.mutuelle.deductible > 0 ? `- Case ${data.mutuelle.case} (${data.mutuelle.info}) : ${fmt(data.mutuelle.deductible)} → Formulaire ${data.mutuelle.formulaire}` : '- Mutuelle : ' + data.mutuelle.info}
    =======================================

    --- DÉTAIL DES CALCULS (Règles ${currentYear}) ---
    1. Jours au bureau = Jours ouvrés (${data.situation.joursOuvres}) - Arrêts maladie (${data.situation.joursArret}) - Télétravail (${data.situation.joursTeletravail}) = ${data.situation.joursBureau} jours
    2. Kilométrage annuel = Jours au bureau (${data.situation.joursBureau}) × Distance aller (${data.transport.distAller} km) × 2 = ${data.transport.kmAnnuel} km
    3. Frais de transport = ${data.transport.kmAnnuel} km × ${fmt(data.transport.tarifKm)}/km ${data.transport.majorationElectrique > 1 ? '× ' + data.transport.majorationElectrique : ''} = ${fmt(data.transport.fraisTransport)}
    
    4. Frais de repas :
    ${data.repas.type === 'Repas classiques' ? `
       - Repas classiques : (${fmt(data.repas.cout)} - ${fmt(config.forfaitRepas)}) × ${data.repas.nb} = ${fmt(data.repas.deductible)}` : ''}
    ${data.repas.type === 'Tickets restaurant' ? `
       - Tickets restaurant : (${fmt(data.repas.valeur)} - ${fmt(data.repas.partEmployeur)} - ${fmt(config.forfaitRepas)}) × ${data.repas.nb} = ${fmt(data.repas.deductible)}
       - Reste à charge : ${fmt(data.repas.resteCharge)} (${data.repas.resteCharge > config.forfaitRepas ? 'Déductible' : 'Non déductible'})` : ''}
    ${data.repas.type === 'Mixte (Repas + Tickets)' ? `
       - Repas classiques : (${fmt(data.repas.coutRepas)} - ${fmt(config.forfaitRepas)}) × ${data.repas.nbRepas} = ${fmt(data.repas.deductibleRepas)}
       - Tickets restaurant : (${fmt(data.repas.valeurTicket)} - ${fmt(data.repas.partEmployeur)} - ${fmt(config.forfaitRepas)}) × ${data.repas.nbTickets} = ${fmt(data.repas.deductibleTickets)}
       - Total : ${fmt(data.repas.deductible)}` : ''}

    5. Total frais réels nets = (${fmt(data.results.totalFraisBruts)} - ${fmt(data.remboursements.total)}) = ${fmt(data.results.totalFraisNets)}
    6. Revenu net imposable = ${fmt(data.situation.salaireBrut)} - max(${fmt(data.results.totalFraisNets)}, ${fmt(data.results.abattement10Pct)}) = ${fmt(data.results.revenuNetImposable)}
    7. Impôt brut = (${fmt(data.results.revenuParPart)} → ${data.results.tranche}) × ${data.situation.nombreParts} parts = ${fmt(data.results.impotBrut)}

    --- RÈGLES SPÉCIFIQUES ${currentYear} (ESCEC & impots.gouv.fr) ---
    - Forfait repas : ${fmt(config.forfaitRepas)} (seule la partie > ${fmt(config.forfaitRepas)} est déductible).
    - Tickets restaurant :
      * Plafond valeur ticket : ${fmt(config.plafondTicket)} (non imposable si ≤ ce montant).
      * Plafond part employeur : ${fmt(config.plafondEmployeur)} (non imposable si ≤ ce montant).
      * Reste à charge = Valeur ticket - Part employeur.
      * Déductible si reste à charge > ${fmt(config.forfaitRepas)}.
  `;
  
  const blob = new Blob([detail], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `declaration_frais_reels_${currentYear}_${new Date().toLocaleDateString('fr-FR')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- EXPORT MENU ---
function showExportMenu() {
  const menu = document.getElementById('export-menu');
  if (menu) {
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  }
}

// Fermer le menu d'export si on clique ailleurs
document.addEventListener('click', function(e) {
  const menu = document.getElementById('export-menu');
  const btn = document.querySelector('.export-dropdown-btn');
  if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.style.display = 'none';
  }
});
