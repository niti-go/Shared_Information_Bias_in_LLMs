import {
  MODERATOR_PROMPT_VARIANTS,
  getModeratorPromptTemplate,
} from "@/lib/sim/moderator";

export async function GET() {
  return Response.json({
    variants: MODERATOR_PROMPT_VARIANTS.map((v) => ({
      id: v.id,
      label: v.label,
      description: v.description,
      template: getModeratorPromptTemplate(v.id),
    })),
  });
}
