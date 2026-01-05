/**
 * AB-OS Audit Ledger
 * 
 * Append-only, signed audit log for compliance and forensics
 */

import { createHash, createHmac } from 'crypto';
import { nanoid } from 'nanoid';

// =============================================================================
// Types
// =============================================================================

export interface AuditEntry {
    id: string;
    timestamp: string;
    sequence: number;

    // Actor
    agent_id: string;
    user_id?: string;

    // Action
    action_type:
    | 'agent_start'
    | 'agent_stop'
    | 'navigate'
    | 'interact'
    | 'read'
    | 'write'
    | 'submit'
    | 'purchase'
    | 'approve'
    | 'deny'
    | 'escalate'
    | 'auth'
    | 'token_issue'
    | 'token_revoke'
    | 'credential_use'
    | 'error';

    action_description: string;

    // Target
    target_domain?: string;
    target_url?: string;
    target_element?: string;

    // Policy
    capability?: string;
    policy_name?: string;
    policy_result?: 'allowed' | 'denied' | 'escalated';

    // Auth
    auth_method?: string;
    passkey_used?: boolean;

    // Risk
    risk_level?: 'low' | 'medium' | 'high';
    confidence_score?: number;

    // Explanation
    llm_rationale?: string;

    // Signature
    entry_hash: string;
    prev_hash: string;
    signature?: string;  // HSM signature in production
}

export interface LedgerBlock {
    block_id: string;
    entries: AuditEntry[];
    created_at: string;
    merkle_root: string;
    prev_block_hash: string;
    block_hash: string;
    signature?: string;  // HSM signature
}

// =============================================================================
// Audit Ledger Service
// =============================================================================

export interface AuditLedgerConfig {
    signing_key: string;
    block_size: number;  // Entries per block
    retention_days: number;
}

export class AuditLedger {
    private config: AuditLedgerConfig;
    private entries: AuditEntry[] = [];
    private blocks: LedgerBlock[] = [];
    private sequence: number = 0;
    private lastHash: string = '0'.repeat(64);

    constructor(config: Partial<AuditLedgerConfig> = {}) {
        this.config = {
            signing_key: 'default-key-replace-with-hsm',
            block_size: 100,
            retention_days: 365,
            ...config,
        };
    }

    // ---------------------------------------------------------------------------
    // Append Entry
    // ---------------------------------------------------------------------------

    append(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'sequence' | 'entry_hash' | 'prev_hash'>): AuditEntry {
        const id = nanoid();
        const timestamp = new Date().toISOString();
        const sequence = ++this.sequence;

        // Create entry
        const fullEntry: AuditEntry = {
            id,
            timestamp,
            sequence,
            ...entry,
            prev_hash: this.lastHash,
            entry_hash: '', // Will be computed
        };

        // Compute hash
        fullEntry.entry_hash = this.computeEntryHash(fullEntry);
        this.lastHash = fullEntry.entry_hash;

        // Add to ledger
        this.entries.push(fullEntry);

        // Check if we should create a block
        if (this.entries.length >= this.config.block_size) {
            this.createBlock();
        }

        return fullEntry;
    }

    // ---------------------------------------------------------------------------
    // Log Helpers
    // ---------------------------------------------------------------------------

    logAgentStart(agentId: string, domain: string): AuditEntry {
        return this.append({
            agent_id: agentId,
            action_type: 'agent_start',
            action_description: `Agent started for ${domain}`,
            target_domain: domain,
            risk_level: 'low',
        });
    }

    logNavigate(agentId: string, url: string): AuditEntry {
        return this.append({
            agent_id: agentId,
            action_type: 'navigate',
            action_description: `Navigated to ${new URL(url).hostname}`,
            target_url: url,
            target_domain: new URL(url).hostname,
        });
    }

    logInteract(agentId: string, element: string, action: string): AuditEntry {
        return this.append({
            agent_id: agentId,
            action_type: 'interact',
            action_description: `${action} on ${element}`,
            target_element: element,
        });
    }

    logPurchase(
        agentId: string,
        domain: string,
        amount: number,
        currency: string,
        approved: boolean,
        passkeyUsed: boolean
    ): AuditEntry {
        return this.append({
            agent_id: agentId,
            action_type: 'purchase',
            action_description: `Purchase attempt: ${currency} ${amount}`,
            target_domain: domain,
            capability: 'CAP_PURCHASE',
            policy_result: approved ? 'allowed' : 'denied',
            passkey_used: passkeyUsed,
            risk_level: amount > 100 ? 'high' : amount > 20 ? 'medium' : 'low',
        });
    }

    logTokenIssued(
        agentId: string,
        capability: string,
        authMethod: string
    ): AuditEntry {
        return this.append({
            agent_id: agentId,
            action_type: 'token_issue',
            action_description: `Capability token issued: ${capability}`,
            capability,
            auth_method: authMethod,
            passkey_used: authMethod !== 'none',
        });
    }

    logCredentialUse(agentId: string, domain: string): AuditEntry {
        return this.append({
            agent_id: agentId,
            action_type: 'credential_use',
            action_description: `Credential used for ${domain}`,
            target_domain: domain,
        });
    }

    logError(agentId: string, error: string): AuditEntry {
        return this.append({
            agent_id: agentId,
            action_type: 'error',
            action_description: `Error: ${error}`,
            risk_level: 'medium',
        });
    }

    // ---------------------------------------------------------------------------
    // Block Management
    // ---------------------------------------------------------------------------

    private createBlock(): LedgerBlock {
        const entriesToBlock = this.entries.splice(0, this.config.block_size);
        const blockId = nanoid();
        const prevBlockHash = this.blocks.length > 0
            ? this.blocks[this.blocks.length - 1].block_hash
            : '0'.repeat(64);

        // Compute merkle root
        const merkleRoot = this.computeMerkleRoot(entriesToBlock);

        // Create block
        const block: LedgerBlock = {
            block_id: blockId,
            entries: entriesToBlock,
            created_at: new Date().toISOString(),
            merkle_root: merkleRoot,
            prev_block_hash: prevBlockHash,
            block_hash: '', // Will be computed
        };

        block.block_hash = this.computeBlockHash(block);
        block.signature = this.signBlock(block);

        this.blocks.push(block);

        console.log('[AuditLedger] Block created:', {
            block_id: blockId,
            entries: entriesToBlock.length,
            hash: block.block_hash.substring(0, 16) + '...',
        });

        return block;
    }

    // ---------------------------------------------------------------------------
    // Crypto
    // ---------------------------------------------------------------------------

    private computeEntryHash(entry: AuditEntry): string {
        const data = JSON.stringify({
            id: entry.id,
            timestamp: entry.timestamp,
            sequence: entry.sequence,
            agent_id: entry.agent_id,
            action_type: entry.action_type,
            prev_hash: entry.prev_hash,
        });
        return createHash('sha256').update(data).digest('hex');
    }

    private computeMerkleRoot(entries: AuditEntry[]): string {
        if (entries.length === 0) return '0'.repeat(64);

        let hashes = entries.map(e => e.entry_hash);

        while (hashes.length > 1) {
            const next: string[] = [];
            for (let i = 0; i < hashes.length; i += 2) {
                const left = hashes[i];
                const right = hashes[i + 1] || left;
                next.push(createHash('sha256').update(left + right).digest('hex'));
            }
            hashes = next;
        }

        return hashes[0];
    }

    private computeBlockHash(block: LedgerBlock): string {
        const data = JSON.stringify({
            block_id: block.block_id,
            merkle_root: block.merkle_root,
            prev_block_hash: block.prev_block_hash,
            created_at: block.created_at,
        });
        return createHash('sha256').update(data).digest('hex');
    }

    private signBlock(block: LedgerBlock): string {
        // In production: Use HSM for signing
        return createHmac('sha256', this.config.signing_key)
            .update(block.block_hash)
            .digest('hex');
    }

    // ---------------------------------------------------------------------------
    // Verification
    // ---------------------------------------------------------------------------

    verifyChain(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Verify blocks
        for (let i = 0; i < this.blocks.length; i++) {
            const block = this.blocks[i];

            // Verify block hash
            const computedHash = this.computeBlockHash(block);
            if (computedHash !== block.block_hash) {
                errors.push(`Block ${i}: Invalid block hash`);
            }

            // Verify chain
            if (i > 0 && block.prev_block_hash !== this.blocks[i - 1].block_hash) {
                errors.push(`Block ${i}: Chain broken`);
            }

            // Verify merkle root
            const computedMerkle = this.computeMerkleRoot(block.entries);
            if (computedMerkle !== block.merkle_root) {
                errors.push(`Block ${i}: Invalid merkle root`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    // ---------------------------------------------------------------------------
    // Query
    // ---------------------------------------------------------------------------

    getRecentEntries(limit: number = 100): AuditEntry[] {
        const allEntries = [...this.blocks.flatMap(b => b.entries), ...this.entries];
        return allEntries.slice(-limit);
    }

    getEntriesByAgent(agentId: string): AuditEntry[] {
        const allEntries = [...this.blocks.flatMap(b => b.entries), ...this.entries];
        return allEntries.filter(e => e.agent_id === agentId);
    }

    exportForCompliance(): {
        blocks: LedgerBlock[];
        pending_entries: AuditEntry[];
        verification: { valid: boolean; errors: string[] };
    } {
        return {
            blocks: this.blocks,
            pending_entries: this.entries,
            verification: this.verifyChain(),
        };
    }
}
