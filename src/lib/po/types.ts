import { z } from "zod";

export const LineItemInput = z.object({
  description: z.string().min(1).max(500),
  qty: z.number().nonnegative(),
  unit_price_centavos: z.number().int().nonnegative(),
});

export const CreatePOInput = z.object({
  workspace_id: z.string().uuid(),
  project_id: z.string().uuid(),
  supplier_name: z.string().min(1).max(200),
  note: z.string().max(2000).optional().nullable(),
  line_items: z.array(LineItemInput).default([]),
});

export const UpdatePOInput = z.object({
  supplier_name: z.string().min(1).max(200).optional(),
  note: z.string().max(2000).nullable().optional(),
  line_items: z.array(LineItemInput).optional(),
});

export const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export type AllowedAttachmentType = (typeof ALLOWED_ATTACHMENT_TYPES)[number];
