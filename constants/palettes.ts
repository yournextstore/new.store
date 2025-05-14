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

export const DEFAULT_PALETTE: ColorPalette = genPalette(
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

export const MINIMALIST_WARM_PALETTE: ColorPalette = genPalette(
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

export const ECO_FRIENDLY_HEALTH_PALETTE: ColorPalette = genPalette(
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

const LINEN_OLIVE_COLORS_PALETTE: ColorPalette = genPalette(
  'LinenOlive',
  'A grounded and earthy theme with soft linen backgrounds, deep grey text, and a natural olive green accent. Great for artisanal or eco-conscious brands that want to feel rustic yet refined.',
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

const PORCELAIN_CORAL_COLORS_PALETTE: ColorPalette = genPalette(
  'PorcelainCoral',
  'A fresh and delicate theme with porcelain white backgrounds, navy-toned text, and soft coral accents. Ideal for wellness, beauty, or boutique brands looking for elegance with a gentle pop.',
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

const CLOUD_SKY_COLORS_PALETTE: ColorPalette = genPalette(
  'CloudSky',
  'A crisp and breathable theme with sky-blue accents, soft navy text, and cool white tones. Perfect for modern digital stores that want to feel lightweight, clean, and tech-savvy.',
  {
    background: '#F8FAFC',
    foreground: '#1E293B',
    primaryAccent: '#38BDF8',
    buttonTextForeground: '#FFFFFF',
    navBackground: '#F1F5F9',
    navForeground: '#0F172A',
    footerBackground: '#1E293B',
    footerForeground: '#F8FAFC',
  },
);

const EGGSHELL_AMBER_COLORS_PALETTE: ColorPalette = genPalette(
  'EggshellAmber',
  'A warm and inviting palette featuring creamy backgrounds, rich brown text, and golden amber highlights. Great for cozy lifestyle stores or heritage-inspired brands.',
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

const IVORY_ROSE_COLORS_PALETTE: ColorPalette = genPalette(
  'IvoryRose',
  'A romantic and gentle palette with blush undertones, ivory backdrops, and rose-pink accents. Ideal for fashion, personal care, or creator stores with a soft, emotional tone.',
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

const WHITE_LIME_COLORS_PALETTE: ColorPalette = genPalette(
  'WhiteLime',
  'A bold and bright theme with crisp white backgrounds, charcoal text, and vibrant lime green for standout CTAs. Great for energetic brands, Gen Z products, or sustainability-focused items.',
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

const PARCHMENT_CYAN_COLORS_PALETTE: ColorPalette = genPalette(
  'ParchmentCyan',
  'A clean and professional theme with parchment-like backgrounds, charcoal text, and a bright cyan pop. Fits well with tech, education, or service-oriented shops.',
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

const SNOW_VIOLET_COLORS_PALETTE: ColorPalette = genPalette(
  'SnowViolet',
  'A minimalist and expressive theme with white-on-white layers, cool violet buttons, and deep grey text. Great for art, design-forward brands, or modern personal portfolios.',
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

const CHARCOAL_MINT_COLORS_PALETTE: ColorPalette = genPalette(
  'CharcoalMint',
  'A sleek dark mode palette with charcoal backdrops, mint green CTAs, and bright text for contrast. Ideal for modern wellness, SaaS, or premium night-mode experiences.',
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

const OBSIDIAN_SKY_COLORS_PALETTE: ColorPalette = genPalette(
  'ObsidianSky',
  'A techy dark theme with obsidian black bases, cool blue buttons, and light steel text. Perfect for software, developer tools, or edgy fashion brands.',
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

const GRAPHITE_LEMON_COLORS_PALETTE: ColorPalette = genPalette(
  'GraphiteLemon',
  'A bold and punchy dark mode with graphite greys, clean yellow highlights, and a strong contrast ratio. Great for DTC or creator brands looking for energy in a dark aesthetic.',
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

const SLATE_PEACH_COLORS_PALETTE: ColorPalette = genPalette(
  'SlatePeach',
  'A cozy dark palette with desaturated navy tones, soft peach accents, and airy text. Ideal for indie brands, lifestyle products, or any store that wants to feel warm yet modern.',
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
  [LINEN_OLIVE_COLORS_PALETTE.name]: LINEN_OLIVE_COLORS_PALETTE,
  [PORCELAIN_CORAL_COLORS_PALETTE.name]: PORCELAIN_CORAL_COLORS_PALETTE,
  [CLOUD_SKY_COLORS_PALETTE.name]: CLOUD_SKY_COLORS_PALETTE,
  [EGGSHELL_AMBER_COLORS_PALETTE.name]: EGGSHELL_AMBER_COLORS_PALETTE,
  [IVORY_ROSE_COLORS_PALETTE.name]: IVORY_ROSE_COLORS_PALETTE,
  [WHITE_LIME_COLORS_PALETTE.name]: WHITE_LIME_COLORS_PALETTE,
  [PARCHMENT_CYAN_COLORS_PALETTE.name]: PARCHMENT_CYAN_COLORS_PALETTE,
  [SNOW_VIOLET_COLORS_PALETTE.name]: SNOW_VIOLET_COLORS_PALETTE,
  [CHARCOAL_MINT_COLORS_PALETTE.name]: CHARCOAL_MINT_COLORS_PALETTE,
  [OBSIDIAN_SKY_COLORS_PALETTE.name]: OBSIDIAN_SKY_COLORS_PALETTE,
  [GRAPHITE_LEMON_COLORS_PALETTE.name]: GRAPHITE_LEMON_COLORS_PALETTE,
  [SLATE_PEACH_COLORS_PALETTE.name]: SLATE_PEACH_COLORS_PALETTE,
};

function genPalette(name: string, description: string, coreColors: CoreColors) {
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
        buttonHoverBackgroundColor: `${coreColors.primaryAccent}CC`, // 80% opacity
        buttonTextColor: coreColors.buttonTextForeground,
      },
    },
  };
}
