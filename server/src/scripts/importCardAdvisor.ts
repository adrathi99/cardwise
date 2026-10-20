/**
 * Import the CardAdvisor open dataset into the CARDWISE catalogue.
 *
 * Usage:
 *   npm --workspace server run import:cardadvisor
 *
 * Anonymous, no key required. Data: CardAdvisor — India Credit Card Facts,
 * CC BY 4.0 (https://cardadvisor.in/data). Attribution is stored on each row.
 */
import { migrate, get } from '../db.ts';
import { importFromCardAdvisor } from '../sources/import.ts';

migrate();

const result = await importFromCardAdvisor();

const counts = {
  issuers: get<{ c: number }>('SELECT COUNT(*) AS c FROM issuers')?.c,
  cards: get<{ c: number }>('SELECT COUNT(*) AS c FROM card_products')?.c,
  benefits: get<{ c: number }>('SELECT COUNT(*) AS c FROM benefits')?.c,
};

console.log(
  JSON.stringify(
    {
      imported: result,
      totals: counts,
    },
    null,
    2,
  ),
);
