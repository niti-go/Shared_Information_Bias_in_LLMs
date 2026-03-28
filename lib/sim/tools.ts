import { z } from "zod";

export const castVoteSchema = z.object({
  option: z.string().min(1),
  rationale: z.string().min(1),
});

export const revealUniqueClueSchema = z.object({
  clue: z.string().min(1),
});

export const simulationTurnSchema = z.object({
  message: z.string().min(1),
  action: z.enum(["message", "reveal_unique_clue", "cast_vote"]),
  reveal_unique_clue: revealUniqueClueSchema.optional(),
  cast_vote: castVoteSchema.optional(),
});

export type SimulationTurnResult = z.infer<typeof simulationTurnSchema>;
