/**
 * Debug test - show what rules are being created
 */

const { RuleEngine } = require('./dist/rule-engine');
const { FilterParser, BUILTIN_RULES } = require('./dist/filter-parser');

console.log('DEBUG: Rule Parser Output');
console.log('='.repeat(60));

const filterParser = new FilterParser();
const rules = filterParser.parseFilterList(BUILTIN_RULES);

console.log(`Total rules parsed: ${rules.length}`);
console.log('');

for (const rule of rules) {
    console.log(`[${rule.rule_id}] type=${rule.type} action=${rule.action}`);
    console.log(`    hosts: ${JSON.stringify(rule.match.host)}`);
    console.log(`    path_regex: ${rule.match.path_regex ? rule.match.path_regex.substring(0, 50) : 'none'}`);
    console.log('');
}
