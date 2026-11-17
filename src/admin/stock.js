import { validReportDate } from './reports.js';
const reply = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
const text = (value, limit) => typeof value === 'string' && value.length <= limit;
export async function handleAdminStock(request, env, loadMenu) {
  const url = new URL(request.url), batch = url.searchParams.get('batch');
  const source = url.origin === 'https://swirlgirl.sg' && !env.ISOLATED_TEST_BACKEND ? 'production'
    : url.origin === 'https://test-swirl-girl.jaemcd95.workers.dev' && env.ISOLATED_TEST_BACKEND === true ? 'test' : null;
  if (!source) return reply({error:'Stock is not configured for this site.'},503);
  if (request.method !== 'GET') return reply({error:'Method not allowed'},405);
  if (!batch || !validReportDate(batch) || new Date(batch+'T00:00:00Z').getUTCDay() !== 6) return reply({error:'Choose a Saturday bake date.'},400);
  try {
    const menu = await loadMenu(), shopping = menu.shopping;
    if (menu.batchKey !== batch || shopping?.batchKey !== batch || !Number.isFinite(Date.parse(shopping.generatedAt))) return reply({error:'The ingredient checklist has not been published for this bake yet. Publish a fresh menu snapshot from the Sheet.'},409);
    if (!Array.isArray(shopping.items) || shopping.items.length > 1000 || !Array.isArray(shopping.warnings) || shopping.warnings.length > 100 || shopping.warnings.some(w=>!text(w,1000))) throw new Error();
    const items = shopping.items.map(item=>{
      if (!text(item.id,200) || !item.id || !text(item.name,200) || !item.name || !text(item.unit,100) || !text(item.location ?? '',200) || !Number.isFinite(item.quantity) || item.quantity < 0 || item.quantity > 1e9 || !Array.isArray(item.forProducts) || item.forProducts.length > 100 || item.forProducts.some(p=>!text(p,200))) throw new Error();
      return {id:item.id,name:item.name,unit:item.unit,location:item.location || '',quantity:item.quantity,forProducts:item.forProducts};
    });
    if(new Set(items.map(i=>i.id)).size !== items.length) throw new Error();
    return reply({ok:true,source,batchKey:batch,shopping:{batchKey:batch,generatedAt:shopping.generatedAt,items,warnings:shopping.warnings}});
  } catch { return reply({error:'Unable to load the ingredient checklist. Please refresh.'},503); }
}
