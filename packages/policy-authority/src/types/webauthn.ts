/**
 * AB-OS WebAuthn / Passkey Types
 * 
 * Phishing-resistant authentication for Smart Browser
 */

// =============================================================================
// WebAuthn Core Types
// =============================================================================

export interface PublicKeyCredentialDescriptor {
    type: 'public-key';
    id: ArrayBuffer;
    transports?: AuthenticatorTransport[];
}

export type AuthenticatorTransport =
    | 'usb'      // Hardware security key
    | 'nfc'      // NFC
    | 'ble'      // Bluetooth
    | 'internal' // Platform authenticator (Touch ID, Windows Hello)
    | 'hybrid';  // Cross-device (phone as authenticator)

export type UserVerificationRequirement =
    | 'required'   // Must verify (biometric/PIN)
    | 'preferred'  // Prefer but fallback allowed
    | 'discouraged'; // Don't require

export type AttestationConveyancePreference =
    | 'none'       // No attestation
    | 'indirect'   // Anonymized attestation
    | 'direct'     // Full attestation (enterprise)
    | 'enterprise'; // Enterprise-managed keys

// =============================================================================
// Passkey Registration
// =============================================================================

export interface PasskeyRegistrationRequest {
    user_id: string;
    user_name: string;
    user_display_name: string;

    // Options
    authenticator_attachment?: 'platform' | 'cross-platform';
    resident_key?: 'required' | 'preferred' | 'discouraged';
    user_verification?: UserVerificationRequirement;
    attestation?: AttestationConveyancePreference;

    // For enterprise
    excluded_credential_ids?: string[]; // Prevent re-registration
}

export interface PasskeyRegistrationResponse {
    credential_id: string;
    public_key: string;        // Base64 encoded
    attestation_object?: string;
    transports: AuthenticatorTransport[];
    created_at: string;
    device_name?: string;
}

// =============================================================================
// Passkey Authentication
// =============================================================================

export interface PasskeyAuthRequest {
    challenge: string;  // Base64 encoded random challenge

    // Specify allowed credentials (empty = discoverable)
    allow_credentials?: string[];

    user_verification?: UserVerificationRequirement;
    timeout?: number;  // Milliseconds

    // Context for approval
    action_context?: {
        action_type: string;      // "purchase", "login", "approve_agent"
        agent_id?: string;
        amount?: number;
        description?: string;
    };
}

export interface PasskeyAuthResponse {
    credential_id: string;
    authenticator_data: string;  // Base64
    client_data_json: string;    // Base64
    signature: string;           // Base64
    user_handle?: string;        // Base64 (for discoverable credentials)

    // Parsed metadata
    user_verified: boolean;
    authenticator_attachment: 'platform' | 'cross-platform';
}

// =============================================================================
// Passkey Management
// =============================================================================

export interface StoredPasskey {
    id: string;
    credential_id: string;
    user_id: string;

    // Key material (stored in Vault)
    public_key_spki: string;  // Base64 encoded SPKI

    // Metadata
    name: string;             // User-provided name
    created_at: string;
    last_used_at?: string;
    use_count: number;

    // Authenticator info
    aaguid?: string;          // Authenticator type
    transports: AuthenticatorTransport[];
    backup_eligible: boolean;
    backup_state: boolean;

    // Status
    is_primary: boolean;
    is_revoked: boolean;
}

export interface PasskeyRecoveryRequest {
    recovery_method: 'backup_codes' | 'admin_approval' | 'escrow_key';
    recovery_token?: string;
    new_passkey?: PasskeyRegistrationRequest;
}

// =============================================================================
// Policy Integration
// =============================================================================

export type AuthRequirement =
    | 'none'          // No auth required
    | 'passkey'       // Any passkey
    | 'platform'      // Platform authenticator (biometric)
    | 'hardware_key'  // Hardware security key only
    | 'biometric'     // Explicit biometric verification
    | 'manager';      // Manager approval

export interface AuthenticatedCapabilityRequest {
    capability: string;           // e.g., "CAP_PURCHASE"
    agent_id: string;
    requires_auth: AuthRequirement[];

    // For approval context
    preflight_payload?: {
        url: string;
        method: string;
        body_preview?: string;  // Masked sensitive data
        estimated_cost?: number;
    };
}

export interface AuthenticatedCapabilityToken {
    token: string;              // JWT
    capability: string;
    agent_id: string;

    // Auth proof
    auth_method: AuthRequirement;
    passkey_assertion_hash?: string;
    verified_at: string;

    // Constraints
    expires_at: string;
    single_use: boolean;
    scoped_to_action?: string;
}

// =============================================================================
// Secure Approval Sheet
// =============================================================================

export interface SecureApprovalRequest {
    request_id: string;
    agent_id: string;
    agent_name: string;

    // What's being approved
    action_type: 'purchase' | 'submit' | 'export' | 'delete' | 'auth' | 'custom';
    action_description: string;

    // Preflight details
    target_url: string;
    http_method?: string;
    payload_preview?: string;  // Masked sensitive fields

    // For purchases
    amount?: {
        value: number;
        currency: string;
    };

    // Auth requirement
    requires_auth: AuthRequirement;

    // Policy context
    triggered_policies: string[];
    risk_level: 'low' | 'medium' | 'high';
}

export interface SecureApprovalResponse {
    request_id: string;
    approved: boolean;

    // Auth proof (if approved)
    passkey_assertion?: PasskeyAuthResponse;

    // Audit
    decided_at: string;
    decided_by: 'user' | 'manager' | 'policy';
    reason?: string;
}

// =============================================================================
// Hardware Key Specific
// =============================================================================

export interface HardwareKeyAttestation {
    aaguid: string;              // Authenticator type ID
    vendor: string;              // e.g., "Yubico"
    model: string;               // e.g., "YubiKey 5 NFC"
    firmware_version?: string;

    // Attestation certificate chain
    attestation_cert: string;    // Base64 DER
    root_ca_fingerprint: string;

    // Security properties
    is_fips_certified: boolean;
    pin_protocol_version?: number;
}

// =============================================================================
// WebAuthn Service Interface
// =============================================================================

export interface WebAuthnService {
    // Registration
    createRegistrationOptions(request: PasskeyRegistrationRequest): Promise<PublicKeyCredentialCreationOptions>;
    verifyRegistration(credential: Credential, expectedChallenge: string): Promise<PasskeyRegistrationResponse>;

    // Authentication
    createAuthenticationOptions(request: PasskeyAuthRequest): Promise<PublicKeyCredentialRequestOptions>;
    verifyAuthentication(credential: Credential, expectedChallenge: string): Promise<PasskeyAuthResponse>;

    // Management
    listPasskeys(userId: string): Promise<StoredPasskey[]>;
    revokePasskey(passkeyId: string): Promise<void>;
    renamePasskey(passkeyId: string, newName: string): Promise<void>;

    // Recovery
    initiateRecovery(request: PasskeyRecoveryRequest): Promise<{ recovery_token: string }>;
    completeRecovery(recoveryToken: string, newCredential: Credential): Promise<PasskeyRegistrationResponse>;
}
