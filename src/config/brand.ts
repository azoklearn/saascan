export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "SaaScan",
  tagline: "Le radar des SaaS qui marchent.",
  description: "5 questions sur votre situation. 3 idées de SaaS à lancer seul, un prompt de construction et un plan sur 30 jours.",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  legalName: process.env.LEGAL_COMPANY_NAME || "",
  legalAddress: process.env.LEGAL_COMPANY_ADDRESS || "",
  legalRegistration: process.env.LEGAL_COMPANY_REGISTRATION || "",
  accent: "#00c2a0",
};
