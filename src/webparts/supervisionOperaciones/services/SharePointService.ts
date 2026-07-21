import type { SPFI } from '@pnp/sp';
import '@pnp/sp/attachments';
import '@pnp/sp/fields';
import '@pnp/sp/items';
import '@pnp/sp/items/get-all';
import '@pnp/sp/lists';
import '@pnp/sp/views';
import '@pnp/sp/webs';

import type { IFalta, RoleType } from '../models/AppModels';
import { getSP } from './pnpjsConfig';

const LIST_TITLE = 'Registro_Faltas';
const LIST_DESCRIPTION = 'Lista para el registro oficial de faltas operativas';
const KUDOS_LIST_TITLE = 'Registro_Kudos';
const KUDOS_LIST_DESCRIPTION = 'Lista para reconocimientos corporativos';
const CONFIG_LIST_TITLE = 'Configuracion_Metricas';
const CONFIG_LIST_DESCRIPTION = 'Configuración global de métricas operativas';
const PRODUCTIVITY_LIST_TITLE = 'Registro_Productividad';
const PRODUCTIVITY_LIST_DESCRIPTION = 'Registro de productividad operativa';

export interface IRegistrarFaltaData {
  agente: string;
  fecha: Date;
  categoria: string;
  impacto: string;
  estado: IFalta['estado'];
  rolOriginador: RoleType;
}

export interface IRegistrarKudoData {
  agente: string;
  atributo: string;
  mensaje: string;
  puntos: number;
  fecha: Date;
  remitente: string;
}

export interface IKudoListItem {
  Title?: string;
  Puntos?: number;
}

export interface IRegistrarProductividadData {
  agente: string;
  fecha: Date;
  casos: number;
  emisiones: number;
  movimientos: number;
}

export interface IDashboardProductividadItem {
  Title?: string;
  Casos?: number;
  Emisiones?: number;
  Movimientos?: number;
}

export interface IDashboardFaltaItem {
  Title?: string;
  Impacto?: string;
  Estado?: string;
}

export interface IDatosDashboard {
  config: IConfiguracionMetricas;
  productividad: IDashboardProductividadItem[];
  faltas: IDashboardFaltaItem[];
  kudos: IKudoListItem[];
}

export interface IConfiguracionMetricas {
  Id: number;
  Title: string;
  PesoCasos: number;
  PesoEmisiones: number;
  PesoMovimientos: number;
  MetaDiaria: number;
  PuntosPorKudo: number;
  PenalidadBaja: number;
  PenalidadMedia: number;
  PenalidadCritica: number;
}

export type IConfiguracionMetricasUpdate = Pick<
  IConfiguracionMetricas,
  | 'PesoCasos'
  | 'PesoEmisiones'
  | 'PesoMovimientos'
  | 'MetaDiaria'
  | 'PuntosPorKudo'
  | 'PenalidadBaja'
  | 'PenalidadMedia'
  | 'PenalidadCritica'
>;

export class SharePointService {
  public constructor(private readonly sp: SPFI = getSP()) {}

  public async ensureRegistroFaltasList(): Promise<void> {
    let provisioningStep = 'crear o verificar la lista';

    try {
      const listEnsure = await this.sp.web.lists.ensure(
        LIST_TITLE,
        LIST_DESCRIPTION,
        100,
        false
      );

      let existingInternalNames: string[];

      if (listEnsure.created) {
        existingInternalNames = [];
      } else {
        provisioningStep = 'consultar las columnas existentes';
        const existingFields = await listEnsure.list.fields
          .select('InternalName')();
        existingInternalNames = existingFields.map((field) => field.InternalName);
      }

      if (existingInternalNames.indexOf('FechaFalta') < 0) {
        provisioningStep = 'crear la columna FechaFalta';
        const result = await listEnsure.list.fields.addDateTime(
          'FechaFalta',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de FechaFalta';
        await result.field.update({ Title: 'Fecha de la Falta' });
      }

      if (existingInternalNames.indexOf('Categoria') < 0) {
        provisioningStep = 'crear la columna Categoria';
        const result = await listEnsure.list.fields.addText(
          'Categoria',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de Categoria';
        await result.field.update({ Title: 'Categoría' });
      }

      if (existingInternalNames.indexOf('Impacto') < 0) {
        provisioningStep = 'crear la columna Impacto';
        const result = await listEnsure.list.fields.addText(
          'Impacto',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de Impacto';
        await result.field.update({ Title: 'Nivel de Impacto' });
      }

      if (existingInternalNames.indexOf('Estado') < 0) {
        provisioningStep = 'crear la columna Estado';
        const result = await listEnsure.list.fields.addText(
          'Estado',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de Estado';
        await result.field.update({ Title: 'Estado de Registro' });
      }

      if (existingInternalNames.indexOf('RolOriginador') < 0) {
        provisioningStep = 'crear la columna RolOriginador';
        const result = await listEnsure.list.fields.addText(
          'RolOriginador',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de RolOriginador';
        await result.field.update({ Title: 'Rol del Creador' });
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await listEnsure.list.defaultView;
      const defaultViewFields = await defaultView.fields();
      const visibleFields = defaultViewFields.Items;

      if (visibleFields.indexOf('FechaFalta') < 0) {
        provisioningStep = 'agregar FechaFalta a la vista predeterminada';
        await defaultView.fields.add('FechaFalta');
      }

      if (visibleFields.indexOf('Categoria') < 0) {
        provisioningStep = 'agregar Categoria a la vista predeterminada';
        await defaultView.fields.add('Categoria');
      }

      if (visibleFields.indexOf('Impacto') < 0) {
        provisioningStep = 'agregar Impacto a la vista predeterminada';
        await defaultView.fields.add('Impacto');
      }

      if (visibleFields.indexOf('Estado') < 0) {
        provisioningStep = 'agregar Estado a la vista predeterminada';
        await defaultView.fields.add('Estado');
      }

      if (visibleFields.indexOf('RolOriginador') < 0) {
        provisioningStep = 'agregar RolOriginador a la vista predeterminada';
        await defaultView.fields.add('RolOriginador');
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ${LIST_TITLE}: ${detail}`
      );
    }
  }

  public async registrarFalta(
    faltaData: IRegistrarFaltaData,
    // El contrato refleja directamente el estado de un input File.
    // eslint-disable-next-line @rushstack/no-new-null
    file: File | null
  ): Promise<void> {
    let itemCreated = false;

    try {
      await this.ensureRegistroFaltasList();

      const iar = await this.sp.web.lists
        .getByTitle(LIST_TITLE)
        .items.add({
          Title: faltaData.agente,
          FechaFalta: faltaData.fecha.toISOString(),
          Categoria: faltaData.categoria,
          Impacto: faltaData.impacto,
          Estado: faltaData.estado,
          RolOriginador: faltaData.rolOriginador
        });

      itemCreated = true;

      if (file) {
        await iar.item.attachmentFiles.add(file.name, file);
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);

      if (itemCreated && file) {
        throw new Error(
          `La falta fue creada, pero no se pudo adjuntar ${file.name}: ${detail}`
        );
      }

      throw new Error(`No fue posible registrar la falta: ${detail}`);
    }
  }

  public async ensureRegistroKudosList(): Promise<void> {
    let provisioningStep = 'crear o verificar la lista';

    try {
      const listEnsure = await this.sp.web.lists.ensure(
        KUDOS_LIST_TITLE,
        KUDOS_LIST_DESCRIPTION,
        100,
        false
      );

      let existingInternalNames: string[];

      if (listEnsure.created) {
        existingInternalNames = [];
      } else {
        provisioningStep = 'consultar las columnas existentes';
        const existingFields = await listEnsure.list.fields
          .select('InternalName')();
        existingInternalNames = existingFields.map((field) => field.InternalName);
      }

      if (existingInternalNames.indexOf('Atributo') < 0) {
        provisioningStep = 'crear la columna Atributo';
        const result = await listEnsure.list.fields.addText(
          'Atributo',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de Atributo';
        await result.field.update({ Title: 'Atributo Corporativo' });
      }

      if (existingInternalNames.indexOf('Mensaje') < 0) {
        provisioningStep = 'crear la columna Mensaje';
        const result = await listEnsure.list.fields.addMultilineText(
          'Mensaje',
          {
            NumberOfLines: 6,
            Required: true,
            RichText: false
          }
        );
        provisioningStep = 'asignar el nombre visible de Mensaje';
        await result.field.update({ Title: 'Mensaje de Reconocimiento' });
      }

      if (existingInternalNames.indexOf('Puntos') < 0) {
        provisioningStep = 'crear la columna Puntos';
        const result = await listEnsure.list.fields.addNumber(
          'Puntos',
          {
            MinimumValue: 0,
            Required: true
          }
        );
        provisioningStep = 'asignar el nombre visible de Puntos';
        await result.field.update({ Title: 'Puntos Asignados' });
      }

      if (existingInternalNames.indexOf('FechaKudo') < 0) {
        provisioningStep = 'crear la columna FechaKudo';
        const result = await listEnsure.list.fields.addDateTime(
          'FechaKudo',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de FechaKudo';
        await result.field.update({ Title: 'Fecha' });
      }

      if (existingInternalNames.indexOf('Remitente') < 0) {
        provisioningStep = 'crear la columna Remitente';
        const result = await listEnsure.list.fields.addText(
          'Remitente',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de Remitente';
        await result.field.update({ Title: 'Enviado por' });
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await listEnsure.list.defaultView;
      const defaultViewFields = await defaultView.fields();
      const visibleFields = defaultViewFields.Items;

      if (visibleFields.indexOf('Atributo') < 0) {
        provisioningStep = 'agregar Atributo a la vista predeterminada';
        await defaultView.fields.add('Atributo');
      }

      if (visibleFields.indexOf('Mensaje') < 0) {
        provisioningStep = 'agregar Mensaje a la vista predeterminada';
        await defaultView.fields.add('Mensaje');
      }

      if (visibleFields.indexOf('Puntos') < 0) {
        provisioningStep = 'agregar Puntos a la vista predeterminada';
        await defaultView.fields.add('Puntos');
      }

      if (visibleFields.indexOf('FechaKudo') < 0) {
        provisioningStep = 'agregar FechaKudo a la vista predeterminada';
        await defaultView.fields.add('FechaKudo');
      }

      if (visibleFields.indexOf('Remitente') < 0) {
        provisioningStep = 'agregar Remitente a la vista predeterminada';
        await defaultView.fields.add('Remitente');
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ${KUDOS_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async registrarKudo(kudoData: IRegistrarKudoData): Promise<void> {
    try {
      await this.ensureRegistroKudosList();

      await this.sp.web.lists
        .getByTitle(KUDOS_LIST_TITLE)
        .items.add({
          Title: kudoData.agente,
          Atributo: kudoData.atributo,
          Mensaje: kudoData.mensaje,
          Puntos: kudoData.puntos,
          FechaKudo: kudoData.fecha.toISOString(),
          Remitente: kudoData.remitente
        });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible registrar el reconocimiento: ${detail}`);
    }
  }

  public async getKudosMensuales(): Promise<IKudoListItem[]> {
    try {
      const items: IKudoListItem[] = await this.sp.web.lists
        .getByTitle(KUDOS_LIST_TITLE)
        .items
        .select('Title', 'Puntos')();

      return items;
    } catch {
      // El Dashboard se presenta vacío si la lista todavía no está disponible.
      return [];
    }
  }

  public async ensureProductividadList(): Promise<void> {
    let provisioningStep = 'crear o verificar la lista';

    try {
      const listEnsure = await this.sp.web.lists.ensure(
        PRODUCTIVITY_LIST_TITLE,
        PRODUCTIVITY_LIST_DESCRIPTION,
        100,
        false
      );

      let existingInternalNames: string[];

      if (listEnsure.created) {
        existingInternalNames = [];
      } else {
        provisioningStep = 'consultar las columnas existentes';
        const existingFields = await listEnsure.list.fields
          .select('InternalName')();
        existingInternalNames = existingFields.map((field) => field.InternalName);
      }

      if (existingInternalNames.indexOf('FechaRegistro') < 0) {
        provisioningStep = 'crear la columna FechaRegistro';
        const result = await listEnsure.list.fields.addDateTime(
          'FechaRegistro'
        );
        provisioningStep = 'asignar el nombre visible de FechaRegistro';
        await result.field.update({ Title: 'Fecha de Registro' });
      }

      if (existingInternalNames.indexOf('Casos') < 0) {
        provisioningStep = 'crear la columna Casos';
        const result = await listEnsure.list.fields.addNumber(
          'Casos',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de Casos';
        await result.field.update({ Title: 'Casos Procesados' });
      }

      if (existingInternalNames.indexOf('Emisiones') < 0) {
        provisioningStep = 'crear la columna Emisiones';
        const result = await listEnsure.list.fields.addNumber(
          'Emisiones',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de Emisiones';
        await result.field.update({ Title: 'Emisiones' });
      }

      if (existingInternalNames.indexOf('Movimientos') < 0) {
        provisioningStep = 'crear la columna Movimientos';
        const result = await listEnsure.list.fields.addNumber(
          'Movimientos',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de Movimientos';
        await result.field.update({ Title: 'Movimientos' });
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await listEnsure.list.defaultView;
      const defaultViewFields = await defaultView.fields();

      if (defaultViewFields.Items.indexOf('FechaRegistro') < 0) {
        provisioningStep = 'agregar FechaRegistro a la vista predeterminada';
        await defaultView.fields.add('FechaRegistro');
      }

      if (defaultViewFields.Items.indexOf('Casos') < 0) {
        provisioningStep = 'agregar Casos a la vista predeterminada';
        await defaultView.fields.add('Casos');
      }

      if (defaultViewFields.Items.indexOf('Emisiones') < 0) {
        provisioningStep = 'agregar Emisiones a la vista predeterminada';
        await defaultView.fields.add('Emisiones');
      }

      if (defaultViewFields.Items.indexOf('Movimientos') < 0) {
        provisioningStep = 'agregar Movimientos a la vista predeterminada';
        await defaultView.fields.add('Movimientos');
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ${PRODUCTIVITY_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async registrarProductividad(
    data: IRegistrarProductividadData
  ): Promise<void> {
    try {
      await this.ensureProductividadList();

      await this.sp.web.lists
        .getByTitle(PRODUCTIVITY_LIST_TITLE)
        .items.add({
          Title: data.agente,
          FechaRegistro: data.fecha.toISOString(),
          Casos: data.casos,
          Emisiones: data.emisiones,
          Movimientos: data.movimientos
        });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible registrar la productividad: ${detail}`);
    }
  }

  public async ensureConfiguracionList(): Promise<void> {
    let provisioningStep = 'crear o verificar la lista';

    try {
      const listEnsure = await this.sp.web.lists.ensure(
        CONFIG_LIST_TITLE,
        CONFIG_LIST_DESCRIPTION,
        100,
        false
      );

      let existingInternalNames: string[];

      if (listEnsure.created) {
        existingInternalNames = [];
      } else {
        provisioningStep = 'consultar las columnas existentes';
        const existingFields = await listEnsure.list.fields
          .select('InternalName')();
        existingInternalNames = existingFields.map((field) => field.InternalName);
      }

      if (existingInternalNames.indexOf('PesoCasos') < 0) {
        provisioningStep = 'crear la columna PesoCasos';
        await listEnsure.list.fields.addNumber('PesoCasos', {
          MinimumValue: 0,
          Required: true
        });
      }

      if (existingInternalNames.indexOf('PesoEmisiones') < 0) {
        provisioningStep = 'crear la columna PesoEmisiones';
        await listEnsure.list.fields.addNumber('PesoEmisiones', {
          MinimumValue: 0,
          Required: true
        });
      }

      if (existingInternalNames.indexOf('PesoMovimientos') < 0) {
        provisioningStep = 'crear la columna PesoMovimientos';
        await listEnsure.list.fields.addNumber('PesoMovimientos', {
          MinimumValue: 0,
          Required: true
        });
      }

      if (existingInternalNames.indexOf('MetaDiaria') < 0) {
        provisioningStep = 'crear la columna MetaDiaria';
        await listEnsure.list.fields.addNumber('MetaDiaria', {
          MinimumValue: 0,
          Required: true
        });
      }

      if (existingInternalNames.indexOf('PuntosPorKudo') < 0) {
        provisioningStep = 'crear la columna PuntosPorKudo';
        const result = await listEnsure.list.fields.addNumber(
          'PuntosPorKudo',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PuntosPorKudo';
        await result.field.update({ Title: 'Puntos por Kudo' });
      }

      if (existingInternalNames.indexOf('PenalidadBaja') < 0) {
        provisioningStep = 'crear la columna PenalidadBaja';
        const result = await listEnsure.list.fields.addNumber(
          'PenalidadBaja',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PenalidadBaja';
        await result.field.update({ Title: 'Penalidad Impacto Bajo' });
      }

      if (existingInternalNames.indexOf('PenalidadMedia') < 0) {
        provisioningStep = 'crear la columna PenalidadMedia';
        const result = await listEnsure.list.fields.addNumber(
          'PenalidadMedia',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PenalidadMedia';
        await result.field.update({ Title: 'Penalidad Impacto Medio' });
      }

      if (existingInternalNames.indexOf('PenalidadCritica') < 0) {
        provisioningStep = 'crear la columna PenalidadCritica';
        const result = await listEnsure.list.fields.addNumber(
          'PenalidadCritica',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PenalidadCritica';
        await result.field.update({ Title: 'Penalidad Impacto Crítico' });
      }

      const defaultConfiguration: Omit<IConfiguracionMetricas, 'Id'> = {
        Title: 'Config_Global',
        PesoCasos: 1,
        PesoEmisiones: 1.5,
        PesoMovimientos: 1.2,
        MetaDiaria: 100,
        PuntosPorKudo: 10,
        PenalidadBaja: 5,
        PenalidadMedia: 15,
        PenalidadCritica: 50
      };

      if (listEnsure.created) {
        provisioningStep = 'insertar la configuración predeterminada';
        await listEnsure.list.items.add(defaultConfiguration);
      } else {
        provisioningStep = 'verificar la fila de configuración';
        const existingConfiguration: Array<{
          Id: number;
          PuntosPorKudo?: number;
          PenalidadBaja?: number;
          PenalidadMedia?: number;
          PenalidadCritica?: number;
        }> = await listEnsure.list.items
          .select(
            'Id',
            'PuntosPorKudo',
            'PenalidadBaja',
            'PenalidadMedia',
            'PenalidadCritica'
          )
          .top(1)();

        if (existingConfiguration.length === 0) {
          provisioningStep = 'recrear la configuración predeterminada';
          await listEnsure.list.items.add(defaultConfiguration);
        } else {
          const currentConfiguration = existingConfiguration[0];
          const missingDefaults: Partial<IConfiguracionMetricasUpdate> = {};

          if (typeof currentConfiguration.PuntosPorKudo !== 'number') {
            missingDefaults.PuntosPorKudo = 10;
          }
          if (typeof currentConfiguration.PenalidadBaja !== 'number') {
            missingDefaults.PenalidadBaja = 5;
          }
          if (typeof currentConfiguration.PenalidadMedia !== 'number') {
            missingDefaults.PenalidadMedia = 15;
          }
          if (typeof currentConfiguration.PenalidadCritica !== 'number') {
            missingDefaults.PenalidadCritica = 50;
          }

          if (Object.keys(missingDefaults).length > 0) {
            provisioningStep = 'inicializar valores nuevos en Config_Global';
            await listEnsure.list.items
              .getById(currentConfiguration.Id)
              .update(missingDefaults);
          }
        }
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await listEnsure.list.defaultView;
      const defaultViewFields = await defaultView.fields();

      if (defaultViewFields.Items.indexOf('PuntosPorKudo') < 0) {
        provisioningStep = 'agregar PuntosPorKudo a la vista predeterminada';
        await defaultView.fields.add('PuntosPorKudo');
      }

      if (defaultViewFields.Items.indexOf('PenalidadBaja') < 0) {
        provisioningStep = 'agregar PenalidadBaja a la vista predeterminada';
        await defaultView.fields.add('PenalidadBaja');
      }

      if (defaultViewFields.Items.indexOf('PenalidadMedia') < 0) {
        provisioningStep = 'agregar PenalidadMedia a la vista predeterminada';
        await defaultView.fields.add('PenalidadMedia');
      }

      if (defaultViewFields.Items.indexOf('PenalidadCritica') < 0) {
        provisioningStep = 'agregar PenalidadCritica a la vista predeterminada';
        await defaultView.fields.add('PenalidadCritica');
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ${CONFIG_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async getConfiguracion(): Promise<IConfiguracionMetricas> {
    try {
      await this.ensureConfiguracionList();

      const items: IConfiguracionMetricas[] = await this.sp.web.lists
        .getByTitle(CONFIG_LIST_TITLE)
        .items
        .select(
          'Id',
          'Title',
          'PesoCasos',
          'PesoEmisiones',
          'PesoMovimientos',
          'MetaDiaria',
          'PuntosPorKudo',
          'PenalidadBaja',
          'PenalidadMedia',
          'PenalidadCritica'
        )
        .top(1)();

      if (items.length === 0) {
        throw new Error('No existe la fila Config_Global.');
      }

      return items[0];
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible obtener la configuración: ${detail}`);
    }
  }

  public async actualizarConfiguracion(
    id: number,
    data: IConfiguracionMetricasUpdate
  ): Promise<void> {
    try {
      await this.ensureConfiguracionList();

      await this.sp.web.lists
        .getByTitle(CONFIG_LIST_TITLE)
        .items
        .getById(id)
        .update({
          PesoCasos: data.PesoCasos,
          PesoEmisiones: data.PesoEmisiones,
          PesoMovimientos: data.PesoMovimientos,
          MetaDiaria: data.MetaDiaria,
          PuntosPorKudo: data.PuntosPorKudo,
          PenalidadBaja: data.PenalidadBaja,
          PenalidadMedia: data.PenalidadMedia,
          PenalidadCritica: data.PenalidadCritica
        });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible actualizar la configuración: ${detail}`);
    }
  }

  public async getDatosDashboard(): Promise<IDatosDashboard> {
    try {
      const productividadPromise: Promise<IDashboardProductividadItem[]> =
        this.sp.web.lists
          .getByTitle(PRODUCTIVITY_LIST_TITLE)
          .items
          .select('Title', 'Casos', 'Emisiones', 'Movimientos')
          .getAll<IDashboardProductividadItem>();

      const faltasPromise: Promise<IDashboardFaltaItem[]> = this.sp.web.lists
        .getByTitle(LIST_TITLE)
        .items
        .filter("Estado eq 'Aprobado'")
        .select('Title', 'Impacto', 'Estado')
        .getAll<IDashboardFaltaItem>();

      const kudosPromise: Promise<IKudoListItem[]> = this.sp.web.lists
        .getByTitle(KUDOS_LIST_TITLE)
        .items
        .select('Title', 'Puntos')
        .getAll<IKudoListItem>();

      const [config, productividad, faltas, kudos] = await Promise.all([
        this.getConfiguracion(),
        productividadPromise,
        faltasPromise,
        kudosPromise
      ]);

      return {
        config,
        productividad,
        faltas,
        kudos
      };
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible cargar los datos del Dashboard: ${detail}`);
    }
  }
}

export default SharePointService;
