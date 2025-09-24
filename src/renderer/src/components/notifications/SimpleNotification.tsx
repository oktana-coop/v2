import { Transition } from '@headlessui/react';

import { CloseIcon, InfoIcon } from '../icons';
import { IconProps } from '../icons/types';

export type SimpleNotificationProps = {
  show: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ComponentType<IconProps>;
  message?: string;
  messageElement?: React.ReactNode;
};

export const SimpleNotification = ({
  show,
  onClose,
  title,
  icon,
  message,
  messageElement,
}: SimpleNotificationProps) => {
  const Icon = icon ?? InfoIcon;

  return (
    <Transition show={show}>
      <div className="pointer-events-auto w-full max-w-sm bg-white shadow-lg outline outline-1 outline-black/5 transition data-[closed]:data-[enter]:translate-y-2 data-[enter]:transform data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-100 data-[enter]:ease-out data-[leave]:ease-in data-[closed]:data-[enter]:sm:translate-x-2 data-[closed]:data-[enter]:sm:translate-y-0 dark:bg-gray-800 dark:-outline-offset-1 dark:outline-white/10">
        <div className="p-4">
          <div className="flex items-start">
            <div className="shrink-0">
              <Icon aria-hidden="true" className="size-6 text-gray-400" />
            </div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className="text-left text-sm font-medium text-gray-900 dark:text-white">
                {title}
              </p>
              {messageElement ?? (
                <p className="mt-1 text-left text-sm text-gray-500 dark:text-gray-400">
                  {message}
                </p>
              )}
            </div>
            <div className="ml-4 flex shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex text-gray-400 hover:text-gray-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600 dark:hover:text-white dark:focus:outline-indigo-500"
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
