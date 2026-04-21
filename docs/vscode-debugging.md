# VSCode Debugging

It is possible to attach breakpoints to the main process code in VSCode if you do the following:

1. Run `pnpm run debug` **from your OS terminal** (outside VSCode)
2. Manually attach the VSCode debugger via the VSCode UI

Don't forget to close the debugger in the end of your session.

**Note:** There is an issue that seems to be related to EffectTS runtime when you start the app from the VSCode integrated terminal (we get Effect-related errors we don't get when we run it from the OS terminal).
