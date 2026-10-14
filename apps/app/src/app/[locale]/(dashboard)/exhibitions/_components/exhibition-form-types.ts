import { z } from "zod";

export const exhibitionParticipantSchema = z
  .array(
    z.object({
      collectionId: z.string().min(1),
      role: z.enum(["featured", "participant"]),
    }),
  )
  .min(1)
  .refine(
    (participants) =>
      new Set(participants.map((participant) => participant.collectionId))
        .size === participants.length,
    "duplicate",
  )
  .refine(
    (participants) =>
      participants.filter((participant) => participant.role === "featured")
        .length <= 1,
    "featured",
  );

export interface ExhibitionFormData {
  title: string;
  location: string;
  startDate: Date;
  endDate: Date | undefined;
  isCurrent: boolean;
  isLoan: boolean;
  loanVenue: string;
  notes: string;
  participants: Array<{
    collectionId?: string;
    role: "featured" | "participant";
  }>;
}

export interface ExhibitionScheduleConflict {
  id: string;
  title: string;
  startDate: number;
  endDate?: number;
  status: string;
}
