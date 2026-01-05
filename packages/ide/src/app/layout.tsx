import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'AB-OS Smart Browser',
    description: 'AI-Native Browser Operating System - Command & Control Dashboard',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" data-theme="dark-neon" data-accent="cyan">
            <body>{children}</body>
        </html>
    );
}
