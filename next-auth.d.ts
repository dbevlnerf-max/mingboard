import "next-auth";
import "next-auth/jwt";
import type { AccessClaims } from "@/lib/access-policy";

type SessionAccess = {
  discordId?: string;
  isGuildMember?: boolean;
  hasZeusRole?: boolean;
  hasActiveCharacterLink?: boolean;
  needsCharacterLink?: boolean;
  linkedGid?: string;
  characterStatus?: string;
  isAdmin?: boolean;
  isMaster?: boolean;
  authVerificationPending?: boolean;
  authDegraded?: boolean;
};

declare module "next-auth" {
  interface User extends SessionAccess {
    discordId?: string;
  }
  interface Session {
    user: SessionAccess & {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT extends AccessClaims {
    discordId?: string;
    isMaster?: boolean;
    needsCharacterLink?: boolean;
  }
}
