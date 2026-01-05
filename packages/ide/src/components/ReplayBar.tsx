import React from 'react';
import { Play, GitBranch } from 'lucide-react';

interface ReplayBarProps {
    progress: number;
    onProgressChange: (progress: number) => void;
    onPlay: () => void;
    onFork: () => void;
    thumbnails: string[];
    activeThumbnail: number;
}

export function ReplayBar({
    progress,
    onProgressChange,
    onPlay,
    onFork,
    thumbnails,
    activeThumbnail,
}: ReplayBarProps) {
    return (
        <div className="glass-panel replay-bar">
            <div className="replay-controls">
                <button className="replay-btn" onClick={onPlay} title="Play">
                    <Play size={16} />
                </button>
                <span className="replay-label">Replay</span>
            </div>

            <div className="replay-slider">
                <div
                    className="replay-slider-progress"
                    style={{ width: `${progress}%` }}
                />
                <div
                    className="replay-slider-thumb"
                    style={{ left: `${progress}%` }}
                />
            </div>

            <button className="fork-btn" onClick={onFork}>
                <GitBranch size={14} style={{ marginRight: 4 }} />
                Fork Execution
            </button>

            <div className="replay-thumbnails">
                {thumbnails.map((thumb, i) => (
                    <div
                        key={i}
                        className={`replay-thumbnail ${i === activeThumbnail ? 'active' : ''}`}
                    >
                        {thumb && <img src={thumb} alt={`State ${i + 1}`} />}
                    </div>
                ))}
            </div>
        </div>
    );
}

interface PolicyBadge {
    label: string;
    type: 'allowed' | 'readonly' | 'approval';
}

interface PolicyBarProps {
    policies: PolicyBadge[];
}

export function PolicyBar({ policies }: PolicyBarProps) {
    return (
        <div className="policy-bar">
            <span className="policy-label">Policy</span>
            <div className="policy-badges">
                {policies.map((policy, i) => (
                    <span key={i} className={`policy-badge ${policy.type}`}>
                        {policy.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
