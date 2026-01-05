/**
 * Debug trie structure
 */

const { RuleEngine } = require('./dist/rule-engine');
const { FilterParser, BUILTIN_RULES } = require('./dist/filter-parser');

const ruleEngine = new RuleEngine();
const filterParser = new FilterParser();
const rules = filterParser.parseFilterList(BUILTIN_RULES);

console.log('Parsed network rules (first 5):');
rules.filter(r => r.type === 'network').slice(0, 5).forEach(r => {
    console.log(`  ${r.rule_id}: host=${JSON.stringify(r.match.host)}`);
});

rules.forEach(r => ruleEngine.addRule(r));

// Access private trie for debugging
const trie = ruleEngine['domainTrie'];

console.log('\nTrie structure:');
console.log('Root rules:', trie.rules.length);
console.log('Root wildcard rules:', trie.wildcardRules.length);
console.log('Root children:', [...trie.children.keys()]);

// Check if 'net' exists
if (trie.children.has('net')) {
    const netNode = trie.children.get('net');
    console.log('\nnet children:', [...netNode.children.keys()]);

    if (netNode.children.has('doubleclick')) {
        const dcNode = netNode.children.get('doubleclick');
        console.log('  doubleclick rules:', dcNode.rules.length);
        console.log('  doubleclick wildcard rules:', dcNode.wildcardRules.length);
        if (dcNode.rules.length > 0) {
            console.log('  First rule:', dcNode.rules[0].rule_id);
        }
    }
}

// Check if 'com' exists
if (trie.children.has('com')) {
    const comNode = trie.children.get('com');
    console.log('\ncom children:', [...comNode.children.keys()].slice(0, 10));
}
