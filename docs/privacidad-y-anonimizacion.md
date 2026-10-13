# Privacidad y Anonimización de Datos

La privacidad del usuario es el pilar fundacional de **Control de Gastos (Expense Tracker)**. Los estados de cuenta bancarios contienen algunos de los datos personales más confidenciales de un individuo: nombre completo, dirección residencial, número de identificación personal (DPI/CUI), número de identificación tributaria (NIT), números de cuenta, tarjetas de crédito, números de teléfono y saldos financieros.

Este documento explica cómo el sistema protege la información del usuario mediante una estricta filosofía de **Privacidad por Diseño (Privacy by Design)** y muestra los fragmentos de código reales implementados para anonimizar los datos antes de realizar cualquier llamada a servicios externos.

---

## 1. Principios de Protección de Datos

1. **Nunca enviar archivos binarios a la nube**: Ni los archivos PDF ni los CSV se transmiten jamás a un modelo de lenguaje externo.
2. **Sanitización local previa obligatoria**: Cualquier texto extraído de un estado de cuenta bancario no compatible es procesado localmente con algoritmos de detección y censura de datos sensibles (PII).
3. **Consentimiento visual explícito**: El usuario visualiza el texto redactado en una ventana modal interactiva antes de autorizar cualquier comunicación externa, teniendo la opción de agregar términos personalizados para censurar.
4. **Validación estricta en el servidor**: Antes de que el servidor Next.js envíe una solicitud a la API de Google Gemini Pro, valida que el texto no contenga patrones residuales de IBAN, cuentas bancarias, DPI o correos electrónicos. Si detecta una coincidencia, la solicitud se rechaza de inmediato.
5. **Cero bases de datos remotas**: No existe base de datos centralizada ni sistema de cuentas de usuario. La persistencia se realiza exclusivamente en el almacenamiento local del navegador (`localStorage`).

---

## 2. Marcadores de Redacción (Placeholders)

Para que el modelo de lenguaje mantenga el contexto gramatical y financiero sin conocer la identidad real del usuario, el sistema sustituye los datos personales por marcadores semánticos estandarizados:

```typescript
// src/lib/anonymizer.ts (líneas 33-40)
export const REDACTION_PLACEHOLDERS = {
  name: "[NOMBRE_REDACTADO]",
  address: "[DIRECCION_REDACTADA]",
  account: "[CUENTA_REDACTADA]",
  id: "[IDENTIFICACION_REDACTADA]",
  contact: "[CONTACTO_REDACTADO]",
  custom: "[DATO_REDACTADO]",
} as const;
```

---

## 3. Fragmentos de Código: Expresiones Regulares de Detección

El módulo `src/lib/anonymizer.ts` define patrones especializados adaptados al sistema financiero y demográfico de Guatemala:

### 3.1. Cuentas Bancarias, IBAN y Tarjetas de Pago

```typescript
// src/lib/anonymizer.ts (líneas 45-57)
const ACCOUNT_PATTERNS: RegExp[] = [
  // IBAN / Cuenta Estandarizada Guatemalteca (e.g., GT75 INDL 0101 0000 0006 9579 8863)
  /\bGT\d{2}\s*[A-Z]{4}(?:\s*[0-9]{4}){4,6}\b/gi,
  // Cuentas bancarias de bancos en Guatemala (e.g., 069-579886-3 o 0357897-1)
  /\b\d{3}[-.\s]\d{6,8}[-.\s]\d\b/g,
  // Tarjetas enmascaradas (e.g., XXXX XXXX XXXX 4123 o 5183-22XX-XXXX-0713)
  /\b(?:X{4}[\s-]?){3}\d{4}\b/gi,
  /\b\d{4}[-\s]?\d{2}XX[-\s]?XXXX[-\s]?\d{4}\b/gi,
  // Cuentas de transferencia interna (e.g., CTA GT 0357897, TRANSF A CTA 0357897)
  /\b(?:CTA|CUENTA)\s+(?:GT\s+)?\d{6,14}\b/gi,
  // Números de tarjeta de crédito/débito de 16 dígitos
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
];
```

### 3.2. Identificación Tributaria y Personal (NIT y DPI)

```typescript
// src/lib/anonymizer.ts (líneas 76-86)
const TAX_ID_PATTERNS: RegExp[] = [
  // NIT con prefijo (e.g., NIT: 1234567-8 o NIT: 87654321K)
  /\b(?:NIT|Nit)[^\r\n:]*[:\s]+(\d{6,9}-?[\dkK])\b/gi,
  // NIT con guion independiente (e.g., 12345678-9)
  /\b\d{6,9}-[\dkK]\b/gi,
  // DPI / CUI con prefijo (13 dígitos o formato 4-5-4)
  /\b(?:DPI|CUI)[^\r\n:]*[:\s]+(\d{13}|\d{4}\s*\d{5}\s*\d{4})\b/gi,
  // DPI / CUI independiente formateado como 4 - 5 - 4 dígitos
  /\b\d{4}\s*\d{5}\s*\d{4}\b/g,
];
```

### 3.3. Direcciones Residenciales y Teléfonos

```typescript
// src/lib/anonymizer.ts (líneas 62-71 y 90-97)
const CONTACT_PATTERNS: RegExp[] = [
  // Correos electrónicos
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Líneas PBX (e.g., PBX 1717, PBX: 2411-6000)
  /\bPBX\s*[:\s]*\d{4,8}\b/gi,
  // Números de 8 dígitos de Guatemala, con o sin prefijo +502
  /\b(?:\+?502[\s.-]?)?[2-7]\d{3}[\s.-]?\d{4}\b/g,
  // Teléfonos explícitos
  /\b(?:Tel|Teléfono|Telefono|Cel|Celular)[:\s]*\d{8}\b/gi,
];

const ADDRESS_PATTERNS: RegExp[] = [
  // Calles, avenidas, zonas, colonias y barrios en Guatemala
  /\b\d{1,2}\s*(?:AVE|AVENIDA|CALLE|AV|CL|C\.)\b[^\r\n]+?\b(?:ZONA|COLONIA|COL\.|BO\.|BARRIO|KM|SECTOR|EDIFICIO|APTO|NIVEL|LOTE|MANZANA)\b[^\r\n]*/gi,
  // Municipios y códigos postales (e.g., SAN MIGUEL PETAPA GUATEMALA 01066)
  /^[^\r\n]*(?:SAN MIGUEL|GUATEMALA|MIXCO|VILLA NUEVA|SANTA CATARINA|PINULA|CARRETERA A EL SALVADOR)[^\r\n]*(?:\d{5}|\/\/\d+)[^\r\n]*/gim,
  // Líneas explícitas de dirección
  /\b(?:Dirección|Direccion|Domicilio)[:\s]+[^\r\n]+/gi,
];
```

---

## 4. Detección Heurística del Nombre del Titular

Los estados de cuenta bancarios no siempre incluyen un prefijo explícito como `"Nombre:"` para identificar al cuentahabiente. El algoritmo `extractStatementOwnerName` examina las primeras 20 líneas del documento para identificar cadenas de nombres propios en mayúsculas, excluyendo términos bancarios conocidos:

```typescript
// src/lib/anonymizer.ts (líneas 102-128)
function extractStatementOwnerName(rawText: string): string | undefined {
  const candidateLines = rawText.split("\n").slice(0, 20);
  const excludeKeywords = new Set([
    "TIPO", "MONETARIA", "QUETZALES", "DOLARES", "NUMERO", "CUENTA",
    "ESTANDARIZADA", "ESTADO", "BANCO", "PAGINA", "SALDO", "RESUMEN",
    "INTERES", "DEBITO", "CREDITO", "JULIO", "AGOSTO", "SEPTIEMBRE",
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "DOC", "DIA"
  ]);

  for (const line of candidateLines) {
    if (line.includes("[") || line.includes("****") || line.length < 5) continue;
    const cleaned = line.replace(/\s+[A-ZÁÉÍÓÚÑ]+\/\d+.*$/, "").trim();
    const tokens = cleaned.split(/\s+/);

    if (tokens.length >= 2 && tokens.length <= 5) {
      const allAlpha = tokens.every((t) => /^[A-ZÁÉÍÓÚÑ]{2,}$/.test(t));
      const hasExcluded = tokens.some((t) => excludeKeywords.has(t));
      if (allAlpha && !hasExcluded) {
        return cleaned; // Nombre del titular detectado (ej. "JIMENEZ CU LUIS RICARDO")
      }
    }
  }

  return undefined;
}
```

Al detectar el nombre del titular, la función no solo redacta el nombre completo, sino también combinaciones de sus nombres y apellidos para evitar filtraciones en descripciones de transferencias internas.

---

## 5. Función Principal de Anonimización

La función `anonymizeStatementText` ejecuta todas las etapas de censura de forma secuencial y calcula estadísticas precisas para presentarlas al usuario:

```typescript
// src/lib/anonymizer.ts (líneas 150-188)
export function anonymizeStatementText(
  rawText: string,
  customWords: string[] = []
): AnonymizationResult {
  let text = rawText;
  const redactionsCount: RedactionCount = {
    name: 0, address: 0, account: 0, id: 0, contact: 0, custom: 0, total: 0,
  };

  // 1. Cuentas y tarjetas -> [CUENTA_REDACTADA]
  for (const pattern of ACCOUNT_PATTERNS) {
    text = text.replace(pattern, () => {
      redactionsCount.account++;
      redactionsCount.total++;
      return REDACTION_PLACEHOLDERS.account;
    });
  }

  // 2. Contactos y correos -> [CONTACTO_REDACTADO]
  for (const pattern of CONTACT_PATTERNS) {
    text = text.replace(pattern, () => {
      redactionsCount.contact++;
      redactionsCount.total++;
      return REDACTION_PLACEHOLDERS.contact;
    });
  }

  // 3. Documentos de identidad (NIT / DPI) -> [IDENTIFICACION_REDACTADA]
  // 4. Direcciones residenciales -> [DIRECCION_REDACTADA]
  // 5. Nombres propios del titular y beneficiarios ACH -> [NOMBRE_REDACTADO]
  // 6. Palabras personalizadas del usuario -> [DATO_REDACTADO]

  return { sanitizedText: text, redactionsCount, customWords };
}
```

---

## 6. Validación de Frontera en el Servidor (Server-Side Boundary Check)

Para evitar que una alteración en el cliente o un error de lógica envíe datos no sanitizados a la nube, los Route Handlers de Next.js ejecutan una verificación obligatoria antes de invocar a Google Gemini:

```typescript
// src/lib/llm-extractor.ts (líneas 8-52)
export function validateSanitizedPayload(text: string): {
  isValid: boolean;
  reason?: string;
} {
  if (!text || !text.trim()) {
    return { isValid: false, reason: "El texto proporcionado está vacío." };
  }

  // Verificación de IBAN no censurado
  if (/\bGT\d{2}\s*[A-Z]{4}(?:\s*[0-9]{4}){4,6}\b/i.test(text)) {
    return {
      isValid: false,
      reason: "Se detectó un número de cuenta estandarizada (IBAN) sin anonimizar.",
    };
  }

  // Verificación de cuenta bancaria estándar no censurada
  if (/\b\d{3}[-.\s]\d{6,8}[-.\s]\d\b/.test(text)) {
    return {
      isValid: false,
      reason: "Se detectó un número de cuenta bancaria sin anonimizar.",
    };
  }

  // Verificación de DPI / CUI (13 dígitos) no censurado
  if (/\b\d{4}\s\d{5}\s\d{4}\b/.test(text)) {
    return {
      isValid: false,
      reason: "Se detectó un número de identificación personal (DPI/CUI) sin anonimizar.",
    };
  }

  // Verificación de correos electrónicos no censurados
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
    return {
      isValid: false,
      reason: "Se detectó una dirección de correo electrónico sin anonimizar.",
    };
  }

  return { isValid: true };
}
```

Si cualquiera de estas comprobaciones falla, el servidor cancela la petición retornando un error HTTP 400 y el modelo externo nunca recibe el contenido.

---

## Enlaces de Referencia

* [Volver al README Principal](../README.md)
* [Instalación, Configuración y Ejecución](instalacion-y-ejecucion.md)
* [Estructura del Proyecto](estructura-del-proyecto.md)
* [Arquitectura Split-Brain](arquitectura-split-brain.md)
* [Herramientas y Arquitectura Técnica](herramientas-y-arquitectura.md)
* [Uso del LLM Externo y Manejo de Fallos](uso-del-llm-y-manejo-de-fallos.md)
* [Pruebas Unitarias y Cobertura](pruebas-unitarias.md)
