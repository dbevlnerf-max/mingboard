export class PortalRequestError extends Error {
  constructor(message: string, public retryable = true, public status = 0) {
    super(message);
    this.name = "PortalRequestError";
  }
}

type PortalResponse = { success: boolean; message?: string; retryable?: boolean };

// The deadline includes reading the body, not just receiving the headers.
export async function fetchPortalJson<T extends PortalResponse>(
  url: string,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    allowDomainFailure?: boolean;
    arrayField?: string;
  } = {},
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const deadline = setTimeout(abort, options.timeoutMs ?? 25000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    let data: T;
    try {
      data = await response.json();
    } catch {
      throw new PortalRequestError("응답을 읽지 못했습니다. 자동으로 다시 확인합니다.",
        response.status !== 401 && response.status !== 403, response.status);
    }
    if (!response.ok) {
      throw new PortalRequestError(
        data?.message || "데이터를 불러오지 못했습니다.",
        data?.retryable !== false &&
          (response.status >= 500 || [408, 425, 429].includes(response.status)),
        response.status,
      );
    }
    if (!data || typeof data.success !== "boolean") {
      throw new PortalRequestError("응답을 확인하고 있습니다. 잠시만 기다려주세요.");
    }
    if (!data.success && !options.allowDomainFailure) {
      throw new PortalRequestError(data.message || "데이터를 불러오지 못했습니다.", data.retryable !== false);
    }
    if (data.success && options.arrayField &&
        !Array.isArray((data as Record<string, unknown>)[options.arrayField])) {
      throw new PortalRequestError("응답을 확인하고 있습니다. 잠시만 기다려주세요.");
    }
    return data;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (controller.signal.aborted) {
      throw new PortalRequestError("응답이 늦어지고 있어 자동으로 다시 확인합니다.");
    }
    if (error instanceof PortalRequestError) throw error;
    throw new PortalRequestError("연결이 원활하지 않아 자동으로 다시 확인합니다.");
  } finally {
    clearTimeout(deadline);
    options.signal?.removeEventListener("abort", abort);
  }
}
