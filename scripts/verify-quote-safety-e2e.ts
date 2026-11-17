import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
const url=process.env.DATABASE_URL||'';
assert(url.includes('@127.0.0.1:55437/queen_os_ponytail_20261116'), 'ABORT unsafe DB');
process.env.VERCEL='1';
process.env.DEMO_AUTO_LOGIN='true'; // disposable localhost only
const { default: app } = await import('../server.ts');
const { PRESET_ORDER_ENTITIES } = await import('../src/data/presetOrderEntities.ts');
const { createSessionToken, hashSessionToken, hashPassword } = await import('../server/auth.ts');
const srv=app.listen(0,'127.0.0.1');
await new Promise<void>(r=>srv.once('listening',r));
const addr=srv.address();
if(!addr||typeof addr==='string')throw Error('no address');
const base='http://127.0.0.1:'+addr.port;
const db = new PrismaClient();
const checks: Record<string,unknown>[]=[];
async function request(path:string,body?:any,cookie?:string) {
 const headers:any={};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(cookie)headers.Cookie=cookie;
 const r=await fetch(base+path,{method:body!==undefined?'POST':'GET',headers,body:body!==undefined?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 const contentType=r.headers.get('content-type')||'';
 return {status:r.status,body:contentType.includes('application/json')?await r.json():await r.arrayBuffer(),headers:r.headers};
}
function check(name:string,value:boolean,extra:Record<string,unknown>={}){checks.push({name,pass:value,...extra});assert(value,'FAILED '+name)}
try{
 const order=PRESET_ORDER_ENTITIES[0];
 const result=await request('/api/quote/calculate',{orderEntity:order});
 check('calculate',result.status===200,{status:result.status});
 const canonical=(result.body as any).data;
 const issuePayload={orderEntity:order,calculationResult:canonical,status:'ISSUED',title:'격리 테스트 주문'};
 let tampered=structuredClone(issuePayload);
 tampered.calculationResult.summary.finalGrandTotal=1;
 let x=await request('/api/quotes',tampered);
 check('tampered_total_rejected',x.status===409,{status:x.status});
 tampered=structuredClone(issuePayload);
 tampered.calculationResult.validationReport.push({type:'ERROR',field:'customerName',message:'고의 오류'});
 x=await request('/api/quotes',tampered);
 check('review_error_rejected',x.status===409,{status:x.status});
 x=await request('/api/quotes',{...issuePayload,publishMeta:{validUntilDays:30,paymentTerms:'',exclusions:'',specialTerms:'',internalMemo:'',hiddenBreakdownIds:['bd-carcass-lower']}});
 check('hidden_row_rejected',x.status===409,{status:x.status});
 x=await request('/api/quotes',{...issuePayload,targetMarginRate:125});
 check('invalid_margin_rejected',x.status===400,{status:x.status});
 x=await request('/api/quotes',issuePayload);
 check('valid_issue',x.status===200,{status:x.status});
 const quote=(x.body as any).data;
 x=await request('/api/quotes/'+quote.id);
 check('persisted_retrieval',x.status===200,{status:x.status});
 async function excel(mode:'customer'|'internal',endpoint='/api/quotes/excel',cookie?:string){
  const r=await request(endpoint,{quoteId:quote.id,audience:mode},cookie);
  const workbook=r.status===200?XLSX.read(Buffer.from(r.body as ArrayBuffer),{type:'buffer'}):null;
  const rows=workbook?XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{header:1}) as any[][]:[];
  return {res:r,rows,string:JSON.stringify(rows)};
 }
 const c=await excel('customer');
 check('customer_xlsx_generated',c.res.status===200&&c.rows.length>10,{status:c.res.status,rows:c.rows.length});
 check('customer_xlsx_has_no_cost_or_margin',!c.string.includes('제조원가')&&!c.string.includes('마진')&&!c.string.includes('단가표'));
 check('customer_preview_marked',c.string.includes('대외 발송 금지'));
 const i=await excel('internal');
 check('internal_xlsx_has_cost_and_margin',i.res.status===200&&i.string.includes('제조원가')&&i.string.includes('마진'),{status:i.res.status});
 const legacy=await request('/api/export/quote-excel',{quoteId:quote.id});
 check('legacy_is_customer_default',legacy.status===200,{status:legacy.status});
 const disallowClientData=await request('/api/quotes/excel',{quoteId:quote.id,calculationResult:canonical});
 check('export_rejects_caller_supplied_result',disallowClientData.status===400,{status:disallowClientData.status});

 // Explicit pricing adjustments are persisted only after server recomputation.
 const adjustments = { lossRatePct: 5, targetMarginRate: 30, discountAmount: 17500, surchargeAmount: 8500, vatMode: 'EXCLUDED' };
 const pricingMeta = (hiddenBreakdownIds:string[], priceOverrides:Record<string,unknown>={}) => ({
   validUntilDays:15,paymentTerms:'테스트',exclusions:'',specialTerms:'',internalMemo:'',
   hiddenBreakdownIds, pricingAdjustments:{...adjustments,...priceOverrides},
 });
 let projected = await request('/api/quotes',{
   ...issuePayload,targetMarginRate:30,publishMeta:pricingMeta([]),
 });
 check('adjusted_quote_issued',projected.status===200,{status:projected.status});
 const priced=(projected.body as any).data;
 const pSummary=priced.calculationResult.summary;
 check('adjusted_lines_sum_matches_total',
   priced.calculationResult.breakdowns.reduce((n:number,l:any)=>n+l.sellingTotal,0)===pSummary.totalSellingPrice
   &&pSummary.totalSellingPrice+pSummary.vatAmount===pSummary.finalGrandTotal,
   {total:pSummary.finalGrandTotal});
 check('adjusted_margin_is_persisted',priced.publishMeta?.pricingAdjustments?.targetMarginRate===30 && priced.targetMarginRate===30);
 const withoutTopLevel=await request('/api/quotes',{...issuePayload,publishMeta:pricingMeta([])});
 check('margin_saved_correctly_if_legacy_caller_omits_top_level',withoutTopLevel.status===200&&(withoutTopLevel.body as any).data?.targetMarginRate===30);
 const sheetResult=await request('/api/quotes/excel',{quoteId:priced.id});
 const book=XLSX.read(Buffer.from(sheetResult.body as ArrayBuffer),{type:'buffer'});
 const xlsxRows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1}) as any[][];
 const totalRow=xlsxRows.find(row=>row[0]==='최종 견적 총액');
 check('xlsx_matches_server_adjusted_total',sheetResult.status===200&&totalRow?.[1]===pSummary.finalGrandTotal,{xlsx:totalRow?.[1],db:pSummary.finalGrandTotal});
 const excluded=canonical.breakdowns[0].id;
 projected=await request('/api/quotes',{
   ...issuePayload,targetMarginRate:30,publishMeta:pricingMeta([excluded],{vatMode:'INCLUDED'}),
 });
 check('excluded_item_and_included_vat_issued',projected.status===200,{status:projected.status});
 const exQuote=(projected.body as any).data;
 check('excluded_line_removed_in_server_and_total_consistent',
   !exQuote.calculationResult.breakdowns.some((l:any)=>l.id===excluded)
   &&exQuote.calculationResult.breakdowns.reduce((n:number,l:any)=>n+l.sellingTotal,0)===exQuote.calculationResult.summary.totalSellingPrice
   &&exQuote.calculationResult.summary.totalSellingPrice+exQuote.calculationResult.summary.vatAmount===exQuote.calculationResult.summary.finalGrandTotal);
 const badMargin=await request('/api/quotes',{...issuePayload,targetMarginRate:28,publishMeta:pricingMeta([])});
 check('inconsistent_margin_between_fields_rejected',badMargin.status===409,{status:badMargin.status});
 const badExcluded=await request('/api/quotes',{...issuePayload,targetMarginRate:30,publishMeta:pricingMeta(['missing-id'])});
 check('unknown_excluded_item_rejected',badExcluded.status===409,{status:badExcluded.status});
 const badAdjust=await request('/api/quotes',{...issuePayload,targetMarginRate:30,publishMeta:pricingMeta([],{targetMarginRate:95})});
 check('out_of_range_adjustment_rejected',badAdjust.status===400,{status:badAdjust.status});
 // VIEWER session is created only in disposable database, never production.
 const token=createSessionToken();
 const id=randomUUID();
 const viewer=await db.user.create({data:{id,email:'viewer-'+id.slice(0,12)+'@test.invalid',name:'Synthetic Viewer',role:'VIEWER',passwordHash:hashPassword('TestPassword2026!')}});
 await db.session.create({data:{userId:viewer.id,tokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+600000)}});
 process.env.DEMO_AUTO_LOGIN='false';
 const viewerCookie='queen_session='+encodeURIComponent(token);
 const viewerInternal=await request('/api/quotes/excel',{quoteId:quote.id,audience:'internal'},viewerCookie);
 check('viewer_internal_denied',viewerInternal.status===403,{status:viewerInternal.status});
 const viewerCustomer=await request('/api/quotes/excel',{quoteId:quote.id,audience:'customer'},viewerCookie);
 check('viewer_customer_denied_by_post_write_policy',viewerCustomer.status===403,{status:viewerCustomer.status});
 const legacyViewer=await request('/api/export/quote-excel',{quoteId:quote.id},viewerCookie);
 check('viewer_legacy_export_denied',legacyViewer.status===403,{status:legacyViewer.status});
 const anonInternal=await request('/api/quotes/excel',{quoteId:quote.id,audience:'internal'});
 check('anonymous_internal_denied',anonInternal.status===401,{status:anonInternal.status});
 console.log('SECURITY_API_TESTS',JSON.stringify({count:checks.length,results:checks},null,2));
}catch(err){console.error('SECURITY_TEST_ERROR',(err as Error).stack||String(err));console.log('PARTIAL',JSON.stringify(checks));process.exitCode=1}finally{srv.close();await db.$disconnect()}