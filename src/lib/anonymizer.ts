/**
 * Local PII Anonymization and Rule-based Sanitizer (US-005).
 * 
 * Runs 100% locally on client/local environment to detect and redact sensitive personal information
 * before any payload could ever reach an external LLM.
 */

export type RedactionCategory =
  | "name"
  | "address"
  | "account"
  | "id"
  | "contact"
  | "custom";

export interface RedactionCount {
  name: number;
  address: number;
  account: number;
  id: number;
  contact: number;
  custom: number;
  total: number;
}

export interface AnonymizationResult {
  sanitizedText: string;
  redactionsCount: RedactionCount;
  detectedOwnerName?: string;
  customWords: string[];
}

export const REDACTION_PLACEHOLDERS = {
  name: "[NOMBRE_REDACTADO]",
  address: "[DIRECCION_REDACTADA]",
  account: "[CUENTA_REDACTADA]",
  id: "[IDENTIFICACION_REDACTADA]",
  contact: "[CONTACTO_REDACTADO]",
  custom: "[DATO_REDACTADO]",
} as const;

/**
 * Common account and payment card regex patterns.
 */
const ACCOUNT_PATTERNS: RegExp[] = [
  // IBAN / Cuenta Estandarizada Guatemalteca (e.g., GT75 INDL 0101 0000 0006 9579 8863)
  /\bGT\d{2}\s*[A-Z]{4}(?:\s*[0-9]{4}){4,6}\b/gi,
  // Standard Guatemalan bank account numbers (e.g., 069-579886-3 or 0357897-1)
  /\b\d{3}[-.\s]\d{6,8}[-.\s]\d\b/g,
  // Masked or partial card numbers (e.g., XXXX XXXX XXXX 4123 or 5183-22XX-XXXX-0713)
  /\b(?:X{4}[\s-]?){3}\d{4}\b/gi,
  /\b\d{4}[-\s]?\d{2}XX[-\s]?XXXX[-\s]?\d{4}\b/gi,
  // Internal transfer accounts (e.g., CTA GT 0357897, TRANSF A CTA 0357897)
  /\b(?:CTA|CUENTA)\s+(?:GT\s+)?\d{6,14}\b/gi,
  // Full 16-digit credit/debit card numbers
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
];

/**
 * Contact patterns: Emails, PBX numbers, cellphones, and phone lines.
 */
const CONTACT_PATTERNS: RegExp[] = [
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // PBX numbers (e.g. PBX 1717, PBX: 2411-6000)
  /\bPBX\s*[:\s]*\d{4,8}\b/gi,
  // Guatemalan 8-digit phone numbers, with or without +502 prefix
  /\b(?:\+?502[\s.-]?)?[2-7]\d{3}[\s.-]?\d{4}\b/g,
  // Explicit phone indicators (Tel: 22001122, Cel: 55443322)
  /\b(?:Tel|Teléfono|Telefono|Cel|Celular)[:\s]*\d{8}\b/gi,
];

/**
 * Tax IDs: Guatemalan NIT and DPI (CUI).
 */
const TAX_ID_PATTERNS: RegExp[] = [
  // NIT with prefix (e.g. NIT: 1234567-8 or NIT sin guion: 87654321K)
  /\b(?:NIT|Nit)[^\r\n:]*[:\s]+(\d{6,9}-?[\dkK])\b/gi,
  // Standalone NIT with hyphen (e.g. 12345678-9 or 1234567-K)
  /\b\d{6,9}-[\dkK]\b/gi,
  // DPI / CUI with prefix (e.g. DPI: 2345 67890 0101 or CUI: 1234567890101)
  /\b(?:DPI|CUI)[^\r\n:]*[:\s]+(\d{13}|\d{4}\s*\d{5}\s*\d{4})\b/gi,
  // Standalone DPI / CUI (13 digits formatted as 4 - 5 - 4 digits)
  /\b\d{4}\s*\d{5}\s*\d{4}\b/g,
];

/**
 * Physical and mailing address patterns in Guatemala.
 */
const ADDRESS_PATTERNS: RegExp[] = [
  // Street + zone/colonia patterns on the same line (e.g. 9 AVE 2-60 ZONA 13 RIVERA DEL RIO)
  /\b\d{1,2}\s*(?:AVE|AVENIDA|CALLE|AV|CL|C\.)\b[^\r\n]+?\b(?:ZONA|COLONIA|COL\.|BO\.|BARRIO|KM|SECTOR|EDIFICIO|APTO|NIVEL|LOTE|MANZANA)\b[^\r\n]*/gi,
  // Municipalities / Postal code lines (e.g. SAN MIGUEL PETA GUATEMALA 01066 //099762)
  /^[^\r\n]*(?:SAN MIGUEL|GUATEMALA|MIXCO|VILLA NUEVA|SANTA CATARINA|PINULA|CARRETERA A EL SALVADOR)[^\r\n]*(?:\d{5}|\/\/\d+)[^\r\n]*/gim,
  // Explicit address lines (e.g. Dirección: 12 Calle 4-55 Zona 10)
  /\b(?:Dirección|Direccion|Domicilio)[:\s]+[^\r\n]+/gi,
];

/**
 * Scans the first section of a bank statement to find the account owner's full name.
 */
function extractStatementOwnerName(rawText: string): string | undefined {
  const candidateLines = rawText.split("\n").slice(0, 20);
  const excludeKeywords = new Set([
    "TIPO", "MONETARIA", "QUETZALES", "DOLARES", "NUMERO", "CUENTA",
    "ESTANDARIZADA", "ESTADO", "BANCO", "PAGINA", "SALDO", "RESUMEN",
    "INTERES", "DEBITO", "CREDITO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE",
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "NOVIEMBRE", "DICIEMBRE",
    "DOC", "DIA", "DESCRIPCION", "INFORMACION", "USO", "CANALES", "TOTALES"
  ]);

  for (const line of candidateLines) {
    if (line.includes("[") || line.includes("****") || line.length < 5) continue;
    // Strip trailing statement periods like JULIO/25 or 2026/08
    const cleaned = line.replace(/\s+[A-ZÁÉÍÓÚÑ]+\/\d+.*$/, "").trim();
    const tokens = cleaned.split(/\s+/);

    if (tokens.length >= 2 && tokens.length <= 5) {
      const allAlpha = tokens.every((t) => /^[A-ZÁÉÍÓÚÑ]{2,}$/.test(t));
      const hasExcluded = tokens.some((t) => excludeKeywords.has(t));
      if (allAlpha && !hasExcluded) {
        return cleaned;
      }
    }
  }

  return undefined;
}

/**
 * Escapes a literal string for safe usage in RegExp.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Redacts a list of manual or custom terms from text.
 */
export function redactCustomTerm(text: string, term: string): string {
  if (!term || !term.trim()) return text;
  const regex = new RegExp(escapeRegex(term.trim()), "gi");
  return text.replace(regex, REDACTION_PLACEHOLDERS.custom);
}

/**
 * Core PII Anonymizer function.
 * Scans text, detects sensitive PII and returns sanitized text along with redaction metrics.
 */
export function anonymizeStatementText(
  rawText: string,
  customWords: string[] = []
): AnonymizationResult {
  if (!rawText) {
    return {
      sanitizedText: "",
      redactionsCount: {
        name: 0,
        address: 0,
        account: 0,
        id: 0,
        contact: 0,
        custom: 0,
        total: 0,
      },
      customWords: [],
    };
  }

  let text = rawText;
  const redactionsCount: RedactionCount = {
    name: 0,
    address: 0,
    account: 0,
    id: 0,
    contact: 0,
    custom: 0,
    total: 0,
  };

  // 1. Account and card numbers -> [CUENTA_REDACTADA]
  for (const pattern of ACCOUNT_PATTERNS) {
    text = text.replace(pattern, () => {
      redactionsCount.account++;
      redactionsCount.total++;
      return REDACTION_PLACEHOLDERS.account;
    });
  }

  // 2. Contact numbers and emails -> [CONTACTO_REDACTADO]
  for (const pattern of CONTACT_PATTERNS) {
    text = text.replace(pattern, () => {
      redactionsCount.contact++;
      redactionsCount.total++;
      return REDACTION_PLACEHOLDERS.contact;
    });
  }

  // 3. Tax IDs (NIT / DPI) -> [IDENTIFICACION_REDACTADA]
  for (const pattern of TAX_ID_PATTERNS) {
    text = text.replace(pattern, (match, p1) => {
      redactionsCount.id++;
      redactionsCount.total++;
      return p1 ? match.replace(p1, REDACTION_PLACEHOLDERS.id) : REDACTION_PLACEHOLDERS.id;
    });
  }

  // 4. Physical and mailing addresses -> [DIRECCION_REDACTADA]
  for (const pattern of ADDRESS_PATTERNS) {
    text = text.replace(pattern, () => {
      redactionsCount.address++;
      redactionsCount.total++;
      return REDACTION_PLACEHOLDERS.address;
    });
  }

  // 5. Names:
  // 5.1. ACH / Transfer person names (e.g. ACH JHOSELIN IVONE ESPINOZ)
  text = text.replace(
    /\bACH\s+([A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{1,}){1,4})\b/g,
    () => {
      redactionsCount.name++;
      redactionsCount.total++;
      return `ACH ${REDACTION_PLACEHOLDERS.name}`;
    }
  );

  // 5.2. Explicit name prefixes (e.g. Nombre: Juan Perez, Titular: Maria Lopez)
  text = text.replace(
    /\b(?:Nombre|Cliente|Titular|Tarjetahabiente)[:\s]+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,40})/gi,
    (match, p1) => {
      redactionsCount.name++;
      redactionsCount.total++;
      return match.replace(p1.trim(), REDACTION_PLACEHOLDERS.name);
    }
  );

  // 5.3. Detect header customer owner name (e.g. JIMENEZ CU LUIS RICARDO)
  const ownerName = extractStatementOwnerName(rawText);
  if (ownerName) {
    const ownerRegex = new RegExp(
      "\\b" + escapeRegex(ownerName).replace(/\\s+/g, "\\s+") + "\\b",
      "gi"
    );
    text = text.replace(ownerRegex, () => {
      redactionsCount.name++;
      redactionsCount.total++;
      return REDACTION_PLACEHOLDERS.name;
    });

    // Also redact sub-tokens of the owner name (e.g. LUIS RICARDO or JIMENEZ CU)
    const tokens = ownerName.split(/\s+/).filter((t) => t.length > 2);
    if (tokens.length >= 3) {
      // Create permutations of at least 2 tokens
      const partialName1 = `${tokens[0]} ${tokens[1]}`;
      const partialName2 = `${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}`;
      for (const partial of [partialName1, partialName2]) {
        const pRegex = new RegExp("\\b" + escapeRegex(partial) + "\\b", "gi");
        text = text.replace(pRegex, (m) => {
          if (m.includes("[")) return m;
          redactionsCount.name++;
          redactionsCount.total++;
          return REDACTION_PLACEHOLDERS.name;
        });
      }
    }
  }

  // 6. User-defined manual custom words / phrases
  const activeCustomWords: string[] = [];
  for (const term of customWords) {
    if (term && term.trim().length > 1) {
      const cleanTerm = term.trim();
      activeCustomWords.push(cleanTerm);
      const termRegex = new RegExp(escapeRegex(cleanTerm), "gi");
      text = text.replace(termRegex, (m) => {
        // Do not double-replace existing placeholders
        if (m.startsWith("[") && m.endsWith("]")) return m;
        redactionsCount.custom++;
        redactionsCount.total++;
        return REDACTION_PLACEHOLDERS.custom;
      });
    }
  }

  return {
    sanitizedText: text,
    redactionsCount,
    detectedOwnerName: ownerName,
    customWords: activeCustomWords,
  };
}
