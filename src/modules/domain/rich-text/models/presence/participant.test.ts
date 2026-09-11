import { describe, expect, it } from 'vitest';

import { parseEmail, parseUsername } from '../../../../auth';
import { anonymousParticipantName, uniqueParticipants } from './participant';

describe('anonymousParticipantName', () => {
  it('is a memorable lower-case name', () => {
    expect(anonymousParticipantName('seed')).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it('is the same for the same seed', () => {
    expect(anonymousParticipantName('seed')).toBe(
      anonymousParticipantName('seed')
    );
  });

  it('differs between seeds', () => {
    expect(anonymousParticipantName('one')).not.toBe(
      anonymousParticipantName('two')
    );
  });
});

describe('uniqueParticipants', () => {
  const alice = parseUsername('Alice');
  const bob = parseUsername('Bob');
  const aliceAtWork = parseEmail('alice@example.com');
  const aliceAtHome = parseEmail('alice@example.org');

  it('keeps the first of several windows of one person', () => {
    const withAvatar = {
      name: alice,
      email: aliceAtWork,
      avatarUrl: 'https://a/1',
    };
    const bobAnywhere = { name: bob, email: null, avatarUrl: null };

    expect(
      uniqueParticipants([
        withAvatar,
        bobAnywhere,
        { name: alice, email: aliceAtWork, avatarUrl: null },
      ])
    ).toEqual([withAvatar, bobAnywhere]);
  });

  it('keeps two people who share a name apart by their emails', () => {
    expect(
      uniqueParticipants([
        { name: alice, email: aliceAtWork, avatarUrl: null },
        { name: alice, email: aliceAtHome, avatarUrl: null },
      ])
    ).toHaveLength(2);
  });

  it('goes by name when a peer set no email', () => {
    expect(
      uniqueParticipants([
        { name: alice, email: aliceAtWork, avatarUrl: null },
        { name: alice, email: null, avatarUrl: null },
      ])
    ).toHaveLength(1);
  });
});
