import { next } from '@vercel/edge';
const SPANISH=new Set(['ES','MX','AR','CO','PE','VE','CL','EC','GT','CU','BO','DO','HN','PY','SV','NI','CR','PA','UY','PR','GQ']);
const PORTUGUESE=new Set(['BR','PT','AO','MZ','CV','GW','ST','TL']);
const CHINESE=new Set(['CN','HK','MO','TW','SG']);
export const config={matcher:['/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)']};
export default function middleware(request: Request){
  const url=new URL(request.url); const path=url.pathname;
  if(/^\/(es|pt|zh)(\/|$)/.test(path)) return next();
  const c=(request.headers.get('x-vercel-ip-country')||'').toUpperCase();
  let p=''; if(CHINESE.has(c))p='/zh'; else if(PORTUGUESE.has(c))p='/pt'; else if(SPANISH.has(c))p='/es';
  if(!p) return next();
  url.pathname=p+(path==='/'?'/':path); return Response.redirect(url,307);
}
