import { cliTypes, type Wasm } from '../../../wasm';
import { type RepresentationTransform } from '../../ports/representation-transform';
import { representationToCliArg } from './cli-args';

export const createAdapter = ({
  runWasiCLI,
}: {
  runWasiCLI: Wasm['runWasiCLI'];
}): RepresentationTransform => {
  const transformFromAutomerge: RepresentationTransform['transformFromAutomerge'] =
    async ({ spans, representation }) => {
      const output = await runWasiCLI({
        type: cliTypes.AUTOMERGE_PANDOC,
        args: [
          'automerge-pandoc',
          'fromAutomerge',
          '--to',
          representationToCliArg(representation),
          spans,
        ],
      });

      return output;
    };

  const transformToAutomerge: RepresentationTransform['transformToAutomerge'] =
    async ({ input, representation }) => {
      const output = await runWasiCLI({
        type: cliTypes.AUTOMERGE_PANDOC,
        args: [
          'automerge-pandoc',
          'toAutomerge',
          '--from',
          representationToCliArg(representation),
          input,
        ],
      });

      return output;
    };

  return {
    transformFromAutomerge,
    transformToAutomerge,
  };
};
