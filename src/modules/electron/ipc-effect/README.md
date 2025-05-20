# Electron IPC - EffectTS Bridge

Electron's Inter-Process Communication (IPC) [serializes objects to pass them between processes](https://www.electronjs.org/docs/latest/tutorial/ipc#object-serialization). Also, the way Electron gives us for a two-way renderer-to-main communication is [ipcRenderer.invoke](https://www.electronjs.org/docs/latest/tutorial/ipc#object-serialization), which returns a Promise.

This module is used to bridge an API whose methods return `Effect` types (from [Effect](https://effect.website/)) with these challenges that Electron IPC brings. Specifically, it exposes an `invokeEffect` generic function, which under the hood uses [Effect.tryPromise](https://effect.website/docs/getting-started/creating-effects/#trypromise) to transform the promise returned by `ipcRenderer.invoke` to an Effect of the correct type.

When this promise is rejected, we deserialize the caught error and try to re-create it with the proper class, so that the result is an `Effect` whose error types match the original one used by the main Electron process. We also require a fallback error type in case this deserialization is not successful.
