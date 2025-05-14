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
  coreColors: CoreColors;
  globalPalette: GlobalPalette;
  sectionThemes: SectionThemes;
}

export const DEFAULT_PALETTE: ColorPalette = genPallette('Default', {
  background: '#f3f4f6', // Light Gray
  foreground: '#374151', // Dark Gray
  primaryAccent: '#3b82f6', // Blue
  buttonTextForeground: '#ffffff', // White
  navBackground: '#e5e7eb', // Slightly Darker Gray
  navForeground: '#374151', // Dark Gray
  footerBackground: '#374151', // Dark Gray
  footerForeground: '#f3f4f6', // Light Gray
});

export const MINIMALIST_WARM_PALETTE: ColorPalette = genPallette(
  'MinimalistWarm',
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

const LINEN_OLIVE_COLORS_PALLETE: ColorPalette = genPallette(
  'LINEN_OLIVE_COLORS',
  {
    background: '#FFFBF0',
    foreground: '#2E2E2E',
    primaryAccent: '#6B8E23',
    buttonTextForeground: '#FFFFFF',
    navBackground: '#FFFFFF',
    navForeground: '#333333',
    footerBackground: '#2E2E2E',
    footerForeground: '#FFFBF0',
  },
);

const PORCELAIN_CORAL_COLORS_PALLETE: ColorPalette = genPallette(
  'PORCELAIN_CORAL_COLORS',
  {
    background: '#F9FAFB',
    foreground: '#0F172A',
    primaryAccent: '#F87171',
    buttonTextForeground: '#FFFFFF',
    navBackground: '#FFFFFF',
    navForeground: '#1F2937',
    footerBackground: '#0F172A',
    footerForeground: '#F9FAFB',
  },
);

const CLOUD_SKY_COLORS_PALLETE: ColorPalette = genPallette('CLOUD_SKY_COLORS', {
  background: '#F8FAFC',
  foreground: '#1E293B',
  primaryAccent: '#38BDF8',
  buttonTextForeground: '#FFFFFF',
  navBackground: '#F1F5F9',
  navForeground: '#0F172A',
  footerBackground: '#1E293B',
  footerForeground: '#F8FAFC',
});

const EGGSHELL_AMBER_COLORS_PALLETE: ColorPalette = genPallette(
  'EGGSHELL_AMBER_COLORS',
  {
    background: '#FFFBEB',
    foreground: '#1C1917',
    primaryAccent: '#F59E0B',
    buttonTextForeground: '#FFFFFF',
    navBackground: '#FFF7ED',
    navForeground: '#292524',
    footerBackground: '#1C1917',
    footerForeground: '#FFFBEB',
  },
);

const IVORY_ROSE_COLORS_PALLETE: ColorPalette = genPallette(
  'IVORY_ROSE_COLORS',
  {
    background: '#FFFAF5',
    foreground: '#1A1A1A',
    primaryAccent: '#FB7185',
    buttonTextForeground: '#FFFFFF',
    navBackground: '#FFFFFF',
    navForeground: '#1E1E1E',
    footerBackground: '#1A1A1A',
    footerForeground: '#FFFAF5',
  },
);

const WHITE_LIME_COLORS_PALLETE: ColorPalette = genPallette(
  'WHITE_LIME_COLORS',
  {
    background: '#FFFFFF',
    foreground: '#222222',
    primaryAccent: '#84CC16',
    buttonTextForeground: '#FFFFFF',
    navBackground: '#FFFFFF',
    navForeground: '#1A1A1A',
    footerBackground: '#222222',
    footerForeground: '#FFFFFF',
  },
);

const PARCHMENT_CYAN_COLORS_PALLETE: ColorPalette = genPallette(
  'PARCHMENT_CYAN_COLORS',
  {
    background: '#FDFCFB',
    foreground: '#1C1C1C',
    primaryAccent: '#06B6D4',
    buttonTextForeground: '#FFFFFF',
    navBackground: '#F8FAFC',
    navForeground: '#0F172A',
    footerBackground: '#1C1C1C',
    footerForeground: '#FDFCFB',
  },
);

const SNOW_VIOLET_COLORS_PALLETE: ColorPalette = genPallette(
  'SNOW_VIOLET_COLORS',
  {
    background: '#FDFDFD',
    foreground: '#2E2E2E',
    primaryAccent: '#8B5CF6',
    buttonTextForeground: '#FFFFFF',
    navBackground: '#FFFFFF',
    navForeground: '#1E1E1E',
    footerBackground: '#2E2E2E',
    footerForeground: '#FDFDFD',
  },
);

const CHARCOAL_MINT_COLORS_PALLETE: ColorPalette = genPallette(
  'CHARCOAL_MINT_COLORS',
  {
    background: '#1F1F1F',
    foreground: '#F9FAFB',
    primaryAccent: '#34D399',
    buttonTextForeground: '#0F172A',
    navBackground: '#1A1A1A',
    navForeground: '#E5E7EB',
    footerBackground: '#F9FAFB',
    footerForeground: '#1F1F1F',
  },
);

const OBSIDIAN_SKY_COLORS_PALLETE: ColorPalette = genPallette(
  'OBSIDIAN_SKY_COLORS',
  {
    background: '#0B0C10',
    foreground: '#F8FAFC',
    primaryAccent: '#60A5FA',
    buttonTextForeground: '#0F172A',
    navBackground: '#111827',
    navForeground: '#CBD5E1',
    footerBackground: '#F8FAFC',
    footerForeground: '#0B0C10',
  },
);

const GRAPHITE_LEMON_COLORS_PALLETE: ColorPalette = genPallette(
  'GRAPHITE_LEMON_COLORS',
  {
    background: '#1C1C1C',
    foreground: '#E5E7EB',
    primaryAccent: '#FACC15',
    buttonTextForeground: '#1C1917',
    navBackground: '#1F2937',
    navForeground: '#F3F4F6',
    footerBackground: '#E5E7EB',
    footerForeground: '#1C1C1C',
  },
);

const SLATE_PEACH_COLORS_PALLETE: ColorPalette = genPallette(
  'SLATE_PEACH_COLORS',
  {
    background: '#1E293B',
    foreground: '#F8FAFC',
    primaryAccent: '#FDBA74',
    buttonTextForeground: '#1E293B',
    navBackground: '#1C1C1C',
    navForeground: '#E5E7EB',
    footerBackground: '#F8FAFC',
    footerForeground: '#1E293B',
  },
);

export const AVAILABLE_PALETTES: Record<string, ColorPalette> = {
  [DEFAULT_PALETTE.name]: DEFAULT_PALETTE,
  [MINIMALIST_WARM_PALETTE.name]: MINIMALIST_WARM_PALETTE,
  [ECO_FRIENDLY_HEALTH_PALETTE.name]: ECO_FRIENDLY_HEALTH_PALETTE,
  [LINEN_OLIVE_COLORS_PALLETE.name]: LINEN_OLIVE_COLORS_PALLETE,
  [PORCELAIN_CORAL_COLORS_PALLETE.name]: PORCELAIN_CORAL_COLORS_PALLETE,
  [CLOUD_SKY_COLORS_PALLETE.name]: CLOUD_SKY_COLORS_PALLETE,
  [EGGSHELL_AMBER_COLORS_PALLETE.name]: EGGSHELL_AMBER_COLORS_PALLETE,
  [IVORY_ROSE_COLORS_PALLETE.name]: IVORY_ROSE_COLORS_PALLETE,
  [WHITE_LIME_COLORS_PALLETE.name]: WHITE_LIME_COLORS_PALLETE,
  [PARCHMENT_CYAN_COLORS_PALLETE.name]: PARCHMENT_CYAN_COLORS_PALLETE,
  [SNOW_VIOLET_COLORS_PALLETE.name]: SNOW_VIOLET_COLORS_PALLETE,
  [CHARCOAL_MINT_COLORS_PALLETE.name]: CHARCOAL_MINT_COLORS_PALLETE,
  [OBSIDIAN_SKY_COLORS_PALLETE.name]: OBSIDIAN_SKY_COLORS_PALLETE,
  [GRAPHITE_LEMON_COLORS_PALLETE.name]: GRAPHITE_LEMON_COLORS_PALLETE,
  [SLATE_PEACH_COLORS_PALLETE.name]: SLATE_PEACH_COLORS_PALLETE,
};

function genPallette(name: string, coreColors: CoreColors) {
  return {
    name,
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
