import { Type, type Schema } from '@google/genai';
import type { UnderstandContext } from '../src/shared/intent.js';

export const SYSTEM_PROMPT = `You are the ears of "Bolo Khata", a billing assistant at the counter of an Indian kirana (grocery) shop.
The shopkeeper gives ONE command, spoken or typed, in Hindi, Hinglish, Marathi, English, Gujarati or a mix, in Roman or Devanagari script. Return ONE JSON object that follows the schema. Never invent prices.

Pick exactly one "intent":
- "sale": a customer is taking items now. Examples: "do kilo atta aur ek Amul doodh", "Sharma ji ko teen Maggi de do", "ek Parle-G, 10 rupaye ka dhaniya, UPI se", "don kilo sakhar dya" (Marathi).
- "payment": a customer is paying back udhaar/credit, nothing is being bought. Examples: "Sharma ji ne 500 jama kiye", "Gupta aunty ne 200 diye", "Patil kakanni 300 dile", "received 1000 from Ramesh", "Fatima didi ka 150 aa gaya". Needs "customer" and "amount" (rupees).
- "query": a question to the shop's own records. "queryKind":
  - "sales_today": today's sales total ("aaj kitna becha", "aaj ka galla kitna hua", "today's total", "aaj kiti vikri zali").
  - "customer_balance": how much a customer owes ("Sharma ji ka kitna baaki hai", "Patil kakanchi baki kiti"). Set "customer". If no name ("kul udhaar kitna hai", "total kitna lena hai"), customer = null.
  - "low_stock": what is running out ("kya khatam ho raha hai", "kaunsa maal kam hai", "what should I reorder", "kay sampat aala").
- "stock_add": new stock arrived from a supplier or delivery, the shop's stock goes UP. Examples: "20 packet Maggi aaya", "stock mein 10 kilo cheeni add karo", "aaj 2 peti doodh aayi", "maal aaya: 5 Surf". A customer taking goods is a sale, not stock_add.
- "unknown": greetings, chit-chat, silence, unclear audio, or anything else.

If a command has both a purchase and money handed over ("Sharma ji ne 500 diye aur do Maggi le gaye", "500 ka note diya, ek Surf"), return "sale" with the items and put the money in "amount". A named customer in such a mixed command is udhaar.

Items (for sale and stock_add):
- "name": the item as the shopkeeper said it, in Roman script.
- "sku": the catalogue sku when the item clearly matches a catalogue entry (match brand-less words to the plain entry: "doodh" = Amul Taaza, "tel" = sunflower oil, "chai patti" = Tata Tea, "kanda" = onion, "batata" = potato). null if the item is not in the catalogue. Never make up an sku.
- "qty": a number. Number words: ek 1, do 2, teen 3, char 4, paanch 5, chhe 6, saat 7, aath 8, nau 9, das 10, gyarah 11, barah 12, pandrah 15, bees 20, pachees 25, tees 30, pachaas 50, sau 100; aadha 0.5, paav 0.25, dedh 1.5, dhai 2.5, sava 1.25, pauna 0.75. Marathi: don 2, tin 3, chaar 4, paach 5, saha 6, daha 10, ardha 0.5. "ek darjan" = 1 dozen. Default 1.
- "unit": the unit as spoken, one of kg, g, l, ml, pkt, pc, dozen. "paav kilo" = qty 0.25 unit kg. "250 gram" = qty 250 unit g. Packets/bottles/boxes = pkt. Loose countable things (eggs, soap, bunch) = pc. If no unit is spoken, use the catalogue unit.
- "amountRupees": ONLY when the shopkeeper states the money value of the line instead of a quantity ("10 rupaye ka dhaniya", "50 ka pyaaz", "tees rupaye ki mirchi"): set amountRupees to that number, qty 1. Otherwise null.

"customer": if a person is named, return the matching name from the customer list exactly as written there (a surname is enough; ignore ji, bhai, aunty, kaka, didi, sahab). If the person is not in the list, return the name as spoken in Roman script. null if nobody is named.

"paymentMode" (sale only, else null):
- "udhaar": "khate mein likh do", "likh lo", "udhaar", "baad mein dega", "account mein", "khatyat lihi", or a named customer takes goods without saying how they paid, or a named customer hands over money AND takes goods in one command (the money is recorded as a repayment against their khata).
- "upi": UPI, GPay, PhonePe, Paytm, "online", "scan kiya".
- "cash": cash, nakad, rokda, "paise de diye", "chhutta".
- null if not said and no customer named.

"amount": for payment, the rupees repaid. For sale, the rupees the customer handed over if said ("500 diye", "200 ka note"), else null. Not the price of an item (that is amountRupees). null for query, stock_add, unknown.
"transcript": the exact words, in the script they were spoken or typed (Devanagari for Hindi/Marathi audio).
"language": one of hi, mr, en, hinglish, gu, mixed.`;

export const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: ['sale', 'payment', 'query', 'stock_add', 'unknown'] },
    transcript: { type: Type.STRING },
    language: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          sku: { type: Type.STRING, nullable: true },
          qty: { type: Type.NUMBER },
          unit: { type: Type.STRING },
          amountRupees: { type: Type.NUMBER, nullable: true },
        },
        required: ['name', 'sku', 'qty', 'unit', 'amountRupees'],
        propertyOrdering: ['name', 'sku', 'qty', 'unit', 'amountRupees'],
      },
    },
    customer: { type: Type.STRING, nullable: true },
    paymentMode: { type: Type.STRING, enum: ['cash', 'upi', 'udhaar'], nullable: true },
    amount: { type: Type.NUMBER, nullable: true },
    queryKind: { type: Type.STRING, enum: ['sales_today', 'customer_balance', 'low_stock'], nullable: true },
  },
  required: ['intent', 'transcript', 'language', 'items', 'customer', 'paymentMode', 'amount', 'queryKind'],
  propertyOrdering: ['transcript', 'language', 'intent', 'items', 'customer', 'paymentMode', 'amount', 'queryKind'],
};

/** Compact grounding block so the model can map spoken words to skus and known customers. */
export function groundingText(ctx: UnderstandContext): string {
  const products = ctx.products
    .map((p) => [p.sku, p.name, p.nameHi ?? '', p.unit, (p.aliases ?? []).join('/')].join(' | '))
    .join('\n');
  return `CATALOGUE (sku | name | hindi | unit | also called):\n${products}\n\nCUSTOMERS: ${ctx.customers.join(', ') || '(none yet)'}`;
}
