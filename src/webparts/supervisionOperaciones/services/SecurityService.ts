import type { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/site-users/web';

import type { IUsuario, RoleType } from '../models/AppModels';
import { getSP } from './pnpjsConfig';

export default class SecurityService {
  public constructor(private readonly sp: SPFI = getSP()) {}

  public async getCurrentUser(): Promise<IUsuario> {
    try {
      const currentUser = await this.sp.web.currentUser();
      const email = currentUser.Email || '';
      const rol = await this.getUserRole(email);

      return {
        id: currentUser.Id,
        email,
        displayName: currentUser.Title,
        rol
      };
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible obtener el usuario actual: ${detail}`);
    }
  }

  public getUserRole(email: string): Promise<RoleType> {
    // El correo se usará para consultar la lista de roles de SharePoint.
    if (!email) {
      return Promise.resolve('Admin');
    }

    return Promise.resolve('Admin');
  }
}
