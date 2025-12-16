import type { Endpoints } from '@octokit/types';
import * as Cause from 'effect/Cause';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Ref from 'effect/Ref';
import * as Schedule from 'effect/Schedule';

import { buildConfig } from '../../../../modules/config';
import { mapErrorTo } from '../../../../utils/errors';
import { SyncProviderError } from '../errors';

type UserResponse = Endpoints['GET /user']['response']['data'];

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const ACCESS_TOKEN_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';
const USER_URL = 'https://api.github.com/user';

type RequestDeviceCodeGithubApiResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

type RequestDeviceCodeResponse = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
};

type RequestAccessTokenInput = RequestDeviceCodeResponse;

type RequestAccessTokenGithubApiSuccessResponse = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  scope: string;
  token_type: string;
};

type RequestAccessTokenGithubApiErrorResponse = {
  error:
    | 'authorization_pending'
    | 'slow_down'
    | 'expired_token'
    | 'access_denied';
};

type RequestAccessTokenGithubApiResponse =
  | RequestAccessTokenGithubApiSuccessResponse
  | RequestAccessTokenGithubApiErrorResponse;

type RequestAccessTokenResponse = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
  scope: string;
  tokenType: string;
};

export type GithubUserInfo = {
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string;
};

export type GithubDeviceFlowVerificationInfo = {
  // A verification code that your application should display so that the user can enter the code in a browser.
  // This code is 8 characters with a hyphen in the middle. For example, WDJB-MJHT.
  userCode: string;
  // The URL where users need to enter their user_code
  verificationUri: string;
};

export type GithubDeviceFlowResponse = {
  token: string;
  userInfo: GithubUserInfo;
};

export const requestDeviceCode = (): Effect.Effect<
  RequestDeviceCodeResponse,
  SyncProviderError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(DEVICE_CODE_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: buildConfig.githubAppClientId,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to request device code: ${response.statusText}`
          );
        }

        return (await response.json()) as RequestDeviceCodeGithubApiResponse;
      },
      catch: mapErrorTo(
        SyncProviderError,
        'Error in getting the current branch'
      ),
    }),
    Effect.map(
      ({ device_code, user_code, verification_uri, expires_in, interval }) => ({
        deviceCode: device_code,
        userCode: user_code,
        verificationUri: verification_uri,
        expiresIn: expires_in,
        interval,
      })
    )
  );

const GithubAuthorizationPendingErrorTag = 'GithubAuthorizationPendingError';
class GithubAuthorizationPendingError extends Cause.YieldableError {
  readonly _tag = GithubAuthorizationPendingErrorTag;
}

const GithubAuthorizationSlowDownErrorTag = 'GithubAuthorizationSlowDownError';
class GithubAuthorizationSlowDownError extends Cause.YieldableError {
  readonly _tag = GithubAuthorizationSlowDownErrorTag;
}

type RequestAccessTokenError =
  | GithubAuthorizationPendingError
  | GithubAuthorizationSlowDownError
  | SyncProviderError;

const requestAccessToken = (
  input: RequestAccessTokenInput
): Effect.Effect<RequestAccessTokenResponse, RequestAccessTokenError, never> =>
  pipe(
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(ACCESS_TOKEN_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: buildConfig.githubAppClientId,
            device_code: input.deviceCode,
            grant_type: ACCESS_TOKEN_GRANT_TYPE,
          }),
        });

        return (await response.json()) as RequestAccessTokenGithubApiResponse;
      },
      catch: mapErrorTo(SyncProviderError, 'Error polling for access token'),
    }),
    Effect.flatMap(
      (
        githubApiResponse
      ): Effect.Effect<
        RequestAccessTokenResponse,
        RequestAccessTokenError,
        never
      > => {
        if ('access_token' in githubApiResponse) {
          const response: RequestAccessTokenResponse = {
            accessToken: githubApiResponse.access_token,
            expiresIn: githubApiResponse.expires_in,
            refreshToken: githubApiResponse.refresh_token,
            refreshTokenExpiresIn: githubApiResponse.refresh_token_expires_in,
            scope: githubApiResponse.scope,
            tokenType: githubApiResponse.token_type,
          };

          return Effect.succeed(response);
        } else if (githubApiResponse.error === 'authorization_pending') {
          return Effect.fail(
            new GithubAuthorizationPendingError(
              `Token request failed: ${githubApiResponse.error}`
            )
          );
        } else if (githubApiResponse.error === 'slow_down') {
          return Effect.fail(
            new GithubAuthorizationSlowDownError(
              `Token request failed: ${githubApiResponse.error}`
            )
          );
        } else {
          return Effect.fail(
            new SyncProviderError(
              `Token request failed: ${githubApiResponse.error}`
            )
          );
        }
      }
    )
  );

const tokenRequestPollingScheduleEffect = ({
  initialIntervalSeconds,
  expiresInSeconds,
}: {
  initialIntervalSeconds: number;
  expiresInSeconds: number;
}): Effect.Effect<
  Schedule.Schedule<Duration.Duration, RequestAccessTokenError, never>,
  never,
  never
> =>
  pipe(
    Ref.make(initialIntervalSeconds),
    Effect.map((intervalRef) =>
      pipe(
        // Timeout schedule - outputs elapsed Duration.
        // The output type doesn't change in the next steps of the pipeline.
        pipe(
          Schedule.elapsed,
          Schedule.whileOutput((elapsed) =>
            Duration.lessThan(elapsed, Duration.seconds(expiresInSeconds))
          )
        ),

        // Only retry on specific errors
        Schedule.whileInput(
          (error: RequestAccessTokenError) =>
            error._tag === GithubAuthorizationPendingErrorTag ||
            error._tag === GithubAuthorizationSlowDownErrorTag
        ),

        // Update the Ref when we see slow_down
        Schedule.tapInput((error: RequestAccessTokenError) =>
          error._tag === GithubAuthorizationSlowDownErrorTag
            ? Ref.update(intervalRef, (n) => n + initialIntervalSeconds)
            : Effect.void
        ),

        // Set delay based on current Ref value
        Schedule.modifyDelayEffect(() =>
          pipe(
            Ref.get(intervalRef),
            Effect.map((interval) => Duration.seconds(interval))
          )
        )
      )
    )
  );

const pollForToken = (
  input: RequestAccessTokenInput
): Effect.Effect<RequestAccessTokenResponse, SyncProviderError, never> =>
  pipe(
    tokenRequestPollingScheduleEffect({
      initialIntervalSeconds: input.interval,
      expiresInSeconds: input.expiresIn,
    }),
    Effect.flatMap((schedule) =>
      pipe(requestAccessToken(input), Effect.retry(schedule))
    ),
    Effect.catchAll((err) => Effect.fail(new SyncProviderError(err.message)))
  );

const getAuthenticatedUser = (
  token: string
): Effect.Effect<GithubUserInfo, SyncProviderError, never> =>
  pipe(
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(USER_URL, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to get user: ${response.statusText}`);
        }

        return (await response.json()) as UserResponse;
      },
      catch: mapErrorTo(SyncProviderError, 'Error getting authenticated user'),
    }),
    Effect.map((user) => ({
      login: user.login,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
    }))
  );

export const githubAuthUsingDeviceFlow = (
  onDeviceVerificationInfoAvailable: (
    verificationInfo: GithubDeviceFlowVerificationInfo
  ) => void
): Effect.Effect<GithubDeviceFlowResponse, SyncProviderError, never> =>
  pipe(
    requestDeviceCode(),
    Effect.tap(({ userCode, verificationUri }) =>
      Effect.sync(() => {
        // Callback to the caller so that we can display verification info (code)
        // to the user and prompt them to fill it in their browser.
        onDeviceVerificationInfoAvailable({ userCode, verificationUri });
      })
    ),
    // Step 2: Poll for token
    Effect.flatMap((deviceCodeResponse) => pollForToken(deviceCodeResponse)),
    // Step 3: Get user and installations in parallel
    Effect.flatMap(({ accessToken: token }) =>
      pipe(
        getAuthenticatedUser(token),
        Effect.map((userInfo) => ({
          token,
          userInfo,
        }))
      )
    )
  );
