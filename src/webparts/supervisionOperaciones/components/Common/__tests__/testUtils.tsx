import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

const mountedContainers = new Set<HTMLDivElement>();

export interface IRenderUiResult {
  container: HTMLDivElement;
  rerender: (element: React.ReactElement) => void;
  unmount: () => void;
}

export const renderUi = (element: React.ReactElement): IRenderUiResult => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mountedContainers.add(container);

  act(() => {
    ReactDOM.render(element, container);
  });

  return {
    container,
    rerender: (nextElement: React.ReactElement) => {
      act(() => {
        ReactDOM.render(nextElement, container);
      });
    },
    unmount: () => {
      if (!mountedContainers.has(container)) return;
      act(() => {
        ReactDOM.unmountComponentAtNode(container);
      });
      mountedContainers.delete(container);
      container.remove();
    }
  };
};

export const cleanupUi = (): void => {
  Array.from(mountedContainers).forEach((container) => {
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
    mountedContainers.delete(container);
  });
  document.body.classList.remove('overflow-hidden');
};
