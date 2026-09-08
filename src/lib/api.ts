/**
 * API 호출 공용 헬퍼.
 *
 * fetch 후 곧바로 res.json() 을 호출하면, 서버가 내려가 있거나 라우트가 없을 때
 * 본문이 비어 있어 "Unexpected end of JSON input" 같은 원인을 알 수 없는 오류가 납니다.
 * 여기서 응답을 먼저 텍스트로 읽고 상황별로 조치 방법까지 담은 메시지를 던집니다.
 */

const HOW_TO_RUN =
  "터미널에서 'npm run dev' 를 실행한 뒤 http://localhost:3000 으로 접속하세요.";

/**
 * 서버가 JSON 오류 응답을 돌려준 경우의 에러.
 * HTTP 상태와 본문을 함께 담으므로, 호출부에서 409(초안 저장 충돌) 같은
 * 특정 상황을 구분해 처리할 수 있습니다.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly payload: any;

  constructor(message: string, status: number, payload: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

/** 네트워크 단절 등으로 서버에 닿지 못한 경우 (요청이 전송되지 않음) */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new NetworkError(`백엔드 서버에 연결할 수 없습니다: ${url}\n${HOW_TO_RUN}`);
  }

  const body = await res.text();

  // 본문이 비어 있으면 대부분 API 서버가 없거나 닿지 않는 상황입니다.
  if (body.trim() === '') {
    if (res.status === 404) {
      throw new Error(
        `API 경로를 찾을 수 없습니다 (404): ${url}\n` +
          `프론트엔드만 실행 중입니다 (API 서버 미실행). ${HOW_TO_RUN}`
      );
    }
    if (res.status >= 500) {
      throw new Error(
        `API 서버에 연결하지 못했습니다 (HTTP ${res.status}): ${url}\n` +
          `백엔드(:3000)가 꺼져 있거나 아직 기동 중일 수 있습니다. ${HOW_TO_RUN}`
      );
    }
    throw new Error(`서버가 빈 응답을 반환했습니다 (HTTP ${res.status}): ${url}`);
  }

  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    const preview = body.slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(
      `서버가 JSON이 아닌 응답을 반환했습니다 (HTTP ${res.status}): ${url}\n응답: ${preview}`
    );
  }

  if (!res.ok || data?.success === false) {
    throw new ApiError(data?.error || `요청 실패 (HTTP ${res.status}): ${url}`, res.status, data);
  }

  return data as T;
}
