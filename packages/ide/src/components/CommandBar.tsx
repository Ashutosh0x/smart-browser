import React from 'react';
import { Search, Sparkles } from 'lucide-react';

interface CommandBarProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    placeholder?: string;
    hint?: string;
}

export function CommandBar({
    value,
    onChange,
    onSubmit,
    placeholder = 'Tell Smart Browser what to do...',
    hint = 'Play music on Spotify, open my latest Gmail, open Photos, buy a novel on Amazon - do everything at once.'
}: CommandBarProps) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };

    return (
        <div className="command-bar">
            <div className="command-bar-container">
                <div className="glass-panel command-input-wrapper">
                    <Sparkles className="command-icon" size={20} />
                    <input
                        type="text"
                        className="command-input"
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button className="command-search-btn" onClick={onSubmit}>
                        <Search size={18} />
                    </button>
                </div>
                {hint && <p className="command-hint">{hint}</p>}
            </div>
        </div>
    );
}
