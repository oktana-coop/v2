# Electron IPC - EffectTS Bridge

The scope of this module is to give us the tools to channel Effects through process boundaries in Electron. This way we'll be able to handle functions that return Effects consistently across browser and desktop versions of the app.

Electron's Inter-Process Communication (IPC) [serializes objects to pass them between processes](https://www.electronjs.org/docs/latest/tutorial/ipc#object-serialization). Also, the way Electron gives us for a two-way renderer-to-main communication is [ipcRenderer.invoke](https://www.electronjs.org/docs/latest/tutorial/ipc#object-serialization), which returns a Promise. More details can be found in the [relevant docs](https://www.electronjs.org/docs/latest/tutorial/ipc#pattern-2-renderer-to-main-two-way).

The important relevant note in the Electron documentation is [the following](https://www.electronjs.org/docs/latest/tutorial/ipc#1-listen-for-events-with-ipcmainhandle):

> Errors thrown through `handle` in the main process are not transparent as they are serialized and only the `message` property from the original error is provided to the renderer process.

Even worse, after experimenting with trying to convert the IPC promise into an Effect, the conclusion was that it **can't be done properly in the preload script** - it must happen in the renderer process, **after** the relevant function of the preload script has returned its results. And this is because:

- If we `throw` errors in the preload script, they evade the Effect failure pipelines and they are regular JS exceptions.
- If we `return` typed errors from the preload script (which would be the consistent thing to do with other cases of converting promises to effects), we get an error that the returned object cannot be cloned, which is related to crossing Electron process boundaries. So whatever we do, we need to deserialize/reconstruct the error after the preload script.

## Exposed Functions

In the process boundary we are working with **promises**, so we have to convert effect to promises and vice-versa to cross the boundary.

- `runPromiseSerializingErrorsForIPC`: Converts an `Effect` to a `Promise`. Leaves the successful result as-is, just wrapping it in an object. Converts the error to a successful result (resolving, not rejecting the promise) and serializes it. It includes the error's `tag` in the serialized object so that we can reconstruct the typed error in the renderer. This is mostly used in the main process.
- `effectifyIPCPromise`: Converts a `Promise` to an `Effect`, checking for returned/resolved errors and deserializing them. It returns them as failures/errors in `Effect` so that we can process and handle them in effectful pipelines as failures. For the deserialization to happen, we must pass it an error registry of the available errors, whose keys must match the `tag`s of the errors. We must be careful to pass the proper registry of the expected/allowed errors according to the `Effect` we want to convert the `Promise` to. Unfortunately, this last part seems error-prone and something we should strive to improve and get more guarantees for type safety if possible.

## Exposed Type Utils

- `PromisifyEffects<T>`: This type util takes a TypeScript API whose functions return `Effect`s and returns a new one whose functions return `Promise`s, with the success type wrapped in `IPCResult`, which is a union type of the success and error results returned by `runPromiseSerializingErrorsForIPC`. The benefit of this type util is that we don't have to manually write the Promise-based APIs but calculate them from the Effect API. It's used in the preload script to describe the types of objects we use in the IPC boundary.
