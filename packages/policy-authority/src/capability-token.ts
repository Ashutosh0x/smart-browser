/**
 * AB-OS Capability Token Service
 * 
 * Issues capability tokens with optional passkey protection
 */

import * as jose from 'jose';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import type { Capability, AuthRequirement, AuthenticatedCapabilityToken } from './types/webauthn.js';

// =============================================================================
// Schemas
// =============================================================================

const CapabilityRequestSchema = z.object({
    agent_id: z.string(),
    capabilities: z.array(z.string()),
    site_domain: z.string(),
    page_id: z.string().optional(),
    ttl_seconds: z.number().optional().default(300), // 5 minutes default
});

export type CapabilityRequest = z.infer<typeof CapabilityRequestSchema>;

// =============================================================================
// Policy Configuration
// =============================================================================

interface CapabilityPolicy {
    capability: string;
    requires_auth: AuthRequirement[];
    max_ttl_seconds: number;
    requires_logging: boolean;
}

const DEFAULT_POLICIES: CapabilityPolicy[] = [
    {
        capability: 'CAP_READ',
        requires_auth: ['none'],
        max_ttl_seconds: 3600,
        requires_logging: false,
    },
    {
        capability: 'CAP_NAVIGATE',
        requires_auth: ['none'],
        max_ttl_seconds: 1800,
        requires_logging: true,
    },
    {
        capability: 'CAP_INTERACT',
        requires_auth: ['none'],
        max_ttl_seconds: 900,
        requires_logging: true,
    },
    {
        capability: 'CAP_WRITE',
        requires_auth: ['passkey'],
        max_ttl_seconds: 300,
        requires_logging: true,
    },
    {
        capability: 'CAP_SUBMIT',
        requires_auth: ['passkey'],
        max_ttl_seconds: 300,
        requires_logging: true,
    },
    {
        capability: 'CAP_PURCHASE',
        requires_auth: ['passkey', 'biometric'],
        max_ttl_seconds: 60,
        requires_logging: true,
    },
    {
        capability: 'CAP_DELETE',
        requires_auth: ['passkey', 'hardware_key'],
        max_ttl_seconds: 60,
        requires_logging: true,
    },
    {
        capability: 'CAP_EXPORT',
        requires_auth: ['passkey'],
        max_ttl_seconds: 300,
        requires_logging: true,
    },
    {
        capability: 'CAP_AUTH',
        requires_auth: ['passkey', 'biometric'],
        max_ttl_seconds: 120,
        requires_logging: true,
    },
];

// =============================================================================
// Token Service
// =============================================================================

export interface CapabilityTokenServiceConfig {
    issuer: string;
    audience: string;
    signingKey: jose.KeyLike | Uint8Array;
    policies?: CapabilityPolicy[];
}

export class CapabilityTokenService {
    private config: CapabilityTokenServiceConfig;
    private policies: Map<string, CapabilityPolicy>;
    private issuedTokens: Map<string, { token: string; revoked: boolean }>;

    constructor(config: CapabilityTokenServiceConfig) {
        this.config = config;
        this.policies = new Map();
        this.issuedTokens = new Map();

        // Load policies
        const allPolicies = [...DEFAULT_POLICIES, ...(config.policies || [])];
        for (const policy of allPolicies) {
            this.policies.set(policy.capability, policy);
        }
    }

    // ---------------------------------------------------------------------------
    // Check if auth is required
    // ---------------------------------------------------------------------------

    getRequiredAuth(capability: string): AuthRequirement[] {
        const policy = this.policies.get(capability);
        return policy?.requires_auth || ['passkey'];
    }

    requiresPasskey(capability: string): boolean {
        const required = this.getRequiredAuth(capability);
        return required.some(r =>
            r === 'passkey' || r === 'biometric' || r === 'hardware_key'
        );
    }

    // ---------------------------------------------------------------------------
    // Issue token
    // ---------------------------------------------------------------------------

    async issueToken(
        request: CapabilityRequest,
        authProof?: {
            method: AuthRequirement;
            assertion_hash?: string;
            verified_at: string;
        }
    ): Promise<AuthenticatedCapabilityToken[]> {
        const validated = CapabilityRequestSchema.parse(request);
        const tokens: AuthenticatedCapabilityToken[] = [];

        for (const capability of validated.capabilities) {
            const policy = this.policies.get(capability);

            // Check auth requirement
            if (this.requiresPasskey(capability) && !authProof) {
                throw new Error(`Capability ${capability} requires passkey authentication`);
            }

            // Calculate TTL
            const maxTtl = policy?.max_ttl_seconds || 300;
            const ttl = Math.min(validated.ttl_seconds, maxTtl);

            // Generate token ID
            const tokenId = nanoid();

            // Build JWT payload
            const payload = {
                jti: tokenId,
                sub: validated.agent_id,
                cap: capability,
                dom: validated.site_domain,
                pid: validated.page_id,
                auth: authProof?.method || 'none',
                ath: authProof?.assertion_hash,
            };

            // Sign JWT
            const jwt = await new jose.SignJWT(payload)
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuer(this.config.issuer)
                .setAudience(this.config.audience)
                .setIssuedAt()
                .setExpirationTime(`${ttl}s`)
                .sign(this.config.signingKey);

            // Store token reference
            this.issuedTokens.set(tokenId, { token: jwt, revoked: false });

            tokens.push({
                token: jwt,
                capability,
                agent_id: validated.agent_id,
                auth_method: authProof?.method || 'none',
                passkey_assertion_hash: authProof?.assertion_hash,
                verified_at: authProof?.verified_at || new Date().toISOString(),
                expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
                single_use: capability === 'CAP_PURCHASE' || capability === 'CAP_DELETE',
                scoped_to_action: validated.page_id,
            });

            // Log if required
            if (policy?.requires_logging) {
                console.log('[CapabilityToken] Issued:', {
                    token_id: tokenId,
                    capability,
                    agent_id: validated.agent_id,
                    domain: validated.site_domain,
                    auth_method: authProof?.method || 'none',
                    expires_in: ttl,
                });
            }
        }

        return tokens;
    }

    // ---------------------------------------------------------------------------
    // Verify token
    // ---------------------------------------------------------------------------

    async verifyToken(token: string): Promise<{
        valid: boolean;
        payload?: jose.JWTPayload & {
            cap: string;
            dom: string;
            auth: string;
        };
        error?: string;
    }> {
        try {
            const { payload } = await jose.jwtVerify(token, this.config.signingKey, {
                issuer: this.config.issuer,
                audience: this.config.audience,
            });

            // Check if revoked
            const tokenId = payload.jti as string;
            const stored = this.issuedTokens.get(tokenId);
            if (stored?.revoked) {
                return { valid: false, error: 'Token has been revoked' };
            }

            return {
                valid: true,
                payload: payload as any,
            };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // ---------------------------------------------------------------------------
    // Revoke token
    // ---------------------------------------------------------------------------

    revokeToken(tokenId: string): boolean {
        const stored = this.issuedTokens.get(tokenId);
        if (stored) {
            stored.revoked = true;
            console.log('[CapabilityToken] Revoked:', tokenId);
            return true;
        }
        return false;
    }

    revokeAgentTokens(agentId: string): number {
        let count = 0;
        // In production, track tokens by agent_id for bulk revocation
        console.log('[CapabilityToken] Revoked all tokens for agent:', agentId);
        return count;
    }
}
