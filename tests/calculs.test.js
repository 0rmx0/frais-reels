// Tests unitaires du module de calcul pur (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');

const cfg = require('../config.js');
const Calculs = require('../calculs.js');

const CONFIG = cfg.getConfig(2026);

const baseState = (over = {}) => ({
  year: 2026,
  transport: 'voiture',
  repasType: 'classique',
  mutuelle: 'entreprise_fiche',
  situation: 'celibataire',
  f: {},
  ...over
});

// --- Barème kilométrique officiel 2026 (exemples publiés par l'administration) ---

test('barème voiture 5 CV, 4 000 km = 2 544 € (exemple officiel)', () => {
  const b = Calculs.baremeKm('voiture', '5', 4000, false, CONFIG);
  assert.equal(Math.round(b.montant), 2544);
});

test('barème voiture 5 CV, 10 000 km = 4 965 € (exemple officiel)', () => {
  const b = Calculs.baremeKm('voiture', '5', 10000, false, CONFIG);
  assert.equal(Math.round(b.montant), 4965); // (10 000 x 0,357) + 1 395
});

test('barème voiture 6 CV électrique, 6 000 km = 4 441,20 € (majoration +20 %)', () => {
  const b = Calculs.baremeKm('voiture', '6', 6000, true, CONFIG);
  assert.ok(Math.abs(b.montant - 4441.20) < 0.01); // ((6 000 x 0,374) + 1 457) x 1,20
});

test('barème voiture 4 CV, 25 000 km = 10 175 € (tranche > 20 000 km)', () => {
  const b = Calculs.baremeKm('voiture', '4', 25000, false, CONFIG);
  assert.equal(Math.round(b.montant), 10175); // 25 000 x 0,407
});

test('barème moto 3-5 CV, 4 500 km = 1 527 €', () => {
  const b = Calculs.baremeKm('moto', '3-5', 4500, false, CONFIG);
  assert.equal(Math.round(b.montant), 1527); // (4 500 x 0,082) + 1 158
});

test('barème cyclomoteur, 4 000 km = 1 027 €', () => {
  const b = Calculs.baremeKm('cyclomoteur', '', 4000, false, CONFIG);
  assert.equal(Math.round(b.montant), 1027); // (4 000 x 0,079) + 711
});

test('plus de plafond fictif de 200 € à 5 000 km', () => {
  const b = Calculs.baremeKm('voiture', '5', 4000, false, CONFIG);
  assert.ok(b.montant > 200);
});

// --- Règle des 40 km ---

test('règle des 40 km : 60 km aller => 40 km retenus sans circonstances', () => {
  const d = Calculs.distanceRetenue(60, false, CONFIG);
  assert.equal(d.retenue, 40);
  assert.equal(d.depassement, true);
});

test('règle des 40 km : 60 km aller retenus intégralement avec circonstances particulières', () => {
  const d = Calculs.distanceRetenue(60, true, CONFIG);
  assert.equal(d.retenue, 60);
  assert.equal(d.depassement, false);
});

// --- Repas ---

test('repas classique : (12 - 5,45) x 200 = 1 310 €', () => {
  const r = Calculs.calculFraisRepas(baseState({ f: { nb_repas_classique: '200', cout_repas_classique: '12' } }), CONFIG);
  assert.ok(Math.abs(r.deductible - 1310) < 0.01);
});

test('repas plafonné à 21,10 € : coût 30 € => déduction max 15,65 €/repas', () => {
  const r = Calculs.calculFraisRepas(baseState({ f: { nb_repas_classique: '10', cout_repas_classique: '30' } }), CONFIG);
  assert.ok(Math.abs(r.deductible - 156.50) < 0.01); // (21,10 - 5,45) x 10
  assert.equal(r.repas.plafonne, true);
});

test('tickets restaurant : exemple officiel 12 € - 5,45 - 4,50 = 2,05 €/jour', () => {
  const r = Calculs.calculFraisRepas(baseState({
    repasType: 'tickets',
    f: { nb_tickets: '1', valeur_ticket: '12', part_employeur_ticket: '4.50' }
  }), CONFIG);
  assert.ok(Math.abs(r.deductible - 2.05) < 0.01);
});

test('mixte : tickets seuls remplis => déduction tickets (bug corrigé)', () => {
  const r = Calculs.calculFraisRepas(baseState({
    repasType: 'mixte',
    f: { nb_tickets_mixte: '100', valeur_ticket_mixte: '12', part_employeur_ticket_mixte: '4.50' }
  }), CONFIG);
  assert.ok(Math.abs(r.deductible - 205) < 0.01); // 2,05 x 100
});

// --- Abattement 10 % borné ---

test('abattement 10 % : 45 000 € => 4 500 €', () => {
  assert.equal(Calculs.abattementForfaitaire(45000, CONFIG), 4500);
});

test('abattement 10 % : plancher 509 € (salaire 3 000 €)', () => {
  assert.equal(Calculs.abattementForfaitaire(3000, CONFIG), 509);
});

test('abattement 10 % : plafond 14 555 € (salaire 200 000 €)', () => {
  assert.equal(Calculs.abattementForfaitaire(200000, CONFIG), 14555);
});

// --- Impôt ---

test('impôt par tranche : 20 000 €/part, 1 part = 924 € (barème 2026)', () => {
  assert.equal(Math.round(Calculs.calculImpotParTranche(20000, CONFIG)), 924); // (20 000 - 11 600) x 11 %
});

test('décote célibataire : impôt brut 924 € => décote 478,89 €, net 445,11 €', () => {
  const i = Calculs.calculImpot(20000, 1, 'celibataire', CONFIG);
  assert.equal(Math.round(i.impotBrut), 924);
  assert.ok(Math.abs(i.decote - 478.89) < 0.01);
  assert.ok(Math.abs(i.impotNet - 445.11) < 0.01);
});

test('décote couple : 40 000 €, 2 parts => impôt brut 1 848 €, décote 646,78 €', () => {
  const i = Calculs.calculImpot(40000, 2, 'couple', CONFIG);
  assert.ok(Math.abs(i.impotBrut - 1848) < 0.01);
  assert.ok(Math.abs(i.decote - 646.78) < 0.01);
});

test('plafonnement du quotient familial : 100 000 €, 4 parts plafonné à 1 807 €/demi-part', () => {
  const i = Calculs.calculImpot(100000, 4, 'couple', CONFIG);
  const impotSansQF = Calculs.calculImpotParTranche(50000, CONFIG) * 2;
  const impotAvecQF = Calculs.calculImpotParTranche(25000, CONFIG) * 4;
  const plafond = 1807 * 2;
  assert.ok(Math.abs(i.impotBrut - Math.max(impotAvecQF, impotSansQF - plafond)) < 0.01);
});

test('CEHR : 600 000 € célibataire => 3 % x 250 000 + 4 % x 100 000 = 11 500 €', () => {
  const i = Calculs.calculImpot(600000, 1, 'celibataire', CONFIG);
  assert.ok(Math.abs(i.cehr - 11500) < 0.01);
});

// --- Calcul complet ---

test('compute complet : 45 000 €, 220 jours, 22 km, 5 CV, 200 repas à 12 €', () => {
  const res = Calculs.compute(baseState({
    situation: 'celibataire',
    f: {
      salaire: '45000', nombre_parts: '1',
      jours_ouvres: '220', jours_arret: '0', jours_teletravail: '20',
      dist_aller: '22', cv: '5', energie: 'thermique',
      nb_repas_classique: '200', cout_repas_classique: '12'
    }
  }), CONFIG);
  assert.equal(res.jours.joursBureau, 200);
  assert.equal(res.kmAnnuel, 200 * 22 * 2); // 8 800 km
  // (8 800 x 0,357) + 1 395 = 4 536,60 €
  assert.ok(Math.abs(res.transport.frais - 4536.60) < 0.01);
  assert.ok(Math.abs(res.repas.deductible - 1310) < 0.01);
  const bruts = 4536.60 + 1310;
  assert.ok(Math.abs(res.totalFraisBruts - bruts) < 0.01);
  assert.equal(res.abattement10Pct, 4500);
  assert.ok(res.gain > 0); // frais réels avantageux ici
  assert.equal(res.revenuNetImposable, 45000 - bruts);
  assert.ok(res.verdict.kind === 'good');
});

test('compute : avertissement 40 km émis quand distance > 40 km', () => {
  const res = Calculs.compute(baseState({
    f: { salaire: '40000', jours_ouvres: '220', dist_aller: '60', cv: '5', energie: 'thermique' }
  }), CONFIG);
  assert.ok(res.warnings.some(w => w.text.includes('40 km')));
  assert.equal(res.kmAnnuel, 220 * 40 * 2);
});

test('compute : forfait télétravail 2,70 €/jour plafonné à 626,40 €', () => {
  const res = Calculs.compute(baseState({
    f: { salaire: '40000', jours_ouvres: '260', jours_teletravail: '260', forfait_tt: 'on' }
  }), CONFIG);
  assert.equal(res.autresFrais.teletravail, 626.40);
});

test('compute : allocation télétravail => forfait TT non déductible', () => {
  const res = Calculs.compute(baseState({
    f: { salaire: '40000', jours_ouvres: '260', jours_teletravail: '100', forfait_tt: 'on', alloc_tt: 'on' }
  }), CONFIG);
  assert.equal(res.autresFrais.teletravail, 0);
});

test('année 2027 marquée provisoire', () => {
  assert.equal(cfg.getConfig(2027).provisoire, true);
  assert.equal(cfg.getConfig(2026).provisoire, false);
  assert.equal(cfg.getLatestOfficialYear(), 2026);
});
