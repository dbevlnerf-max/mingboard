const guildId =
  process.env.DISCORD_GUILD_ID || "";

const zeusRoleId =
  process.env.DISCORD_ZEUS_ROLE_ID || "";

const botToken =
  process.env.DISCORD_BOT_TOKEN || "";


export type DiscordRoleRemovalResult = {
  discordId: string;
  success: boolean;
  alreadyGone: boolean;
  status: number | null;
  message: string;
};


export async function removeZeusRole(
  discordId: string
): Promise<DiscordRoleRemovalResult> {

  if (
    !guildId ||
    !zeusRoleId ||
    !botToken
  ) {
    return {
      discordId,
      success: false,
      alreadyGone: false,
      status: null,
      message:
        "Discord 역할 회수 환경변수가 설정되지 않았습니다.",
    };
  }


  try {
    const response =
      await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${zeusRoleId}`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              `Bot ${botToken}`,
          },
          cache: "no-store",
        }
      );


    if (
      response.status ===
      204
    ) {
      return {
        discordId,
        success: true,
        alreadyGone: false,
        status: 204,
        message:
          "제우스 역할을 회수했습니다.",
      };
    }


    if (
      response.status ===
      404
    ) {
      return {
        discordId,
        success: true,
        alreadyGone: true,
        status: 404,
        message:
          "Discord 서버에 없는 계정입니다.",
      };
    }


    const text =
      await response.text();


    return {
      discordId,
      success: false,
      alreadyGone: false,
      status: response.status,
      message:
        text ||
        `Discord 역할 회수 실패 (${response.status})`,
    };

  } catch (
    error
  ) {
    return {
      discordId,
      success: false,
      alreadyGone: false,
      status: null,
      message:
        error instanceof Error
          ? error.message
          : "Discord 역할 회수 중 오류가 발생했습니다.",
    };
  }
}
