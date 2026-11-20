import React from 'react';
import { AlertCircle, ArrowRight, FileClock, FilePlus2, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QuoteDocument, QuoteDraftSummary } from '../types';

export const STEP_LABELS: Record<number, string> = {
  1: '자료 입력',
  2: '규격 검수',
  3: '원가 계산',
  4: '견적서 발행',
};

export function recentByUpdatedAt<T extends { updatedAt: string }>(items: T[], limit = 5): T[] {
  return [...items]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

interface WorkOverviewProps {
  quotes: QuoteDocument[];
  drafts: QuoteDraftSummary[];
  loading: boolean;
  error: string | null;
  canEditQuotes: boolean;
  canSeeCost: boolean;
  onRetry: () => void;
}

const date = (value: string) => new Date(value).toLocaleDateString('ko-KR');
const won = (value: number) => `₩${Math.round(value).toLocaleString('ko-KR')}`;

export const WorkOverview: React.FC<WorkOverviewProps> = ({
  quotes,
  drafts,
  loading,
  error,
  canEditQuotes,
  canSeeCost,
  onRetry,
}) => {
  const activeDrafts = recentByUpdatedAt(drafts.filter((draft) => draft.status === 'ACTIVE'));
  const recentQuotes = recentByUpdatedAt(quotes);

  return (
    <div className="work-overview space-y-8">
      <section className="overview-hero">
        <div>
          <p className="overview-kicker">오늘의 견적 업무</p>
          <h1>멈춘 곳에서 바로 이어가세요.</h1>
          <p>작성 중인 초안과 최근 발행 견적을 실제 저장 데이터 기준으로 보여드립니다.</p>
        </div>
        {canEditQuotes && (
          <Link to="/wizard" className="primary-action">
            <FilePlus2 aria-hidden="true" /> 새 견적 작성
          </Link>
        )}
      </section>

      {error && (
        <section className="state-panel error-state" role="alert">
          <AlertCircle aria-hidden="true" />
          <div><strong>업무 현황을 불러오지 못했습니다.</strong><p>{error}</p></div>
          <button type="button" onClick={onRetry}><RefreshCw aria-hidden="true" /> 다시 불러오기</button>
        </section>
      )}

      {!error && loading && (
        <section className="state-panel" aria-live="polite">
          <Loader2 className="animate-spin" aria-hidden="true" /> 업무 현황을 불러오는 중입니다.
        </section>
      )}

      {!error && !loading && (
        <>
          <section aria-labelledby="draft-heading">
            <div className="section-heading">
              <div><span>{activeDrafts.length}건</span><h2 id="draft-heading">이어서 할 견적</h2></div>
              <Link to="/history">초안 전체 보기 <ArrowRight aria-hidden="true" /></Link>
            </div>
            {activeDrafts.length === 0 ? (
              <div className="empty-panel">
                <FileClock aria-hidden="true" />
                <div><strong>작성 중인 초안이 없습니다.</strong><p>{canEditQuotes ? '새 견적을 만들면 자동 저장된 작업이 여기에 표시됩니다.' : '현재 이어서 확인할 초안이 없습니다.'}</p></div>
                {canEditQuotes && <Link to="/wizard">새 견적 작성</Link>}
              </div>
            ) : (
              <div className="work-list">
                {activeDrafts.map((draft) => (
                  <article key={draft.id}>
                    <div className="work-list-main">
                      <span className="step-badge">{STEP_LABELS[draft.step]}</span>
                      <h3>{draft.customerName || '고객 미지정'}{draft.projectName ? ` · ${draft.projectName}` : ''}</h3>
                      <p>{draft.quoteTitle} · 품목 {draft.itemCount}건 · {date(draft.updatedAt)} 수정</p>
                    </div>
                    {canEditQuotes && <Link to={`/wizard?draftId=${draft.id}`}>이어서 작성 <ArrowRight aria-hidden="true" /></Link>}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="recent-heading">
            <div className="section-heading">
              <div><span>{quotes.length}건</span><h2 id="recent-heading">최근 견적</h2></div>
              <Link to="/history">견적 관리 <ArrowRight aria-hidden="true" /></Link>
            </div>
            {recentQuotes.length === 0 ? (
              <div className="empty-panel"><div><strong>발행된 견적이 없습니다.</strong><p>발행을 완료한 견적이 날짜순으로 표시됩니다.</p></div></div>
            ) : (
              <div className="recent-table" role="region" aria-label="최근 견적" tabIndex={0}>
                <table>
                  <thead><tr><th>견적번호</th><th>고객 / 견적명</th><th>상태</th><th>최종 금액</th><th>수정일</th></tr></thead>
                  <tbody>{recentQuotes.map((quote) => (
                    <tr key={quote.id}>
                      <td><Link to={`/quotes/${quote.id}`}>{quote.quoteNumber}</Link></td>
                      <td><strong>{quote.orderEntity.customerName || '고객 미지정'}</strong><span>{quote.title}</span></td>
                      <td>{quote.status}</td>
                      <td>{canSeeCost ? won(quote.calculationResult.summary.finalGrandTotal) : '권한 없음'}</td>
                      <td>{date(quote.updatedAt)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
