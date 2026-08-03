const MONZO_API_URL = 'https://api.monzo.com';
const MONZO_AUTH_URL = 'https://auth.monzo.com';

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getMonzoConfiguration() {
  return {
    clientId: requireEnvironmentVariable('MONZO_CLIENT_ID'),
    clientSecret: requireEnvironmentVariable('MONZO_CLIENT_SECRET'),
    redirectUri: requireEnvironmentVariable('MONZO_REDIRECT_URI'),
  };
}

/**
 * Creates the URL used to send the administrator to Monzo
 * for OAuth approval.
 */
export function createMonzoAuthorisationUrl(state: string): string {
  const { clientId, redirectUri } = getMonzoConfiguration();

  const url = new URL(MONZO_AUTH_URL);

  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  return url.toString();
}

export type MonzoTokenResponse = {
  access_token: string;
  client_id: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
  user_id: string;
};

type MonzoApiError = {
  error?: string;
  error_description?: string;
  message?: string;
};

/**
 * Exchanges the callback authorisation code for OAuth tokens.
 */
export async function exchangeMonzoAuthorisationCode(
  code: string,
): Promise<MonzoTokenResponse> {
  const { clientId, clientSecret, redirectUri } =
    getMonzoConfiguration();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(`${MONZO_API_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  });

  return readMonzoJson<MonzoTokenResponse>(
    response,
    'Unable to complete the Monzo authorisation.',
  );
}

export type MonzoRefreshTokenResponse = {
  access_token: string;
  client_id: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
  user_id: string;
};

/**
 * Exchanges a refresh token for a new access token and refresh token.
 */
export async function refreshMonzoAccessToken(
  refreshToken: string,
): Promise<MonzoRefreshTokenResponse> {
  const { clientId, clientSecret } = getMonzoConfiguration();

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(`${MONZO_API_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  });

  return readMonzoJson<MonzoRefreshTokenResponse>(
    response,
    'Unable to refresh the Monzo access token.',
  );
}

export type MonzoAccount = {
  id: string;
  description: string;
  created: string;
  type?: string;
  account_type?: string;
  closed?: boolean;
  account_number?: string;
  sort_code?: string;
  owners?: Array<{
    user_id?: string;
    preferred_name?: string;
    preferred_first_name?: string;
  }>;
};

type MonzoAccountsResponse = {
  accounts: MonzoAccount[];
};
export type MonzoBalanceResponse = {
  balance: number;
  total_balance: number;
  currency: string;
  spend_today: number;
  balance_including_flexible_savings?: number;
  local_currency?: string;
  local_exchange_rate?: number;
  local_spend?: Array<{
    spend_today: number;
    currency: string;
  }>;
};

/**
 * Returns every open account available through this OAuth connection.
 *
 * The browser must still ask the user to select the Syntra Grid
 * Business account explicitly.
 */
export async function getMonzoAccounts(
  accessToken: string,
): Promise<MonzoAccount[]> {
  const response = await fetch(`${MONZO_API_URL}/accounts`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const result = await readMonzoJson<MonzoAccountsResponse>(
    response,
    'Unable to retrieve your Monzo accounts.',
  );

  return result.accounts.filter((account) => !account.closed);
}

/**
 * Returns the balance for one explicitly selected Monzo account.
 */
export async function getMonzoBalance(
  accessToken: string,
  accountId: string,
): Promise<MonzoBalanceResponse> {
  const url = new URL(`${MONZO_API_URL}/balance`);

  url.searchParams.set('account_id', accountId);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  return readMonzoJson<MonzoBalanceResponse>(
    response,
    'Unable to retrieve the Monzo balance.',
  );
}

async function readMonzoJson<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const responseText = await response.text();

  let result: T | MonzoApiError;

  try {
    result = JSON.parse(responseText) as T | MonzoApiError;
  } catch {
    console.error('Monzo returned an invalid response:', {
      status: response.status,
      body: responseText.slice(0, 500),
    });

    throw new Error(`${fallbackMessage} Monzo returned invalid JSON.`);
  }

  if (!response.ok) {
    const error = result as MonzoApiError;

    console.error('Monzo API request failed:', {
      status: response.status,
      error: error.error,
      description: error.error_description,
      message: error.message,
    });

    throw new Error(
      error.error_description ||
        error.message ||
        error.error ||
        fallbackMessage,
    );
  }

  return result as T;
}