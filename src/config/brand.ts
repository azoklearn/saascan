export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "SaaScan",
  tagline: "Le scanner d’idées de SaaS rentables.",
  description: "20 questions sur ta situation réelle. 3 idées de SaaS que tu peux lancer seul. Un prompt de construction et un plan sur 30 jours.",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  legalName: process.env.LEGAL_COMPANY_NAME || "",
  legalAddress: process.env.LEGAL_COMPANY_ADDRESS || "",
  legalRegistration: process.env.LEGAL_COMPANY_REGISTRATION || "",
  accent: "#00c2a0",
};
