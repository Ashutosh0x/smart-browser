'use client';

import React, { useState } from 'react';
import { Shield, Fingerprint, Key, AlertTriangle, Check, X } from 'lucide-react';
import clsx from 'clsx';

// =============================================================================
// Types
// =============================================================================

export interface ApprovalRequest {
    request_id: string;
    agent_name: string;
    action_type: 'purchase' | 'submit' | 'export' | 'delete' | 'auth' | 'custom';
    action_description: string;
    target_url: string;
    http_method?: string;
    payload_preview?: string;
    amount?: {
        value: number;
        currency: string;
    };
    requires_auth: 'none' | 'passkey' | 'platform' | 'hardware_key' | 'biometric';
    risk_level: 'low' | 'medium' | 'high';
    triggered_policies: string[];
}

interface SecureApprovalProps {
    request: ApprovalRequest;
    onApprove: (request_id: string, authMethod: string) => Promise<void>;
    onDeny: (request_id: string, reason?: string) => void;
    onCancel: () => void;
}

// =============================================================================
// Styles (inline for component isolation)
// =============================================================================

const styles = {
    overlay: {
        position: 'fixed' as const,
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    },
    sheet: {
        background: 'var(--panel-glass)',
        border: '2px solid var(--accent-primary)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 0 60px var(--accent-glow)',
        maxWidth: '500px',
        width: '90%',
        padding: 'var(--spacing-xl)',
        animation: 'slide-up 0.2s ease',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)',
    },
    shieldIcon: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'var(--accent-glow)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 'var(--font-size-lg)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--text-primary)',
    },
    subtitle: {
        fontSize: 'var(--font-size-sm)',
        color: 'var(--text-secondary)',
    },
    section: {
        marginBottom: 'var(--spacing-lg)',
        padding: 'var(--spacing-md)',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
    },
    label: {
        fontSize: 'var(--font-size-xs)',
        color: 'var(--text-muted)',
        marginBottom: 'var(--spacing-xs)',
        textTransform: 'uppercase' as const,
    },
    value: {
        fontSize: 'var(--font-size-sm)',
        color: 'var(--text-primary)',
        fontFamily: 'monospace',
        wordBreak: 'break-all' as const,
    },
    amount: {
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--status-warning)',
    },
    riskBadge: {
        padding: 'var(--spacing-xs) var(--spacing-sm)',
        borderRadius: 'var(--radius-pill)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)',
    },
    buttons: {
        display: 'flex',
        gap: 'var(--spacing-md)',
        marginTop: 'var(--spacing-xl)',
    },
    button: {
        flex: 1,
        padding: 'var(--spacing-md)',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        fontSize: 'var(--font-size-md)',
        fontWeight: 'var(--font-weight-medium)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--spacing-sm)',
        transition: 'all var(--transition-fast)',
    },
    approveBtn: {
        background: 'var(--status-success)',
        color: 'white',
    },
    denyBtn: {
        background: 'transparent',
        border: '1px solid var(--status-error)',
        color: 'var(--status-error)',
    },
    authPrompt: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-md)',
        background: 'var(--accent-glow)',
        borderRadius: 'var(--radius-md)',
        marginTop: 'var(--spacing-md)',
    },
};

// =============================================================================
// Component
// =============================================================================

export function SecureApprovalSheet({
    request,
    onApprove,
    onDeny,
    onCancel,
}: SecureApprovalProps) {
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleApprove = async () => {
        setIsAuthenticating(true);
        setError(null);

        try {
            // In production: Trigger WebAuthn or biometric prompt here
            await onApprove(request.request_id, request.requires_auth);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Authentication failed');
            setIsAuthenticating(false);
        }
    };

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'high': return 'var(--status-error)';
            case 'medium': return 'var(--status-warning)';
            default: return 'var(--status-success)';
        }
    };

    const getAuthIcon = () => {
        switch (request.requires_auth) {
            case 'hardware_key': return <Key size={24} />;
            case 'biometric': return <Fingerprint size={24} />;
            default: return <Fingerprint size={24} />;
        }
    };

    return (
        <div style={styles.overlay} onClick={onCancel}>
            <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.shieldIcon}>
                        <Shield size={24} color="var(--accent-primary)" />
                    </div>
                    <div>
                        <div style={styles.title}>Approval Required</div>
                        <div style={styles.subtitle}>Agent: {request.agent_name}</div>
                    </div>
                </div>

                {/* Action Description */}
                <div style={styles.section}>
                    <div style={styles.label}>Action</div>
                    <div style={styles.value}>{request.action_description}</div>
                </div>

                {/* Target URL */}
                <div style={styles.section}>
                    <div style={styles.label}>Target</div>
                    <div style={styles.value}>
                        {request.http_method && <span>[{request.http_method}] </span>}
                        {request.target_url}
                    </div>
                </div>

                {/* Amount (if purchase) */}
                {request.amount && (
                    <div style={styles.section}>
                        <div style={styles.label}>Amount</div>
                        <div style={styles.amount}>
                            {request.amount.currency} {request.amount.value.toFixed(2)}
                        </div>
                    </div>
                )}

                {/* Payload Preview */}
                {request.payload_preview && (
                    <div style={styles.section}>
                        <div style={styles.label}>Payload Preview</div>
                        <div style={styles.value}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                {request.payload_preview}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Risk Level & Policies */}
                <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
                    <span
                        style={{
                            ...styles.riskBadge,
                            background: getRiskColor(request.risk_level) + '20',
                            color: getRiskColor(request.risk_level),
                            border: `1px solid ${getRiskColor(request.risk_level)}`,
                        }}
                    >
                        <AlertTriangle size={12} style={{ marginRight: 4 }} />
                        {request.risk_level.toUpperCase()} RISK
                    </span>
                    {request.triggered_policies.map((policy, i) => (
                        <span key={i} style={{
                            ...styles.riskBadge,
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                        }}>
                            {policy}
                        </span>
                    ))}
                </div>

                {/* Auth Requirement */}
                {request.requires_auth !== 'none' && (
                    <div style={styles.authPrompt}>
                        {getAuthIcon()}
                        <div>
                            <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--text-primary)' }}>
                                {request.requires_auth === 'hardware_key' ? 'Security Key Required' : 'Passkey Required'}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                {request.requires_auth === 'hardware_key'
                                    ? 'Insert and tap your security key to approve'
                                    : 'Use Touch ID, Face ID, or Windows Hello to approve'
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div style={{
                        marginTop: 'var(--spacing-md)',
                        padding: 'var(--spacing-sm)',
                        background: 'var(--status-error-bg)',
                        color: 'var(--status-error)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                    }}>
                        {error}
                    </div>
                )}

                {/* Buttons */}
                <div style={styles.buttons}>
                    <button
                        style={{ ...styles.button, ...styles.denyBtn }}
                        onClick={() => onDeny(request.request_id)}
                        disabled={isAuthenticating}
                    >
                        <X size={18} />
                        Deny
                    </button>
                    <button
                        style={{ ...styles.button, ...styles.approveBtn }}
                        onClick={handleApprove}
                        disabled={isAuthenticating}
                    >
                        {isAuthenticating ? (
                            <>Authenticating...</>
                        ) : (
                            <>
                                <Check size={18} />
                                Approve
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
