// Color tokens from Bayn design system

export const primitives = {
  primary: {
    100: '#90E4C8',
    150: '#83D3B9',
    200: '#76C3A9',
    250: '#69B29A',
    300: '#5CA18A',
    400: '#43806C',
    500: '#295E4D',
    600: '#0F3D2E',
    700: '#0C3125',
    800: '#09251C',
    900: '#061812',
    950: '#04120E',
    1000: '#030C09',
    1100: '#020605',
  },

  neutral: {
    100: '#FFFFFF',
    200: '#C9C9C9',
    300: '#AEAEAE',
    400: '#787878',
    500: '#606060',
    600: '#484848',
    700: '#000000',
  },

  secondary: {
    100: '#F8F6F3',
    200: '#F2EEE8',
    300: '#EBE5DC',
    400: '#E4DDD0',
    500: '#D7CBB9',
    600: '#C9BAA1',
    700: '#BCA98A',
    800: '#9A8A71',
    900: '#786C57',
    1000: '#574D3E',
    1050: '#463E31',
    1100: '#352F24',
    1150: '#241F18',
    1200: '#13100B',
  },

  error: {
    100: '#FEE6E6',
    200: '#FCCCCC',
    300: '#F99999',
    400: '#F66666',
    500: '#F33333',
    600: '#F00000',
    700: '#C00000',
    800: '#900000',
    900: '#300000',
  },

  warning: {
    100: '#FFF8E6',
    200: '#FFF1CC',
    300: '#FFE499',
    400: '#FFD666',
    500: '#FFC933',
    600: '#FFBB00',
    700: '#CC9600',
    800: '#997000',
    900: '#332500',
  },

  success: {
    100: '#EDFBE6',
    200: '#DBF7CC',
    300: '#B7EF99',
    400: '#93E666',
    500: '#6FDE33',
    600: '#4BD600',
    700: '#3CAB00',
    800: '#2D8000',
    900: '#0F2B00',
  },

  darkMood: {
    100: '#85928B',
    200: '#76837D',
    300: '#4C5550',
    400: '#4C5550',
    500: '#2A2B26',
    600: '#141816',
    700: '#0F1211',
    800: '#0A0D0C',
    900: '#07090A',
  },
};

export const semantic = {
  background: {
    surfacePrimary: primitives.secondary[300],
    surfaceSecondary: primitives.secondary[500],
    surfaceThirdary: primitives.secondary[600],
    surfaceTertiary: primitives.primary[100],
    borderPrimary: primitives.secondary[1100],
  },

  buttons: {
    primaryDefault: primitives.primary[500],
    primaryHover: primitives.primary[600],
    primaryClickEffect: 'rgba(235, 229, 220, 0.1)',
    secondaryHover: primitives.secondary[800],
    secondaryClickEffect: 'rgba(120, 108, 87, 0.49)',
    tertiaryHover: primitives.secondary[900],
    text: primitives.secondary[300],
  },

  text: {
    title: primitives.primary[600],
    body: primitives.primary[500],
    body2: primitives.secondary[1050],
    supporting: primitives.secondary[900],
    disabled: primitives.neutral[400],
    disabled2: primitives.neutral[500],
  },

  input: {
    defaultBackground: 'rgba(215, 203, 185, 0.7)',
    hoverBackground: primitives.secondary[600],
    hoverBorder: primitives.secondary[700],
    focus: primitives.secondary[400],
    borderDefault: primitives.secondary[1050],
    disabled: primitives.neutral[300],
    disabledBorder: primitives.neutral[600],
    error: primitives.error[800],
  },

  dropdown: {
    hover: primitives.secondary[500],
  },

  checkbox: {
    borderDefault: primitives.secondary[1000],
    clickEffect: primitives.secondary[700],
    hoverEffect: 'rgba(70, 62, 49, 0.2)',
    checkColor: primitives.primary[600],
  },

  sidebar: {
    background: primitives.primary[700],
    textDefault: primitives.secondary[600],
    hoverButton: primitives.primary[600],
  },
};

export const colors = { ...primitives, ...semantic };

export default colors;
