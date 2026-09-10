import type { Request, Response } from 'express';
import { z } from 'zod';

/**
 * 요청 본문 검증 헬퍼.
 *
 * 검증에 실패하면 400 과 함께 "어느 필드가 왜 잘못됐는지"를 한국어로 돌려줍니다.
 * 기존에는 `if (!orderEntity)` 수준이라, 치수에 문자열이 들어오거나 필드가 통째로
 * 빠져도 계산 단계까지 흘러가 엉뚱한 곳에서 터졌습니다.
 */

/** zod 오류를 사람이 읽을 수 있는 한 줄들로 바꾼다. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(본문)';
    return `${path}: ${issue.message}`;
  });
}

/**
 * 검증 성공 시 파싱된 값을, 실패 시 null 을 돌려주고 응답까지 보냅니다.
 *
 * 사용법:
 *   const body = parseBody(SaveDraftSchema, req, res);
 *   if (!body) return;            // 이미 400 응답이 나간 상태
 */
export function parseBody<T extends z.ZodType>(
  schema: T,
  req: Request,
  res: Response
): z.infer<T> | null {
  const result = schema.safeParse(req.body);
  if (result.success) return result.data;

  const details = formatIssues(result.error);
  res.status(400).json({
    success: false,
    error: `요청 값이 올바르지 않습니다. ${details[0]}`,
    details,
  });
  return null;
}

/** 쿼리스트링 검증. 본문과 동일하게 동작합니다. */
export function parseQuery<T extends z.ZodType>(
  schema: T,
  req: Request,
  res: Response
): z.infer<T> | null {
  const result = schema.safeParse(req.query);
  if (result.success) return result.data;

  const details = formatIssues(result.error);
  res.status(400).json({
    success: false,
    error: `요청 값이 올바르지 않습니다. ${details[0]}`,
    details,
  });
  return null;
}
