import {
  cliTypes,
  type Wasm,
} from '../../../../../modules/infrastructure/wasm';
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
        type: cliTypes.HS_LIB,
        args: [
          'v2-hs-lib',
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
        type: cliTypes.HS_LIB,
        args: [
          'v2-hs-lib',
          'toAutomerge',
          '--from',
          representationToCliArg(representation),
          input,
        ],
      });

      return output;
    };

  const transform: RepresentationTransform['transform'] = async ({
    from,
    to,
    input,
  }) => {
    const output = await runWasiCLI({
      type: cliTypes.HS_LIB,
      args: [
        'v2-hs-lib',
        'convert',
        '--from',
        representationToCliArg(from),
        '--to',
        representationToCliArg(to),
        input,
      ],
    });

    return output;
  };

  return {
    transform,
    transformFromAutomerge,
    transformToAutomerge,
  };
};
