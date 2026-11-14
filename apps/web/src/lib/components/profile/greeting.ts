/**
 * Greeting validation (DESIGN §3.6): the greeting opens every new agent
 * dialog and must be question-free — any `?` (ASCII) or full-width `？`
 * blocks saving client-side; a server 400 is surfaced with the same copy.
 */
export function containsQuestionMark(text: string): boolean {
  return text.includes('?') || text.includes('？');
}
