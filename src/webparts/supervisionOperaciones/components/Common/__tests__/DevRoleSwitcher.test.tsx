import * as React from 'react';
import { act } from 'react-dom/test-utils';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import DevRoleSwitcher from '../DevRoleSwitcher';
import { DEV_MOCK_STORAGE_KEY } from '../../../../../auth/devMockUsers';
import { renderUi, cleanupUi, setupMemoryStorage } from './testUtils';

describe('DevRoleSwitcher Component', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = setupMemoryStorage();
  });

  afterEach(() => {
    cleanupUi();
    storage.clear();
  });

  it('renderiza el widget flotante con el badge de DEV AUTH BYPASS', () => {
    const { container } = renderUi(<DevRoleSwitcher />);
    expect(container.textContent).toContain('Dev Auth Bypass');
    const select = container.querySelector('select#dev-role-select');
    expect(select).not.toBeNull();
  });

  it('permite alternar entre los roles y actualizar localStorage', () => {
    const { container } = renderUi(<DevRoleSwitcher />);
    const select = container.querySelector('select#dev-role-select') as HTMLSelectElement;
    expect(select).not.toBeNull();

    act(() => {
      select.value = 'gerente';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(storage.getItem(DEV_MOCK_STORAGE_KEY)).toBe('gerente');

    act(() => {
      select.value = 'agente';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(storage.getItem(DEV_MOCK_STORAGE_KEY)).toBe('agente');
  });

  it('permite minimizar y desplegar el widget', () => {
    const { container } = renderUi(<DevRoleSwitcher />);
    const minimizeBtn = container.querySelector('button[title="Minimizar panel"]') as HTMLButtonElement;
    expect(minimizeBtn).not.toBeNull();

    act(() => {
      minimizeBtn.click();
    });

    const expandBtn = container.querySelector('button[title="Desplegar Dev Auth Switcher"]') as HTMLButtonElement;
    expect(expandBtn).not.toBeNull();
    expect(container.textContent).toContain('DEV ROLES');

    act(() => {
      expandBtn.click();
    });
    expect(container.textContent).toContain('Dev Auth Bypass');
  });
});
