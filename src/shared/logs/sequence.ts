const LOG_SEQUENCE_PATTERN = /^SEQ:(\d+)/;

export function extractLogSequence(message: string): number | null {
  const sequenceMatch = message.match(LOG_SEQUENCE_PATTERN);
  if (!sequenceMatch) {
    return null;
  }

  const parsed = Number.parseInt(sequenceMatch[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}
