import {
  createTheme,
  type IStackStyles,
  type ITheme
} from '@fluentui/react';

export const darkTheme: ITheme = createTheme({
  isInverted: true,
  palette: {
    themeDarker: '#00385f',
    themeDark: '#005a9e',
    themeDarkAlt: '#106ebe',
    themePrimary: '#0078d4',
    themeSecondary: '#2b88d8',
    themeTertiary: '#71afe5',
    themeLight: '#c7e0f4',
    themeLighter: '#deecf9',
    themeLighterAlt: '#eff6fc',
    accent: '#00a4ef',
    neutralLighterAlt: '#1b1b1e',
    neutralLighter: '#252529',
    neutralLight: '#2f2f36',
    neutralQuaternaryAlt: '#383842',
    neutralQuaternary: '#40404c',
    neutralTertiaryAlt: '#5d5d6c',
    neutralTertiary: '#c8c8c8',
    neutralSecondary: '#d0d0d0',
    neutralPrimaryAlt: '#dadada',
    neutralPrimary: '#ffffff',
    neutralDark: '#f4f4f4',
    black: '#ffffff',
    white: '#121214'
  },
  semanticColors: {
    bodyBackground: '#0f0f12',
    bodyFrameBackground: '#0f0f12',
    bodyText: '#ffffff',
    bodySubtext: '#c8c8c8',
    disabledBackground: '#252529',
    disabledText: '#73737f',
    inputBackground: '#151519',
    inputBorder: '#40404c',
    inputBorderHovered: '#0078d4',
    inputFocusBorderAlt: '#00a4ef',
    inputText: '#ffffff',
    inputPlaceholderText: '#9a9aa5',
    buttonBackground: '#252529',
    buttonBackgroundHovered: '#2f2f36',
    buttonBackgroundPressed: '#383842',
    buttonText: '#ffffff',
    buttonTextHovered: '#ffffff',
    primaryButtonBackground: '#0078d4',
    primaryButtonBackgroundHovered: '#1686d9',
    primaryButtonBackgroundPressed: '#005a9e',
    primaryButtonText: '#ffffff',
    primaryButtonTextHovered: '#ffffff',
    link: '#55b7ff',
    linkHovered: '#8dceff',
    errorText: '#ff8a8a',
    messageText: '#ffffff'
  }
});

/**
 * Superficie reutilizable para widgets y tarjetas del portal.
 * Puede aplicarse directamente a componentes Stack mediante su prop `styles`.
 */
export const glowCardStyles: IStackStyles = {
  root: {
    background: '#1a1a1e',
    border: '1px solid #2d2d35',
    borderRadius: 8,
    boxShadow: '0 0 0 1px rgba(0, 120, 212, 0.08), 0 14px 36px rgba(0, 0, 0, 0.34)',
    padding: 24
  }
};
