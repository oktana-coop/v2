export type GithubUserInfo = {
  username: string;
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
