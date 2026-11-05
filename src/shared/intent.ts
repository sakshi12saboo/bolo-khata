import { z } from 'zod';

export const PaymentModeSchema = z.enum(['cash', 'upi', 'udhaar']);
export const QueryKindSchema = z.enum(['sales_today', 'customer_balance', 'low_stock']);

export const IntentItemSchema = z.object({
  name: z.string().min(1).max(80),
  sku: z.string().max(40).nullable(),
  qty: z.number().positive().max(10000),
  unit: z.string().max(12),
  amountRupees: z.number().positive().max(1_000_000).nullable(),
});
export type IntentItem = z.infer<typeof IntentItemSchema>;

export const IntentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('sale'),
    items: z.array(IntentItemSchema).min(1).max(40),
    customer: z.string().max(60).nullable(),
    paymentMode: PaymentModeSchema,
    /** money the customer handed over while buying, if said ("500 diye") */
    paidRupees: z.number().positive().max(1_000_000).nullable().optional(),
  }),
  z.object({
    kind: z.literal('payment'),
    customer: z.string().min(1).max(60),
    amount: z.number().positive().max(10_000_000),
  }),
  z.object({
    kind: z.literal('query'),
    query: QueryKindSchema,
    customer: z.string().max(60).nullable(),
  }),
  z.object({
    kind: z.literal('stock_add'),
    items: z.array(IntentItemSchema).min(1).max(40),
  }),
  z.object({ kind: z.literal('unknown') }),
]);
export type Intent = z.infer<typeof IntentSchema>;

export const ContextSchema = z.object({
  products: z
    .array(
      z.object({
        sku: z.string().max(40),
        name: z.string().max(80),
        nameHi: z.string().max(80).optional(),
        unit: z.string().max(12),
        aliases: z.array(z.string().max(40)).max(12).optional(),
      }),
    )
    .max(500),
  customers: z.array(z.string().max(60)).max(500),
});
export type UnderstandContext = z.infer<typeof ContextSchema>;

export const UnderstandRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(500).optional(),
    audio: z.string().min(16).optional(),
    mimeType: z
      .string()
      .regex(/^audio\/[a-z0-9.+-]+(;\s*codecs=[a-z0-9.,"-]+)?$/i)
      .optional(),
    context: ContextSchema,
  })
  .refine((r) => Boolean(r.text) !== Boolean(r.audio), {
    message: 'send exactly one of text or audio',
  })
  .refine((r) => !r.audio || Boolean(r.mimeType), { message: 'mimeType is required with audio' });
export type UnderstandRequest = z.infer<typeof UnderstandRequestSchema>;

export const UnderstandOkSchema = z.object({
  ok: z.literal(true),
  intent: IntentSchema,
  transcript: z.string(),
  language: z.string(),
});
export type UnderstandOk = z.infer<typeof UnderstandOkSchema>;
export type UnderstandResponse = UnderstandOk | { ok: false; error: string };
