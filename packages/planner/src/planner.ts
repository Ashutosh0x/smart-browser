import OpenAI from 'openai';
import { PlanDAGSchema, type PlanDAG, type PlannerRequest, type PlannerResponse } from './types.js';
import { PLANNER_SYSTEM_PROMPT } from './prompts.js';

export interface PlannerConfig {
    provider: 'openai' | 'ollama' | 'groq' | 'gemini';
    model: string;
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
    reasoningEffort?: 'low' | 'medium' | 'high';
}

export class Planner {
    private client: OpenAI;
    private config: PlannerConfig;

    constructor(config: PlannerConfig) {
        this.config = {
            temperature: 0.1,
            maxTokens: 4096,
            reasoningEffort: 'medium',
            ...config,
        };

        // Configure client based on provider
        switch (config.provider) {
            case 'groq':
                this.client = new OpenAI({
                    baseURL: config.baseUrl || 'https://api.groq.com/openai/v1',
                    apiKey: config.apiKey || process.env.GROQ_API_KEY,
                });
                break;

            case 'gemini':
                this.client = new OpenAI({
                    baseURL: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai',
                    apiKey: config.apiKey || process.env.GEMINI_API_KEY,
                });
                break;

            case 'ollama':
                this.client = new OpenAI({
                    baseURL: config.baseUrl || 'http://localhost:11434/v1',
                    apiKey: 'ollama', // Ollama doesn't need a real key
                });
                break;

            default: // openai
                this.client = new OpenAI({
                    apiKey: config.apiKey || process.env.OPENAI_API_KEY,
                    baseURL: config.baseUrl,
                });
        }
    }

    async createPlan(request: PlannerRequest): Promise<PlannerResponse> {
        try {
            // Build user message with context
            let userMessage = `User Intent: ${request.intent}`;

            if (request.context?.currentUrl) {
                userMessage += `\n\nCurrent URL: ${request.context.currentUrl}`;
            }

            if (request.context?.previousSteps?.length) {
                userMessage += `\n\nPrevious steps completed: ${JSON.stringify(request.context.previousSteps, null, 2)}`;
            }

            // Build request options
            const requestOptions: OpenAI.ChatCompletionCreateParams = {
                model: this.config.model,
                messages: [
                    { role: 'system', content: PLANNER_SYSTEM_PROMPT },
                    { role: 'user', content: userMessage },
                ],
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
            };

            // Add JSON response format for supported providers
            if (this.config.provider !== 'gemini') {
                requestOptions.response_format = { type: 'json_object' };
            }

            // Call LLM
            const response = await this.client.chat.completions.create(requestOptions);

            const content = response.choices[0]?.message?.content;
            if (!content) {
                return { success: false, error: 'Empty response from LLM' };
            }

            // Parse JSON from response (handle markdown code blocks)
            let jsonContent = content;
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonContent = jsonMatch[1].trim();
            }

            // Parse and validate the plan
            const rawPlan = JSON.parse(jsonContent);
            const validatedPlan = PlanDAGSchema.parse(rawPlan);

            // Validate plan structure (DAG properties)
            const validationError = this.validatePlanStructure(validatedPlan);
            if (validationError) {
                return { success: false, error: validationError };
            }

            return { success: true, plan: validatedPlan };

        } catch (error) {
            if (error instanceof Error) {
                return { success: false, error: error.message };
            }
            return { success: false, error: 'Unknown error occurred' };
        }
    }

    private validatePlanStructure(plan: PlanDAG): string | null {
        const stepIds = new Set(plan.steps.map(s => s.step_id));

        // Check all dependencies exist
        for (const step of plan.steps) {
            for (const dep of step.depends_on) {
                if (!stepIds.has(dep)) {
                    return `Step ${step.step_id} depends on non-existent step ${dep}`;
                }
            }
        }

        // Check for cycles
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (stepId: string): boolean => {
            if (recursionStack.has(stepId)) return true;
            if (visited.has(stepId)) return false;

            visited.add(stepId);
            recursionStack.add(stepId);

            const step = plan.steps.find(s => s.step_id === stepId);
            if (step) {
                for (const dep of step.depends_on) {
                    if (hasCycle(dep)) return true;
                }
            }

            recursionStack.delete(stepId);
            return false;
        };

        for (const step of plan.steps) {
            if (hasCycle(step.step_id)) {
                return 'Plan contains dependency cycles';
            }
        }

        return null;
    }

    // Get available models for each provider
    static getAvailableModels(provider: string): string[] {
        switch (provider) {
            case 'groq':
                return [
                    'openai/gpt-oss-120b',
                    'llama-3.3-70b-versatile',
                    'llama-3.1-8b-instant',
                    'mixtral-8x7b-32768',
                ];
            case 'gemini':
                return [
                    'gemini-2.0-flash-exp',
                    'gemini-1.5-flash',
                    'gemini-1.5-pro',
                ];
            case 'openai':
                return [
                    'gpt-4o',
                    'gpt-4-turbo',
                    'gpt-4',
                    'gpt-3.5-turbo',
                ];
            case 'ollama':
                return [
                    'llama3:latest',
                    'mistral:latest',
                    'mixtral:latest',
                ];
            default:
                return [];
        }
    }
}

export { type PlanDAG, type PlanStep, type Capability } from './types.js';
