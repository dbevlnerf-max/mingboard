import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";


const guildId =
  process.env.DISCORD_GUILD_ID!;

const zeusRoleId =
  process.env.DISCORD_ZEUS_ROLE_ID!;

const adminRoleId =
  process.env.DISCORD_ADMIN_ROLE_ID!;

const masterUserId =
  process.env.DISCORD_MASTER_USER_ID!;

const botToken =
  process.env.DISCORD_BOT_TOKEN!;


/* =========================================
   Discord 서버 멤버 정보 조회
========================================= */

async function getDiscordMember(
  userId: string
) {
  try {
    const response =
      await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
        {
          headers: {
            Authorization:
              `Bot ${botToken}`,
          },

          cache:
            "no-store",
        }
      );


    if (!response.ok) {
      console.error(
        "Discord member lookup failed:",
        response.status
      );

      return null;
    }


    return await response.json();

  } catch (error) {
    console.error(
      "Discord member lookup error:",
      error
    );

    return null;
  }
}


/* =========================================
   Auth.js
========================================= */

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({

  providers: [
    Discord({
      clientId:
        process.env.AUTH_DISCORD_ID!,

      clientSecret:
        process.env.AUTH_DISCORD_SECRET!,
    }),
  ],


  callbacks: {

    /* =====================================
       JWT 생성
    ===================================== */

    async jwt({
      token,
      account,
      profile,
    }) {

      if (
        account &&
        profile
      ) {

        const discordProfile =
          profile as {
            id?: string;
          };


        const discordId =
          String(
            discordProfile.id || ""
          );


        token.discordId =
          discordId;


        /* MASTER */

        token.isMaster =
          discordId ===
          masterUserId;


        /* Discord 서버 멤버 조회 */

        const member =
          await getDiscordMember(
            discordId
          );


        token.isGuildMember =
          Boolean(member);


        const roles:
          string[] =
          member &&
          Array.isArray(
            member.roles
          )
            ? member.roles
            : [];


        /* 제우스 역할 */

        token.hasZeusRole =
          roles.includes(
            zeusRoleId
          );


        /* 관리자 역할 */

        token.isAdmin =
          roles.includes(
            adminRoleId
          );


        /*
          마스터는 관리자 권한도 가짐.
          단, 웹 입장 자체는 제우스 역할이 있어야 함.
        */

        if (
          token.isMaster
        ) {
          token.isAdmin =
            true;
        }
      }


      return token;
    },


    /* =====================================
       Session에 권한 정보 전달
    ===================================== */

    async session({
      session,
      token,
    }) {

      if (
        session.user
      ) {

        session.user.discordId =
          String(
            token.discordId || ""
          );


        session.user.isGuildMember =
          Boolean(
            token.isGuildMember
          );


        session.user.hasZeusRole =
          Boolean(
            token.hasZeusRole
          );


        session.user.isAdmin =
          Boolean(
            token.isAdmin
          );


        session.user.isMaster =
          Boolean(
            token.isMaster
          );
      }


      return session;
    },
  },


  pages: {
    signIn: "/",
  },
});