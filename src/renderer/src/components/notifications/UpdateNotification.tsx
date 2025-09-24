import { Transition } from '@headlessui/react';
import { useState } from 'react';

import { CloseIcon, UpdateIcon } from '../icons';

export const UpdateNotification = () => {
  const [show, setShow] = useState(true);

  return (
    <Transition show={show}>
      <div className="pointer-events-auto w-full max-w-sm bg-white shadow-lg outline outline-1 outline-black/5 transition data-[closed]:data-[enter]:translate-y-2 data-[enter]:transform data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-100 data-[enter]:ease-out data-[leave]:ease-in data-[closed]:data-[enter]:sm:translate-x-2 data-[closed]:data-[enter]:sm:translate-y-0 dark:bg-gray-800 dark:-outline-offset-1 dark:outline-white/10">
        <div className="p-4">
          <div className="flex items-start">
            <div className="shrink-0">
              <UpdateIcon aria-hidden="true" className="size-6 text-gray-400" />
            </div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className="text-left text-sm font-medium text-gray-900 dark:text-white">
                Update Available
              </p>
              <p className="mt-1 text-left text-sm text-gray-500 dark:text-gray-400">
                A new version of the app is available.
              </p>
              <div className="mt-3 flex space-x-7">
                <button
                  type="button"
                  className="text-sm font-medium text-purple-600 hover:text-purple-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-purple-500 dark:text-purple-300 dark:hover:text-purple-200 dark:focus:outline-purple-300"
                >
                  Install
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-gray-700 hover:text-gray-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-purple-500 dark:text-gray-300 dark:hover:text-white dark:focus:outline-purple-300"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <div className="ml-4 flex shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShow(false);
                }}
                className="inline-flex text-gray-400 hover:text-gray-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-purple-600 dark:hover:text-white dark:focus:outline-purple-500"
              >
                <span className="sr-only">Close</span>
                <CloseIcon aria-hidden="true" className="size-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  );
};
