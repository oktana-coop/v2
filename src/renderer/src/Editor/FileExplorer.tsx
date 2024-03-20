import React from 'react';

import {
  UncontrolledTreeEnvironment,
  Tree,
  StaticTreeDataProvider,
} from 'react-complex-tree';

declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

const items = {
  root: {
    index: 'root',
    canMove: true,
    isFolder: true,
    children: ['child1', 'child2'],
    data: 'Root item',
    canRename: true,
  },
  child1: {
    index: 'child1',
    canMove: true,
    isFolder: false,
    children: [],
    data: 'Child item 1',
    canRename: true,
  },
  child2: {
    index: 'child2',
    canMove: true,
    isFolder: false,
    children: [],
    data: 'Child item 2',
    canRename: true,
  },
};

export const FileExplorer = () => {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current !== null) {
      ref.current.setAttribute('directory', '');
      ref.current.setAttribute('webkitdirectory', '');
    }
  }, [ref]);

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    console.log(files);
  };

  async function getFile() {
    // Open file picker and destructure the result the first handle
    const [fileHandle] = await window.showOpenFilePicker();
    const file = await fileHandle.getFile();
    return file;
  }

  return (
    <div className="text-black">
      <div>File Explorer</div>

      <div>
        <button onClick={async () => await getFile()}></button>
        <input
          type="file"
          name="files"
          webkitdirectory=""
          directory=""
          id="files"
          onChange={async () => {
            // await new Promise((resolve) => setTimeout(resolve, 1000));

            const handle = await window.showSaveFilePicker({
              suggestedName: 'test',
              // startIn: fileHandle,
              types: [
                {
                  description: 'ZIP files',
                  accept: {
                    'application/zip': ['.zip'],
                  },
                },
              ],
            });
          }}
        ></input>
      </div>

      <UncontrolledTreeEnvironment
        dataProvider={
          new StaticTreeDataProvider(items, (item, data) => ({
            ...item,
            data,
          }))
        }
        getItemTitle={(item) => item.data}
        viewState={{}}
      >
        <Tree treeId="tree-1" rootItem="root" treeLabel="Tree Example" />
      </UncontrolledTreeEnvironment>
    </div>
  );
};
