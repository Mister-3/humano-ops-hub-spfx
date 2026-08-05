export const LOCAL_DATABASE_NAME = 'HumanoOpsHubDB';
export const LOCAL_DATABASE_VERSION = 3;

export const LOCAL_STORES = {
  faltas: 'faltas',
  kudos: 'kudos',
  productividad: 'productividad',
  ausencias: 'ausencias',
  llamadas: 'llamadas',
  correos: 'correos',
  headcount: 'headcount',
  configuracion: 'configuracion',
  catalogos: 'catalogos',
  roles: 'roles',
  publicaciones: 'publicaciones',
  users: 'users',
  sessions: 'sessions',
  notifications: 'notifications',
  metas: 'metas'
} as const;

export type LocalStoreName =
  typeof LOCAL_STORES[keyof typeof LOCAL_STORES];

export interface ILocalEntity {
  Id?: number;
  AuditID?: string;
  SyncStatus?: 'Pendiente' | 'Sincronizado';
  UpdatedAt?: string;
}

/** Campos operativos 1:1 compartidos por IndexedDB y Tabla_Faltas. */
export interface IOperationalFaltaFields {
  IdCasoHelpdesk?: string;
  ProcesoArea?: string;
  HorasPerdidas?: number;
  MinutosTardanza?: number;
  HoraLlegada?: string;
  OrigenError?: string;
  SubcategoriaError?: string;
  ComentariosCapacitacion?: string;
  IdAuditoria?: string;
}

const STORE_NAMES = Object.values(LOCAL_STORES) as LocalStoreName[];

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

/**
 * Thin promise-based IndexedDB adapter with an in-memory fallback for preview,
 * test and private-browser contexts where IndexedDB is unavailable.
 */
export class IndexedDbAdapter {
  private static databasePromise: Promise<IDBDatabase> | undefined;
  private static readonly memoryStores = new Map<
    LocalStoreName,
    Map<number, ILocalEntity>
  >();
  private static readonly memoryCounters = new Map<LocalStoreName, number>();

  public async getAll<T extends ILocalEntity>(
    storeName: LocalStoreName
  ): Promise<T[]> {
    if (!this.isIndexedDbAvailable()) {
      return Array.from(this.getMemoryStore(storeName).values())
        .map((item) => cloneValue(item as T));
    }

    const database = await this.openDatabase();

    return new Promise<T[]>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).getAll();

      request.onsuccess = () => resolve(
        (request.result as T[]).map((item) => cloneValue(item))
      );
      request.onerror = () => reject(
        request.error || new Error(`No fue posible leer ${storeName}.`)
      );
    });
  }

  public async getById<T extends ILocalEntity>(
    storeName: LocalStoreName,
    id: number
  ): Promise<T | undefined> {
    if (!this.isIndexedDbAvailable()) {
      const value = this.getMemoryStore(storeName).get(id);
      return value ? cloneValue(value as T) : undefined;
    }

    const database = await this.openDatabase();

    return new Promise<T | undefined>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).get(id);

      request.onsuccess = () => resolve(
        request.result ? cloneValue(request.result as T) : undefined
      );
      request.onerror = () => reject(
        request.error || new Error(`No fue posible leer ${storeName}/${id}.`)
      );
    });
  }

  public async add<T extends ILocalEntity>(
    storeName: LocalStoreName,
    value: T
  ): Promise<T & { Id: number }> {
    const entity: T = {
      ...cloneValue(value),
      UpdatedAt: value.UpdatedAt || new Date().toISOString()
    };

    if (!this.isIndexedDbAvailable()) {
      const nextId = this.getNextMemoryId(storeName);
      const stored = { ...entity, Id: nextId } as T & { Id: number };
      this.getMemoryStore(storeName).set(nextId, cloneValue(stored));
      return cloneValue(stored);
    }

    const database = await this.openDatabase();

    return new Promise<T & { Id: number }>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const request = transaction.objectStore(storeName).add(entity);

      request.onsuccess = () => {
        const id = Number(request.result);
        resolve({ ...entity, Id: id } as T & { Id: number });
      };
      request.onerror = () => reject(
        request.error || new Error(`No fue posible guardar en ${storeName}.`)
      );
    });
  }

  public async put<T extends ILocalEntity>(
    storeName: LocalStoreName,
    value: T & { Id: number }
  ): Promise<T & { Id: number }> {
    const entity = {
      ...cloneValue(value),
      UpdatedAt: new Date().toISOString()
    };

    if (!this.isIndexedDbAvailable()) {
      this.getMemoryStore(storeName).set(value.Id, cloneValue(entity));
      return cloneValue(entity);
    }

    const database = await this.openDatabase();

    return new Promise<T & { Id: number }>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const request = transaction.objectStore(storeName).put(entity);

      request.onsuccess = () => resolve(cloneValue(entity));
      request.onerror = () => reject(
        request.error || new Error(`No fue posible actualizar ${storeName}.`)
      );
    });
  }

  public async remove(
    storeName: LocalStoreName,
    id: number
  ): Promise<void> {
    if (!this.isIndexedDbAvailable()) {
      this.getMemoryStore(storeName).delete(id);
      return;
    }

    const database = await this.openDatabase();

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const request = transaction.objectStore(storeName).delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(
        request.error || new Error(`No fue posible eliminar ${storeName}/${id}.`)
      );
    });
  }

  public async replaceAll<T extends ILocalEntity>(
    storeName: LocalStoreName,
    values: ReadonlyArray<T>
  ): Promise<void> {
    if (!this.isIndexedDbAvailable()) {
      const store = this.getMemoryStore(storeName);
      store.clear();
      let maximumId = 0;

      values.forEach((value, index) => {
        const id = value.Id && value.Id > 0 ? value.Id : index + 1;
        maximumId = Math.max(maximumId, id);
        store.set(id, cloneValue({ ...value, Id: id }));
      });

      IndexedDbAdapter.memoryCounters.set(storeName, maximumId);
      return;
    }

    const database = await this.openDatabase();

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      store.clear();
      values.forEach((value) => store.put(cloneValue(value)));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(
        transaction.error || new Error(`No fue posible importar ${storeName}.`)
      );
      transaction.onabort = () => reject(
        transaction.error || new Error(`La importación de ${storeName} fue cancelada.`)
      );
    });
  }

  private isIndexedDbAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private getMemoryStore(storeName: LocalStoreName): Map<number, ILocalEntity> {
    let store = IndexedDbAdapter.memoryStores.get(storeName);

    if (!store) {
      store = new Map<number, ILocalEntity>();
      IndexedDbAdapter.memoryStores.set(storeName, store);
    }

    return store;
  }

  private getNextMemoryId(storeName: LocalStoreName): number {
    const current = IndexedDbAdapter.memoryCounters.get(storeName) || 0;
    const next = current + 1;
    IndexedDbAdapter.memoryCounters.set(storeName, next);
    return next;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!IndexedDbAdapter.databasePromise) {
      IndexedDbAdapter.databasePromise = new Promise<IDBDatabase>(
        (resolve, reject) => {
          const request = indexedDB.open(
            LOCAL_DATABASE_NAME,
            LOCAL_DATABASE_VERSION
          );

          request.onupgradeneeded = () => {
            const database = request.result;

            STORE_NAMES.forEach((storeName) => {
              if (!database.objectStoreNames.contains(storeName)) {
                database.createObjectStore(storeName, {
                  keyPath: 'Id',
                  autoIncrement: true
                });
              }
            });
          };

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(
            request.error || new Error('No fue posible abrir IndexedDB.')
          );
          request.onblocked = () => reject(
            new Error(
              'IndexedDB está bloqueado por otra pestaña. Cierre otras sesiones e intente nuevamente.'
            )
          );
        }
      );
    }

    return IndexedDbAdapter.databasePromise;
  }
}

export default IndexedDbAdapter;
