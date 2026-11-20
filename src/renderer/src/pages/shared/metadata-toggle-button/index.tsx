import { useContext } from 'react';

import { FunctionalityConfigContext } from '../../../../../modules/personalization/browser';
import { IconButton } from '../../../components/actions/IconButton';
import { InfoIcon } from '../../../components/icons';

export const MetadataToggleButton = () => {
  const { showMetadata, setShowMetadata } = useContext(
    FunctionalityConfigContext
  );

  const handleClick = (ev: React.MouseEvent) => {
    ev.preventDefault();
    setShowMetadata(!showMetadata);
  };

  return (
    <IconButton
      icon={<InfoIcon />}
      tooltip={showMetadata ? 'Hide properties' : 'Show properties'}
      onClick={handleClick}
    />
  );
};
