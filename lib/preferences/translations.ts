import type { Language } from "@/components/preferences/PreferencesProvider";

type FooterTranslations = {
  ctaBadge: string;
  ctaTitle: string;
  ctaText: string;
  findHousing: string;
  listProperty: string;
  marketplaceLabel: string;
  popular: string;
  students: string;
  landlords: string;
  support: string;
  company: string;
  trustFirst: string;
  trustFirstText: string;
  supportReady: string;
  supportReadyText: string;
  stayConnected: string;
  stayConnectedText: string;
  privacy: string;
  terms: string;
  safety: string;
};

export const footerTranslations: Record<Language, FooterTranslations> = {
  en: {
    ctaBadge: "Student housing made safer",
    ctaTitle: "Find trusted student housing near campus.",
    ctaText:
      "Travel Markets helps students discover rentals, message landlords, book viewings, and protect exact addresses until the right stage of the rental process.",
    findHousing: "Find Housing",
    listProperty: "List Property",
    marketplaceLabel: "Student housing marketplace",
    popular: "Popular",
    students: "Students",
    landlords: "Landlords",
    support: "Support",
    company: "Company",
    trustFirst: "Trust first",
    trustFirstText:
      "Verification, reports, reviews, and safer communication tools.",
    supportReady: "Support ready",
    supportReadyText:
      "Students and landlords can contact support when they need help.",
    stayConnected: "Stay connected",
    stayConnectedText:
      "Notifications keep users updated on inquiries, messages, and viewings.",
    privacy: "Privacy",
    terms: "Terms",
    safety: "Safety",
  },

  fr: {
    ctaBadge: "Logement étudiant plus sécuritaire",
    ctaTitle: "Trouvez un logement étudiant fiable près du campus.",
    ctaText:
      "Travel Markets aide les étudiants à trouver des logements, communiquer avec les propriétaires, réserver des visites et protéger les adresses exactes jusqu’au bon moment.",
    findHousing: "Trouver un logement",
    listProperty: "Inscrire une propriété",
    marketplaceLabel: "Marché du logement étudiant",
    popular: "Populaire",
    students: "Étudiants",
    landlords: "Propriétaires",
    support: "Soutien",
    company: "Entreprise",
    trustFirst: "La confiance d’abord",
    trustFirstText:
      "Vérification, signalements, avis et outils de communication plus sûrs.",
    supportReady: "Soutien disponible",
    supportReadyText:
      "Les étudiants et propriétaires peuvent contacter le soutien au besoin.",
    stayConnected: "Restez informé",
    stayConnectedText:
      "Les notifications suivent les demandes, messages et visites.",
    privacy: "Confidentialité",
    terms: "Conditions",
    safety: "Sécurité",
  },
};
