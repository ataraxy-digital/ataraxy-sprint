import { next } from '@vercel/edge';

// IP/geo language routing with a manual override.
//
// Priority order:
//   1. An explicit /en prefix redirects to the English root (which lives at /)
//      and pins the choice via the `lang` cookie.
//   2. Explicit locale path (/es, /pt, /zh) is served as-is.
//   3. Search/AI crawlers are never geo-redirected: they get the content at
//      the URL they asked for, and hreflang alternates point them at the
//      language versions. Geo-redirecting bots made Google index the site as
//      "Page with redirect" and pick the wrong canonicals.
//   4. A `lang` cookie set by the footer language toggle wins over geo -
//      `en` keeps the visitor on the English root, es/pt/zh redirect to that
//      prefix. The cookie is scoped to .ataraxydigital.com so a choice made on
//      one property carries across the whole suite.
//   5. Otherwise the country of the IP picks the language (English default).
//
// Any path with a file extension and Next internals are skipped via `matcher`.

const SPANISH = new Set([
  'ES','MX','AR','CO','PE','VE','CL','EC','GT','CU','BO','DO','HN','PY','SV','NI','CR','PA','UY','PR','GQ',
]);
const PORTUGUESE = new Set(['BR','PT','AO','MZ','CV','GW','ST','TL']);
const CHINESE = new Set(['CN','HK','MO','TW','SG']);

// Matches every mainstream search / social / AI crawler. Generic tokens
// (bot, spider, crawl) cover Googlebot, Bingbot, Applebot, GPTBot, ClaudeBot,
// PerplexityBot, Baiduspider, ...; the explicit tail covers the stragglers
// that carry none of the generic markers.
const BOT_RE = /bot|spider|crawl|slurp|bingpreview|facebookexternalhit|meta-external|cohere-ai|whatsapp|telegram|pinterest|embedly|quora link preview|vkshare|ia_archiver|skypeuripreview|chrome-lighthouse|google-inspectiontool|headlesschrome/i;

export const config = {
  matcher: ['/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)'],
};

function cookieLang(request: Request): string {
  const m = /(?:^|;\s*)lang=(en|es|pt|zh)\b/.exec(request.headers.get('cookie') || '');
  return m ? m[1] : '';
}

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // /en is not a real subtree - English lives at the root. Strip the prefix,
  // pin the choice with the cookie, and redirect permanently so crawlers
  // consolidate on the bare URL instead of indexing a 404 at /es/en/.
  const en = /^\/en(\/|$)/.exec(path);
  if (en) {
    url.pathname = path.slice(3) || '/';
    const domain = url.hostname.endsWith('ataraxydigital.com')
      ? ';domain=.ataraxydigital.com'
      : '';
    return new Response(null, {
      status: 308,
      headers: {
        Location: url.toString(),
        'Set-Cookie': 'lang=en;path=/;max-age=31536000;samesite=lax' + domain,
      },
    });
  }

  // already in a localized subtree → leave alone
  if (/^\/(es|pt|zh)(\/|$)/.test(path)) return next();

  // crawlers always get the URL they asked for - hreflang does the routing
  if (BOT_RE.test(request.headers.get('user-agent') || '')) return next();

  // explicit user choice from the language toggle wins over geolocation
  const chosen = cookieLang(request);
  if (chosen === 'en') return next(); // English stays at the root

  let prefix = '';
  if (chosen === 'es' || chosen === 'pt' || chosen === 'zh') {
    prefix = '/' + chosen;
  } else {
    const country = (request.headers.get('x-vercel-ip-country') || '').toUpperCase();
    if (CHINESE.has(country)) prefix = '/zh';
    else if (PORTUGUESE.has(country)) prefix = '/pt';
    else if (SPANISH.has(country)) prefix = '/es';
  }

  if (!prefix) return next(); // English stays at the root

  url.pathname = prefix + (path === '/' ? '/' : path);
  return Response.redirect(url, 307);
}
