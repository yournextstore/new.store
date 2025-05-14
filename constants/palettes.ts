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

export const DEFAULT_PALETTE: ColorPalette = genPallette(
  'Default',
  'A versatile and neutral theme with light grey backgrounds, dark grey text, and a classic blue accent for calls to action. Suitable for a wide range of stores needing a clean, professional look.',
  {
    background: '#f3f4f6', // Light Gray
    foreground: '#374151', // Dark Gray
    primaryAccent: '#3b82f6', // Blue
    buttonTextForeground: '#ffffff', // White
    navBackground: '#e5e7eb', // Slightly Darker Gray
    navForeground: '#374151', // Dark Gray
    footerBackground: '#374151', // Dark Gray
    footerForeground: '#f3f4f6', // Light Gray
  },
);

export const MINIMALIST_WARM_PALETTE: ColorPalette = genPallette(
  'MinimalistWarm',
  'A clean, modern, and airy theme with off-white and cream backgrounds, warm grey text, and a touch of earthy terracotta for highlights. Ideal for designs that feel calm, organic, or subtly sophisticated.',
  {
    background: '#fdfbf7', // Off-white/Cream
    foreground: '#5c5855', // Dark Warm Gray
    primaryAccent: '#c06e52', // Terracotta
    buttonTextForeground: '#fdfbf7', // Off-white/Cream
    navBackground: '#fdfbf7', // Off-white/Cream
    navForeground: '#5c5855', // Dark Warm Gray
    footerBackground: '#5c5855', // Dark Warm Gray
    footerForeground: '#fdfbf7', // Off-white/Cream
  },
);

export const ECO_FRIENDLY_HEALTH_PALETTE: ColorPalette = genPallette(
  'ecoFriendlyHealth',
  'A calming and natural theme using earthy tones, soft greens, and off-whites. Perfect for stores emphasizing organic, sustainable, or health-focused products, creating a wholesome and trustworthy feel.',
  {
    background: '#f5f5f0', // Very light, slightly warm off-white/pale beige
    foreground: '#5d5a53', // Deep, earthy brown-gray
    primaryAccent: '#6b8e23', // Muted, natural green (sage/olive like)
    buttonTextForeground: '#ffffff', // Clean White for text on green buttons
    navBackground: '#f0ede5', // Light creamy beige
    navForeground: '#5d5a53', // Deep, earthy brown-gray (same as main foreground)
    footerBackground: '#686357', // Richer, earthy brown
    footerForeground: '#f0ede5', // Lighter text for footer, matching nav background
  },
);

export const AVAILABLE_PALETTES: Record<string, ColorPalette> = {
  [DEFAULT_PALETTE.name]: DEFAULT_PALETTE,
  [MINIMALIST_WARM_PALETTE.name]: MINIMALIST_WARM_PALETTE,
  [ECO_FRIENDLY_HEALTH_PALETTE.name]: ECO_FRIENDLY_HEALTH_PALETTE,
};

function genPallette(
  name: string,
  description: string,
  coreColors: CoreColors,
) {
  return {
    name,
    description,
    coreColors: coreColors,
    globalPalette: {
      theme: {
        background: coreColors.background,
        DEFAULT: coreColors.foreground,
      },
      'theme-nav': {
        background: coreColors.navBackground,
        DEFAULT: coreColors.navForeground,
      },
      'theme-button': {
        background: coreColors.primaryAccent,
        DEFAULT: coreColors.primaryAccent,
        text: coreColors.buttonTextForeground,
      },
      'theme-footer': {
        background: coreColors.footerBackground,
        DEFAULT: coreColors.footerForeground,
      },
      'theme-primary': {
        DEFAULT: coreColors.primaryAccent,
      },
    },
    sectionThemes: {
      HeroSection: {
        backgroundColor: coreColors.background,
        color: coreColors.foreground,
        buttonBackgroundColor: coreColors.primaryAccent,
        buttonTextColor: coreColors.buttonTextForeground,
      },
      Nav: {
        backgroundColor: coreColors.navBackground,
        color: coreColors.navForeground,
      },
      Footer: {
        backgroundColor: coreColors.footerBackground,
        color: coreColors.footerForeground,
      },
      ProductDetails: {
        color: coreColors.foreground,
        buttonBackgroundColor: coreColors.primaryAccent,
        buttonTextColor: coreColors.buttonTextForeground,
      },
    },
  };
}
