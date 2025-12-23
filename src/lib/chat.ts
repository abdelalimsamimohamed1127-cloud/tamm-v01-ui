/**
 * Deprecated: UI chat streaming now uses Vercel AI SDK's `useChat` hook.
 * This helper intentionally throws to prevent new usage.
 */
export async function sendMessageToAgent(): Promise<never> {
  throw new Error('sendMessageToAgent is deprecated. Use useChat from ai/react instead.')
}
