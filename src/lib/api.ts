/**
 * API 호출 공용 헬퍼.
 *
 * fetch 후 곧바로 res.json() 을 호출하면, 서버가 내려가 있거나 라우트가 없을 때
 * 본문이 비어 있어 "Unexpected end of JSON input" 같은 원인을 알 수 없는 오류가 납니다.
 * 여기서 응답을 먼저 텍스트로 읽고 상황별로 해석 가능한 메시지를 던집니다.
 */
export async function fetchJson<T = any>(
  url: string,
  init?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error(
      `백엔드 서버에 연결할 수 없습니다. 터미널에서 'npm run dev' 로 서버(:3000)를 실행했는지 확인하세요. (${url})`
    );
  }

  const body = await res.text();

  if (body.trim() === '') {
    if (res.status === 404) {
      throw new Error(
        `API 경로를 찾을 수 없습니다 (404): ${url}\n` +
          `프론트엔드만 실행 중일 수 있습니다. 'npm run dev' 로 API가 포함된 서버를 실행하세요.`
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
    throw new Error(data?.error || `요청 실패 (HTTP ${res.status}): ${url}`);
  }

  return data as T;
}
