import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { z } from 'zod';

import {
  type Email,
  parseEmail,
  parseUsername,
  type Username,
} from '../../../../auth';

// Peers name their own avatar image; only images from here are shown.
const TRUSTED_AVATAR_ORIGIN = 'https://avatars.githubusercontent.com';

const trustedAvatarUrl = (url: string | null): string | null => {
  if (url === null) return null;

  try {
    return new URL(url).origin === TRUSTED_AVATAR_ORIGIN ? url : null;
  } catch {
    return null;
  }
};

// A malformed email leaves the peer identified by name, like one without.
const emailOrNull = (email: string | null): Email | null => {
  if (email === null) return null;

  try {
    return parseEmail(email);
  } catch {
    return null;
  }
};

// Who a peer is, as they present themselves: read from whatever they sent,
// since anyone holding a document's link can say anything.
export const participantSchema = z.object({
  name: z.string().trim().min(1).max(100).transform(parseUsername),
  email: z.string().max(320).nullable().transform(emailOrNull),
  avatarUrl: z.string().max(2_000).nullable().transform(trustedAvatarUrl),
});

export type Participant = z.infer<typeof participantSchema>;

// A memorable stand-in for a peer who set no name, stable for a given seed.
export const anonymousParticipantName = (seed: string): Username =>
  parseUsername(
    uniqueNamesGenerator({
      dictionaries: [adjectives, animals],
      separator: '-',
      style: 'lowerCase',
      seed,
    })
  );

export const isSamePerson = (a: Participant, b: Participant) => {
  const bothHaveEmail = a.email && b.email;

  return bothHaveEmail ? a.email === b.email : a.name === b.name;
};

export const uniqueParticipants = (
  participants: ReadonlyArray<Participant>
): Participant[] =>
  participants.reduce<Participant[]>(
    (unique, participant) =>
      unique.some((seen) => isSamePerson(seen, participant))
        ? unique
        : [...unique, participant],
    []
  );
