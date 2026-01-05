/**
 * AB-OS Policy Authority
 * 
 * Main exports for security services
 */

// WebAuthn
export { WebAuthnService } from './webauthn.js';
export type { WebAuthnConfig } from './webauthn.js';

// Capability Tokens
export { CapabilityTokenService } from './capability-token.js';
export type { CapabilityTokenServiceConfig, CapabilityRequest } from './capability-token.js';

// Secrets Vault
export { SecretsVault } from './secrets-vault.js';
export type {
    VaultConfig,
    SecretScope,
    StoredSecret,
    EphemeralCredential
} from './secrets-vault.js';

// Audit Ledger
export { AuditLedger } from './audit-ledger.js';
export type {
    AuditEntry,
    LedgerBlock,
    AuditLedgerConfig
} from './audit-ledger.js';

// Policy Engine
export { PolicyEngine } from './policy-engine.js';
export type {
    Policy,
    PolicyRule,
    Condition,
    Action,
    EvaluationContext,
    EvaluationResult,
} from './policy-engine.js';

// Types
export type {
    AuthRequirement,
    Capability,
    StoredPasskey,
    PasskeyAuthRequest,
    PasskeyAuthResponse,
    PasskeyRegistrationRequest,
    PasskeyRegistrationResponse,
    SecureApprovalRequest,
    SecureApprovalResponse,
    AuthenticatedCapabilityToken,
} from './types/webauthn.js';
