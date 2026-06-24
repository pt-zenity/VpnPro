export function generateInstallCommand(registrationToken: string, panelUrl?: string): string {
  const url = panelUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.PANEL_URL || 'https://panel.example.com';

  return `curl -fsSL ${url}/api/agent/install.sh | AGENT_TOKEN=${registrationToken} PANEL_URL=${url} bash`;
}
