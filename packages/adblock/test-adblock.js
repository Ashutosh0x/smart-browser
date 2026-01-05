/**
 * Adblock Test Script
 * Tests the rule engine and network interceptor with known ad domains
 */

const path = require('path');

// Import the adblock modules
const { RuleEngine } = require('./dist/rule-engine');
const { FilterParser, BUILTIN_RULES } = require('./dist/filter-parser');
const { NetworkInterceptor } = require('./dist/network-interceptor');

console.log('='.repeat(60));
console.log('AB-OS ADBLOCK TEST');
console.log('='.repeat(60));
console.log('');

// Initialize components
console.log('[1] Initializing components...');
const ruleEngine = new RuleEngine();
const filterParser = new FilterParser();
const interceptor = new NetworkInterceptor(ruleEngine, { mode: 'balanced' });

// Parse and load built-in rules
console.log('[2] Loading built-in filter rules...');
const parsedRules = filterParser.parseFilterList(BUILTIN_RULES);
console.log(`    Loaded ${parsedRules.length} rules from BUILTIN_RULES`);

for (const rule of parsedRules) {
    ruleEngine.addRule(rule);
}

console.log(`    Total rules in engine: ${ruleEngine.getRuleCount()}`);
console.log('');

// Test URLs - known ad/tracking domains
const testUrls = [
    // Known ad domains (should be BLOCKED)
    { url: 'https://doubleclick.net/ads/banner.js', type: 'script', expected: 'BLOCKED' },
    { url: 'https://googleadservices.com/pagead/conversion.js', type: 'script', expected: 'BLOCKED' },
    { url: 'https://googlesyndication.com/pagead/ads.js', type: 'script', expected: 'BLOCKED' },
    { url: 'https://facebook.com/tr?id=123', type: 'script', expected: 'BLOCKED' },
    { url: 'https://ads.youtube.com/video_ad.mp4', type: 'media', expected: 'BLOCKED' },
    { url: 'https://ad.doubleclick.net/ddm/activity', type: 'script', expected: 'BLOCKED' },
    { url: 'https://amazon-adsystem.com/aax3/adsense.js', type: 'script', expected: 'BLOCKED' },
    { url: 'https://analytics.google.com/collect', type: 'script', expected: 'BLOCKED' },

    // YouTube specific ad URLs
    { url: 'https://www.youtube.com/api/stats/ads', type: 'xmlhttprequest', expected: 'BLOCKED' },
    { url: 'https://www.youtube.com/pagead/adview', type: 'script', expected: 'BLOCKED' },
    { url: 'https://www.youtube.com/ptracking', type: 'xmlhttprequest', expected: 'BLOCKED' },

    // Legitimate URLs (should be ALLOWED)
    { url: 'https://www.google.com/', type: 'document', expected: 'ALLOWED' },
    { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', type: 'document', expected: 'ALLOWED' },
    { url: 'https://www.amazon.com/product/123', type: 'document', expected: 'ALLOWED' },
    { url: 'https://github.com/repo', type: 'document', expected: 'ALLOWED' },
];

console.log('[3] Testing URL blocking...');
console.log('-'.repeat(60));

let passed = 0;
let failed = 0;

for (const test of testUrls) {
    const request = {
        request_id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: test.url,
        method: 'GET',
        resource_type: test.type,
        agent_id: 'test-agent',
        headers: {},
    };

    const decision = interceptor.intercept(request);
    const status = decision.blocked ? 'BLOCKED' : 'ALLOWED';
    const passed_test = status === test.expected;

    const icon = passed_test ? '✓' : '✗';
    const color = passed_test ? '' : ' [MISMATCH]';

    console.log(`${icon} ${status.padEnd(8)} ${test.url.substring(0, 50).padEnd(52)} ${color}`);

    if (decision.blocked && decision.rule_id) {
        console.log(`          └─ Blocked by rule: ${decision.rule_id}`);
    }

    if (passed_test) passed++;
    else failed++;
}

console.log('-'.repeat(60));
console.log('');

// Print statistics
const stats = ruleEngine.getStats();
console.log('[4] Statistics:');
console.log(`    Rules loaded: ${stats.rulesLoaded}`);
console.log(`    Total checks: ${stats.totalChecks}`);
console.log(`    Total blocked: ${stats.totalBlocked}`);
console.log(`    Total allowed: ${stats.totalAllowed}`);
console.log('');

// Print audit log
const auditLog = interceptor.getAuditLog();
console.log('[5] Audit Log (last 5 blocked):');
const blockedEntries = auditLog.filter(e => e.blocked).slice(-5);
for (const entry of blockedEntries) {
    console.log(`    ${new Date(entry.timestamp).toISOString()} | ${entry.url.substring(0, 40)}`);
}
console.log('');

// Summary
console.log('='.repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
