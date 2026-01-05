import React from 'react';
import { ChevronDown } from 'lucide-react';

interface TimelineEntry {
    id: string;
    time: string;
    agent: string;
    action: string;
    policy?: string;
    policyStatus?: 'allowed' | 'readonly' | 'approval';
}

interface IntelligencePanelProps {
    timeline: TimelineEntry[];
    networkData?: { label: string; value: number }[];
    domData?: { label: string; value: number }[];
}

export function IntelligencePanel({
    timeline,
    networkData = [],
    domData = [],
}: IntelligencePanelProps) {
    return (
        <div className="glass-panel intelligence-panel">
            <div className="panel-section">
                <div className="panel-section-title">Intelligence & Audit View</div>
                <div className="panel-section-subtitle">Live action timeline</div>

                <div className="timeline">
                    {timeline.map((entry) => (
                        <div key={entry.id} className="timeline-entry">
                            <div className="timeline-dot" />
                            <div className="timeline-content">
                                <span className="timeline-time">[{entry.time}]</span>{' '}
                                <span className="timeline-text">
                                    {entry.agent} {entry.action}
                                </span>
                                {entry.policy && (
                                    <>
                                        <br />
                                        <span className="timeline-text">Policy: </span>
                                        <span className="timeline-policy">{entry.policy}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="panel-section">
                <div className="panel-section-header">
                    <span className="panel-section-title">Network Provenance</span>
                    <ChevronDown size={16} />
                </div>
                <div className="provenance-chart">
                    {networkData.map((item, i) => (
                        <div key={i} className="chart-bar">
                            <div className="chart-label">{item.label}</div>
                            <div className="chart-value" style={{ width: `${item.value}%` }} />
                        </div>
                    ))}
                </div>
            </div>

            <div className="panel-section">
                <div className="panel-section-header">
                    <span className="panel-section-title">DOM Provenance</span>
                    <ChevronDown size={16} />
                </div>
                <div className="provenance-chart">
                    {domData.map((item, i) => (
                        <div key={i} className="chart-bar">
                            <div className="chart-label">{item.label}</div>
                            <div className="chart-value" style={{ width: `${item.value}%` }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
