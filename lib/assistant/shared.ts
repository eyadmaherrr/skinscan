// ======================================================
// ASSISTANT TYPES (same as drmahermahmoud.com's lib/assistant/shared.ts)
// ======================================================
//
// Replies carry FAQ text in both languages, so the widget can switch
// language mid-conversation without asking again.

export const MAX_MESSAGE_LENGTH = 500;

export type Localized = { en: string; ar: string };

export type EntryRef = { id: string; question: Localized };

export type EntryAnswer = EntryRef & {
  answer: Localized;
  /** See lib/assistant/links.ts. */
  link: string | null;
};

export type AssistantReply =
  | { kind: 'answer'; entry: EntryAnswer; related: EntryRef[] }
  | { kind: 'clarify'; options: EntryRef[] }
  | { kind: 'medical'; related: EntryRef[] }
  | { kind: 'fallback'; related: EntryRef[] }
  | { kind: 'greeting' }
  | { kind: 'thanks' };
