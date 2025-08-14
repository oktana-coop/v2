import {
  cliTypes,
  type Wasm,
} from '../../../../../modules/infrastructure/wasm';
import { type RepresentationTransform } from '../../ports/representation-transform';
import { representationToCliArg } from './cli-args';

export const createAdapter = ({
  runWasiCLIOutputingText,
}: {
  runWasiCLIOutputingText: Wasm['runWasiCLIOutputingText'];
}): RepresentationTransform => {
  const transform: RepresentationTransform['transform'] = async ({
    from,
    to,
    input,
  }) => {
    const output = await runWasiCLIOutputingText({
      type: cliTypes.HS_LIB,
      args: [
        'v2-hs-lib',
        'convertToText',
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
