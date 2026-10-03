/**
 * Pure TypeScript Arabic Contextual Shaper & Token-Level BiDi Engine
 * 
 * Features:
 * 1. Contextual Arabic glyph shaping (isolated, initial, medial, final)
 *    mapping from U+0621..U+064A to Unicode Presentation Forms-B (U+FE80..U+FEFC).
 * 2. Automatic Lam-Alef ligature merging (لا, لأ, لإ, لآ).
 * 3. Token-level BiDi reordering:
 *    - Preserves numbers (150.00, 15%, 2026-09-04), codes (#INV-2026-0001),
 *      and Latin identifiers (SAR, IBAN) in natural Left-To-Right order.
 *    - Reorders Arabic tokens and shapes their glyphs for jsPDF direct vector drawing.
 *    - Correctly mirrors enclosing brackets and punctuation.
 */

interface GlyphForm {
  isolated: number;
  final: number;
  initial?: number;
  medial?: number;
}

// Arabic character definitions mapping to Presentation Forms-B
const ARABIC_GLYPHS: Record<number, GlyphForm> = {
  // Hamza
  0x0621: { isolated: 0xFE80, final: 0xFE80 },
  // Alef with Madda
  0x0622: { isolated: 0xFE81, final: 0xFE82 },
  // Alef with Hamza Above
  0x0623: { isolated: 0xFE83, final: 0xFE84 },
  // Waw with Hamza
  0x0624: { isolated: 0xFE85, final: 0xFE86 },
  // Alef with Hamza Below
  0x0625: { isolated: 0xFE87, final: 0xFE88 },
  // Yeh with Hamza
  0x0626: { isolated: 0xFE89, final: 0xFE8A, initial: 0xFE8B, medial: 0xFE8C },
  // Alef
  0x0627: { isolated: 0xFE8D, final: 0xFE8E },
  // Beh
  0x0628: { isolated: 0xFE8F, final: 0xFE90, initial: 0xFE91, medial: 0xFE92 },
  // Teh Marbuta
  0x0629: { isolated: 0xFE93, final: 0xFE94 },
  // Teh
  0x062A: { isolated: 0xFE95, final: 0xFE96, initial: 0xFE97, medial: 0xFE98 },
  // Theh
  0x062B: { isolated: 0xFE99, final: 0xFE9A, initial: 0xFE9B, medial: 0xFE9C },
  // Jeem
  0x062C: { isolated: 0xFE9D, final: 0xFE9E, initial: 0xFE9F, medial: 0xFEA0 },
  // Hah
  0x062D: { isolated: 0xFEA1, final: 0xFEA2, initial: 0xFEA3, medial: 0xFEA4 },
  // Khah
  0x062E: { isolated: 0xFEA5, final: 0xFEA6, initial: 0xFEA7, medial: 0xFEA8 },
  // Dal
  0x062F: { isolated: 0xFEA9, final: 0xFEAA },
  // Thal
  0x0630: { isolated: 0xFEAB, final: 0xFEAC },
  // Reh
  0x0631: { isolated: 0xFEAD, final: 0xFEAE },
  // Zain
  0x0632: { isolated: 0xFEAF, final: 0xFEB0 },
  // Seen
  0x0633: { isolated: 0xFEB1, final: 0xFEB2, initial: 0xFEB3, medial: 0xFEB4 },
  // Sheen
  0x0634: { isolated: 0xFEB5, final: 0xFEB6, initial: 0xFEB7, medial: 0xFEB8 },
  // Sad
  0x0635: { isolated: 0xFEB9, final: 0xFEBA, initial: 0xFEBB, medial: 0xFEBC },
  // Dad
  0x0636: { isolated: 0xFEBD, final: 0xFEBE, initial: 0xFEBF, medial: 0xFEC0 },
  // Tah
  0x0637: { isolated: 0xFEC1, final: 0xFEC2, initial: 0xFEC3, medial: 0xFEC4 },
  // Zah
  0x0638: { isolated: 0xFEC5, final: 0xFEC6, initial: 0xFEC7, medial: 0xFEC8 },
  // Ain
  0x0639: { isolated: 0xFEC9, final: 0xFECA, initial: 0xFECB, medial: 0xFECC },
  // Ghain
  0x063A: { isolated: 0xFECD, final: 0xFECE, initial: 0xFECF, medial: 0xFED0 },
  // Tatweel / Kashida
  0x0640: { isolated: 0x0640, final: 0x0640, initial: 0x0640, medial: 0x0640 },
  // Feh
  0x0641: { isolated: 0xFED1, final: 0xFED2, initial: 0xFED3, medial: 0xFED4 },
  // Qaf
  0x0642: { isolated: 0xFED5, final: 0xFED6, initial: 0xFED7, medial: 0xFED8 },
  // Kaf
  0x0643: { isolated: 0xFED9, final: 0xFEDA, initial: 0xFEDB, medial: 0xFEDC },
  // Lam
  0x0644: { isolated: 0xFEDD, final: 0xFEDE, initial: 0xFEDF, medial: 0xFEE0 },
  // Meem
  0x0645: { isolated: 0xFEE1, final: 0xFEE2, initial: 0xFEE3, medial: 0xFEE4 },
  // Noon
  0x0646: { isolated: 0xFEE5, final: 0xFEE6, initial: 0xFEE7, medial: 0xFEE8 },
  // Heh
  0x0647: { isolated: 0xFEE9, final: 0xFEEA, initial: 0xFEEB, medial: 0xFEEC },
  // Waw
  0x0648: { isolated: 0xFEED, final: 0xFEEE },
  // Alef Maksura
  0x0649: { isolated: 0xFEEF, final: 0xFEF0, initial: 0xFEF3, medial: 0xFEF4 },
  // Yeh
  0x064A: { isolated: 0xFEF1, final: 0xFEF2, initial: 0xFEF3, medial: 0xFEF4 },
};

// Lam-Alef Ligatures (Lam 0x0644 + Alef variations)
const LAM_ALEF_LIGATURES: Record<number, { isolated: number; final: number }> = {
  0x0622: { isolated: 0xFEF5, final: 0xFEF6 }, // لآ
  0x0623: { isolated: 0xFEF7, final: 0xFEF8 }, // لأ
  0x0625: { isolated: 0xFEF9, final: 0xFEFA }, // لإ
  0x0627: { isolated: 0xFEFB, final: 0xFEFC }, // لا
};

/**
 * Returns true if character is a dual-joining Arabic letter (can connect to left and right).
 */
function isDualJoining(code: number): boolean {
  const g = ARABIC_GLYPHS[code];
  return Boolean(g && g.initial && g.medial);
}

/**
 * Returns true if character is a right-joining Arabic letter (can connect to preceding, but not next).
 */
function isRightJoining(code: number): boolean {
  const g = ARABIC_GLYPHS[code];
  return Boolean(g && !g.initial && g.final && g.final !== g.isolated);
}

/**
 * Returns true if character is any Arabic letter in our shaping table.
 */
export function isArabicCharCode(code: number): boolean {
  return code in ARABIC_GLYPHS;
}

/**
 * Checks if a string contains any Arabic characters.
 */
export function hasArabic(text: string): boolean {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Contextual shaper for a single Arabic word or continuous Arabic character segment.
 * Returns the shaped Presentation Forms-B string in logical order (before BiDi reversal).
 */
export function shapeArabicWord(word: string): string {
  if (!word) return '';

  const chars: number[] = [];
  // Strip or skip harakat/tashkeel for clean document presentation
  for (let i = 0; i < word.length; i++) {
    const code = word.charCodeAt(i);
    // Ignore Tashkeel / Harakat (0x064B to 0x065F)
    if (code >= 0x064B && code <= 0x065F) continue;
    chars.push(code);
  }

  const result: string[] = [];
  let prevConnected = false;

  for (let i = 0; i < chars.length; i++) {
    const code = chars[i];
    const nextCode = i + 1 < chars.length ? chars[i + 1] : 0;

    // Check for Lam-Alef ligatures (ل + آ/أ/إ/ا)
    if (code === 0x0644 && nextCode in LAM_ALEF_LIGATURES) {
      const lig = LAM_ALEF_LIGATURES[nextCode];
      if (prevConnected) {
        result.push(String.fromCharCode(lig.final));
      } else {
        result.push(String.fromCharCode(lig.isolated));
      }
      prevConnected = false; // Lam-Alef is right-joining only (never connects to next)
      i++; // Skip the Alef
      continue;
    }

    const glyph = ARABIC_GLYPHS[code];
    if (!glyph) {
      // Non-Arabic character in word, pass through
      result.push(String.fromCharCode(code));
      prevConnected = false;
      continue;
    }

    // Determine if next character can connect backward to this one
    const nextCanConnectBefore = nextCode !== 0 && (isDualJoining(nextCode) || isRightJoining(nextCode));

    if (isDualJoining(code)) {
      if (prevConnected && nextCanConnectBefore) {
        result.push(String.fromCharCode(glyph.medial || glyph.isolated));
        prevConnected = true;
      } else if (prevConnected) {
        result.push(String.fromCharCode(glyph.final));
        prevConnected = false;
      } else if (nextCanConnectBefore) {
        result.push(String.fromCharCode(glyph.initial || glyph.isolated));
        prevConnected = true;
      } else {
        result.push(String.fromCharCode(glyph.isolated));
        prevConnected = false;
      }
    } else if (isRightJoining(code)) {
      if (prevConnected) {
        result.push(String.fromCharCode(glyph.final));
      } else {
        result.push(String.fromCharCode(glyph.isolated));
      }
      prevConnected = false; // Right-joining letters never connect to next
    } else {
      // Isolated only (e.g. Hamza ء)
      result.push(String.fromCharCode(glyph.isolated));
      prevConnected = false;
    }
  }

  return result.join('');
}

/**
 * Token types for BiDi reordering.
 */
type TokenType = 'ARABIC' | 'LTR_CONTENT' | 'WHITESPACE' | 'PUNCTUATION';

interface Token {
  type: TokenType;
  value: string;
}

/**
 * Bracket mirroring map for RTL layout.
 */
const BRACKET_MIRRORS: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
  '«': '»',
  '»': '«',
};

/**
 * Tokenizes text into Arabic words, LTR content (numbers, Latin codes, dates, percentages),
 * punctuation, and whitespace.
 */
export function tokenizeForBidi(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    // Whitespace
    if (/\s/.test(ch)) {
      let space = '';
      while (i < n && /\s/.test(text[i])) {
        space += text[i];
        i++;
      }
      tokens.push({ type: 'WHITESPACE', value: space });
      continue;
    }

    // Bracket or standalone punctuation
    if (ch in BRACKET_MIRRORS) {
      tokens.push({ type: 'PUNCTUATION', value: ch });
      i++;
      continue;
    }

    // Arabic segment
    if (hasArabic(ch)) {
      let arabicStr = '';
      while (i < n && (hasArabic(text[i]) || (text[i].charCodeAt(0) >= 0x064B && text[i].charCodeAt(0) <= 0x065F))) {
        arabicStr += text[i];
        i++;
      }
      tokens.push({ type: 'ARABIC', value: arabicStr });
      continue;
    }

    // LTR Content: Numbers (150.00, 15%), Latin codes (#INV-2026-0001), Dates (2026-09-04), Currency codes (SAR, USD)
    let ltrStr = '';
    while (
      i < n &&
      !/\s/.test(text[i]) &&
      !(text[i] in BRACKET_MIRRORS) &&
      !hasArabic(text[i])
    ) {
      ltrStr += text[i];
      i++;
    }

    if (ltrStr) {
      tokens.push({ type: 'LTR_CONTENT', value: ltrStr });
    }
  }

  return tokens;
}

/**
 * Shapes Arabic text and performs token-level BiDi reordering so jsPDF can draw
 * Arabic lines with crisp RTL cursive joining while keeping numbers and Latin codes
 * strictly LTR.
 *
 * @param text The input string (e.g., "فاتورة ضريبية مبسطة #INV-2026-0001 (15%)")
 * @param isRtl Whether the target paragraph/line orientation is RTL (defaults to true if Arabic detected)
 * @returns Reordered and shaped string ready for jsPDF doc.text()
 */
export function shapeBidi(text: string | null | undefined, isRtl?: boolean): string {
  if (!text) return '';

  const str = String(text);
  const targetRtl = isRtl !== undefined ? isRtl : hasArabic(str);

  // If entirely LTR with no Arabic characters and not forced RTL, return as is
  if (!targetRtl && !hasArabic(str)) {
    return str;
  }

  // Handle multi-line strings line-by-line
  if (str.includes('\n')) {
    return str.split('\n').map((line) => shapeBidi(line, targetRtl)).join('\n');
  }

  const tokens = tokenizeForBidi(str);
  if (tokens.length === 0) return '';

  if (targetRtl) {
    // In RTL mode:
    // 1. Reorder tokens sequence from Right-to-Left (reverse token array).
    // 2. For Arabic tokens: Shape glyphs, then reverse characters so jsPDF's LTR engine draws them RTL.
    // 3. For LTR_CONTENT tokens (e.g. "150.00", "#INV-2026-0001", "SAR"): Keep internal characters LTR!
    // 4. For brackets/punctuation: Mirror them so (15%) stays properly bounded.

    const reversedTokens = [...tokens].reverse();
    const resultTokens = reversedTokens.map((token) => {
      if (token.type === 'ARABIC') {
        const shaped = shapeArabicWord(token.value);
        // Reverse characters so jsPDF draws from right to left
        return shaped.split('').reverse().join('');
      } else if (token.type === 'PUNCTUATION') {
        return BRACKET_MIRRORS[token.value] || token.value;
      } else {
        // LTR_CONTENT or WHITESPACE: keep internal character order as-is
        return token.value;
      }
    });

    return resultTokens.join('');
  } else {
    // LTR mode:
    // Keep token sequence LTR, but shape any embedded Arabic words and reverse their characters
    const resultTokens = tokens.map((token) => {
      if (token.type === 'ARABIC') {
        const shaped = shapeArabicWord(token.value);
        return shaped.split('').reverse().join('');
      }
      return token.value;
    });

    return resultTokens.join('');
  }
}

/**
 * Direct alias for backward compatibility or simple word shaping.
 */
export function shapeArabic(text: string): string {
  return shapeBidi(text, true);
}

export default {
  shapeBidi,
  shapeArabic,
  shapeArabicWord,
  hasArabic,
  isArabicCharCode,
};
