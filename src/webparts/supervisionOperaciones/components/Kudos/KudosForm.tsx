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

import SharePointService, {
  type IRegistrarKudoData
} from '../../services/SharePointService';
import type GraphService from '../../services/GraphService';
import styles from './KudosForm.module.scss';

export interface IKudosFormProps {
  graphService: GraphService;
  remitente: string;
}

const atributoOptions: IDropdownOption[] = [
  { key: 'Orientado al negocio', text: 'Orientado al negocio' },
  { key: 'Empatía', text: 'Empatía' },
  { key: 'Agilidad', text: 'Agilidad' },
  { key: 'Pensamiento digital', text: 'Pensamiento digital' },
  { key: 'Resolución de problemas', text: 'Resolución de problemas' },
  { key: 'Trabajo en equipo', text: 'Trabajo en equipo' }
];

const KudosForm: React.FC<IKudosFormProps> = ({ graphService, remitente }) => {
  const [agente, setAgente] = React.useState<string>('');
  const [atributo, setAtributo] = React.useState<string>('');
  const [mensaje, setMensaje] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [teamOptions, setTeamOptions] = React.useState<IDropdownOption[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = React.useState<boolean>(true);
  const [teamErrorMessage, setTeamErrorMessage] = React.useState<string>('');
  const sharePointService = React.useMemo(() => new SharePointService(), []);

  React.useEffect(() => {
    let isMounted = true;

    const loadTeam = async (): Promise<void> => {
      try {
        const directReports = await graphService.getDirectReports();

        if (isMounted) {
          setTeamOptions(directReports.map((item) => ({
            key: item.name,
            text: item.name
          })));
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'No fue posible cargar el equipo del supervisor.';
          setTeamErrorMessage(detail);
        }
      } finally {
        if (isMounted) {
          setIsLoadingTeam(false);
        }
      }
    };

    loadTeam().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [graphService]);

  const submitKudo = async (): Promise<void> => {
    setSuccessMessage('');
    setErrorMessage('');

    if (!agente.trim() || !atributo || !mensaje.trim()) {
      setErrorMessage('Complete todos los campos obligatorios.');
      return;
    }

    setIsSubmitting(true);

    try {
      let puntosPorKudo = 10;

      try {
        const configuration = await sharePointService.getConfiguracion();
        puntosPorKudo = configuration?.PuntosPorKudo || 10;
      } catch {
        // Fallback temporal si la configuración global no está disponible.
        puntosPorKudo = 10;
      }

      const kudoData: IRegistrarKudoData = {
        agente: agente.trim(),
        atributo,
        mensaje: mensaje.trim(),
        puntos: puntosPorKudo,
        fecha: new Date(),
        remitente
      };

      await sharePointService.registrarKudo(kudoData);

      setAgente('');
      setAtributo('');
      setMensaje('');
      setSuccessMessage('Reconocimiento enviado correctamente.');
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al enviar el reconocimiento.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submitKudo().catch((error: unknown) => {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al enviar el reconocimiento.';
      setErrorMessage(detail);
      setIsSubmitting(false);
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <Stack
        className={styles.formCard}
        tokens={{ childrenGap: 15 }}
      >
        <Text className={styles.title} variant="xLarge">
          Enviar un reconocimiento
        </Text>
        <Text className={styles.description}>
          Destaca una conducta que represente los atributos de Humano Seguros.
        </Text>

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

        {teamErrorMessage && (
          <MessageBar messageBarType={MessageBarType.warning}>
            {teamErrorMessage}
          </MessageBar>
        )}

        {isLoadingTeam && (
          <Spinner label="Cargando equipo del supervisor..." size={SpinnerSize.small} />
        )}

        <Dropdown
          disabled={isSubmitting || isLoadingTeam}
          label="Agente receptor"
          onChange={(_, option) => setAgente(String(option?.key || ''))}
          options={teamOptions}
          placeholder="Seleccione un reporte directo"
          required
          selectedKey={agente || undefined}
        />

        <Dropdown
          disabled={isSubmitting}
          label="Atributo corporativo"
          onChange={(_, option) => setAtributo(String(option?.key || ''))}
          options={atributoOptions}
          required
          selectedKey={atributo}
        />

        <TextField
          disabled={isSubmitting}
          label="Mensaje de reconocimiento"
          multiline
          onChange={(_, value) => setMensaje(value || '')}
          required
          rows={5}
          value={mensaje}
        />

        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
          <PrimaryButton
            disabled={isSubmitting || isLoadingTeam}
            text="Enviar reconocimiento"
            type="submit"
          />
          {isSubmitting && (
            <Spinner label="Enviando..." size={SpinnerSize.small} />
          )}
        </Stack>
      </Stack>
    </form>
  );
};

export default KudosForm;
