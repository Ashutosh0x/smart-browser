/**
 * YouTube Adblock Test
 * Specifically tests YouTube ad-related URLs
 */

const { RuleEngine } = require('./dist/rule-engine');
const { FilterParser, BUILTIN_RULES } = require('./dist/filter-parser');
const { NetworkInterceptor } = require('./dist/network-interceptor');

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           YOUTUBE ADBLOCK TEST - VERBOSE LOGS              ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Initialize
const ruleEngine = new RuleEngine();
const filterParser = new FilterParser();
const interceptor = new NetworkInterceptor(ruleEngine, { mode: 'strict' });

// Load rules
const rules = filterParser.parseFilterList(BUILTIN_RULES);
rules.forEach(r => ruleEngine.addRule(r));

console.log(`[INIT] Loaded ${rules.length} filter rules`);
console.log(`[INIT] Mode: STRICT (blocks all ads + trackers)`);
console.log('');

// YouTube-specific ad URLs
const youtubeAdUrls = [
    // Video ads
    'https://www.youtube.com/api/stats/ads?ver=2&ns=yt&event=start',
    'https://www.youtube.com/pagead/viewthroughconversion/123',
    'https://www.youtube.com/ptracking?pltype=adhost',
    'https://www.youtube.com/api/stats/qoe?adformat=2',
    'https://googleads.g.doubleclick.net/pagead/id',
    'https://www.google.com/pagead/lvz?hmac=abc',

    // Tracking
    'https://www.youtube.com/api/stats/watchtime?docid=abc&ads_cts=1',
    'https://s.youtube.com/api/stats/ads?adformat=ad3p',

    // Ad scripts
    'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
    'https://static.doubleclick.net/instream/ad_status.js',
    'https://www.googleadservices.com/pagead/conversion.js',

    // Legitimate YouTube URLs (should NOT be blocked)
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/',
    'https://www.youtube.com/feed/subscriptions',
    'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    'https://www.youtube.com/youtubei/v1/player',
];

console.log('┌────────────┬──────────────────────────────────────────────────┐');
console.log('│  STATUS    │  URL                                             │');
console.log('├────────────┼──────────────────────────────────────────────────┤');

let blocked = 0;
let allowed = 0;

for (const url of youtubeAdUrls) {
    const request = {
        request_id: `yt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        url: url,
        method: 'GET',
        resource_type: 'script',
        agent_id: 'youtube-agent',
        headers: {
            'referer': 'https://www.youtube.com/',
        },
    };

    const decision = interceptor.intercept(request);
    const status = decision.blocked ? '🚫 BLOCKED' : '✅ ALLOWED';
    const shortUrl = url.length > 48 ? url.substring(0, 45) + '...' : url;

    console.log(`│ ${status.padEnd(10)} │ ${shortUrl.padEnd(48)} │`);

    if (decision.blocked) {
        blocked++;
        console.log(`│            │ └─ Rule: ${(decision.rule_id || 'pattern-match').substring(0, 37).padEnd(39)} │`);
    } else {
        allowed++;
    }
}

console.log('└────────────┴──────────────────────────────────────────────────┘');
console.log('');
console.log(`SUMMARY: ${blocked} blocked, ${allowed} allowed`);
console.log('');

// Show blocked requests audit
const audit = interceptor.getAuditLog();
console.log('AUDIT LOG (Blocked Requests):');
console.log('─'.repeat(60));
audit.filter(a => a.blocked).slice(-10).forEach(entry => {
    const time = new Date(entry.timestamp).toISOString().split('T')[1].split('.')[0];
    const shortUrl = entry.url.length > 45 ? entry.url.substring(0, 42) + '...' : entry.url;
    console.log(`[${time}] ${shortUrl}`);
});
console.log('');
