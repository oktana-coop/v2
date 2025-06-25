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
  };
};
