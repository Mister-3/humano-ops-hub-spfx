import type { SPFI } from '@pnp/sp';

let spInstance: SPFI | undefined;

/** Registers the PnPjs client initialized by the Web Part. */
export const setSP = (sp: SPFI): void => {
  spInstance = sp;
};

/** Returns the shared PnPjs client for services and hooks. */
export const getSP = (): SPFI => {
  if (!spInstance) {
    throw new Error('PnPjs has not been initialized.');
  }

  return spInstance;
};
