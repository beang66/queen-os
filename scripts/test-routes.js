async function runTests() {
  const endpoints = [
    'http://localhost:3000/api/health',
    'http://localhost:3000/api/pricing',
    'http://localhost:3000/api/pricing/fingerprint',
    'http://localhost:3000/api/quotes',
    'http://localhost:3000/api/drafts',
  ];

  for (const ep of endpoints) {
    const res = await fetch(ep);
    const json = await res.json();
    console.log(`[OK] ${ep} => status ${res.status}, hasData=${Boolean(json.data || json.count || json.status)}`);
  }

  // 기존 저장된 초안 상세 조회 (/api/drafts/:id)
  const draftsRes = await fetch('http://localhost:3000/api/drafts');
  const draftsJson = await draftsRes.json();
  const firstDraftId = draftsJson.data?.[0]?.id;

  if (firstDraftId) {
    const detailRes = await fetch(`http://localhost:3000/api/drafts/${firstDraftId}`);
    const detailJson = await detailRes.json();
    console.log(`[OK] GET /api/drafts/:id => status ${detailRes.status}, customer=${detailJson.data?.customerName}`);

    if (detailJson.data?.payload?.orderEntity) {
      const calcRes = await fetch('http://localhost:3000/api/quote/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderEntity: detailJson.data.payload.orderEntity,
        }),
      });
      const calcJson = await calcRes.json();
      console.log(`[OK] POST /api/quote/calculate => status ${calcRes.status}, grandTotal=${calcJson.data?.summary?.finalGrandTotal?.toLocaleString()}원`);
    }
  }
}

runTests().catch(console.error);
