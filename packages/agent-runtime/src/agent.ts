import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { v4 as uuid } from 'uuid';
import type {
    AgentConfig,
    AgentState,
    AgentStatus,
    AuditEntry,
    MemoryStore,
    PlanStep,
    Snapshot,
    StepResult,
} from './types.js';

export class Agent {
    readonly id: string;
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private state: AgentState = 'created';
    private config: AgentConfig;
    private memory: MemoryStore;
    private steps: PlanStep[] = [];
    private currentStepIndex: number = 0;
    private auditLog: AuditEntry[] = [];
    private startedAt?: Date;
    private completedAt?: Date;
    private error?: string;

    constructor(config: AgentConfig = {}) {
        this.id = `agent-${uuid().slice(0, 8)}`;
        this.config = {
            headless: true,
            timeout: 30000,
            viewport: { width: 1920, height: 1080 },
            ...config,
        };
        this.memory = {
            shortTerm: new Map(),
            working: new Map(),
            episodic: [],
        };
    }

    async initialize(): Promise<void> {
        this.browser = await chromium.launch({
            headless: this.config.headless,
        });
        this.context = await this.browser.newContext({
            viewport: this.config.viewport,
            userAgent: this.config.userAgent,
        });
        this.page = await this.context.newPage();
        this.page.setDefaultTimeout(this.config.timeout!);
        this.state = 'ready';
    }

    async executeSteps(steps: PlanStep[]): Promise<StepResult[]> {
        if (!this.page) {
            throw new Error('Agent not initialized. Call initialize() first.');
        }

        this.steps = steps;
        this.state = 'running';
        this.startedAt = new Date();
        const results: StepResult[] = [];

        try {
            for (let i = 0; i < steps.length; i++) {
                this.currentStepIndex = i;
                const step = steps[i];
                const result = await this.executeStep(step);
                results.push(result);

                if (!result.success) {
                    this.state = 'failed';
                    this.error = result.error;
                    break;
                }
            }

            if (this.state === 'running') {
                this.state = 'complete';
            }
        } catch (error) {
            this.state = 'failed';
            this.error = error instanceof Error ? error.message : 'Unknown error';
        }

        this.completedAt = new Date();
        return results;
    }

    private async executeStep(step: PlanStep): Promise<StepResult> {
        const startTime = Date.now();

        try {
            let data: unknown;

            switch (step.action) {
                case 'navigate':
                    await this.page!.goto(step.target, { waitUntil: 'domcontentloaded' });
                    break;

                case 'click':
                    await this.page!.click(step.target);
                    break;

                case 'type':
                    const text = step.params?.text as string || '';
                    if (step.params?.clear) {
                        await this.page!.fill(step.target, '');
                    }
                    await this.page!.fill(step.target, text);
                    break;

                case 'scroll':
                    if (step.target === 'page') {
                        const x = step.params?.x as number || 0;
                        const y = step.params?.y as number || 500;
                        await this.page!.evaluate(({ x, y }) => window.scrollBy(x, y), { x, y });
                    } else {
                        await this.page!.locator(step.target).scrollIntoViewIfNeeded();
                    }
                    break;

                case 'hover':
                    await this.page!.hover(step.target);
                    break;

                case 'wait':
                    if (step.params?.timeout) {
                        await this.page!.waitForTimeout(step.params.timeout as number);
                    } else {
                        await this.page!.waitForSelector(step.target, { state: 'visible' });
                    }
                    break;

                case 'extract':
                    const elements = await this.page!.locator(step.target).all();
                    data = await Promise.all(
                        elements.map(async (el) => {
                            const attr = step.params?.attribute as string;
                            if (attr === 'textContent') {
                                return el.textContent();
                            } else if (attr === 'innerHTML') {
                                return el.innerHTML();
                            } else if (attr) {
                                return el.getAttribute(attr);
                            }
                            return el.textContent();
                        })
                    );
                    break;

                case 'screenshot':
                    data = await this.page!.screenshot({
                        fullPage: step.params?.fullPage as boolean,
                    });
                    break;

                case 'snapshot':
                    const snapshot: Snapshot = {
                        id: `snap-${uuid().slice(0, 8)}`,
                        timestamp: new Date().toISOString(),
                        url: this.page!.url(),
                        title: await this.page!.title(),
                        html: await this.page!.content(),
                    };
                    this.memory.episodic.push(snapshot);
                    data = snapshot;
                    break;

                default:
                    throw new Error(`Unknown action: ${step.action}`);
            }

            const duration_ms = Date.now() - startTime;

            // Log to audit
            this.auditLog.push({
                timestamp: new Date().toISOString(),
                agentId: this.id,
                action: step.action,
                target: step.target,
                success: true,
                duration_ms,
            });

            return {
                step_id: step.step_id,
                success: true,
                data,
                duration_ms,
            };

        } catch (error) {
            const duration_ms = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            this.auditLog.push({
                timestamp: new Date().toISOString(),
                agentId: this.id,
                action: step.action,
                target: step.target,
                success: false,
                duration_ms,
                error: errorMessage,
            });

            return {
                step_id: step.step_id,
                success: false,
                error: errorMessage,
                duration_ms,
            };
        }
    }

    getStatus(): AgentStatus {
        return {
            agentId: this.id,
            state: this.state,
            currentStep: this.currentStepIndex,
            totalSteps: this.steps.length,
            currentUrl: this.page?.url(),
            error: this.error,
            startedAt: this.startedAt?.toISOString(),
            completedAt: this.completedAt?.toISOString(),
        };
    }

    getAuditLog(): AuditEntry[] {
        return [...this.auditLog];
    }

    getMemory(): MemoryStore {
        return this.memory;
    }

    async close(): Promise<void> {
        await this.context?.close();
        await this.browser?.close();
        this.state = 'complete';
    }
}
