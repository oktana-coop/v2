export const isNodeError = (err: unknown): err is NodeJS.ErrnoException => {
  return err instanceof Error && 'code' in err;
};
