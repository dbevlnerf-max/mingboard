import "next-auth";
import "next-auth/jwt";


declare module "next-auth" {

  interface User {
    discordId?: string;

    isGuildMember?: boolean;

    hasZeusRole?: boolean;

    isAdmin?: boolean;

    isMaster?: boolean;
  }


  interface Session {

    user: {
      name?: string | null;

      email?: string | null;

      image?: string | null;

      discordId?: string;

      isGuildMember?: boolean;

      hasZeusRole?: boolean;

      isAdmin?: boolean;

      isMaster?: boolean;
    };
  }
}


declare module "next-auth/jwt" {

  interface JWT {

    discordId?: string;

    isGuildMember?: boolean;

    hasZeusRole?: boolean;

    isAdmin?: boolean;

    isMaster?: boolean;
  }
}