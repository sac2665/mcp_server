export interface Env {
  APEX_API_BASE_URL: string;
  AWS_COGNITO_REGION: string;
  AWS_COGNITO_POOL_ID: string;
  AWS_COGNITO_CLIENT_ID: string;
  APEX_SERVICE_USERNAME: string;
  APEX_SERVICE_PASSWORD: string;
  MCP_SHARED_SECRET: string;
}

export interface CognitoToken {
  AccessToken: string;
  RefreshToken: string;
  ExpiresIn: number;
  // Internal tracking
  _cachedAt: number;
  _expiresAt: number;
}

export interface ApexResponse<T> {
  system: Record<string, unknown>;
  response: T;
}

export interface ApexError {
  statusCode: number;
  error: string;
  message: string;
}

export interface Workout {
  id: number;
  title: string;
  description: string;
  discriminator: string;
  duration: number;
  level: number;
  weights: boolean;
  containsProfanity: boolean;
  genre: string;
  instructor: Instructor;
  music: unknown;
  thumbnailUrl: string;
  resizedUrls: unknown;
  rating: number;
  playlistId: number;
  activityType: number;
  videoUrl?: string;
}

export interface Instructor {
  id: number;
  name: string;
  bio: string;
  rating: number;
  profileUrl: string;
  resizedUrls: unknown;
  isArchived: boolean;
}
