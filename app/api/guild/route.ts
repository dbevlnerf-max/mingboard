import { auth } from "@/auth";
import { readSheet, sheetJson, sheetReadError } from "@/lib/sheet-read";
import { includeUnreturnedGuilds, type RosterMember } from "@/lib/guild-roster";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (session?.user?.authVerificationPending) {
      return sheetJson({ success: false, retryable: true, code: "AUTH_CHECK_UNAVAILABLE",
        message: "인증 서버 연결을 다시 확인하고 있습니다." }, 503);
    }
    if (!session?.user?.isGuildMember || !session.user.hasZeusRole) {
      return sheetJson({
        success: false, message: "인증된 길드원만 이용할 수 있습니다.",
      }, 401);
    }
    const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (!googleScriptUrl) {
      return sheetJson({
        success: false, retryable: false,
        message: "Google Script 주소가 설정되지 않았습니다.",
      }, 500);
    }
    const data = await readSheet(
      googleScriptUrl, new URLSearchParams({ action: "guild" }), request.signal, "members",
      new URL(request.url).searchParams.get("fresh") === "1",
    );
    if (!data.success || !Array.isArray(data.members)) return sheetJson(data);

    const { members, supplementalUpdatedAt } = await includeUnreturnedGuilds(
      data.members as RosterMember[]
    );
    const count = (name: string) =>
      members.filter(member => member.guild === name).length;
    const jobs = [...new Set(members.map(member => member.job).filter(Boolean))].sort();

    return sheetJson({
      ...data,
      members,
      jobs,
      counts: {
        total: members.length,
        pink: count("핑뚝"),
        red: count("빨뚝"),
        black: count("검뚝"),
        teon: count("테온"),
        jigok: count("지옥소녀"),
        heaven: count("헤븐"),
      },
      supplementalUpdatedAt,
    });
  } catch (error) {
    console.error("Guild API Error:", error);
    return sheetReadError(error, "길드현황을 불러오지 못했습니다.");
  }
}
