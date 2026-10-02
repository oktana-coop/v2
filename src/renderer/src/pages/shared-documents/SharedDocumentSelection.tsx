import { useContext } from 'react';

import { GuestEditingContext } from '../../app-state';
import { Button } from '../../components/actions/Button';
import { EmptyDocument } from '../../components/document-views/EmptyDocument';
import { GroupIcon } from '../../components/icons';
import { DefaultActionsBar } from '../shared/default-actions-bar';

export const SharedDocumentSelection = () => {
  const { onOpenJoinDialog } = useContext(GuestEditingContext);

  return (
    <div className="flex w-full flex-col">
      <div className="w-full">
        <DefaultActionsBar />
      </div>
      <EmptyDocument
        heading="Shared with me"
        message="Documents others shared with you that you hold in no project. Pick one from the list, or join one with the link you were sent."
      >
        <Button onClick={onOpenJoinDialog} variant="plain" color="purple">
          <GroupIcon className="mr-1" />
          Join shared document
        </Button>
      </EmptyDocument>
    </div>
  );
};
