// ============================================
// CONFIGURATION DES BARÈMES FISCAUX
// Calculateur Frais Réels - 0rmx0
// Sources : impots.gouv.fr, BOFiP, service-public.fr, loi de finances
// ============================================

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    const exported = factory();
    root.VERSION = exported.VERSION;
    root.FISCAL_CONFIG = exported.FISCAL_CONFIG;
    root.getConfig = exported.getConfig;
    root.getAvailableYears = exported.getAvailableYears;
    root.getLatestOfficialYear = exported.getLatestOfficialYear;
  }
})(typeof self !== 'undefined' ? self : this, function () {

const VERSION = '2.1.0';

// Barème kilométrique officiel (d = distance annuelle en km à titre professionnel).
// Structure : pour chaque type de véhicule, des seuils de distance et, par
// puissance fiscale, 3 tranches [taux1, taux2, taux3] + part fixe [0, fixe2, 0].
// Barème 2026 (revenus 2025) : inchangé depuis l'arrêté du 27 mars 2023.
// Majoration de 20 % pour les véhicules 100 % électriques (pas les hybrides).
const BAREME_KM_2026 = {
  voiture: {
    seuilsKm: [5000, 20000],
    cv: {
      '3': { t: [0.529, 0.316, 0.370], fixe: [0, 1065, 0] },
      '4': { t: [0.606, 0.340, 0.407], fixe: [0, 1330, 0] },
      '5': { t: [0.636, 0.357, 0.427], fixe: [0, 1395, 0] },
      '6': { t: [0.665, 0.374, 0.447], fixe: [0, 1457, 0] },
      '7': { t: [0.697, 0.394, 0.470], fixe: [0, 1515, 0] }
    }
  },
  moto: { // motocyclettes et scooters > 50 cm³
    seuilsKm: [3000, 6000],
    cv: {
      '1-2': { t: [0.395, 0.099, 0.248], fixe: [0, 891, 0] },
      '3-5': { t: [0.468, 0.082, 0.275], fixe: [0, 1158, 0] },
      '5+':  { t: [0.606, 0.079, 0.343], fixe: [0, 1583, 0] }
    }
  },
  cyclomoteur: { // 50 cm³ et moins : pas de distinction de puissance
    seuilsKm: [3000, 6000],
    cv: {
      '': { t: [0.315, 0.079, 0.198], fixe: [0, 711, 0] }
    }
  }
};

const FISCAL_CONFIG = {
  // Déclaration 2026 = revenus 2025 (loi de finances n° 2026-103 du 19/02/2026)
  2026: {
    year: 2026,
    revenusYear: 2025,
    label: '2026 (revenus 2025)',
    provisoire: false,
    // Repas (BOFiP BOI-RSA-BASE-30-50-30)
    forfaitRepas: 5.45,        // valeur d'un repas pris au foyer
    plafondRepas: 21.10,       // dépense max retenue par repas (déduction max = 21,10 - 5,45 = 15,65 €)
    // Titres-restaurant (titres émis à partir du 01/01/2026)
    plafondPartEmployeur: 7.32, // part employeur exonérée max par titre (entre 50 % et 60 % de la valeur)
    // Barème kilométrique
    baremeKm: BAREME_KM_2026,
    limiteKmTrajet: 40,          // 40 km aller max retenus (80 km/jour) sauf circonstances particulières
    majorationElectrique: 1.20,  // véhicules 100 % électriques uniquement
    // Télétravail (forfait si pas d'allocation employeur exonérée)
    forfaitTeletravailJour: 2.70,
    plafondTeletravail: 626.40,  // 2,70 € x 232 jours
    // Abattement forfaitaire 10 % sur salaires (min / max par déclarant)
    abattementForfaitaire: 0.10,
    abattementMin: 509,
    abattementMax: 14555,
    // Barème IR progressif (art. 197 CGI)
    tranches: [
      { max: 11600, rate: 0.00 },
      { max: 29579, rate: 0.11 },
      { max: 84577, rate: 0.30 },
      { max: 181917, rate: 0.41 },
      { max: Infinity, rate: 0.45 }
    ],
    // Décote (art. 197 I 4 CGI) : forfait - 45,25 % x impôt brut
    decoteCelibataire: 897,
    decoteCouple: 1483,
    decoteTaux: 0.4525,
    // Plafonnement du quotient familial (art. 197 I 2 CGI)
    plafondQuotientFamilial: 1807, // par demi-part au-delà de la part de base
    // CEHR (art. 223 sexies CGI) sur le RFR
    cehr: {
      celibataire: { seuil1: 250000, seuil2: 500000 },
      couple:      { seuil1: 500000, seuil2: 1000000 },
      taux1: 0.03,
      taux2: 0.04
    }
  },

  // Déclaration 2027 = revenus 2026 : barèmes NON publiés à ce jour
  // (publication au printemps 2027, loi de finances pour 2027).
  // Valeurs 2026 reconduites à titre provisoire.
  2027: {
    year: 2027,
    revenusYear: 2026,
    label: '2027 (revenus 2026) — barème provisoire',
    provisoire: true,
    forfaitRepas: 5.45,
    plafondRepas: 21.10,
    plafondPartEmployeur: 7.32,
    baremeKm: BAREME_KM_2026,
    limiteKmTrajet: 40,
    majorationElectrique: 1.20,
    forfaitTeletravailJour: 2.70,
    plafondTeletravail: 626.40,
    abattementForfaitaire: 0.10,
    abattementMin: 509,
    abattementMax: 14555,
    tranches: [
      { max: 11600, rate: 0.00 },
      { max: 29579, rate: 0.11 },
      { max: 84577, rate: 0.30 },
      { max: 181917, rate: 0.41 },
      { max: Infinity, rate: 0.45 }
    ],
    decoteCelibataire: 897,
    decoteCouple: 1483,
    decoteTaux: 0.4525,
    plafondQuotientFamilial: 1807,
    cehr: {
      celibataire: { seuil1: 250000, seuil2: 500000 },
      couple:      { seuil1: 500000, seuil2: 1000000 },
      taux1: 0.03,
      taux2: 0.04
    }
  }
};

// Récupère la configuration pour l'année sélectionnée
function getConfig(year) {
  return FISCAL_CONFIG[year] || FISCAL_CONFIG[getAvailableYears()[0]];
}

// Liste des années disponibles (plus récente d'abord)
function getAvailableYears() {
  return Object.keys(FISCAL_CONFIG).sort((a, b) => parseInt(b) - parseInt(a));
}

// Dernière année avec un barème officiel (non provisoire)
function getLatestOfficialYear() {
  const years = getAvailableYears().filter(y => !FISCAL_CONFIG[y].provisoire);
  return parseInt(years[0] || getAvailableYears()[0]);
}

return { VERSION, FISCAL_CONFIG, getConfig, getAvailableYears, getLatestOfficialYear };
});
