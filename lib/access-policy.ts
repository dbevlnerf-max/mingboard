export type AccessClaims = {
  isGuildMember?: boolean;
  hasZeusRole?: boolean;
  isAdmin?: boolean;
  hasActiveCharacterLink?: boolean;
  linkedGid?: string;
  characterStatus?: string;
  discordVerifiedAt?: number;
  characterVerifiedAt?: number;
  accessRetryAt?: number;
  accessContext?: string;
  authVerificationPending?: boolean;
  authDegraded?: boolean;
};

export type Verification<T> =
  | { verified: true; value: T }
  | { verified: false; retryAt?: number };

export type DiscordAccess = { isGuildMember: boolean; hasZeusRole: boolean; isAdmin: boolean };
export type CharacterAccess = { active: boolean; gid: string | null; status: string | null };

const freshMs = 60000;
const graceMs = 5 * 60000;

function recent(time: number | undefined, now: number, limit: number) {
  return typeof time === "number" && time > 0 && time <= now && now - time < limit;
}

export function canReuseAccess(claims: AccessClaims, context: string, now: number) {
  if (claims.accessContext !== context) return false;
  if (!claims.authVerificationPending && !claims.authDegraded &&
      recent(claims.discordVerifiedAt, now, freshMs) &&
      recent(claims.characterVerifiedAt, now, freshMs)) return true;
  return Boolean(claims.accessRetryAt && now < claims.accessRetryAt);
}

export function mergeVerifiedAccess(
  previous: AccessClaims,
  discord: Verification<DiscordAccess>,
  character: Verification<CharacterAccess>,
  context: string,
  isMaster: boolean,
  now: number,
): AccessClaims {
  const sameContext = previous.accessContext === context;
  const discordGrace = sameContext && recent(previous.discordVerifiedAt, now, graceMs);
  const characterGrace = sameContext && recent(previous.characterVerifiedAt, now, graceMs);
  const next: AccessClaims = { ...previous, accessContext: context };
  if (discord.verified) {
    Object.assign(next, discord.value, { discordVerifiedAt: now });
  } else if (!discordGrace) {
    Object.assign(next, { isGuildMember: false, hasZeusRole: false, isAdmin: false });
  }
  if (character.verified) {
    Object.assign(next, {
      hasActiveCharacterLink: character.value.active,
      linkedGid: character.value.gid ?? undefined,
      characterStatus: character.value.status ?? undefined,
      characterVerifiedAt: now,
    });
  } else if (!characterGrace) {
    Object.assign(next, {
      hasActiveCharacterLink: false, linkedGid: undefined, characterStatus: undefined,
    });
  }
  const needsCharacter = next.isGuildMember && next.hasZeusRole && !isMaster;
  next.authVerificationPending = (!discord.verified && !discordGrace) ||
    Boolean(needsCharacter && !character.verified && !characterGrace);
  next.authDegraded = !discord.verified || !character.verified;
  next.accessRetryAt = next.authDegraded ? Math.max(
    now + 10000,
    !discord.verified ? discord.retryAt ?? 0 : 0,
    !character.verified ? character.retryAt ?? 0 : 0,
  ) : undefined;
  // Expired verified history must never become a new grant on the next request.
  return next;
}

export function reuseAccess(claims: AccessClaims, context: string, isMaster: boolean, now: number) {
  const result = mergeVerifiedAccess(claims, { verified: false, retryAt: claims.accessRetryAt },
    { verified: false, retryAt: claims.accessRetryAt }, context, isMaster, now);
  result.accessRetryAt = claims.accessRetryAt;
  return result;
}
