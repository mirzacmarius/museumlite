import { z } from "zod";

/** Client checks mirroring the entry commands; the server rules still apply. */
const requiredText = z.string().trim().min(1);

const namedParty = z
  .object({ name: z.string(), accountId: z.string().optional() })
  .refine(
    (party) => party.name.trim().length > 0 || party.accountId !== undefined,
  );

export const receiveEntrySchema = z.object({
  title: requiredText,
  depositor: namedParty,
  receivedAt: z.date(),
  locationId: requiredText,
  conditionAtEntry: requiredText,
  responsibleUserId: requiredText,
});

export const recordExitSchema = z.object({
  recipient: namedParty,
  exitedAt: z.date(),
});

export const beginAcquisitionSchema = z.object({
  cost: z
    .string()
    .trim()
    .refine(
      (cost) =>
        cost === "" || (Number.isFinite(Number(cost)) && Number(cost) >= 0),
    ),
});

export const withdrawAcquisitionSchema = z.object({
  reason: requiredText.max(2000),
});
