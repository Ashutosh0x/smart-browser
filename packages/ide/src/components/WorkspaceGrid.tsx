import React from 'react';
import clsx from 'clsx';
import { MoreHorizontal } from 'lucide-react';
import type { AgentStatus } from './AgentConsole';

interface WorkspaceWindow {
    id: string;
    agentId: string;
    title: string;
    icon: React.ReactNode;
    status: AgentStatus;
    statusText: string;
    thumbnail?: string;
}

interface WorkspaceGridProps {
    windows: WorkspaceWindow[];
    activeWindowId: string | null;
    onWindowSelect: (id: string) => void;
}

export function WorkspaceGrid({
    windows,
    activeWindowId,
    onWindowSelect
}: WorkspaceGridProps) {
    return (
        <div className="workspace">
            <div className="workspace-header">Main Workspace</div>
            <div className="workspace-grid">
                {windows.map((window) => (
                    <div
                        key={window.id}
                        className={clsx('glass-panel agent-window', {
                            active: window.id === activeWindowId,
                        })}
                        onClick={() => onWindowSelect(window.id)}
                    >
                        <div className="agent-window-header">
                            <span className="agent-window-icon">{window.icon}</span>
                            <span className="agent-window-title">{window.title}</span>
                            <span className={clsx('agent-window-status', window.status)}>
                                {window.statusText}
                            </span>
                            <button className="agent-control-btn">
                                <MoreHorizontal size={14} />
                            </button>
                        </div>
                        <div className="agent-window-content">
                            {window.thumbnail ? (
                                <img src={window.thumbnail} alt={window.title} />
                            ) : (
                                <div className="agent-window-placeholder" />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
