import { Env, CognitoToken } from "./types";

let cachedToken: CognitoToken | null = null;

export async function getAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // If we have a cached token and it's not close to expiry, reuse it
  if (cachedToken && now < cachedToken._expiresAt - 300) {
    return cachedToken.AccessToken;
  }

  // If we have a refresh token, try refreshing
  if (cachedToken?.RefreshToken) {
    try {
      const refreshed = await refreshToken(env, cachedToken.RefreshToken);
      cachedToken = refreshed;
      return refreshed.AccessToken;
    } catch {
      // Fall through to full auth
    }
  }

  // Full authentication
  const token = await authenticate(env);
  cachedToken = token;
  return token.AccessToken;
}

async function authenticate(env: Env): Promise<CognitoToken> {
  const url = `https://cognito-idp.${env.AWS_COGNITO_REGION}.amazonaws.com/`;
  const body = {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: env.AWS_COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: env.APEX_SERVICE_USERNAME,
      PASSWORD: env.APEX_SERVICE_PASSWORD,
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-1.1-json",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Cognito auth failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as {
    AuthenticationResult: {
      AccessToken: string;
      RefreshToken: string;
      ExpiresIn: number;
    };
  };

  const result = data.AuthenticationResult;
  const now = Math.floor(Date.now() / 1000);

  return {
    AccessToken: result.AccessToken,
    RefreshToken: result.RefreshToken,
    ExpiresIn: result.ExpiresIn,
    _cachedAt: now,
    _expiresAt: now + result.ExpiresIn,
  };
}

async function refreshToken(
  env: Env,
  refreshToken: string
): Promise<CognitoToken> {
  const url = `https://cognito-idp.${env.AWS_COGNITO_REGION}.amazonaws.com/`;
  const body = {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: env.AWS_COGNITO_CLIENT_ID,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-1.1-json",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Cognito refresh failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as {
    AuthenticationResult: {
      AccessToken: string;
      ExpiresIn: number;
      RefreshToken?: string;
    };
  };

  const result = data.AuthenticationResult;
  const now = Math.floor(Date.now() / 1000);

  return {
    AccessToken: result.AccessToken,
    RefreshToken: result.RefreshToken || cachedToken?.RefreshToken || "",
    ExpiresIn: result.ExpiresIn,
    _cachedAt: now,
    _expiresAt: now + result.ExpiresIn,
  };
}
