import { auth } from "@/auth";
import { readSheet, sheetJson, sheetReadError } from "@/lib/sheet-read";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return sheetJson({ success: false, message: "로그인이 필요합니다." }, 401);
    }
    const user = session.user;
    if (!((user.isGuildMember && user.hasZeusRole) || user.isAdmin || user.isMaster)) {
      return sheetJson({
        success: false, message: "분배내역을 조회할 권한이 없습니다.",
      }, 403);
    }
    const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (!googleScriptUrl) {
      return sheetJson({
        success: false, retryable: false,
        message: "Google Script 주소가 설정되지 않았습니다.",
      }, 500);
    }
    const { searchParams } = new URL(request.url);
    const nickname = (searchParams.get("nickname") || "").trim();
    const params = new URLSearchParams({ action: nickname ? "search" : "distributionList" });
    if (nickname) {
      params.set("nickname", nickname);
    } else {
      for (const key of ["startDate", "endDate", "category", "sort", "page", "pageSize"]) {
        const value = (searchParams.get(key) || "").trim();
        if (value) params.set(key, value);
      }
    }
    const data = await readSheet(
      googleScriptUrl, params, request.signal, nickname ? "items" : "rows",
    );
    return sheetJson(data);
  } catch (error) {
    console.error("Distribution API Error:", error);
    return sheetReadError(error, "분배 데이터를 불러오지 못했습니다.");
  }
}
