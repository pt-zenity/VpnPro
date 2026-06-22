import axios, { AxiosError } from 'axios';

const AGENT_TIMEOUT = 60000; // 60 seconds

export async function callAgentApi(
  host: string,
  path: string,
  payload: Record<string, unknown>,
  apiToken: string,
): Promise<any> {
  const url = `https://${host}/api/agent${path}`;

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: AGENT_TIMEOUT,
      // For self-hosted with self-signed certs
      httpsAgent: undefined, // TODO: configure for self-signed certs
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      if (axiosError.response) {
        return {
          success: false,
          message: axiosError.response.data?.message || 'Agent request failed',
        };
      }
      if (axiosError.request) {
        return {
          success: false,
          message: 'Agent unreachable',
        };
      }
    }
    return {
      success: false,
      message: 'Unknown error',
    };
  }
}
