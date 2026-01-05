export const authCallback = (authToken: string) => () => ({
  username: 'oauth2', // arbitrary / doesn't matter for token auth
  password: authToken,
});
