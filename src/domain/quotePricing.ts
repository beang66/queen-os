/**
 * Shared price projection for the calculation screen, issue preview and server.
 * Never trust a client-computed result: the server recomputes base prices first.
 *
 * Excluded breakdown IDs remove both the line and its amount. Adjustments are
 * allocated across included lines in integer KRW, so their sellingTotal sums
 * EXACTLY to the visible summary and exported XLSX.
 */
import type { ItemCategory, QuoteBreakdownItem, QuoteCalculationResult, QuotePriceAdjustments, QuoteSummary } from '../types.js';
import { computeCost } from '../components/wizard/calc/costModel.js';

type AmountKind = 'costTotal' | 'sellingTotal';
const categories: ItemCategory[] = ['CARCASS','DOOR','COUNTERTOP','HARDWARE','APPLIANCE','LABOR','ACCESSORY'];
const keys: Record<ItemCategory, [keyof QuoteSummary,keyof QuoteSummary]> = {
  CARCASS:['carcassCost','carcassSelling'],
  DOOR:['doorCost','doorSelling'],
  COUNTERTOP:['countertopCost','countertopSelling'],
  HARDWARE:['hardwareCost','hardwareSelling'],
  APPLIANCE:['applianceCost','applianceSelling'],
  LABOR:['laborCost','laborSelling'],
  ACCESSORY:['accessoryCost','accessorySelling'],
};

function distributeInteger(total:number, weights:number[]):number[] {
  if (!Number.isSafeInteger(total) || total < 0) throw Error('결제 금액은 음수가 아닌 안전한 정수여야 합니다.');
  if (!weights.length) return [];
  const adjusted = weights.map(n=>Math.max(0, Number.isFinite(n)?n:0));
  const sum=adjusted.reduce((a,n)=>a+n,0);
  const normalized=sum>0?adjusted:weights.map(()=>1);
  const denominator=sum>0?sum:weights.length;
  const raw=normalized.map(w=>total*w/denominator);
  const rounded=raw.map(n=>Math.floor(n));
  let rest=total-rounded.reduce((a,n)=>a+n,0);
  const positions=raw.map((n,i)=>({i,remainder:n-Math.floor(n)}))
    .sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
  for(let i=0;i<rest;i++)rounded[positions[i%positions.length].i]+=1;
  return rounded;
}

function summarize(lines:QuoteBreakdownItem[]):QuoteSummary {
  const s: QuoteSummary={
    carcassCost:0,carcassSelling:0,doorCost:0,doorSelling:0,countertopCost:0,countertopSelling:0,
    hardwareCost:0,hardwareSelling:0,applianceCost:0,applianceSelling:0,laborCost:0,laborSelling:0,
    accessoryCost:0,accessorySelling:0,totalManufacturingCost:0,totalSellingPrice:0,
    totalMarginAmount:0,averageMarginRate:0,vatAmount:0,finalGrandTotal:0,
  };
  for(const line of lines) {
    const [c,sale]=keys[line.category];
    (s as unknown as Record<string,number>)[c]+=line.costTotal;
    (s as unknown as Record<string,number>)[sale]+=line.sellingTotal;
  }
  s.totalManufacturingCost=lines.reduce((n,line)=>n+line.costTotal,0);
  s.totalSellingPrice=lines.reduce((n,line)=>n+line.sellingTotal,0);
  s.totalMarginAmount=s.totalSellingPrice-s.totalManufacturingCost;
  s.averageMarginRate=s.totalSellingPrice>0
    ?Number((100*s.totalMarginAmount/s.totalSellingPrice).toFixed(1)):0;
  s.vatAmount=Math.round(s.totalSellingPrice*0.1);
  s.finalGrandTotal=s.totalSellingPrice+s.vatAmount;
  return s;
}

export function quotePriceProjection(
  base:QuoteCalculationResult,
  adjustments:QuotePriceAdjustments,
  excludedIds:string[]=[],
) {
  const allIds=new Set(base.breakdowns.map(line=>line.id));
  const excluded=new Set(excludedIds);
  if(excluded.size!==excludedIds.length || excludedIds.some(id=>!allIds.has(id))) {
    throw new Error('알 수 없거나 중복된 견적 제외 품목입니다.');
  }
  const included=base.breakdowns.filter(line=>!excluded.has(line.id));
  if(!included.length)throw new Error('모든 품목을 제외한 견적은 발행할 수 없습니다.');
  const filteredBase={...base,breakdowns:included,summary:summarize(included)};
  const computed=computeCost(filteredBase,adjustments);
  return {included,computed};
}

export function projectQuotePrice(
  base:QuoteCalculationResult,
  adjustments:QuotePriceAdjustments,
  excludedIds:string[]=[],
):QuoteCalculationResult {
  const {included,computed}=quotePriceProjection(base,adjustments,excludedIds);
  if (computed.adjustedCost>0 && computed.discountedSellingPrice<=0) {
    throw new Error('할인으로 견적 총액이 0원이 되었습니다. 할인액을 줄인 뒤 발행해 주세요.');
  }
  const costs=Array(included.length).fill(0) as number[];
  for(const group of computed.groups) {
    const indices=included.map((line,i)=>line.category===group.key?i:-1).filter(i=>i>=0);
    const distribution=distributeInteger(group.cost,indices.map(i=>included[i].costTotal));
    indices.forEach((i,j)=>{costs[i]=distribution[j]});
  }
  const subtotal=adjustments.vatMode==='INCLUDED'
    ?computed.discountedSellingPrice-computed.vatAmount
    :computed.discountedSellingPrice;
  const sells=distributeInteger(subtotal,costs);
  const priced=included.map((line,i)=>{
    const cost=costs[i],selling=sells[i];
    return {
      ...line,
      costTotal:cost,
      costUnitPrice:line.quantity>0?cost/line.quantity:0,
      sellingTotal:selling,
      sellingUnitPrice:line.quantity>0?selling/line.quantity:0,
      marginRate:selling>0?Number((100*(selling-cost)/selling).toFixed(1)):0,
      // Original formula referred to catalog unit pricing, now adjusted.
      formula:'조정 후 단가 × '+line.quantity+' '+line.unit+' (원가/할인/추가금 반영)',
    };
  });
  const summary=summarize(priced);
  summary.vatAmount=computed.vatAmount;
  summary.finalGrandTotal=computed.finalTotal;
  if(summary.totalManufacturingCost!==computed.adjustedCost
    || summary.totalSellingPrice+summary.vatAmount!==summary.finalGrandTotal) {
    throw Error('견적 가격 배분 또는 VAT 합계가 일치하지 않습니다.');
  }
  // Apply final VAT and margin as persisted in the adjustment snapshot.
  summary.totalMarginAmount=summary.totalSellingPrice-summary.totalManufacturingCost;
  summary.averageMarginRate=summary.totalSellingPrice>0
    ?Number((100*summary.totalMarginAmount/summary.totalSellingPrice).toFixed(1)):0;
  return {...base,breakdowns:priced,summary};
}
