export interface CoreColors {
  background: { oklch: string; hex: string };
  foreground: { oklch: string; hex: string };
  primaryAccent: { oklch: string; hex: string };
  buttonTextForeground: { oklch: string; hex: string };
  navBackground: { oklch: string; hex: string };
  navForeground: { oklch: string; hex: string };
  footerBackground: { oklch: string; hex: string };
  footerForeground: { oklch: string; hex: string };
}

export interface GlobalPalette {
  theme: { background: string; DEFAULT: string };
  'theme-nav': { background: string; DEFAULT: string };
  'theme-button': { background: string; DEFAULT: string; text: string };
  'theme-footer': { background: string; DEFAULT: string };
  'theme-primary': { DEFAULT: string };
}

export interface SectionThemes {
  HeroSection?: {
    backgroundColor: string;
    color: string;
    buttonBackgroundColor: string;
    buttonTextColor: string;
  };
  Nav?: { backgroundColor: string; color: string };
  Footer?: { backgroundColor: string; color: string };
  ProductDetails?: {
    color: string;
    buttonBackgroundColor: string;
    buttonTextColor: string;
  };
}

export interface ColorPalette {
  name: string;
  description: string;
  coreColors: CoreColors;
  globalPalette: GlobalPalette;
  sectionThemes: SectionThemes;
}

const DEFAULT_PALETTE_COLORS: CoreColors = {
  background: { oklch: '95% 0 0', hex: '#f3f4f6' }, // Light Gray
  foreground: { oklch: '20% 0 0', hex: '#374151' }, // Dark Gray
  primaryAccent: { oklch: '55% 0.15 250', hex: '#3b82f6' }, // Blue
  buttonTextForeground: { oklch: '100% 0 0', hex: '#ffffff' }, // White
  navBackground: { oklch: '90% 0 0', hex: '#e5e7eb' }, // Slightly Darker Gray
  navForeground: { oklch: '20% 0 0', hex: '#374151' }, // Dark Gray
  footerBackground: { oklch: '20% 0 0', hex: '#374151' }, // Dark Gray
  footerForeground: { oklch: '95% 0 0', hex: '#f3f4f6' }, // Light Gray
};

const MINIMALIST_WARM_PALETTE_COLORS: CoreColors = {
  background: { oklch: '98% 0.01 90', hex: '#fdfbf7' }, // Off-white/Cream
  foreground: { oklch: '30% 0.02 70', hex: '#5c5855' }, // Dark Warm Gray
  primaryAccent: { oklch: '60% 0.1 40', hex: '#c06e52' }, // Terracotta
  buttonTextForeground: { oklch: '98% 0.01 90', hex: '#fdfbf7' }, // Off-white/Cream
  navBackground: { oklch: '98% 0.01 90', hex: '#fdfbf7' }, // Off-white/Cream
  navForeground: { oklch: '30% 0.02 70', hex: '#5c5855' }, // Dark Warm Gray
  footerBackground: { oklch: '30% 0.02 70', hex: '#5c5855' }, // Dark Warm Gray
  footerForeground: { oklch: '98% 0.01 90', hex: '#fdfbf7' }, // Off-white/Cream
};

export const DEFAULT_PALETTE: ColorPalette = {
  name: 'Default',
  description:
    'A versatile and neutral theme with light grey backgrounds, dark grey text, and a classic blue accent for calls to action. Suitable for a wide range of stores needing a clean, professional look.',
  coreColors: DEFAULT_PALETTE_COLORS,
  globalPalette: {
    theme: {
      background: DEFAULT_PALETTE_COLORS.background.oklch,
      DEFAULT: DEFAULT_PALETTE_COLORS.foreground.oklch,
    },
    'theme-nav': {
      background: DEFAULT_PALETTE_COLORS.navBackground.oklch,
      DEFAULT: DEFAULT_PALETTE_COLORS.navForeground.oklch,
    },
    'theme-button': {
      background: DEFAULT_PALETTE_COLORS.primaryAccent.oklch,
      DEFAULT: DEFAULT_PALETTE_COLORS.primaryAccent.oklch,
      text: DEFAULT_PALETTE_COLORS.buttonTextForeground.oklch,
    },
    'theme-footer': {
      background: DEFAULT_PALETTE_COLORS.footerBackground.oklch,
      DEFAULT: DEFAULT_PALETTE_COLORS.footerForeground.oklch,
    },
    'theme-primary': { DEFAULT: DEFAULT_PALETTE_COLORS.primaryAccent.oklch },
  },
  sectionThemes: {
    HeroSection: {
      backgroundColor: DEFAULT_PALETTE_COLORS.background.hex,
      color: DEFAULT_PALETTE_COLORS.foreground.hex,
      buttonBackgroundColor: DEFAULT_PALETTE_COLORS.primaryAccent.hex,
      buttonTextColor: DEFAULT_PALETTE_COLORS.buttonTextForeground.hex,
    },
    Nav: {
      backgroundColor: DEFAULT_PALETTE_COLORS.navBackground.hex,
      color: DEFAULT_PALETTE_COLORS.navForeground.hex,
    },
    Footer: {
      backgroundColor: DEFAULT_PALETTE_COLORS.footerBackground.hex,
      color: DEFAULT_PALETTE_COLORS.footerForeground.hex,
    },
    ProductDetails: {
      color: DEFAULT_PALETTE_COLORS.foreground.hex,
      buttonBackgroundColor: DEFAULT_PALETTE_COLORS.primaryAccent.hex,
      buttonTextColor: DEFAULT_PALETTE_COLORS.buttonTextForeground.hex,
    },
  },
};

export const MINIMALIST_WARM_PALETTE: ColorPalette = {
  name: 'MinimalistWarm',
  description:
    'A clean, modern, and airy theme with off-white and cream backgrounds, warm grey text, and a touch of earthy terracotta for highlights. Ideal for designs that feel calm, organic, or subtly sophisticated.',
  coreColors: MINIMALIST_WARM_PALETTE_COLORS,
  globalPalette: {
    theme: {
      background: MINIMALIST_WARM_PALETTE_COLORS.background.oklch,
      DEFAULT: MINIMALIST_WARM_PALETTE_COLORS.foreground.oklch,
    },
    'theme-nav': {
      background: MINIMALIST_WARM_PALETTE_COLORS.navBackground.oklch,
      DEFAULT: MINIMALIST_WARM_PALETTE_COLORS.navForeground.oklch,
    },
    'theme-button': {
      background: MINIMALIST_WARM_PALETTE_COLORS.primaryAccent.oklch,
      DEFAULT: MINIMALIST_WARM_PALETTE_COLORS.primaryAccent.oklch,
      text: MINIMALIST_WARM_PALETTE_COLORS.buttonTextForeground.oklch,
    },
    'theme-footer': {
      background: MINIMALIST_WARM_PALETTE_COLORS.footerBackground.oklch,
      DEFAULT: MINIMALIST_WARM_PALETTE_COLORS.footerForeground.oklch,
    },
    'theme-primary': {
      DEFAULT: MINIMALIST_WARM_PALETTE_COLORS.primaryAccent.oklch,
    },
  },
  sectionThemes: {
    HeroSection: {
      backgroundColor: MINIMALIST_WARM_PALETTE_COLORS.background.hex,
      color: MINIMALIST_WARM_PALETTE_COLORS.foreground.hex,
      buttonBackgroundColor: MINIMALIST_WARM_PALETTE_COLORS.primaryAccent.hex,
      buttonTextColor: MINIMALIST_WARM_PALETTE_COLORS.buttonTextForeground.hex,
    },
    Nav: {
      backgroundColor: MINIMALIST_WARM_PALETTE_COLORS.navBackground.hex,
      color: MINIMALIST_WARM_PALETTE_COLORS.navForeground.hex,
    },
    Footer: {
      backgroundColor: MINIMALIST_WARM_PALETTE_COLORS.footerBackground.hex,
      color: MINIMALIST_WARM_PALETTE_COLORS.footerForeground.hex,
    },
    ProductDetails: {
      color: MINIMALIST_WARM_PALETTE_COLORS.foreground.hex,
      buttonBackgroundColor: MINIMALIST_WARM_PALETTE_COLORS.primaryAccent.hex,
      buttonTextColor: MINIMALIST_WARM_PALETTE_COLORS.buttonTextForeground.hex,
    },
  },
};

export const AVAILABLE_PALETTES: Record<string, ColorPalette> = {
  [DEFAULT_PALETTE.name]: DEFAULT_PALETTE,
  [MINIMALIST_WARM_PALETTE.name]: MINIMALIST_WARM_PALETTE,
};
