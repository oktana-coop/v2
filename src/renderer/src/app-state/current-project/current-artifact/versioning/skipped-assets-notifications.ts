import { removePath } from '../../../../../../modules/infrastructure/filesystem';
import { createInfoNotification } from '../../../../../../modules/infrastructure/notifications/browser';

const formatSkippedAssetNames = (skippedAssetPaths: string[]): string =>
  skippedAssetPaths.map(removePath).join(', ');

export const buildSkippedAssetsOnCommitNotification = (
  skippedAssetPaths: string[]
) => {
  const isSingular = skippedAssetPaths.length === 1;

  return createInfoNotification({
    title: 'Some images were not saved',
    message: `${skippedAssetPaths.length} referenced ${
      isSingular ? 'file is' : 'files are'
    } missing from disk and ${
      isSingular ? 'was' : 'were'
    } left out of this commit: ${formatSkippedAssetNames(skippedAssetPaths)}`.slice(
      0,
      255
    ),
  });
};

export const buildSkippedAssetsOnRestoreNotification = (
  skippedAssetPaths: string[]
) => {
  const isSingular = skippedAssetPaths.length === 1;

  return createInfoNotification({
    title: 'Some images were not restored',
    message: `${skippedAssetPaths.length} referenced ${
      isSingular ? 'file' : 'files'
    } could not be read from this version and ${
      isSingular ? 'was' : 'were'
    } left out: ${formatSkippedAssetNames(skippedAssetPaths)}`.slice(0, 255),
  });
};
