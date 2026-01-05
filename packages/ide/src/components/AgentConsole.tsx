import React from 'react';
import { Pause, Square, Maximize2 } from 'lucide-react';
import clsx from 'clsx';

export type AgentStatus = 'running' | 'paused' | 'completed' | 'warning' | 'error' | 'idle';

export interface AgentInfo {
    id: string;
    name: string;
    icon: React.ReactNode;
    status: AgentStatus;
    statusText: string;
}

interface AgentCardProps {
    agent: AgentInfo;
    isActive: boolean;
    onClick: () => void;
    onPause: () => void;
    onStop: () => void;
    onExpand: () => void;
}

function Waveform() {
    return (
        <div className="agent-waveform">
            <span style={{ height: '60%' }} />
            <span style={{ height: '100%' }} />
            <span style={{ height: '40%' }} />
            <span style={{ height: '80%' }} />
            <span style={{ height: '50%' }} />
        </div>
    );
}

export function AgentCard({
    agent,
    isActive,
    onClick,
    onPause,
    onStop,
    onExpand
}: AgentCardProps) {
    return (
        <div
            className={clsx('glass-panel agent-card', {
                active: isActive,
                running: agent.status === 'running',
            })}
            onClick={onClick}
        >
            <div className="agent-icon">
                {agent.icon}
            </div>

            <div className="agent-info">
                <div className="agent-name">{agent.name}</div>
                <div className={clsx('agent-status', agent.status)}>
                    {agent.statusText}
                </div>
            </div>

            {agent.status === 'running' && <Waveform />}

            <div className="agent-controls">
                <button
                    className="agent-control-btn"
                    onClick={(e) => { e.stopPropagation(); onPause(); }}
                    title="Pause"
                >
                    <Pause size={14} />
                </button>
                <button
                    className="agent-control-btn"
                    onClick={(e) => { e.stopPropagation(); onStop(); }}
                    title="Stop"
                >
                    <Square size={14} />
                </button>
                <button
                    className="agent-control-btn"
                    onClick={(e) => { e.stopPropagation(); onExpand(); }}
                    title="Expand"
                >
                    <Maximize2 size={14} />
                </button>
            </div>
        </div>
    );
}

interface AgentConsoleProps {
    agents: AgentInfo[];
    activeAgentId: string | null;
    onAgentSelect: (id: string) => void;
    onAgentPause: (id: string) => void;
    onAgentStop: (id: string) => void;
    onAgentExpand: (id: string) => void;
}

export function AgentConsole({
    agents,
    activeAgentId,
    onAgentSelect,
    onAgentPause,
    onAgentStop,
    onAgentExpand,
}: AgentConsoleProps) {
    return (
        <div className="glass-panel agent-console">
            <div className="agent-console-header">Agent Console</div>
            {agents.map((agent) => (
                <AgentCard
                    key={agent.id}
                    agent={agent}
                    isActive={agent.id === activeAgentId}
                    onClick={() => onAgentSelect(agent.id)}
                    onPause={() => onAgentPause(agent.id)}
                    onStop={() => onAgentStop(agent.id)}
                    onExpand={() => onAgentExpand(agent.id)}
                />
            ))}
        </div>
    );
}
