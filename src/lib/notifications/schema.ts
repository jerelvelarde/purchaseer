import { z } from "zod";

export const notificationKindSchema = z.enum(["po.approved", "po.rejected"]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

export const notificationPayloadSchema = z.object({
  po_id: z.string().uuid(),
  po_number: z.string().min(1),
  project_id: z.string().uuid(),
  decision_note: z.string().optional(),
});
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
