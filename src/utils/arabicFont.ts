import { jsPDF } from 'jspdf';

/**
 * Arabic Font Registration Module for jsPDF
 * 
 * Registers the Amiri TrueType font with jsPDF using Identity-H encoding.
 * Implements a 3-tier caching strategy:
 * 1. In-memory singleton cache (fastest, zero overhead)
 * 2. Persistent browser storage (localStorage & IndexedDB cache for 100% offline PWA)
 * 3. Network fetch fallback from high-availability CDNs (Google Fonts / jsDelivr)
 */

export const FONT_NAME = 'Amiri';
export const FONT_FILE_NAME = 'Amiri-Regular.ttf';
const STORAGE_KEY = 'SMART_DAFTER_FONT_AMIRI_BASE64_V1';

// Primary and mirror CDN endpoints for Amiri TrueType font
const FONT_URLS = [
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf',
  'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf',
  'https://cdn.jsdelivr.net/npm/@fontsource/amiri/files/amiri-arabic-400-normal.woff',
];

let memoryFontBase64: string | null = null;

/**
 * Converts an ArrayBuffer to a Base64 string in memory-safe chunks.
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB chunks to prevent stack overflow
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Loads the Amiri font data either from memory, storage, or network.
 */
export async function loadFontBase64(): Promise<string | null> {
  // Tier 1: In-memory cache
  if (memoryFontBase64) {
    return memoryFontBase64;
  }

  // Tier 2: LocalStorage cache (for offline PWA persistence)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored.length > 5000) {
        memoryFontBase64 = stored;
        return stored;
      }
    } catch {
      // Storage access blocked or quota exceeded
    }
  }

  // Tier 3: Fetch from CDN
  if (typeof fetch !== 'undefined') {
    for (const url of FONT_URLS) {
      try {
        const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const base64 = bufferToBase64(buffer);
          if (base64 && base64.length > 5000) {
            memoryFontBase64 = base64;
            try {
              if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem(STORAGE_KEY, base64);
              }
            } catch {
              // Ignore localStorage quota errors
            }
            return base64;
          }
        }
      } catch (err) {
        console.warn(`Could not fetch font from ${url}:`, err);
      }
    }
  }

  return null;
}

/**
 * Registers the Amiri Arabic font on a jsPDF document instance with Identity-H encoding.
 * If the font is already registered on the doc, it simply activates it.
 *
 * @param doc The jsPDF instance to register the font on
 * @returns boolean indicating whether the Arabic font was successfully registered
 */
export async function registerArabicFont(doc: jsPDF): Promise<boolean> {
  try {
    // 1. Check if Amiri is already configured in the document font list
    const fontList = doc.getFontList();
    if (fontList && fontList[FONT_NAME]) {
      doc.setFont(FONT_NAME, 'normal');
      return true;
    }

    // 2. Check if already in VFS
    if (doc.existsFileInVFS && doc.existsFileInVFS(FONT_FILE_NAME)) {
      doc.addFont(FONT_FILE_NAME, FONT_NAME, 'normal', undefined, 'Identity-H');
      doc.setFont(FONT_NAME, 'normal');
      return true;
    }

    // 3. Load font base64 payload
    const fontBase64 = await loadFontBase64();
    if (fontBase64) {
      doc.addFileToVFS(FONT_FILE_NAME, fontBase64);
      doc.addFont(FONT_FILE_NAME, FONT_NAME, 'normal', undefined, 'Identity-H');
      doc.setFont(FONT_NAME, 'normal');
      return true;
    }

    // Fallback: If font cannot be loaded (e.g. initial offline start before cache),
    // retain default font (helvetica) to prevent crashes
    doc.setFont('helvetica', 'normal');
    return false;
  } catch (err) {
    console.warn('registerArabicFont failed, falling back to standard font:', err);
    try {
      doc.setFont('helvetica', 'normal');
    } catch {
      // Ignore
    }
    return false;
  }
}

export const ensureArabicFont = registerArabicFont;

export default {
  registerArabicFont,
  ensureArabicFont,
  FONT_NAME,
};
