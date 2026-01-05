/**
 * AB-OS Demo Script
 * 
 * Demonstrates the Planner + Agent integration with multiple LLM providers
 * 
 * Usage:
 *   1. Install dependencies: npm install
 *   2. Ensure .env has API keys (Groq, Gemini, or OpenAI)
 *   3. Run: npx tsx demo.ts
 */

import 'dotenv/config';
import { Planner } from './packages/planner/src/index.js';
import { Agent } from './packages/agent-runtime/src/index.js';

// Determine which provider to use based on available API keys
function getProvider(): { provider: 'groq' | 'gemini' | 'openai' | 'ollama'; model: string } {
    if (process.env.GROQ_API_KEY) {
        return { provider: 'groq', model: 'openai/gpt-oss-120b' };
    }
    if (process.env.GEMINI_API_KEY) {
        return { provider: 'gemini', model: 'gemini-2.0-flash-exp' };
    }
    if (process.env.OPENAI_API_KEY) {
        return { provider: 'openai', model: 'gpt-4o' };
    }
    return { provider: 'ollama', model: 'llama3:latest' };
}

async function main() {
    console.log('[AB-OS] Demo Starting\n');

    // Get provider configuration
    const { provider, model } = getProvider();
    console.log(`[Provider] Using: ${provider} (${model})\n`);

    // Initialize Planner
    const planner = new Planner({
        provider,
        model,
        apiKey: provider === 'groq' ? process.env.GROQ_API_KEY :
            provider === 'gemini' ? process.env.GEMINI_API_KEY :
                process.env.OPENAI_API_KEY,
    });

    // Example intent
    const intent = 'Go to example.com and take a screenshot';

    console.log(`[Intent] "${intent}"\n`);
    console.log('[Planner] Generating plan...\n');

    // Generate plan
    const startTime = Date.now();
    const planResult = await planner.createPlan({ intent });
    const planTime = Date.now() - startTime;

    if (!planResult.success || !planResult.plan) {
        console.error('[Error] Failed to generate plan:', planResult.error);
        return;
    }

    console.log(`[Success] Plan generated in ${planTime}ms:`);
    console.log(JSON.stringify(planResult.plan, null, 2));
    console.log('\n');

    // Initialize Agent
    console.log('[Agent] Initializing browser...\n');
    const agent = new Agent({
        headless: process.env.AGENT_HEADLESS !== 'false',
        timeout: parseInt(process.env.AGENT_TIMEOUT || '30000'),
    });

    try {
        await agent.initialize();
        console.log(`[Success] Agent ${agent.id} initialized\n`);

        // Execute plan steps
        console.log('[Executor] Running plan steps...\n');
        const execStartTime = Date.now();
        const results = await agent.executeSteps(planResult.plan.steps);
        const execTime = Date.now() - execStartTime;

        // Print results
        for (const result of results) {
            const status = result.success ? '[OK]' : '[FAIL]';
            console.log(`${status} Step ${result.step_id}: ${result.success ? 'Success' : result.error} (${result.duration_ms}ms)`);
        }

        // Print timing summary
        console.log('\n[Performance]');
        console.log(`  Plan generation: ${planTime}ms`);
        console.log(`  Execution total: ${execTime}ms`);

        // Print final status
        console.log('\n[Status]');
        console.log(JSON.stringify(agent.getStatus(), null, 2));

        // Print audit log
        console.log('\n[Audit Log]');
        console.log(JSON.stringify(agent.getAuditLog(), null, 2));

    } finally {
        await agent.close();
        console.log('\n[Done] Agent closed');
    }
}

main().catch(console.error);
