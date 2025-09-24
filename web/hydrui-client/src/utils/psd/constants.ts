export const PSD_SIGNATURE = "8BPS";

export const PSD_VERSION = 1;

export enum PSDColorMode {
  BITMAP = 0,
  GRAYSCALE = 1,
  INDEXED = 2,
  RGB = 3,
  CMYK = 4,
  MULTICHANNEL = 7,
  DUOTONE = 8,
  LAB = 9,
}

export enum PSDCompressionMethod {
  RAW = 0,
  RLE = 1,
  ZIP = 2,
  ZIP_PRED = 3,
}

export enum PSDChannelID {
  RED = 0,
  GREEN = 1,
  BLUE = 2,
  ALPHA = -1,
  MASK = -2,
  REAL_MASK = -3,
}

export enum PSDResourceID {
  RESOLUTION_INFO = 1005,
  ALPHA_NAMES = 1006,
  DISPLAY_INFO = 1007,
  CAPTION = 1008,
  ICC_PROFILE = 1039,
  THUMBNAIL = 1033,
  LAYER_COMP = 1065,
  LAYER_SELECTION_ID = 1069,
}

export enum PSDBlendMode {
  PASS_THROUGH = "pass",
  NORMAL = "norm",
  DISSOLVE = "diss",
  DARKEN = "dark",
  MULTIPLY = "mul ",
  COLOR_BURN = "idiv",
  LINEAR_BURN = "lbrn",
  DARKER_COLOR = "dkCl",
  LIGHTEN = "lite",
  SCREEN = "scrn",
  COLOR_DODGE = "div ",
  LINEAR_DODGE = "lddg",
  LIGHTER_COLOR = "lgCl",
  OVERLAY = "over",
  SOFT_LIGHT = "sLit",
  HARD_LIGHT = "hLit",
  VIVID_LIGHT = "vLit",
  LINEAR_LIGHT = "lLit",
  PIN_LIGHT = "pLit",
  HARD_MIX = "hMix",
  DIFFERENCE = "diff",
  EXCLUSION = "smud",
  SUBTRACT = "fsub",
  DIVIDE = "fdiv",
  HUE = "hue ",
  SATURATION = "sat ",
  COLOR = "colr",
  LUMINOSITY = "lum ",
}

export enum PSDSectionType {
  NORMAL = 0,
  OPEN_FOLDER = 1,
  CLOSED_FOLDER = 2,
  DIVIDER = 3,
}

/**
 * Get the human-readable color mode name
 * @param colorMode The PSD color mode enum value
 * @returns The color mode name
 */
export function getColorModeName(colorMode: PSDColorMode): string {
  switch (colorMode) {
    case PSDColorMode.BITMAP:
      return "Bitmap";
    case PSDColorMode.GRAYSCALE:
      return "Grayscale";
    case PSDColorMode.INDEXED:
      return "Indexed";
    case PSDColorMode.RGB:
      return "RGB";
    case PSDColorMode.CMYK:
      return "CMYK";
    case PSDColorMode.MULTICHANNEL:
      return "Multichannel";
    case PSDColorMode.DUOTONE:
      return "Duotone";
    case PSDColorMode.LAB:
      return "Lab";
    default:
      return "Unknown";
  }
}
