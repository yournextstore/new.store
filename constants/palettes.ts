// HOW TO ADD A NEW COLOR PALETTE:
// 1. Define Core Colors:
//    - Create a new constant (e.g., `NEW_PALETTE_COLORS: CoreColors`).
//    - Specify 8 `CoreColors` (background, foreground, primaryAccent, buttonTextForeground,
//      navBackground, navForeground, footerBackground, footerForeground).
//    - For each core color, provide both its `oklch` string (for global theme settings)
//      and its `hex` string (for specific section themes).
//
// 2. Define the Full Palette Object:
//    - Create a new exported constant (e.g., `export const NEW_PALETTE: ColorPalette`).
//    - Assign a `name` (string, this will be used by the AI) and a `description` (string,
//      this will be shown to the AI to help it choose).
//    - Set `coreColors` to your new `NEW_PALETTE_COLORS` constant.
//    - Populate `globalPalette`:
//      - `theme.background` and `theme.DEFAULT` use `oklch` from core colors.
//      - `theme-nav.background` and `theme-nav.DEFAULT` use `oklch` from core colors.
//      - `theme-button.background`, `theme-button.DEFAULT`, and `theme-button.text` use `oklch` from core colors.
//      - `theme-footer.background` and `theme-footer.DEFAULT` use `oklch` from core colors.
//      - `theme-primary.DEFAULT` uses `oklch` from core colors (typically the primaryAccent).
//    - Populate `sectionThemes` (HeroSection, Nav, Footer, ProductDetails):
//      - All color values here use the `hex` strings from your defined core colors. This ensures
//        that section-specific themes are visually consistent with the global OKLCH-based theme.
//
// 3. Make Palette Available:
//    - Add your new palette object to the `AVAILABLE_PALETTES` record at the end of the file,
//      using its `name` as the key (e.g., `[NEW_PALETTE.name]: NEW_PALETTE`).
//
// 4. Update AI Prompt:
//    - Add the new palette's `name` and `description` to the list of available palettes in
//      `app/api/generate/gen-store-json-prompt.md` so the AI knows it can select it.

export interface CoreColors {
  background: string;
  foreground: string;
  primaryAccent: string;
  buttonTextForeground: string;
  navBackground: string;
  navForeground: string;
  footerBackground: string;
  footerForeground: string;
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
  background: '#f3f4f6', // Light Gray
  foreground: '#374151', // Dark Gray
  primaryAccent: '#3b82f6', // Blue
  buttonTextForeground: '#ffffff', // White
  navBackground: '#e5e7eb', // Slightly Darker Gray
  navForeground: '#374151', // Dark Gray
  footerBackground: '#374151', // Dark Gray
  footerForeground: '#f3f4f6', // Light Gray
};

const MINIMALIST_WARM_PALETTE_COLORS: CoreColors = {
  background: '#fdfbf7', // Off-white/Cream
  foreground: '#5c5855', // Dark Warm Gray
  primaryAccent: '#c06e52', // Terracotta
  buttonTextForeground: '#fdfbf7', // Off-white/Cream
  navBackground: '#fdfbf7', // Off-white/Cream
  navForeground: '#5c5855', // Dark Warm Gray
  footerBackground: '#5c5855', // Dark Warm Gray
  footerForeground: '#fdfbf7', // Off-white/Cream
};

const ECO_FRIENDLY_HEALTH_PALETTE_COLORS: CoreColors = {
  background: '#f5f5f0', // Very light, slightly warm off-white/pale beige
  foreground: '#5d5a53', // Deep, earthy brown-gray
  primaryAccent: '#6b8e23', // Muted, natural green (sage/olive like)
  buttonTextForeground: '#ffffff', // Clean White for text on green buttons
  navBackground: '#f0ede5', // Light creamy beige
  navForeground: '#5d5a53', // Deep, earthy brown-gray (same as main foreground)
  footerBackground: '#686357', // Richer, earthy brown
  footerForeground: '#f0ede5', // Lighter text for footer, matching nav background
};

export const DEFAULT_PALETTE: ColorPalette = {
  name: 'Default',
  description:
    'A versatile and neutral theme with light grey backgrounds, dark grey text, and a classic blue accent for calls to action. Suitable for a wide range of stores needing a clean, professional look.',
  coreColors: DEFAULT_PALETTE_COLORS,
  globalPalette: {
    theme: {
      background: DEFAULT_PALETTE_COLORS.background,
      DEFAULT: DEFAULT_PALETTE_COLORS.foreground,
    },
    'theme-nav': {
      background: DEFAULT_PALETTE_COLORS.navBackground,
      DEFAULT: DEFAULT_PALETTE_COLORS.navForeground,
    },
    'theme-button': {
      background: DEFAULT_PALETTE_COLORS.primaryAccent,
      DEFAULT: DEFAULT_PALETTE_COLORS.primaryAccent,
      text: DEFAULT_PALETTE_COLORS.buttonTextForeground,
    },
    'theme-footer': {
      background: DEFAULT_PALETTE_COLORS.footerBackground,
      DEFAULT: DEFAULT_PALETTE_COLORS.footerForeground,
    },
    'theme-primary': { DEFAULT: DEFAULT_PALETTE_COLORS.primaryAccent },
  },
  sectionThemes: {
    HeroSection: {
      backgroundColor: DEFAULT_PALETTE_COLORS.background,
      color: DEFAULT_PALETTE_COLORS.foreground,
      buttonBackgroundColor: DEFAULT_PALETTE_COLORS.primaryAccent,
      buttonTextColor: DEFAULT_PALETTE_COLORS.buttonTextForeground,
    },
    Nav: {
      backgroundColor: DEFAULT_PALETTE_COLORS.navBackground,
      color: DEFAULT_PALETTE_COLORS.navForeground,
    },
    Footer: {
      backgroundColor: DEFAULT_PALETTE_COLORS.footerBackground,
      color: DEFAULT_PALETTE_COLORS.footerForeground,
    },
    ProductDetails: {
      color: DEFAULT_PALETTE_COLORS.foreground,
      buttonBackgroundColor: DEFAULT_PALETTE_COLORS.primaryAccent,
      buttonTextColor: DEFAULT_PALETTE_COLORS.buttonTextForeground,
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
      background: MINIMALIST_WARM_PALETTE_COLORS.background,
      DEFAULT: MINIMALIST_WARM_PALETTE_COLORS.foreground,
    },
    'theme-nav': {
      background: MINIMALIST_WARM_PALETTE_COLORS.navBackground,
      DEFAULT: MINIMALIST_WARM_PALETTE_COLORS.navForeground,
    },
    'theme-button': {
      background: MINIMALIST_WARM_PALETTE_COLORS.primaryAccent,
      DEFAULT: MINIMALIST_WARM_PALETTE_COLORS.primaryAccent,
      text: MINIMALIST_WARM_PALETTE_COLORS.buttonTextForeground,
    },
    'theme-footer': {
      background: MINIMALIST_WARM_PALETTE_COLORS.footerBackground,
      DEFAULT: MINIMALIST_WARM_PALETTE_COLORS.footerForeground,
    },
    'theme-primary': {
      DEFAULT: MINIMALIST_WARM_PALETTE_COLORS.primaryAccent,
    },
  },
  sectionThemes: {
    HeroSection: {
      backgroundColor: MINIMALIST_WARM_PALETTE_COLORS.background,
      color: MINIMALIST_WARM_PALETTE_COLORS.foreground,
      buttonBackgroundColor: MINIMALIST_WARM_PALETTE_COLORS.primaryAccent,
      buttonTextColor: MINIMALIST_WARM_PALETTE_COLORS.buttonTextForeground,
    },
    Nav: {
      backgroundColor: MINIMALIST_WARM_PALETTE_COLORS.navBackground,
      color: MINIMALIST_WARM_PALETTE_COLORS.navForeground,
    },
    Footer: {
      backgroundColor: MINIMALIST_WARM_PALETTE_COLORS.footerBackground,
      color: MINIMALIST_WARM_PALETTE_COLORS.footerForeground,
    },
    ProductDetails: {
      color: MINIMALIST_WARM_PALETTE_COLORS.foreground,
      buttonBackgroundColor: MINIMALIST_WARM_PALETTE_COLORS.primaryAccent,
      buttonTextColor: MINIMALIST_WARM_PALETTE_COLORS.buttonTextForeground,
    },
  },
};

export const ECO_FRIENDLY_HEALTH_PALETTE: ColorPalette = {
  name: 'ecoFriendlyHealth',
  description:
    'A calming and natural theme using earthy tones, soft greens, and off-whites. Perfect for stores emphasizing organic, sustainable, or health-focused products, creating a wholesome and trustworthy feel.',
  coreColors: ECO_FRIENDLY_HEALTH_PALETTE_COLORS,
  globalPalette: {
    theme: {
      background: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.background,
      DEFAULT: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.foreground,
    },
    'theme-nav': {
      background: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.navBackground,
      DEFAULT: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.navForeground,
    },
    'theme-button': {
      background: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.primaryAccent,
      DEFAULT: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.primaryAccent,
      text: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.buttonTextForeground,
    },
    'theme-footer': {
      background: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.footerBackground,
      DEFAULT: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.footerForeground,
    },
    'theme-primary': {
      DEFAULT: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.primaryAccent,
    },
  },
  sectionThemes: {
    HeroSection: {
      backgroundColor: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.background,
      color: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.foreground,
      buttonBackgroundColor: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.primaryAccent,
      buttonTextColor: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.buttonTextForeground,
    },
    Nav: {
      backgroundColor: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.navBackground,
      color: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.navForeground,
    },
    Footer: {
      backgroundColor: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.footerBackground,
      color: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.footerForeground,
    },
    ProductDetails: {
      color: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.foreground,
      buttonBackgroundColor: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.primaryAccent,
      buttonTextColor: ECO_FRIENDLY_HEALTH_PALETTE_COLORS.buttonTextForeground,
    },
  },
};

export const AVAILABLE_PALETTES: Record<string, ColorPalette> = {
  [DEFAULT_PALETTE.name]: DEFAULT_PALETTE,
  [MINIMALIST_WARM_PALETTE.name]: MINIMALIST_WARM_PALETTE,
  [ECO_FRIENDLY_HEALTH_PALETTE.name]: ECO_FRIENDLY_HEALTH_PALETTE,
};
