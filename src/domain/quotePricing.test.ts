import { describe,expect,it } from 'vitest';
import type { QuoteCalculationResult, QuotePriceAdjustments, QuoteBreakdownItem } from '../types.js';
import { DEFAULT_ADJUSTMENTS, computeCost } from '../components/wizard/calc/costModel.js';
import { projectQuotePrice, quotePriceProjection } from './quotePricing.js';

function line(id:string,category:'CARCASS'|'DOOR'|'LABOR',cost:number,selling:number,quantity=1) {
 return {
   id,category,code:id,name:id,spec:'test',formula:'기본 단가',unit:'EA',quantity,
   costUnitPrice:cost/quantity,costTotal:cost,sellingUnitPrice:selling/quantity,
   sellingTotal:selling,marginRate:0,validationStatus:'VALID',
 } as QuoteBreakdownItem;
}
function fixture():QuoteCalculationResult {
 const breakdowns=[line('a','CARCASS',100000,130000,2),line('b','DOOR',200000,280000),line('c','LABOR',50000,75000)];
 return {
   breakdowns,
   summary:{
     carcassCost:100000,carcassSelling:130000,doorCost:200000,doorSelling:280000,
     countertopCost:0,countertopSelling:0,hardwareCost:0,hardwareSelling:0,applianceCost:0,
     applianceSelling:0,laborCost:50000,laborSelling:75000,accessoryCost:0,accessorySelling:0,
     totalManufacturingCost:350000,totalSellingPrice:485000,totalMarginAmount:135000,
     averageMarginRate:27.8,vatAmount:48500,finalGrandTotal:533500,
   },
   validationReport:[],appliedPricingSnapshot:{},calculatedAt:'2026-11-17T00:00:00.000Z',
 };
}
const adj:QuotePriceAdjustments={
 lossRatePct:10,targetMarginRate:25,discountAmount:5000,surchargeAmount:1000,vatMode:'EXCLUDED',
};
function assertExactTotals(x:QuoteCalculationResult){
 const sum=(key:'costTotal'|'sellingTotal')=>x.breakdowns.reduce((n,v)=>n+v[key],0);
 expect(sum('costTotal')).toBe(x.summary.totalManufacturingCost);
 expect(sum('sellingTotal')).toBe(x.summary.totalSellingPrice);
 expect(x.summary.totalSellingPrice+x.summary.vatAmount).toBe(x.summary.finalGrandTotal);
 expect(x.breakdowns.every(v=>Number.isFinite(v.sellingUnitPrice)&&v.sellingTotal>=0)).toBe(true);
}
describe('same quote math in 3단계, 4단계 and server',()=>{
 it('loss + margin + discount + surcharge keep every line, summary and VAT consistent',()=>{
   const result=projectQuotePrice(fixture(),adj);
   const computed=computeCost(fixture(),adj);
   assertExactTotals(result);
   expect(result.summary.totalManufacturingCost).toBe(380000);
   expect(result.summary.totalSellingPrice).toBe(computed.discountedSellingPrice);
   expect(result.summary.finalGrandTotal).toBe(computed.finalTotal);
   expect(result.breakdowns.length).toBe(3);
 });
 it('inclusive VAT allocates the net supply without double charging',()=>{
   const config={...adj,vatMode:'INCLUDED' as const};
   const result=projectQuotePrice(fixture(),config);
   const computed=computeCost(fixture(),config);
   assertExactTotals(result);
   expect(result.summary.finalGrandTotal).toBe(computed.discountedSellingPrice);
   expect(result.summary.vatAmount).toBe(computed.vatAmount);
   expect(result.summary.totalSellingPrice).toBe(computed.discountedSellingPrice-computed.vatAmount);
 });
 it('excluding a line removes it from both price and cost before recalculating',()=>{
   const result=projectQuotePrice(fixture(),adj,['b']);
   assertExactTotals(result);
   expect(result.breakdowns.map(x=>x.id)).toEqual(['a','c']);
   expect(result.summary.totalManufacturingCost).toBe(160000);
   expect(result.summary.finalGrandTotal).toBeLessThan(projectQuotePrice(fixture(),adj).summary.finalGrandTotal);
 });
 it('step 3 total after excluded items equals step 4 preview and persisted total',()=>{
   const base=fixture();
   const step3=quotePriceProjection(base,adj,['b']).computed;
   const step4=projectQuotePrice(base,adj,['b']).summary;
   expect(step3.finalTotal).toBe(step4.finalGrandTotal);
   expect(step3.adjustedCost).toBe(step4.totalManufacturingCost);
 });
 it('rejects unknown, duplicate and all excluded line IDs',()=>{
   for(const ids of [['not-a-real-id'],['a','a'],['a','b','c']]){
     expect(()=>projectQuotePrice(fixture(),adj,ids)).toThrow();
   }
 });
 it('does not mutate the original calculation document',()=>{
   const base=fixture(),copy=structuredClone(base);
   projectQuotePrice(base,adj,['a']);
   expect(base).toEqual(copy);
 });
 it('does not allow accidental zero-priced quote with positive manufacturing cost',()=>{
   expect(()=>projectQuotePrice(fixture(),{...DEFAULT_ADJUSTMENTS,lossRatePct:0,discountAmount:100000000})).toThrow('0원');
 });
});
