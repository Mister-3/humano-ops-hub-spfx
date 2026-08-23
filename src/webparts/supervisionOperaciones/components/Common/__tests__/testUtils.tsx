import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

const mountedContainers = new Set<HTMLDivElement>();

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

export const setupMemoryStorage = (): Storage => {
  const memory = new MemoryStorage();
  try {
    Object.defineProperty(window, 'localStorage', {
      value: memory,
      writable: true,
      configurable: true
    });
  } catch {
    // fallback
  }
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      value: memory,
      writable: true,
      configurable: true
    });
  } catch {
    // fallback
  }
  return memory;
};

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
