import { open, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WASI } from 'node:wasi';

import { v4 as uuidv4 } from 'uuid';

import { cliTypes, type WasmCLIType } from '../../constants/cli-types';
import automergePandocWasm from '../../files/automerge-pandoc.wasm?url';
import type { RunWasiCLIArgs, Wasm } from '../../ports/wasm';

const getFilePath = ({ type }: { type: WasmCLIType }) => {
  switch (type) {
    case cliTypes.AUTOMERGE_PANDOC:
      return automergePandocWasm;
  }
};

const loadWasmCLIModules = async (): Promise<
  Record<WasmCLIType, WebAssembly.Module>
> => {
  // Using Promise.all to load all WASM files concurrently
  const wasmModules = await Promise.all(
    Object.values(cliTypes).map(async (type) => {
      const filePath = getFilePath({ type });
      const response = await fetch(filePath);
      const wasmBytes = await response.arrayBuffer();
      const wasmModule = await WebAssembly.compile(wasmBytes);
      const result: [WasmCLIType, WebAssembly.Module] = [type, wasmModule];
      return result;
    })
  );

  return wasmModules.reduce(
    (acc, [type, wasmModule]) => {
      acc[type] = wasmModule;
      return acc;
    },
    {} as Record<WasmCLIType, WebAssembly.Module>
  );
};

export const createAdapter = async (): Promise<Wasm> => {
  // Load all WASM modules during adapter creation
  const wasmCLIModules = await loadWasmCLIModules();

  return {
    runWasiCLI: async ({ type, args }: RunWasiCLIArgs) => {
      // Create a temporary file to capture WASI output.
      // This is needed because the WASI constructor takes a file descriptor, not a stream.
      const tempFileName = `wasi-output-${uuidv4()}.tmp`;
      const tempFilePath = join(tmpdir(), tempFileName);
      const tempFileHandle = await open(tempFilePath, 'w+');

      const wasi = new WASI({
        version: 'preview1',
        args,
        env: {},
        stdout: tempFileHandle.fd,
      });

      const instance = await WebAssembly.instantiate(wasmCLIModules[type], {
        wasi_snapshot_preview1: wasi.wasiImport,
      });

      wasi.start(instance);

      await tempFileHandle.close();

      const buffer = await readFile(tempFilePath);
      const output = new TextDecoder().decode(buffer);

      // Clean up: delete the temporary file
      await unlink(tempFilePath).catch(console.error);

      return output;
    },
  };
};
