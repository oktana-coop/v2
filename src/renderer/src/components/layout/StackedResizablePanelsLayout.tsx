import { Fragment, type ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

export const StackedResizablePanelsLayout = ({
  autoSaveId,
  children,
}: {
  autoSaveId: string;
  children: ReactNode;
}) => {
  if (Array.isArray(children) && children.length > 1) {
    return (
      <PanelGroup autoSaveId={autoSaveId} direction="vertical">
        {children.map((child, index, arr) => (
          <Fragment key={`${autoSaveId}-${index}`}>
            <Panel minSize={5} defaultSize={index === 0 ? 80 : 20}>
              {child}
            </Panel>
            {index === arr.length - 1 ? null : (
              <PanelResizeHandle className="w-full border-b border-gray-300 dark:border-neutral-600" />
            )}
          </Fragment>
        ))}
      </PanelGroup>
    );
  }

  return children;
};
