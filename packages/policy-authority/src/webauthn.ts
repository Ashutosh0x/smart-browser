/**
 * AB-OS WebAuthn Service
 * 
 * Phishing-resistant authentication using FIDO2/WebAuthn passkeys
 */

import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
    type VerifiedRegistrationResponse,
    type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { nanoid } from 'nanoid';
import type {
    PasskeyRegistrationRequest,
    PasskeyRegistrationResponse,
    PasskeyAuthRequest,
    PasskeyAuthResponse,
    StoredPasskey,
    WebAuthnService as IWebAuthnService,
} from './types/webauthn.js';

// =============================================================================
// Configuration
// =============================================================================

export interface WebAuthnConfig {
    rpName: string;           // "AB-OS Smart Browser"
    rpID: string;             // "localhost" or "abos.example.com"
    origin: string;           // "https://localhost:3000"
    timeout?: number;         // Default: 60000ms
}

// =============================================================================
// In-Memory Storage (Replace with Vault in production)
// =============================================================================

const challengeStore = new Map<string, { challenge: string; expires: number }>();
const passkeyStore = new Map<string, StoredPasskey>();

function storeChallenge(userId: string, challenge: string): void {
    challengeStore.set(userId, {
        challenge,
        expires: Date.now() + 5 * 60 * 1000, // 5 minutes
    });
}

function getChallenge(userId: string): string | null {
    const stored = challengeStore.get(userId);
    if (!stored) return null;
    if (Date.now() > stored.expires) {
        challengeStore.delete(userId);
        return null;
    }
    return stored.challenge;
}

// =============================================================================
// WebAuthn Service Implementation
// =============================================================================

export class WebAuthnService implements IWebAuthnService {
    private config: WebAuthnConfig;

    constructor(config: WebAuthnConfig) {
        this.config = {
            timeout: 60000,
            ...config,
        };
    }

    // ---------------------------------------------------------------------------
    // Registration
    // ---------------------------------------------------------------------------

    async createRegistrationOptions(
        request: PasskeyRegistrationRequest
    ): Promise<PublicKeyCredentialCreationOptions> {
        // Get existing credentials to exclude
        const existingCredentials = await this.listPasskeys(request.user_id);

        const options = await generateRegistrationOptions({
            rpName: this.config.rpName,
            rpID: this.config.rpID,
            userID: request.user_id,
            userName: request.user_name,
            userDisplayName: request.user_display_name,
            timeout: this.config.timeout,
            attestationType: request.attestation || 'none',
            authenticatorSelection: {
                authenticatorAttachment: request.authenticator_attachment,
                residentKey: request.resident_key || 'preferred',
                userVerification: request.user_verification || 'preferred',
            },
            excludeCredentials: existingCredentials.map(cred => ({
                id: Buffer.from(cred.credential_id, 'base64url'),
                type: 'public-key',
                transports: cred.transports,
            })),
        });

        // Store challenge for verification
        storeChallenge(request.user_id, options.challenge);

        return options as unknown as PublicKeyCredentialCreationOptions;
    }

    async verifyRegistration(
        credential: Credential,
        expectedChallenge: string
    ): Promise<PasskeyRegistrationResponse> {
        const verification = await verifyRegistrationResponse({
            response: credential as any,
            expectedChallenge,
            expectedOrigin: this.config.origin,
            expectedRPID: this.config.rpID,
        });

        if (!verification.verified || !verification.registrationInfo) {
            throw new Error('Registration verification failed');
        }

        const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

        // Create stored passkey
        const passkey: StoredPasskey = {
            id: nanoid(),
            credential_id: Buffer.from(credentialID).toString('base64url'),
            user_id: '', // Set by caller
            public_key_spki: Buffer.from(credentialPublicKey).toString('base64'),
            name: 'Passkey',
            created_at: new Date().toISOString(),
            use_count: 0,
            transports: [],
            backup_eligible: verification.registrationInfo.credentialBackedUp || false,
            backup_state: false,
            is_primary: false,
            is_revoked: false,
        };

        return {
            credential_id: passkey.credential_id,
            public_key: passkey.public_key_spki,
            transports: passkey.transports,
            created_at: passkey.created_at,
        };
    }

    // ---------------------------------------------------------------------------
    // Authentication
    // ---------------------------------------------------------------------------

    async createAuthenticationOptions(
        request: PasskeyAuthRequest
    ): Promise<PublicKeyCredentialRequestOptions> {
        const allowCredentials = request.allow_credentials?.map(id => ({
            id: Buffer.from(id, 'base64url'),
            type: 'public-key' as const,
        }));

        const options = await generateAuthenticationOptions({
            rpID: this.config.rpID,
            timeout: request.timeout || this.config.timeout,
            userVerification: request.user_verification || 'preferred',
            allowCredentials,
        });

        // Store challenge
        storeChallenge(request.challenge, options.challenge);

        return options as unknown as PublicKeyCredentialRequestOptions;
    }

    async verifyAuthentication(
        credential: Credential,
        expectedChallenge: string
    ): Promise<PasskeyAuthResponse> {
        // Get stored passkey
        const credentialId = (credential as any).id;
        const storedPasskey = Array.from(passkeyStore.values()).find(
            p => p.credential_id === credentialId
        );

        if (!storedPasskey) {
            throw new Error('Passkey not found');
        }

        const verification = await verifyAuthenticationResponse({
            response: credential as any,
            expectedChallenge,
            expectedOrigin: this.config.origin,
            expectedRPID: this.config.rpID,
            authenticator: {
                credentialID: Buffer.from(storedPasskey.credential_id, 'base64url'),
                credentialPublicKey: Buffer.from(storedPasskey.public_key_spki, 'base64'),
                counter: storedPasskey.use_count,
            },
        });

        if (!verification.verified) {
            throw new Error('Authentication verification failed');
        }

        // Update use count
        storedPasskey.use_count = verification.authenticationInfo.newCounter;
        storedPasskey.last_used_at = new Date().toISOString();
        passkeyStore.set(storedPasskey.id, storedPasskey);

        return {
            credential_id: storedPasskey.credential_id,
            authenticator_data: Buffer.from(verification.authenticationInfo.authenticatorData || []).toString('base64'),
            client_data_json: '',
            signature: '',
            user_verified: verification.authenticationInfo.userVerified,
            authenticator_attachment: 'platform',
        };
    }

    // ---------------------------------------------------------------------------
    // Management
    // ---------------------------------------------------------------------------

    async listPasskeys(userId: string): Promise<StoredPasskey[]> {
        return Array.from(passkeyStore.values()).filter(
            p => p.user_id === userId && !p.is_revoked
        );
    }

    async revokePasskey(passkeyId: string): Promise<void> {
        const passkey = passkeyStore.get(passkeyId);
        if (passkey) {
            passkey.is_revoked = true;
            passkeyStore.set(passkeyId, passkey);
        }
    }

    async renamePasskey(passkeyId: string, newName: string): Promise<void> {
        const passkey = passkeyStore.get(passkeyId);
        if (passkey) {
            passkey.name = newName;
            passkeyStore.set(passkeyId, passkey);
        }
    }

    async initiateRecovery(request: any): Promise<{ recovery_token: string }> {
        // Generate secure recovery token
        const token = nanoid(32);
        return { recovery_token: token };
    }

    async completeRecovery(
        recoveryToken: string,
        newCredential: Credential
    ): Promise<PasskeyRegistrationResponse> {
        // Verify recovery token and register new passkey
        return this.verifyRegistration(newCredential, recoveryToken);
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    async storePasskey(passkey: StoredPasskey): Promise<void> {
        passkeyStore.set(passkey.id, passkey);
    }

    async getPasskey(credentialId: string): Promise<StoredPasskey | null> {
        return Array.from(passkeyStore.values()).find(
            p => p.credential_id === credentialId
        ) || null;
    }
}
