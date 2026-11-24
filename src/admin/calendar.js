import { readLimited } from './photos.js';

const reply = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control':'no-store'}});

export async function handleCalendar(request, env) {
  const url = new URL(request.url);
  const test = env.ISOLATED_TEST_BACKEND === true;
  const origin = test ? 'https://test-swirl-girl.jaemcd95.workers.dev' : 'https://swirlgirl.sg';
  if (url.origin !== origin) return reply({error:'Unknown calendar workspace.'},403);
  let command = {action:'calendarRead'};
  if (request.method === 'POST') {
    if (request.headers.get('Origin') !== origin) return reply({error:'Invalid origin.'},403);
    try {
      const data = JSON.parse(new TextDecoder().decode(await readLimited(request, 16000)));
      const {date,open,productIds,previous,reservations} = data;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date+'T12:00:00Z').getUTCDay() !== 6 ||
          typeof open !== 'boolean' || !Array.isArray(productIds) || productIds.length > 300 ||
          productIds.some(id => typeof id !== 'string' || id.length > 100) ||
          typeof previous !== 'string' || !Number.isSafeInteger(reservations)) throw Error();
      command = {action:'calendarSave',date,open,productIds,previous,reservations};
    } catch { return reply({error:'Invalid bake plan.'},400); }
  } else if (request.method !== 'GET') return reply({error:'Method not allowed.'},405);
  try {
    const response = await fetch(env.ORDER_SHEET_WEBHOOK_URL, {method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...command,environment:test?'test':'production',secret:env.ORDER_WEBHOOK_SECRET}),signal:AbortSignal.timeout(55000)});
    const result = await response.json();
    if (!response.ok || result.ok !== true) return reply({error:result.error || 'Check the Calendar tab and retry publication.'},409);
    if (request.method === 'GET') return reply({dates:result.dates,products:result.products,count:result.count});
    return reply({saved:result.saved === true});
  } catch { return reply({error:'Unable to confirm publication. Refresh the calendar and retry.'},503); }
}
