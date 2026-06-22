export function generateInstallCommand(registrationToken: string, panelUrl?: string): string {
  const url = panelUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.PANEL_URL || 'https://panel.example.com';

  // Use -L flag to follow redirects (GitHub/raw URLs require this)
  return `curl -fsSL ${url}/api/agent/install.sh | AGENT_TOKEN=${registrationToken} PANEL_URL=${url} bash`;
}

export function generateOneLineInstall(registrationToken: string, panelUrl?: string): string {
  const command = generateInstallCommand(registrationToken, panelUrl);
  return `sudo bash -c "${command}"`;
}

export function generateCurlCommand(registrationToken: string, panelUrl?: string): string {
  const url = panelUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.PANEL_URL || 'https://panel.example.com';

  return `curl -fsSL ${url}/api/agent/install.sh | AGENT_TOKEN=${registrationToken} PANEL_URL=${url} bash`;
}
