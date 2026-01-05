/**
 * Debug domain matching
 */

const { RuleEngine } = require('./dist/rule-engine');
const { FilterParser, BUILTIN_RULES } = require('./dist/filter-parser');

const ruleEngine = new RuleEngine();
const filterParser = new FilterParser();
const rules = filterParser.parseFilterList(BUILTIN_RULES);
rules.forEach(r => ruleEngine.addRule(r));

console.log('Testing domain matching:');
console.log('='.repeat(60));

const testHosts = [
    'doubleclick.net',
    'googleads.g.doubleclick.net',
    'ad.doubleclick.net',
    'www.youtube.com',
    'googlesyndication.com',
    'pagead2.googlesyndication.com',
];

for (const host of testHosts) {
    const request = {
        url: `https://${host}/test`,
        host: host,
        path: '/test',
        resource_type: 'script',
        is_third_party: true,
    };

    const result = ruleEngine.match(request);
    const status = result.matched && result.action === 'block' ? 'BLOCKED' : 'ALLOWED';
    console.log(`${status.padEnd(8)} ${host.padEnd(35)} rule: ${result.rule?.rule_id || 'none'}`);
}
