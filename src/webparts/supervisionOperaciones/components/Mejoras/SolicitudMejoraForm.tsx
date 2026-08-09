import * as React from 'react';
import {
  Dropdown,
  type IDropdownOption,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  Stack,
  Text,
  TextField
} from '@fluentui/react';

import { cloudDbClient } from '../../../../services/CloudDbClient';
import SharePointService from '../../services/SharePointService';
import styles from './MejorasView.module.scss';

export interface ISolicitudMejoraFormProps {
  currentUserEmail: string;
  currentUserName: string;
  onSaved?: () => void;
}

const DEFAULT_MODULE_OPTIONS: ReadonlyArray<IDropdownOption> = [
  { key: 'Productividad', text: '📊 Productividad' },
  { key: 'Faltas y Errores Operativos', text: '⚠️ Faltas y Errores Operativos' },
  { key: 'Ocupación y Registro de Llamadas', text: '📞 Ocupación y Registro de Llamadas' },
  { key: 'Reconocimientos y Kudos', text: '🏆 Reconocimientos y Kudos' },
  { key: 'Ausencias y Vacaciones', text: '📅 Ausencias y Vacaciones' },
  { key: 'Administración y Catálogos', text: '⚙️ Administración y Catálogos' }
];

export const SolicitudMejoraForm: React.FC<ISolicitudMejoraFormProps> = ({
  currentUserEmail,
  currentUserName,
  onSaved
}) => {
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const [titulo, setTitulo] = React.useState<string>('');
  const [moduloAfectado, setModuloAfectado] = React.useState<string>('');
  const [comoRol, setComoRol] = React.useState<string>('');
  const [quieroFuncionalidad, setQuieroFuncionalidad] = React.useState<string>('');
  const [paraBeneficio, setParaBeneficio] = React.useState<string>('');
  const [criteriosAceptacion, setCriteriosAceptacion] = React.useState<string>('');
  const [moduleOptions, setModuleOptions] = React.useState<IDropdownOption[]>(
    [...DEFAULT_MODULE_OPTIONS]
  );
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  React.useEffect(() => {
    let isMounted = true;
    sharePointService
      .getCatalogos('modulos_pantallas')
      .then((items: any[]) => {
        if (isMounted && items && items.length > 0) {
          const loaded = items.map((it: any) => ({
            key: String(it.Valor || it.title || ''),
            text: String(it.Valor || it.title || '')
          }));
          setModuleOptions(loaded);
        }
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, [sharePointService]);

  const userStoryDescription = React.useMemo(() => {
    if (!comoRol.trim() && !quieroFuncionalidad.trim() && !paraBeneficio.trim()) {
      return '';
    }
    return `Como ${comoRol.trim() || '[Rol]'}, quiero ${quieroFuncionalidad.trim() || '[Funcionalidad]'}, para ${paraBeneficio.trim() || '[Beneficio]'}.`;
  }, [comoRol, quieroFuncionalidad, paraBeneficio]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!titulo.trim()) {
      setErrorMessage('Ingrese un título descriptivo para la solicitud de mejora.');
      return;
    }

    if (!moduloAfectado) {
      setErrorMessage('Seleccione el módulo o pantalla objetivo.');
      return;
    }

    if (!comoRol.trim() || !quieroFuncionalidad.trim() || !paraBeneficio.trim()) {
      setErrorMessage('Complete todos los bloques de la plantilla de Historia de Usuario.');
      return;
    }

    if (!criteriosAceptacion.trim()) {
      setErrorMessage('Especifique los criterios de aceptación indispensables.');
      return;
    }

    setIsSubmitting(true);

    try {
      await cloudDbClient.createSolicitudMejora({
        autor_nombre: currentUserName || 'Colaborador',
        autor_email: currentUserEmail,
        modulo_afectado: moduloAfectado,
        titulo: titulo.trim(),
        descripcion: userStoryDescription,
        criterios_aceptacion: criteriosAceptacion.trim()
      });

      setTitulo('');
      setModuloAfectado('');
      setComoRol('');
      setQuieroFuncionalidad('');
      setParaBeneficio('');
      setCriteriosAceptacion('');
      setSuccessMessage('¡Iniciativa enviada exitosamente! Su propuesta ya está registrada en la cola de revisión.');
      onSaved?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar la solicitud.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.card} onSubmit={(e) => void handleSubmit(e)}>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack tokens={{ childrenGap: 4 }}>
          <Text className={styles.headerTitle}>
            ✍️ Registrar Nueva Iniciativa de Mejora
          </Text>
          <Text className={styles.headerSubtitle}>
            Complete la estructura guiada de Historia de Usuario para sustentar su propuesta ante el equipo evaluador.
          </Text>
        </Stack>

        {successMessage && (
          <MessageBar messageBarType={MessageBarType.success}>
            {successMessage}
          </MessageBar>
        )}

        {errorMessage && (
          <MessageBar messageBarType={MessageBarType.error}>
            {errorMessage}
          </MessageBar>
        )}

        <div className={styles.formGrid}>
          <TextField
            disabled={isSubmitting}
            label="Título de la Mejora"
            onChange={(_, value) => setTitulo(value || '')}
            placeholder="Ej: Filtro rápido por fecha en el reporte mensual de llamadas"
            required
            value={titulo}
          />

          <Dropdown
            disabled={isSubmitting}
            label="Módulo / Pantalla Objetivo"
            onChange={(_, option) => setModuloAfectado(String(option?.key || ''))}
            options={moduleOptions}
            placeholder="Seleccione el módulo afectado"
            required
            selectedKey={moduloAfectado}
          />

          <div className={`${styles.userStoryCard} ${styles.fullWidth}`}>
            <div className={styles.userStoryHeader}>
              <span>📖</span>
              <span>Plantilla Guiada de Historia de Usuario</span>
            </div>

            <div className={styles.formGrid}>
              <TextField
                disabled={isSubmitting}
                label="1. Como... (Rol del usuario)"
                onChange={(_, value) => setComoRol(value || '')}
                placeholder="Ej: Supervisor de Operaciones / Oficial de Línea"
                required
                value={comoRol}
              />
              <TextField
                disabled={isSubmitting}
                label="2. Quiero... (Funcionalidad o cambio solicitado)"
                onChange={(_, value) => setQuieroFuncionalidad(value || '')}
                placeholder="Ej: Exportar en formato Excel la lista consolidada de ausencias"
                required
                value={quieroFuncionalidad}
              />
              <div className={styles.fullWidth}>
                <TextField
                  disabled={isSubmitting}
                  label="3. Para... (Beneficio o impacto esperado en el negocio)"
                  onChange={(_, value) => setParaBeneficio(value || '')}
                  placeholder="Ej: Disminuir el tiempo de preparación de la auditoría semanal de la dirección"
                  required
                  value={paraBeneficio}
                />
              </div>
            </div>

            {userStoryDescription && (
              <div className={styles.previewQuote}>
                <strong>Vista Previa de la Historia:</strong> "{userStoryDescription}"
              </div>
            )}
          </div>

          <div className={styles.fullWidth}>
            <TextField
              disabled={isSubmitting}
              label="Criterios de Aceptación (Requisitos indispensables para dar por completada la historia)"
              multiline
              onChange={(_, value) => setCriteriosAceptacion(value || '')}
              placeholder="Ej: 1. El reporte debe descargar los registros filtrados por rango de fecha. 2. Mostrar columnas A, B y C."
              required
              rows={3}
              value={criteriosAceptacion}
            />
          </div>
        </div>

        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 14 }} style={{ marginTop: 8 }}>
          <PrimaryButton
            disabled={isSubmitting}
            iconProps={{ iconName: 'Send' }}
            text={isSubmitting ? 'Enviando iniciativa...' : 'Enviar Solicitud de Mejora'}
            type="submit"
          />
          {isSubmitting && <Spinner label="Guardando propuesta..." size={SpinnerSize.small} />}
        </Stack>
      </Stack>
    </form>
  );
};

export default SolicitudMejoraForm;
