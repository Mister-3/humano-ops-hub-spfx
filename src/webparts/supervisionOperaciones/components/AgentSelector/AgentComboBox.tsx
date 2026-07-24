import * as React from 'react';
import {
  ComboBox,
  type IComboBoxOption
} from '@fluentui/react';

import type { IDirectReport } from '../../services/GraphService';

export interface IAgentComboBoxProps {
  agents: ReadonlyArray<IDirectReport>;
  disabled?: boolean;
  label: string;
  onAgentChange: (agent: IDirectReport | undefined) => void;
  placeholder?: string;
  required?: boolean;
  selectedAgent?: IDirectReport;
}

const normalizeSearchValue = (value?: string): string => (
  value
    ?.trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase() || ''
);

const getAgentKey = (agent: IDirectReport): string => {
  const email = normalizeSearchValue(agent.email);

  if (email) {
    return `email:${email}`;
  }

  const objectId = normalizeSearchValue(agent.id);

  if (objectId) {
    return `object:${objectId}`;
  }

  return `name:${normalizeSearchValue(agent.name)}`;
};

const getAgentLabel = (agent: IDirectReport): string => (
  agent.email.trim()
    ? `${agent.name.trim()} · ${agent.email.trim()}`
    : agent.name.trim()
);

export const AgentComboBox: React.FC<IAgentComboBoxProps> = ({
  agents,
  disabled = false,
  label,
  onAgentChange,
  placeholder = 'Escriba un nombre o correo',
  required = false,
  selectedAgent
}) => {
  const [searchText, setSearchText] = React.useState<string>('');

  const authorizedOptions = React.useMemo((): IComboBoxOption[] => {
    const optionsByIdentity = new Map<string, IComboBoxOption>();

    agents.forEach((agent) => {
      const key = getAgentKey(agent);

      if (!optionsByIdentity.has(key) && agent.name.trim()) {
        optionsByIdentity.set(key, {
          data: agent,
          key,
          text: getAgentLabel(agent)
        });
      }
    });

    return Array.from(optionsByIdentity.values())
      .sort((left, right) => left.text.localeCompare(right.text, 'es'));
  }, [agents]);

  const filteredOptions = React.useMemo((): IComboBoxOption[] => {
    const normalizedSearch = normalizeSearchValue(searchText);

    if (!normalizedSearch) {
      return authorizedOptions;
    }

    return authorizedOptions.filter((option) => {
      const agent = option.data as IDirectReport;

      return normalizeSearchValue(agent.name).includes(normalizedSearch) ||
        normalizeSearchValue(agent.email).includes(normalizedSearch);
    });
  }, [authorizedOptions, searchText]);

  React.useEffect(() => {
    setSearchText('');
  }, [selectedAgent]);

  React.useEffect(() => {
    if (
      selectedAgent &&
      !authorizedOptions.some(
        (option) => option.key === getAgentKey(selectedAgent)
      )
    ) {
      onAgentChange(undefined);
    }
  }, [authorizedOptions, onAgentChange, selectedAgent]);

  return (
    <ComboBox
      allowFreeform={false}
      allowFreeInput
      autoComplete="off"
      disabled={disabled}
      label={label}
      onChange={(_, option) => {
        const agent = option?.data as IDirectReport | undefined;

        onAgentChange(agent);
        setSearchText('');
      }}
      onInputValueChange={setSearchText}
      onMenuDismissed={() => setSearchText('')}
      openOnKeyboardFocus
      options={filteredOptions}
      placeholder={placeholder}
      required={required}
      selectedKey={selectedAgent ? getAgentKey(selectedAgent) : undefined}
      useComboBoxAsMenuWidth
    />
  );
};

export default AgentComboBox;
