// Grounding context built from the seed, shared by eval and audio scripts. Runs under plain Node (type stripping).
import data from '../src/domain/seed-data.json' with { type: 'json' };

export const context = {
  products: data.products.map((p) => ({
    sku: p.sku,
    name: p.name,
    nameHi: p.nameHi,
    unit: p.unit,
    ...('aliases' in p && p.aliases ? { aliases: p.aliases } : {}),
  })),
  customers: data.customers.map((c) => c.name),
};

export const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
