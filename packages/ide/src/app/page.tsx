'use client';

import React, { useState } from 'react';
import { Music, Mail, ShoppingCart, Image } from 'lucide-react';
import { useTheme } from '../stores/themeStore';
import {
    CommandBar,
    AgentConsole,
    WorkspaceGrid,
    IntelligencePanel,
    ReplayBar,
    PolicyBar
} from '../components';
import type { AgentInfo } from '../components';
import '../styles/globals.css';

// Demo data
const DEMO_AGENTS: AgentInfo[] = [
    {
        id: 'spotify',
        name: 'Spotify Agent',
        icon: <Music size={20} />,
        status: 'running',
        statusText: 'Running'
    },
    {
        id: 'gmail',
        name: 'Gmail Agent',
        icon: <Mail size={20} />,
        status: 'running',
        statusText: 'Running'
    },
    {
        id: 'amazon',
        name: 'Amazon Agent',
        icon: <ShoppingCart size={20} />,
        status: 'warning',
        statusText: 'Needs Approval'
    },
    {
        id: 'photos',
        name: 'Photos Agent',
        icon: <Image size={20} />,
        status: 'completed',
        statusText: 'Completed'
    },
];

const DEMO_WINDOWS = DEMO_AGENTS.map((agent) => ({
    id: `window-${agent.id}`,
    agentId: agent.id,
    title: `${agent.name.replace(' Agent', '')} Agent`,
    icon: agent.icon,
    status: agent.status,
    statusText: agent.status === 'running' ? 'Playing' :
        agent.status === 'warning' ? 'Approval Required' :
            agent.status === 'completed' ? 'Completed' : 'Reading',
}));

const DEMO_TIMELINE = [
    {
        id: '1',
        time: '09:45:10',
        agent: 'Spotify Agent',
        action: 'started playback.',
        policy: 'Allowed',
        policyStatus: 'allowed' as const,
    },
    {
        id: '2',
        time: '09:45:12',
        agent: 'Gmail Agent',
        action: 'accessed inbox.',
        policy: 'Read-Only',
        policyStatus: 'readonly' as const,
    },
    {
        id: '3',
        time: '09:45:15',
        agent: 'Amazon Agent',
        action: 'initiated purchase.',
        policy: 'Approval Required',
        policyStatus: 'approval' as const,
    },
];

const DEMO_POLICIES = [
    { label: 'Purchase Allowed', type: 'allowed' as const },
    { label: 'Read-Only', type: 'readonly' as const },
    { label: 'Approval Required', type: 'approval' as const },
    { label: 'Transferred Image', type: 'readonly' as const },
    { label: 'Approval Required', type: 'approval' as const },
];

export default function SmartBrowserApp() {
    // Apply theme
    useTheme();

    const [command, setCommand] = useState('');
    const [activeAgentId, setActiveAgentId] = useState<string | null>('spotify');
    const [activeWindowId, setActiveWindowId] = useState<string | null>('window-spotify');
    const [replayProgress, setReplayProgress] = useState(35);

    const handleCommandSubmit = () => {
        console.log('[Command]', command);
        // TODO: Send to planner
    };

    const handleAgentPause = (id: string) => {
        console.log('[Agent] Pause:', id);
    };

    const handleAgentStop = (id: string) => {
        console.log('[Agent] Stop:', id);
    };

    const handleAgentExpand = (id: string) => {
        console.log('[Agent] Expand:', id);
    };

    return (
        <div className="app-layout">
            {/* Command Bar */}
            <CommandBar
                value={command}
                onChange={setCommand}
                onSubmit={handleCommandSubmit}
            />

            {/* Main Content */}
            <div className="main-content">
                {/* Left: Agent Console */}
                <AgentConsole
                    agents={DEMO_AGENTS}
                    activeAgentId={activeAgentId}
                    onAgentSelect={setActiveAgentId}
                    onAgentPause={handleAgentPause}
                    onAgentStop={handleAgentStop}
                    onAgentExpand={handleAgentExpand}
                />

                {/* Center: Workspace */}
                <WorkspaceGrid
                    windows={DEMO_WINDOWS}
                    activeWindowId={activeWindowId}
                    onWindowSelect={setActiveWindowId}
                />

                {/* Right: Intelligence Panel */}
                <IntelligencePanel
                    timeline={DEMO_TIMELINE}
                    networkData={[
                        { label: '750K', value: 75 },
                        { label: '500K', value: 50 },
                        { label: '250K', value: 25 },
                    ]}
                    domData={[
                        { label: '200K', value: 80 },
                        { label: '150K', value: 60 },
                        { label: '100K', value: 40 },
                    ]}
                />
            </div>

            {/* Replay Bar */}
            <ReplayBar
                progress={replayProgress}
                onProgressChange={setReplayProgress}
                onPlay={() => console.log('[Replay] Play')}
                onFork={() => console.log('[Replay] Fork')}
                thumbnails={['', '', '', '']}
                activeThumbnail={1}
            />

            {/* Policy Bar */}
            <PolicyBar policies={DEMO_POLICIES} />
        </div>
    );
}
