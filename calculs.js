// ============================================
// CALCULS FISCAUX — module pur (sans DOM)
// Calculateur Frais Réels - 0rmx0
// Utilisable dans le navigateur (window.Calculs) et en Node (tests).
// ============================================

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./config.js'));
  } else {
    root.Calculs = factory({ getConfig: root.getConfig, FISCAL_CONFIG: root.FISCAL_CONFIG });
  }
})(typeof self !== 'undefined' ? self : this, function (cfg) {

  // --- OUTILS ---

  // Parse une saisie utilisateur : null si vide/invalide, borné entre min et max
  function parseNum(value, min = 0, max = Infinity) {
    if (value === '' || value === null || value === undefined) return null;
    const num = parseFloat(value);
    if (isNaN(num)) return null;
    if (num < min) return min;
    if (num > max) return max;
    return num;
  }

  const n = (v) => parseNum(v, 0) || 0; // nombre >= 0, 0 si vide

  // --- JOURS & KILOMÉTRAGE ---

  function calculJours(f) {
    const joursOuvres = parseNum(f.jours_ouvres, 0, 366) || 0;
    const joursArret = parseNum(f.jours_arret, 0, 366) || 0;
    const joursTeletravail = parseNum(f.jours_teletravail, 0, 366) || 0;
    const joursBureau = Math.max(0, joursOuvres - joursArret - joursTeletravail);
    return { joursOuvres, joursArret, joursTeletravail, joursBureau };
  }

  // Règle des 40 km : au-delà de 40 km aller, seuls 40 km sont retenus par trajet,
  // sauf circonstances particulières justifiées (note explicative à joindre).
  function distanceRetenue(distAller, circonstances, config) {
    const limite = config.limiteKmTrajet || 40;
    const depassement = distAller > limite && !circonstances;
    return { retenue: depassement ? limite : distAller, depassement, limite };
  }

  // --- BARÈME KILOMÉTRIQUE OFFICIEL ---
  // Formule par tranche : montant = d x taux[tranche] + fixe[tranche]
  // (la part fixe n'existe que sur la tranche intermédiaire).
  function baremeKm(type, cv, km, electrique, config) {
    const bareme = config.baremeKm[type];
    if (!bareme || km <= 0) return { montant: 0, tranche: 0, taux: 0, fixe: 0, majoration: 1 };
    const keys = Object.keys(bareme.cv);
    const ligne = bareme.cv[cv] || bareme.cv[keys[keys.length - 1]];
    let tranche = 0;
    for (let i = 0; i < bareme.seuilsKm.length; i++) {
      if (km <= bareme.seuilsKm[i]) { tranche = i; break; }
      tranche = i + 1;
    }
    const taux = ligne.t[tranche];
    const fixe = ligne.fixe[tranche];
    const majoration = electrique ? (config.majorationElectrique || 1.20) : 1;
    const montant = (km * taux + fixe) * majoration;
    return { montant, tranche, taux, fixe, majoration };
  }

  // --- TRANSPORT ---

  const TRANSPORT_LABELS = {
    voiture: 'Voiture',
    moto: 'Moto / scooter (> 50 cm³)',
    cyclomoteur: 'Cyclomoteur (≤ 50 cm³)',
    tc: 'Transports en commun',
    velo: 'Vélo / marche'
  };

  function calculFraisTransport(state, config, ctx) {
    const f = state.f;
    const type = state.transport;
    const distAller = n(f.dist_aller);
    const dist = distanceRetenue(distAller, !!f.circonstances, config);
    const kmAnnuel = ctx.jours.joursBureau * dist.retenue * 2; // un aller-retour par jour

    let frais = 0;
    let detail = { type, label: TRANSPORT_LABELS[type] || type, kmAnnuel, distAller, distRetenue: dist.retenue, depassement40km: dist.depassement };

    if (type === 'voiture' || type === 'moto' || type === 'cyclomoteur') {
      const electrique = f.energie === 'electrique';
      const cv = type === 'cyclomoteur' ? '' : (f.cv || '');
      const b = (type !== 'cyclomoteur' && !f.cv)
        ? { montant: 0, tranche: 0, taux: 0, fixe: 0, majoration: 1 }
        : baremeKm(type, cv, kmAnnuel, electrique, config);
      // Péages, stationnement et intérêts d'emprunt s'ajoutent au barème
      const peage = n(f.peage);
      const parking = n(f.parking);
      const interets = n(f.interets);
      frais = b.montant + peage + parking + interets;
      detail = { ...detail, cv, energie: electrique ? 'electrique' : 'thermique', bareme: b, peage, parking, interets };
    } else if (type === 'tc') {
      frais = n(f.cout_abonnement);
      detail.coutAbonnement = frais;
    } else if (type === 'velo') {
      frais = n(f.frais_velo);
    }
    return { frais, detail };
  }

  // --- REPAS ---
  // Règle : déductible = min(dépense, plafond) - forfait repas - avantages employeur.
  // Sans justificatif, le fisc admet un forfait de 5,45 € par repas.
  function calculFraisRepas(state, config) {
    const f = state.f;
    const type = state.repasType;
    const forfait = config.forfaitRepas;
    const plafond = config.plafondRepas;

    function repasClassique(nb, cout) {
      const nbN = n(nb), coutN = n(cout);
      const retenu = Math.min(coutN, plafond);
      return {
        nb: nbN, cout: coutN, coutRetenu: retenu, plafonne: coutN > plafond,
        deductible: Math.max(0, retenu - forfait) * nbN
      };
    }
    function tickets(nb, valeur, partEmployeur) {
      const nbN = n(nb), valN = n(valeur), partN = n(partEmployeur);
      const valRetenue = Math.min(valN, plafond);
      const resteCharge = valN - partN;
      return {
        nb: nbN, valeur: valN, valeurRetenue: valRetenue, partEmployeur: partN,
        resteCharge,
        partEmployeurHorsPlafond: Math.max(0, partN - config.plafondPartEmployeur),
        deductible: Math.max(0, valRetenue - partN - forfait) * nbN
      };
    }

    if (type === 'tickets') {
      const t = tickets(f.nb_tickets, f.valeur_ticket, f.part_employeur_ticket);
      return { type, deductible: t.deductible, forfait, plafond, tickets: t };
    }
    if (type === 'mixte') {
      // Chaque poste est indépendant : un champ vide ne neutralise pas l'autre
      const r = repasClassique(f.nb_repas_mixte, f.cout_repas_mixte);
      const t = tickets(f.nb_tickets_mixte, f.valeur_ticket_mixte, f.part_employeur_ticket_mixte);
      return { type, deductible: r.deductible + t.deductible, forfait, plafond, repas: r, tickets: t };
    }
    const r = repasClassique(f.nb_repas_classique, f.cout_repas_classique);
    return { type: 'classique', deductible: r.deductible, forfait, plafond, repas: r };
  }

  // --- AUTRES FRAIS ---

  // Postes de frais professionnels admissibles avec règle propre (champ dédié dans l'UI).
  // Sources : BOFiP BOI-RSA-BASE-30-50-30-30 et -40 (frais réels des salariés) + impots.gouv.fr.
  // [id du champ, libellé court (résumé), libellé long (note / exports)]
  const AUTRES_FRAIS_POSTES = [
    ['frais_syndicat', 'Syndicat', "Cotisations syndicales — 100 % déductibles en frais réels (exclusif du crédit d'impôt de 66 % au forfait 10 %)"],
    ['frais_ordre', 'Ordre pro', "Cotisations à un ordre professionnel obligatoire (médecins, avocats, experts-comptables…)"],
    ['frais_assurance_pro', 'Assurance RC pro', "Primes d'assurance responsabilité professionnelle"],
    ['frais_habillement', 'Vêtements pro', "Vêtements/tenues spécifiques à la profession + entretien (bleus de travail, EPI… ; pas les vêtements courants)"],
    ['frais_materiel', 'Matériel < 500 € HT', "Fournitures, mobilier, outillage < 500 € HT/unité : prix d'achat déductible en totalité l'année d'achat"],
    ['frais_materiel_amorti', 'Matériel > 500 € HT', "Matériel > 500 € HT/unité : saisir l'annuité d'amortissement linéaire (ex : prix ÷ 3 ans)"],
    ['frais_telephone', 'Tél. / internet', "Quote-part professionnelle téléphone + internet (usage mixte = quote-part justifiée)"],
    ['frais_double_residence', 'Double résidence', "Double résidence (conjoints exerçant dans des lieux éloignés) : hébergement + repas supplémentaires, justifiés"],
    ['frais_demenagement', 'Déménagement', "Déménagement pour obtenir un nouvel emploi (hors réinstallation du foyer), sur justificatifs"],
    ['frais_sejour_etranger', "Séjour pro à l'étranger", "Séjour à l'étranger imposé par l'employeur : hébergement, repas, transports locaux non remboursés"],
    ['frais_local_pro', 'Local pro', "Quote-part du loyer et des charges de la pièce dédiée à l'activité professionnelle (au prorata de la surface)"],
    ['frais_interets_titres', 'Intérêts titres société', "Intérêts d'emprunt contracté pour acquérir des titres de l'entreprise employeur"],
    ['frais_representation', 'Représentation', "Frais de réception, représentation, gratification (VRP, dirigeants, représentants du personnel), en rapport avec la profession"],
    ['frais_juridiques', 'Frais de procès', "Frais de procès liés au travail (ex : honoraires d'avocat en procédure prud'homale)"]
  ];

  function calculAutresFrais(state, config, ctx) {
    const f = state.f;
    let teletravail = n(f.frais_teletravail);
    let forfaitTT = null;
    if (f.forfait_tt) {
      // Forfait 2,70 €/jour de télétravail, plafonné, non déductible si allocation employeur exonérée
      forfaitTT = f.alloc_tt
        ? 0
        : Math.min((config.forfaitTeletravailJour || 2.70) * ctx.jours.joursTeletravail, config.plafondTeletravail || 626.40);
      teletravail = forfaitTT;
    }
    const formation = n(f.frais_formation);
    const doc = n(f.frais_doc);
    const postes = AUTRES_FRAIS_POSTES.map(([id, court, long]) => ({ id, court, label: long, montant: n(f[id]) }));
    const totalPostes = postes.reduce((s, p) => s + p.montant, 0);
    const autres = n(f.frais_autres);
    return {
      teletravail, forfaitTT, formation, documentation: doc, postes, autres,
      total: teletravail + formation + doc + totalPostes + autres
    };
  }

  // --- REMBOURSEMENTS EMPLOYEUR ---

  function calculRemboursements(f) {
    const ik = n(f.remb_ik);
    const carburant = n(f.remb_carburant);
    const mobilite = n(f.remb_mobilite);
    const autres = n(f.remb_autres);
    return { ik, carburant, mobilite, autres, total: ik + carburant + mobilite + autres };
  }

  // --- MUTUELLE ---

  function calculMutuelle(state) {
    const f = state.f;
    const type = state.mutuelle;
    if (type === 'entreprise_6dd') {
      const montant = n(f.mutuelle_6dd);
      return { type, deductible: montant, case: '6DD', formulaire: '2042 C', info: 'Mutuelle entreprise (non déduite sur la fiche de paie)' };
    }
    if (type === 'madelin') {
      const montant = n(f.mutuelle_madelin);
      return { type, deductible: montant, case: 'BIC/BNC', formulaire: '2035/2031', info: 'Loi Madelin — déduction du bénéfice imposable' };
    }
    return {
      type,
      deductible: 0,
      case: null,
      formulaire: null,
      info: type === 'entreprise_fiche' ? 'Déjà déduite sur la fiche de paie' : 'Mutuelle individuelle : non déductible'
    };
  }

  // --- IMPÔT SUR LE REVENU ---

  // Barème progressif par part de quotient familial.
  // Chaque tranche s'applique à la part du revenu située entre la tranche
  // précédente et la tranche courante (y compris la tranche en cours, partiellement).
  function calculImpotParTranche(revenuParPart, config) {
    if (revenuParPart <= 0) return 0;
    let impot = 0;
    let previousMax = 0;
    for (const tranche of config.tranches) {
      if (revenuParPart > previousMax) {
        impot += (Math.min(revenuParPart, tranche.max) - previousMax) * tranche.rate;
      }
      previousMax = tranche.max;
    }
    return impot;
  }

  // Tranche marginale applicable (celle où tombe le revenu par part)
  function trancheLabel(revenuParPart, config) {
    const fmt = (x) => Math.floor(x).toLocaleString('fr-FR');
    let prev = 0;
    for (const t of config.tranches) {
      if (revenuParPart <= t.max) {
        const rate = Math.round(t.rate * 100);
        if (prev === 0) return `${rate} % (≤ ${fmt(t.max)} €)`;
        const haut = t.max === Infinity ? '…' : fmt(t.max);
        return `${rate} % (${fmt(prev + 1)} € – ${haut} €)`;
      }
      prev = t.max;
    }
    const last = config.tranches[config.tranches.length - 1];
    return `${Math.round(last.rate * 100)} %`;
  }

  // Abattement forfaitaire de 10 % borné (min / max par déclarant)
  function abattementForfaitaire(salaire, config) {
    const brut = salaire * (config.abattementForfaitaire || 0.10);
    return Math.min(Math.max(brut, config.abattementMin || 0), config.abattementMax || Infinity);
  }

  // Impôt complet : barème + plafonnement du quotient familial + décote + CEHR
  function calculImpot(revenuNetImposable, nombreParts, situation, config) {
    const parts = Math.max(0.5, nombreParts || 1);
    const baseParts = situation === 'couple' ? 2 : 1;

    const impotSansQF = calculImpotParTranche(revenuNetImposable / baseParts, config) * baseParts;
    const impotAvecQF = calculImpotParTranche(revenuNetImposable / parts, config) * parts;
    const avantageQF = Math.max(0, impotSansQF - impotAvecQF);
    const plafondQF = (config.plafondQuotientFamilial || 0) * Math.max(0, parts - baseParts);
    const impotBrut = Math.max(impotAvecQF, impotSansQF - plafondQF);

    // Décote (personne seule / veuve / parent isolé => forfait célibataire)
    const forfait = situation === 'couple' ? config.decoteCouple : config.decoteCelibataire;
    const taux = config.decoteTaux || 0.4525;
    const seuil = forfait / taux;
    let decote = 0;
    if (impotBrut > 0 && impotBrut < seuil) {
      decote = Math.min(impotBrut, forfait - taux * impotBrut);
    }
    const impotApresDecote = Math.max(0, impotBrut - decote);

    // CEHR sur le RFR (approximé ici par le revenu net imposable)
    const c = config.cehr || { celibataire: { seuil1: 250000, seuil2: 500000 }, couple: { seuil1: 500000, seuil2: 1000000 }, taux1: 0.03, taux2: 0.04 };
    const s = situation === 'couple' ? c.couple : c.celibataire;
    let cehr = 0;
    if (revenuNetImposable > s.seuil1) {
      cehr += (Math.min(revenuNetImposable, s.seuil2) - s.seuil1) * c.taux1;
      if (revenuNetImposable > s.seuil2) cehr += (revenuNetImposable - s.seuil2) * c.taux2;
    }

    return {
      nombreParts: parts,
      baseParts,
      revenuParPart: revenuNetImposable / parts,
      impotBrut,
      avantageQF,
      plafondQF,
      decote,
      impotApresDecote,
      cehr,
      impotNet: impotApresDecote + cehr,
      tranche: trancheLabel(revenuNetImposable / parts, config)
    };
  }

  // --- AVERTISSEMENTS ---

  function computeWarnings(state, config, res) {
    const w = [];
    const f = state.f;
    if (res.transport.detail.depassement40km) {
      w.push({ level: 'warn', text: `Distance aller > ${config.limiteKmTrajet} km : seuls ${config.limiteKmTrajet} km par trajet (${config.limiteKmTrajet * 2} km/jour) sont retenus, sauf circonstances particulières cochées (note à joindre à la déclaration).` });
    }
    const td = res.transport.detail;
    if ((td.type === 'voiture' || td.type === 'moto') && !td.cv && td.kmAnnuel > 0) {
      w.push({ level: 'warn', text: "Puissance fiscale non renseignée : le barème kilométrique n'est pas appliqué (hors péages, stationnement, intérêts d'emprunt)." });
    }
    const nbRepas = (res.repas.repas ? res.repas.repas.nb : 0) + (res.repas.tickets ? res.repas.tickets.nb : 0);
    if (nbRepas > 0 && res.jours.joursOuvres > 0 && nbRepas > res.jours.joursOuvres) {
      w.push({ level: 'warn', text: `Nombre de repas (${nbRepas}) supérieur aux jours ouvrés (${res.jours.joursOuvres}) : un seul repas déductible par jour travaillé, vérifie ta saisie.` });
    }
    if (res.impot && res.impot.cehr > 0) {
      w.push({ level: 'info', text: "Hauts revenus : outre la CEHR, la CDHR (art. 224 CGI, taux minimal d'imposition de 20 %, reconduit par la LF 2026) peut aussi s'appliquer aux résidents fiscaux français." });
    }
    const repas = res.repas;
    if (repas.repas && repas.repas.plafonne) {
      w.push({ level: 'warn', text: `Coût du repas supérieur au plafond de ${config.plafondRepas.toFixed(2)} € : la dépense retenue est plafonnée (déduction max ${(config.plafondRepas - config.forfaitRepas).toFixed(2)} €/repas).` });
    }
    if (repas.tickets) {
      const t = repas.tickets;
      if (t.partEmployeurHorsPlafond > 0) {
        w.push({ level: 'warn', text: `Part employeur > ${config.plafondPartEmployeur.toFixed(2)} €/titre : l'excédent est soumise à cotisations et à l'impôt (avantage en nature).` });
      }
      if (t.nb > 0 && t.valeur > 0 && (t.partEmployeur / t.valeur < 0.50 || t.partEmployeur / t.valeur > 0.60)) {
        w.push({ level: 'info', text: 'Exonération des titres-restaurant : la part employeur doit représenter entre 50 % et 60 % de la valeur du titre.' });
      }
    }
    if (res.autresFrais.forfaitTT !== null) {
      const brut = (config.forfaitTeletravailJour || 2.70) * res.jours.joursTeletravail;
      if (brut > (config.plafondTeletravail || 626.40)) {
        w.push({ level: 'warn', text: `Forfait télétravail plafonné à ${(config.plafondTeletravail || 626.40).toFixed(2)} €/an (${(config.forfaitTeletravailJour || 2.70).toFixed(2)} € × ${res.jours.joursTeletravail} jours).` });
      }
      if (f.alloc_tt) {
        w.push({ level: 'info', text: 'Allocation télétravail exonérée versée par l employeur : les frais de télétravail ne sont pas déductibles.' });
      }
    }
    if (res.remboursements.ik > res.transport.detail.bareme?.montant && res.transport.detail.bareme?.montant > 0) {
      w.push({ level: 'warn', text: 'Indemnités kilométriques reçues supérieures au barème fiscal : l excédent est imposable.' });
    }
    if (res.jours.joursOuvres - res.jours.joursArret - res.jours.joursTeletravail < 0) {
      w.push({ level: 'warn', text: 'Arrêts + télétravail supérieurs aux jours ouvrés : les jours au bureau sont ramenés à 0.' });
    }
    return w;
  }

  // --- CALCUL PAR DÉCLARANT (pur) ---
  // d = { transport, repasType, mutuelle, f: {id: valeurBrute} } — f.salaire = net imposable du déclarant
  // L'abattement forfaitaire de 10 % est PAR DÉCLARANT (min/max chacun) ; sans revenu, aucun abattement.
  function computeDeclarant(d, config) {
    const state = {
      transport: d.transport || 'voiture',
      repasType: d.repasType || 'classique',
      mutuelle: d.mutuelle || 'entreprise_fiche',
      situation: 'celibataire',
      f: d.f || {}
    };
    const f = state.f;
    const jours = calculJours(f);
    const transport = calculFraisTransport(state, config, { jours });
    const repas = calculFraisRepas(state, config);
    const autresFrais = calculAutresFrais(state, config, { jours });
    const remboursements = calculRemboursements(f);
    const mutuelle = calculMutuelle(state);

    const totalFraisBruts = transport.frais + repas.deductible + autresFrais.total;
    const totalFraisNets = Math.max(0, totalFraisBruts - remboursements.total);

    const salaire = n(f.salaire);
    const abattement10Pct = salaire > 0 ? abattementForfaitaire(salaire, config) : 0;
    const deductionRetenue = salaire > 0 ? Math.max(totalFraisNets, abattement10Pct) : 0;
    const deduction6DD = state.mutuelle === 'entreprise_6dd' ? mutuelle.deductible : 0;
    const gain = totalFraisNets - abattement10Pct;

    let verdict;
    if (salaire === 0) {
      verdict = { kind: 'neutral', title: 'En attente de données', text: 'Saisis ton salaire et tes frais pour voir si les frais réels sont avantageux.' };
    } else if (totalFraisNets > abattement10Pct) {
      verdict = { kind: 'good', title: 'Les frais réels sont avantageux !', text: `Tu économises environ ${gain.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} de revenu imposable par rapport à l'abattement forfaitaire de 10 % (${abattement10Pct.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}).` };
    } else {
      verdict = { kind: 'bad', title: "L'abattement de 10 % est préférable", text: `Tes frais réels (${totalFraisNets.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}) sont inférieurs à l'abattement (${abattement10Pct.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}). Garde le forfait automatique.` };
    }

    const res = {
      jours,
      kmAnnuel: transport.detail.kmAnnuel,
      transport,
      repas,
      autresFrais,
      remboursements,
      mutuelle,
      totalFraisBruts,
      totalFraisNets,
      salaire,
      abattement10Pct,
      deductionRetenue,
      deduction6DD,
      gain,
      impot: { cehr: 0 },
      verdict
    };
    res.warnings = computeWarnings(state, config, res);
    res.declaration = {
      caseAK: totalFraisBruts,
      detailTransport: transport.frais,
      detailRepas: repas.deductible,
      detailAutres: autresFrais.total,
      remboursementsReintegres: remboursements.total,
      mutuelleCase: mutuelle.deductible > 0 ? `${mutuelle.case} (${mutuelle.formulaire})` : null,
      mutuelleMontant: mutuelle.deductible
    };
    return res;
  }

  // --- CALCUL AU NIVEAU DU FOYER (pur) ---
  // state = { situation, nombreParts, active, d1: {...}, d2: {...} }
  // En imposition commune (couple), chaque déclarant garde son propre abattement 10 %
  // et choisit individuellement frais réels ou forfait ; l'impôt est calculé sur le revenu global du foyer.
  function computeFoyer(state, config) {
    const situation = state.situation === 'couple' ? 'couple' : 'celibataire';
    const couple = situation === 'couple';
    const nombreParts = parseNum(state.nombreParts, 0.5) || (couple ? 2 : 1);
    const keys = couple ? ['d1', 'd2'] : ['d1'];
    const declarants = {};
    const warnings = [];
    let salaireFoyer = 0, fraisBrutsFoyer = 0, fraisNetsFoyer = 0;
    let abattementFoyer = 0, deductionFraisFoyer = 0, deduction6DDFoyer = 0, remboursementsFoyer = 0;

    keys.forEach((key) => {
      const d = computeDeclarant(state[key] || {}, config);
      d.label = key === 'd1' ? 'Déclarant 1' : 'Déclarant 2';
      d.cases = {
        salaire: key === 'd1' ? '1AJ' : '2AJ',
        fraisReels: key === 'd1' ? '1AK' : '1BK',
        remboursements: key === 'd1' ? '1GB-1JB' : '2GB-2JB',
        mutuelle: key === 'd1' ? '6DD' : '6DE'
      };
      declarants[key] = d;
      salaireFoyer += d.salaire;
      fraisBrutsFoyer += d.totalFraisBruts;
      fraisNetsFoyer += d.totalFraisNets;
      abattementFoyer += d.abattement10Pct;
      deductionFraisFoyer += d.deductionRetenue;
      deduction6DDFoyer += d.deduction6DD;
      remboursementsFoyer += d.remboursements.total;
      d.warnings.forEach(w => warnings.push(couple ? { level: w.level, text: `${d.label} — ${w.text}` } : w));
    });

    const revenuNetImposable = Math.max(0, salaireFoyer - deductionFraisFoyer - deduction6DDFoyer);
    const impot = calculImpot(revenuNetImposable, nombreParts, situation, config);
    if (impot.cehr > 0) {
      warnings.push({ level: 'info', text: "Hauts revenus : outre la CEHR, la CDHR (art. 224 CGI, taux minimal d'imposition de 20 %, reconduit par la LF 2026) peut aussi s'appliquer aux résidents fiscaux français." });
    }
    const gainFoyer = deductionFraisFoyer - abattementFoyer;

    let verdict;
    if (salaireFoyer === 0) {
      verdict = { kind: 'neutral', title: 'En attente de données', text: 'Saisis les salaires et les frais des déclarants pour voir si les frais réels sont avantageux.' };
    } else if (gainFoyer > 0) {
      verdict = { kind: 'good', title: 'Les frais réels sont avantageux pour le foyer !', text: `Au total, ${gainFoyer.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} de déduction en plus par rapport à l'abattement de 10 % appliqué aux deux salaires (choix fait déclarant par déclarant).` };
    } else {
      verdict = { kind: 'bad', title: "L'abattement de 10 % est préférable", text: `Au niveau du foyer, l'abattement de 10 % (${abattementFoyer.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}) dépasse les frais réels nets (${fraisNetsFoyer.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}). Chaque déclarant garde le forfait automatique.` };
    }

    return {
      situation,
      nombreParts,
      couple,
      active: state.active === 'd2' ? 'd2' : 'd1',
      declarants,
      salaireFoyer,
      fraisBrutsFoyer,
      fraisNetsFoyer,
      abattementFoyer,
      deductionFraisFoyer,
      deduction6DDFoyer,
      deductionTotale: deductionFraisFoyer + deduction6DDFoyer,
      remboursementsFoyer,
      gainFoyer,
      revenuNetImposable,
      impot,
      verdict,
      warnings,
      declaration: {
        case1AJ: declarants.d1.salaire,
        case2AJ: couple ? declarants.d2.salaire : null,
        case1AK: declarants.d1.totalFraisBruts,
        case1BK: couple ? declarants.d2.totalFraisBruts : null,
        remboursements1GB1JB: declarants.d1.remboursements.total,
        remboursements2GB2JB: couple ? declarants.d2.remboursements.total : null,
        mutuelle6DD: declarants.d1.deduction6DD,
        mutuelle6DE: couple ? declarants.d2.deduction6DD : null
      }
    };
  }

  // --- CALCUL PRINCIPAL (pur) — API historique, un seul déclarant ---
  // state = { year, transport, repasType, mutuelle, situation, f: {id: valeurBrute} }
  // Conservée pour compatibilité : délègue au calcul foyer avec un seul déclarant.
  function compute(state, config) {
    const foyer = computeFoyer({
      situation: state.situation,
      nombreParts: (state.f || {}).nombre_parts,
      active: 'd1',
      d1: { transport: state.transport, repasType: state.repasType, mutuelle: state.mutuelle, f: state.f }
    }, config);
    const d1 = foyer.declarants.d1;
    return {
      jours: d1.jours,
      kmAnnuel: d1.kmAnnuel,
      transport: d1.transport,
      repas: d1.repas,
      autresFrais: d1.autresFrais,
      remboursements: d1.remboursements,
      mutuelle: d1.mutuelle,
      totalFraisBruts: d1.totalFraisBruts,
      totalFraisNets: d1.totalFraisNets,
      salaire: d1.salaire,
      nombreParts: foyer.nombreParts,
      situation: foyer.situation,
      abattement10Pct: d1.abattement10Pct,
      deductionRetenue: foyer.deductionFraisFoyer,
      deduction6DD: d1.deduction6DD,
      gain: d1.gain,
      revenuNetImposable: foyer.revenuNetImposable,
      impot: foyer.impot,
      verdict: d1.verdict,
      warnings: foyer.warnings,
      declaration: {
        case1AK: d1.declaration.caseAK,
        detailTransport: d1.declaration.detailTransport,
        detailRepas: d1.declaration.detailRepas,
        detailAutres: d1.declaration.detailAutres,
        remboursementsReintegres: d1.declaration.remboursementsReintegres,
        mutuelleCase: d1.declaration.mutuelleCase,
        mutuelleMontant: d1.declaration.mutuelleMontant
      }
    };
  }

  return {
    parseNum,
    calculJours,
    distanceRetenue,
    baremeKm,
    calculFraisTransport,
    calculFraisRepas,
    calculAutresFrais,
    calculRemboursements,
    calculMutuelle,
    calculImpotParTranche,
    trancheLabel,
    abattementForfaitaire,
    calculImpot,
    computeWarnings,
    computeDeclarant,
    computeFoyer,
    compute
  };
});
