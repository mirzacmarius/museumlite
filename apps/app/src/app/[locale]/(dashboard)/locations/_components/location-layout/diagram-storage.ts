import { z } from "zod";

const diagramStateSchema = z.object({
  viewport: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
      zoom: z.number().min(0.1).max(1.6),
    })
    .optional(),
  collapsed: z.array(z.string()).optional(),
  direction: z.enum(["horizontal", "vertical"]).optional(),
  items: z.enum(["list", "grid"]).optional(),
  size: z.enum(["small", "large"]).optional(),
  spacing: z.enum(["compact", "comfortable"]).optional(),
  lines: z.enum(["smoothstep", "default", "straight"]).optional(),
});
export type SavedDiagramState = z.infer<typeof diagramStateSchema>;

export function readDiagramState(key: string): SavedDiagramState {
  try {
    const parsed = diagramStateSchema.safeParse(
      JSON.parse(localStorage.getItem(key) ?? "{}"),
    );
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function saveDiagramState(key: string, patch: SavedDiagramState) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ ...readDiagramState(key), ...patch }),
    );
  } catch {
    // Storage may be unavailable in private browsing; the diagram still works.
  }
}
