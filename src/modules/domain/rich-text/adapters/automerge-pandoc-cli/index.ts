import {
  cliTypes,
  type Wasm,
} from '../../../../../modules/infrastructure/wasm';
import { type RepresentationTransform } from '../../ports/representation-transform';
import { representationToCliArg } from './cli-args';

export const createAdapter = ({
  runWasiCLIOutputingText,
  runWasiCLIOutputingBinary,
}: {
  runWasiCLIOutputingText: Wasm['runWasiCLIOutputingText'];
  runWasiCLIOutputingBinary: Wasm['runWasiCLIOutputingBinary'];
}): RepresentationTransform => {
  const transformToText: RepresentationTransform['transformToText'] = async ({
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

  const transformToBinary: RepresentationTransform['transformToBinary'] =
    async ({ from, to, input }) => {
      const output = await runWasiCLIOutputingBinary({
        type: cliTypes.HS_LIB,
        args: [
          'v2-hs-lib',
          'convertToBinary',
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
    transformToText,
    transformToBinary,
  };
};
