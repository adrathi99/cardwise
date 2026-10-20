import { migrate, get } from '../db.ts';
import { ensureDefaultProfile, seedCatalog, seedMerchantRules } from '../seed/index.ts';

migrate();
const profile = ensureDefaultProfile();
const cards = seedCatalog();
const rules = seedMerchantRules();
const counts = {
  issuers: get<{ c: number }>('SELECT COUNT(*) AS c FROM issuers')?.c,
  cards: get<{ c: number }>('SELECT COUNT(*) AS c FROM card_products')?.c,
  benefits: get<{ c: number }>('SELECT COUNT(*) AS c FROM benefits')?.c,
  rules: get<{ c: number }>('SELECT COUNT(*) AS c FROM merchant_rules')?.c,
};
console.log(JSON.stringify({ profile, seededCards: cards.cards, seededBenefits: cards.benefits, seededRules: rules, counts }, null, 2));
