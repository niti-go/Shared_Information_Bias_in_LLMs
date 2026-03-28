import { validateUIMessages, type UIMessage } from "ai";

export async function validateSimulationMessages(messages: UIMessage[]) {
  return validateUIMessages({ messages });
}
