import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../../samples');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

interface Row { day: number; desc: string; amount: number; cr?: boolean }

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const TEMPLATES: Row[][] = [
  [
    { day: 2, desc: 'AMAZON INDIA MARKETPLACE REF 8821345', amount: 4999 },
    { day: 5, desc: 'SWIGGY INSTAMART BANGALORE', amount: 1245.5 },
    { day: 7, desc: 'BIGBASKET GROCERY RRN 558899', amount: 3210.75 },
    { day: 9, desc: 'HP PETROL PUMP JP NAGAR', amount: 2000 },
    { day: 12, desc: 'NETFLIX ENTERTAINMENT SERVICES', amount: 649 },
    { day: 15, desc: 'AIRTEL POSTPAID BILL', amount: 999 },
    { day: 18, desc: 'MAKEMYTRIP FLIGHT BOOKING', amount: 12450 },
    { day: 20, desc: 'TATA POWER ELECTRICITY BILL', amount: 2340 },
    { day: 22, desc: 'SWIGGY ORDER 4471', amount: 780 },
    { day: 25, desc: 'PAYMENT RECEIVED - THANK YOU', amount: 5000, cr: true },
    { day: 28, desc: 'FLIPKART INTERNET PRIVATE LTD', amount: 6799 },
    { day: 30, desc: 'LATE PAYMENT CHARGES', amount: 500 },
  ],
  [
    { day: 3, desc: 'ZOMATO ORDER 99120', amount: 560 },
    { day: 6, desc: 'MYNTRA DESIGNS PVT LTD', amount: 3499 },
    { day: 10, desc: 'INDIAN OIL PETROL STATION', amount: 1500 },
    { day: 14, desc: 'REFUND AMAZON INDIA MARKETPLACE', amount: 1299, cr: true },
    { day: 18, desc: 'OYO ROOMS HOTEL BOOKING', amount: 4200 },
    { day: 21, desc: 'LIC INSURANCE PREMIUM', amount: 5000 },
    { day: 25, desc: 'AMAZON PAY BILL PAYMENT', amount: 1899 },
    { day: 29, desc: 'PAYMENT RECEIVED - THANK YOU', amount: 12000, cr: true },
  ],
  [
    { day: 2, desc: 'SWIGGY ORDER 51209', amount: 890 },
    { day: 5, desc: 'BIGBASKET GROCERY RRN 771200', amount: 4120 },
    { day: 9, desc: 'VISTARA AIR TICKETING', amount: 9800 },
    { day: 12, desc: 'CROMA STORE ELECTRONICS', amount: 15999 },
    { day: 18, desc: 'JIO POSTPAID RECHARGE', amount: 599 },
    { day: 22, desc: 'DMART READY RETAIL', amount: 3750 },
    { day: 28, desc: 'PAYMENT RECEIVED - THANK YOU', amount: 20000, cr: true },
  ],
];

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const now = new Date();
const monthsBack = [2, 1, 0];

let index = 0;
for (const back of monthsBack) {
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0));
  const stmtDate = new Date(Date.UTC(y, m + 1, 5));
  const rows = TEMPLATES[index % TEMPLATES.length]!;
  index++;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const page = doc.addPage([612, 792]);
  const header = [
    'HDFC Bank Credit Card Statement',
    'Card Number: XXXX XXXX XXXX 4321',
    `Statement Period: ${fmt(start)} to ${fmt(end)}`,
    `Statement Date: ${fmt(stmtDate)}`,
    '',
    'Date        Transaction Description                         Amount',
    '--------------------------------------------------------------------------',
  ];
  const txnLines = rows.map((r) => {
    const date = `${pad(r.day)}/${pad(m + 1)}/${y}`;
    return `${date}  ${r.desc.padEnd(46).slice(0, 46)}  ${money(r.amount)}${r.cr ? ' Cr' : ''}`;
  });
  const total = rows.filter((r) => !r.cr).reduce((a, r) => a + r.amount, 0);
  const footer = ['--------------------------------------------------------------------------', `Total Amount Due: ${money(total)}`, 'Minimum Amount Due: 5,000.00'];
  const lines = [...header, ...txnLines, ...footer];

  let yPos = 740;
  for (const line of lines) {
    page.drawText(line, { x: 40, y: yPos, size: 9, font });
    yPos -= 14;
  }

  const bytes = await doc.save();
  const file = path.join(outDir, `sample-statement-${MONTH_NAMES[m]}-${y}.pdf`);
  fs.writeFileSync(file, bytes);
  console.log('wrote', file);
}
