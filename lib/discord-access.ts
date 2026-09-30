import type { DiscordAccess, Verification } from "./access-policy";

type Config = { guildId: string; zeusRoleId: string; adminRoleId: string; botToken: string };
const cooldowns = new Map<string, number>();

export async function verifyDiscordAccess(userId: string, config: Config): Promise<Verification<DiscordAccess>> {
  const now = Date.now();
  const retryAt = cooldowns.get(config.guildId) ?? 0;
  if (retryAt > now) return { verified: false, retryAt };
  if (!config.guildId || !config.botToken || !config.zeusRoleId) return { verified: false };
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${config.guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${config.botToken}` }, cache: "no-store", signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (response.status === 404 && data?.code === 10007) {
      return { verified: true, value: { isGuildMember: false, hasZeusRole: false, isAdmin: false } };
    }
    if (response.status === 429) {
      const seconds = Number(response.headers.get("Retry-After") || data?.retry_after || 10);
      const retryAt = now + (Number.isFinite(seconds) && seconds > 0 ? seconds : 10) * 1000;
      cooldowns.set(config.guildId, retryAt);
      return { verified: false, retryAt };
    }
    if (!response.ok || !data || !Array.isArray(data.roles)) {
      if (response.status === 401 || response.status === 403) cooldowns.set(config.guildId, now + 60000);
      console.error("Discord access verification unavailable:", response.status);
      return { verified: false, retryAt: cooldowns.get(config.guildId) };
    }
    return { verified: true, value: {
      isGuildMember: true,
      hasZeusRole: data.roles.includes(config.zeusRoleId),
      isAdmin: data.roles.includes(config.adminRoleId),
    } };
  } catch {
    console.error("Discord access verification temporarily unavailable");
    return { verified: false };
  } finally {
    clearTimeout(deadline);
  }
}
