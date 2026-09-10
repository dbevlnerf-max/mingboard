import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";


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
   활성 캐릭터 연결 조회
========================================= */

async function getActiveCharacterLink(
  discordId: string
) {
  try {
    const {
      data: link,
      error: linkError,
    } =
      await supabaseAdmin
        .from(
          "guild_member_discord_links"
        )
        .select(
          "gid"
        )
        .eq(
          "discord_id",
          discordId
        )
        .is(
          "revoked_at",
          null
        )
        .maybeSingle();


    if (
      linkError
    ) {
      throw linkError;
    }


    if (
      !link
    ) {
      return {
        active: false,
        gid: null,
        status: null,
      };
    }


    const {
      data: state,
      error: stateError,
    } =
      await supabaseAdmin
        .from(
          "guild_member_states"
        )
        .select(
          "status"
        )
        .eq(
          "gid",
          Number(
            link.gid
          )
        )
        .maybeSingle();


    if (
      stateError
    ) {
      throw stateError;
    }


    const status =
      String(
        state?.status ||
        "active"
      );


    return {
      active:
        status ===
        "active",
      gid:
        String(
          link.gid
        ),
      status,
    };

  } catch (error) {
    console.error(
      "Character access lookup error:",
      error
    );

    return {
      active: false,
      gid: null,
      status: "error",
    };
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
       JWT 생성 / 갱신
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


        token.discordId =
          String(
            discordProfile.id ||
            ""
          );
      }


      const discordId =
        String(
          token.discordId ||
          ""
        );


      if (
        !discordId
      ) {
        return token;
      }


      /* MASTER */

      token.isMaster =
        discordId ===
        masterUserId;


      /* Discord 서버 멤버/역할을 세션 접근 시 다시 확인 */

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


      /* 제우스 역할: 기존 의미 그대로 유지 */

      token.hasZeusRole =
        roles.includes(
          zeusRoleId
        );


      /* 관리자 역할 */

      token.isAdmin =
        roles.includes(
          adminRoleId
        );


      if (
        token.isMaster
      ) {
        token.isAdmin =
          true;
      }


      /* 활성 캐릭터 연결 */

      const characterAccess =
        await getActiveCharacterLink(
          discordId
        );


      token.hasActiveCharacterLink =
        characterAccess.active;

      token.linkedGid =
        characterAccess.gid ||
        undefined;

      token.characterStatus =
        characterAccess.status ||
        undefined;

      token.needsCharacterLink =
        Boolean(
          token.isGuildMember &&
          token.hasZeusRole &&
          !token.hasActiveCharacterLink &&
          !token.isMaster
        );


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
            token.discordId ||
            ""
          );


        session.user.isGuildMember =
          Boolean(
            token.isGuildMember
          );


        session.user.hasZeusRole =
          Boolean(
            token.hasZeusRole
          );


        session.user.hasActiveCharacterLink =
          Boolean(
            token.hasActiveCharacterLink
          );


        session.user.needsCharacterLink =
          Boolean(
            token.needsCharacterLink
          );


        session.user.linkedGid =
          token.linkedGid
            ? String(
                token.linkedGid
              )
            : undefined;


        session.user.characterStatus =
          token.characterStatus
            ? String(
                token.characterStatus
              )
            : undefined;


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
