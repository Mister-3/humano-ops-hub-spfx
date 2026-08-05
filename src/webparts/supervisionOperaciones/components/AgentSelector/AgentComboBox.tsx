import * as React from 'react';
import {
  ComboBox,
  type IComboBoxOption
} from '@fluentui/react';

import type { IDirectReport } from '../../services/GraphService';

export interface IAgentComboBoxScopeOption {
  key: string;
  text: string;
}

export interface IAgentComboBoxProps {
  agents: ReadonlyArray<IDirectReport>;
  disabled?: boolean;
  label: string;
  onAgentChange: (agent: IDirectReport | undefined) => void;
  onScopeChange?: (scopeKey: string | undefined) => void;
  placeholder?: string;
  required?: boolean;
  selectedAgent?: IDirectReport;
  selectedScopeKey?: string;
  scopeOptions?: ReadonlyArray<IAgentComboBoxScopeOption>;
}

interface IAgentOptionData {
  agent: IDirectReport;
  type: 'agent';
}

interface IScopeOptionData {
  scopeKey: string;
  type: 'scope';
}

type AgentComboBoxOptionData = IAgentOptionData | IScopeOptionData;

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

const getScopeKey = (scopeKey: string): string => `scope:${scopeKey}`;

export const AgentComboBox: React.FC<IAgentComboBoxProps> = ({
  agents,
  disabled = false,
  label,
  onAgentChange,
  onScopeChange,
  placeholder = 'Escriba un nombre o correo',
  required = false,
  selectedAgent,
  selectedScopeKey,
  scopeOptions = []
}) => {
  const [searchText, setSearchText] = React.useState<string>('');
  const [inputValue, setInputValue] = React.useState<string>('');

  const authorizedAgentOptions = React.useMemo((): IComboBoxOption[] => {
    const optionsByIdentity = new Map<string, IComboBoxOption>();

    agents.forEach((agent) => {
      const key = getAgentKey(agent);

      if (!optionsByIdentity.has(key) && agent.name.trim()) {
        optionsByIdentity.set(key, {
          data: {
            agent,
            type: 'agent'
          } as IAgentOptionData,
          key,
          text: getAgentLabel(agent)
        });
      }
    });

    return Array.from(optionsByIdentity.values())
      .sort((left, right) => left.text.localeCompare(right.text, 'es'));
  }, [agents]);

  const authorizedScopeOptions = React.useMemo((): IComboBoxOption[] => {
    const optionsByKey = new Map<string, IComboBoxOption>();

    scopeOptions.forEach((scopeOption) => {
      const scopeKey = scopeOption.key.trim();
      const text = scopeOption.text.trim();

      if (scopeKey && text && !optionsByKey.has(scopeKey)) {
        optionsByKey.set(scopeKey, {
          data: {
            scopeKey,
            type: 'scope'
          } as IScopeOptionData,
          key: getScopeKey(scopeKey),
          text
        });
      }
    });

    return Array.from(optionsByKey.values());
  }, [scopeOptions]);

  const authorizedOptions = React.useMemo(
    (): IComboBoxOption[] => [
      ...authorizedScopeOptions,
      ...authorizedAgentOptions
    ],
    [authorizedAgentOptions, authorizedScopeOptions]
  );

  const filteredOptions = React.useMemo((): IComboBoxOption[] => {
    const normalizedSearch = normalizeSearchValue(searchText);

    if (!normalizedSearch) {
      return authorizedOptions;
    }

    return authorizedOptions.filter((option) => {
      const data = option.data as AgentComboBoxOptionData;

      if (data.type === 'scope') {
        return normalizeSearchValue(option.text).includes(normalizedSearch);
      }

      return normalizeSearchValue(data.agent.name).includes(normalizedSearch) ||
        normalizeSearchValue(data.agent.email).includes(normalizedSearch);
    });
  }, [authorizedOptions, searchText]);

  const selectedAgentId = selectedAgent
    ? getAgentKey(selectedAgent)
    : '';
  const selectedScopeOption = selectedScopeKey
    ? authorizedScopeOptions.find(
        (option) => option.key === getScopeKey(selectedScopeKey)
      )
    : undefined;

  React.useEffect(() => {
    const selectedValue = selectedAgent
      ? getAgentLabel(selectedAgent)
      : selectedScopeOption?.text || '';

    setInputValue(selectedAgentId || selectedScopeKey ? selectedValue : '');
    setSearchText('');
  }, [selectedAgent, selectedAgentId, selectedScopeKey, selectedScopeOption]);

  React.useEffect(() => {
    if (
      selectedAgent &&
      !authorizedAgentOptions.some(
        (option) => option.key === getAgentKey(selectedAgent)
      )
    ) {
      onAgentChange(undefined);
    }
  }, [authorizedAgentOptions, onAgentChange, selectedAgent]);

  React.useEffect(() => {
    if (
      selectedScopeKey &&
      !authorizedScopeOptions.some(
        (option) => option.key === getScopeKey(selectedScopeKey)
      )
    ) {
      onScopeChange?.(undefined);
    }
  }, [authorizedScopeOptions, onScopeChange, selectedScopeKey]);

  const isDropdownDisabled = disabled || (agents.length <= 1 && scopeOptions.length === 0);

  return (
    <ComboBox
      allowFreeform={false}
      allowFreeInput
      autoComplete="off"
      disabled={isDropdownDisabled}
      label={label}
      onChange={(_, option) => {
        const data = option?.data as AgentComboBoxOptionData | undefined;

        if (data?.type === 'scope') {
          onScopeChange?.(data.scopeKey);
          setInputValue(option?.text || '');
          setSearchText('');
          return;
        }

        onAgentChange(data?.agent);
        onScopeChange?.(undefined);
        setInputValue(data?.agent ? getAgentLabel(data.agent) : '');
        setSearchText('');
      }}
      onInputValueChange={(value) => {
        setInputValue(value);
        setSearchText(value);
      }}
      onMenuDismissed={() => setSearchText('')}
      openOnKeyboardFocus
      options={filteredOptions}
      placeholder={placeholder}
      required={required}
      selectedKey={
        selectedScopeKey
          ? getScopeKey(selectedScopeKey)
          : selectedAgent
            ? getAgentKey(selectedAgent)
            : undefined
      }
      text={inputValue}
      useComboBoxAsMenuWidth
    />
  );
};

export default AgentComboBox;
