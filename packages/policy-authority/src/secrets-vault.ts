/**
 * AB-OS Secrets Vault Client
 * 
 * Ephemeral credential injection with per-agent isolation
 */

import { nanoid } from 'nanoid';

// =============================================================================
// Types
// =============================================================================

export interface SecretScope {
    agent_id: string;
    site_domain: string;
    page_id?: string;
}

export interface StoredSecret {
    id: string;
    name: string;
    type: 'password' | 'api_key' | 'oauth_token' | 'cookie' | 'custom';
    domains: string[];
    created_at: string;
    last_used_at?: string;
    use_count: number;
}

export interface EphemeralCredential {
    credential_id: string;
    value: string;  // The actual secret value
    scoped_to: SecretScope;
    issued_at: string;
    expires_at: string;
    single_use: boolean;
    used: boolean;
}

export interface VaultConfig {
    default_ttl_seconds: number;
    max_ttl_seconds: number;
    encryption_key?: string;  // For local encryption
}

// =============================================================================
// Secrets Vault Service
// =============================================================================

export class SecretsVault {
    private config: VaultConfig;
    private secrets: Map<string, { encrypted: string; metadata: StoredSecret }>;
    private ephemeralCredentials: Map<string, EphemeralCredential>;
    private cleanupInterval: NodeJS.Timer | null = null;

    constructor(config: Partial<VaultConfig> = {}) {
        this.config = {
            default_ttl_seconds: 300,  // 5 minutes
            max_ttl_seconds: 900,      // 15 minutes max
            ...config,
        };
        this.secrets = new Map();
        this.ephemeralCredentials = new Map();

        // Start cleanup task
        this.startCleanup();
    }

    // ---------------------------------------------------------------------------
    // Secret Management
    // ---------------------------------------------------------------------------

    async storeSecret(
        name: string,
        value: string,
        type: StoredSecret['type'],
        domains: string[]
    ): Promise<string> {
        const id = nanoid();
        const encrypted = this.encrypt(value);

        this.secrets.set(id, {
            encrypted,
            metadata: {
                id,
                name,
                type,
                domains,
                created_at: new Date().toISOString(),
                use_count: 0,
            },
        });

        console.log('[Vault] Secret stored:', { id, name, type, domains });
        return id;
    }

    async listSecrets(): Promise<StoredSecret[]> {
        return Array.from(this.secrets.values()).map(s => s.metadata);
    }

    async deleteSecret(secretId: string): Promise<boolean> {
        const deleted = this.secrets.delete(secretId);
        if (deleted) {
            console.log('[Vault] Secret deleted:', secretId);
        }
        return deleted;
    }

    // ---------------------------------------------------------------------------
    // Ephemeral Credential Injection
    // ---------------------------------------------------------------------------

    async issueEphemeralCredential(
        secretId: string,
        scope: SecretScope,
        ttlSeconds?: number
    ): Promise<EphemeralCredential> {
        const secret = this.secrets.get(secretId);
        if (!secret) {
            throw new Error(`Secret ${secretId} not found`);
        }

        // Validate domain
        const domainMatch = secret.metadata.domains.some(d =>
            scope.site_domain === d ||
            scope.site_domain.endsWith(`.${d}`) ||
            d === '*'
        );
        if (!domainMatch) {
            throw new Error(`Secret not authorized for domain ${scope.site_domain}`);
        }

        // Calculate TTL
        const ttl = Math.min(
            ttlSeconds || this.config.default_ttl_seconds,
            this.config.max_ttl_seconds
        );

        // Decrypt value
        const value = this.decrypt(secret.encrypted);

        // Create ephemeral credential
        const credential: EphemeralCredential = {
            credential_id: nanoid(),
            value,
            scoped_to: scope,
            issued_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
            single_use: false,
            used: false,
        };

        // Store for tracking
        this.ephemeralCredentials.set(credential.credential_id, credential);

        // Update use count
        secret.metadata.use_count++;
        secret.metadata.last_used_at = credential.issued_at;

        console.log('[Vault] Ephemeral credential issued:', {
            credential_id: credential.credential_id,
            secret_id: secretId,
            agent_id: scope.agent_id,
            domain: scope.site_domain,
            ttl_seconds: ttl,
        });

        return credential;
    }

    async getCredential(credentialId: string): Promise<EphemeralCredential | null> {
        const credential = this.ephemeralCredentials.get(credentialId);
        if (!credential) return null;

        // Check expiration
        if (new Date(credential.expires_at) < new Date()) {
            this.ephemeralCredentials.delete(credentialId);
            return null;
        }

        // Check single-use
        if (credential.single_use && credential.used) {
            return null;
        }

        // Mark as used
        credential.used = true;

        return credential;
    }

    async revokeCredential(credentialId: string): Promise<boolean> {
        const deleted = this.ephemeralCredentials.delete(credentialId);
        if (deleted) {
            console.log('[Vault] Credential revoked:', credentialId);
        }
        return deleted;
    }

    async revokeAgentCredentials(agentId: string): Promise<number> {
        let count = 0;
        for (const [id, cred] of this.ephemeralCredentials) {
            if (cred.scoped_to.agent_id === agentId) {
                this.ephemeralCredentials.delete(id);
                count++;
            }
        }
        console.log('[Vault] Revoked credentials for agent:', { agentId, count });
        return count;
    }

    // ---------------------------------------------------------------------------
    // Encryption (Simplified - use real encryption in production)
    // ---------------------------------------------------------------------------

    private encrypt(value: string): string {
        // In production: Use AES-256-GCM with key from HSM
        return Buffer.from(value).toString('base64');
    }

    private decrypt(encrypted: string): string {
        // In production: Use AES-256-GCM with key from HSM
        return Buffer.from(encrypted, 'base64').toString('utf-8');
    }

    // ---------------------------------------------------------------------------
    // Cleanup
    // ---------------------------------------------------------------------------

    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            const now = new Date();
            let cleaned = 0;

            for (const [id, cred] of this.ephemeralCredentials) {
                if (new Date(cred.expires_at) < now) {
                    this.ephemeralCredentials.delete(id);
                    cleaned++;
                }
            }

            if (cleaned > 0) {
                console.log('[Vault] Cleanup removed expired credentials:', cleaned);
            }
        }, 60000); // Every minute
    }

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
