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
  action: z.enum(["message", "cast_vote"]),
  cast_vote: castVoteSchema.optional(),
});

export const moderatorDecisionSchema = z.object({
  shouldIntervene: z.boolean(),
  reasoning: z.string().min(1),
  interventionType: z.enum([
    "ask_for_unique_info",
    "flag_premature_convergence",
    "probe_discussion",
    "none",
  ]),
  message: z.string().optional(),
});

export type SimulationTurnResult = z.infer<typeof simulationTurnSchema>;
export type ModeratorDecision = z.infer<typeof moderatorDecisionSchema>;

