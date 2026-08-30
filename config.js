// ============================================
// CONFIGURATION DES BARÈMES FISCAUX
// Calculateur Frais Réels - 0rmx0
// ============================================

const FISCAL_CONFIG = {
  // Configuration par année fiscale (déclaration N pour revenus N-1)
  2027: {
    year: 2027,
    revenusYear: 2026,
    label: "2027 (revenus 2026)",
    forfaitRepas: 5.45,
    plafondTicket: 8.38,
    plafondEmployeur: 5.92,
    baremeKm: {
      voiture: { '3': 0.681, '4': 0.752, '5': 0.821, '6': 0.856, '7': 0.893 },
      moto: { '3': 0.397, '4': 0.475, '5': 0.553, '6': 0.631, '7': 0.631 }
    },
    tranches: [
      { max: 11600, rate: 0.00 },
      { max: 29579, rate: 0.11 },
      { max: 84577, rate: 0.30 },
      { max: 181917, rate: 0.41 },
      { max: Infinity, rate: 0.45 }
    ],
    abattementForfaitaire: 0.10
  },
  2026: {
    year: 2026,
    revenusYear: 2025,
    label: "2026 (revenus 2025)",
    forfaitRepas: 5.45,
    plafondTicket: 8.38,
    plafondEmployeur: 5.92,
    baremeKm: {
      voiture: { '3': 0.681, '4': 0.752, '5': 0.821, '6': 0.856, '7': 0.893 },
      moto: { '3': 0.397, '4': 0.475, '5': 0.553, '6': 0.631, '7': 0.631 }
    },
    tranches: [
      { max: 11294, rate: 0.00 },
      { max: 28797, rate: 0.11 },
      { max: 82341, rate: 0.30 },
      { max: 177106, rate: 0.41 },
      { max: Infinity, rate: 0.45 }
    ],
    abattementForfaitaire: 0.10
  }
};

// Récupère la configuration pour l'année sélectionnée
function getConfig(year) {
  return FISCAL_CONFIG[year] || FISCAL_CONFIG[2027];
}

// Liste des années disponibles
function getAvailableYears() {
  return Object.keys(FISCAL_CONFIG).sort((a, b) => parseInt(b) - parseInt(a));
}
