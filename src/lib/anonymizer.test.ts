import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  anonymizeStatementText,
  redactCustomTerm,
  REDACTION_PLACEHOLDERS,
} from "./anonymizer";
import { extractTextFromPDF } from "./pdf-parser";

describe("anonymizeStatementText unit tests", () => {
  it("redacts bank accounts and card numbers to [CUENTA_REDACTADA]", () => {
    const raw = `
      Cuenta No. 069-579886-3
      Cuenta Estandarizada GT75 INDL 0101 0000 0006 9579 8863
      Tarjeta asociada XXXX XXXX XXXX 4123
      Tarjeta anterior 5183-22XX-XXXX-0713
      Transferencia CTA GT 0357897
    `;
    const result = anonymizeStatementText(raw);

    assert.ok(!result.sanitizedText.includes("069-579886-3"));
    assert.ok(!result.sanitizedText.includes("GT75 INDL"));
    assert.ok(!result.sanitizedText.includes("XXXX XXXX XXXX 4123"));
    assert.ok(!result.sanitizedText.includes("5183-22XX-XXXX-0713"));
    assert.ok(!result.sanitizedText.includes("0357897"));
    assert.ok(result.sanitizedText.includes(REDACTION_PLACEHOLDERS.account));
    assert.ok(result.redactionsCount.account >= 4);
  });

  it("redacts emails, PBX, and phone numbers to [CONTACTO_REDACTADO]", () => {
    const raw = `
      Correo: usuario.ejemplo@gmail.com
      Atención al cliente: PBX 1717 o teléfono +502 2411-5000
      Cel: 55443322
    `;
    const result = anonymizeStatementText(raw);

    assert.ok(!result.sanitizedText.includes("usuario.ejemplo@gmail.com"));
    assert.ok(!result.sanitizedText.includes("PBX 1717"));
    assert.ok(!result.sanitizedText.includes("2411-5000"));
    assert.ok(!result.sanitizedText.includes("55443322"));
    assert.ok(result.sanitizedText.includes(REDACTION_PLACEHOLDERS.contact));
    assert.ok(result.redactionsCount.contact >= 3);
  });

  it("redacts tax IDs (NIT and DPI) to [IDENTIFICACION_REDACTADA]", () => {
    const raw = `
      NIT: 12345678-9
      DPI: 2345 67890 0101
      NIT sin guion: 87654321K
    `;
    const result = anonymizeStatementText(raw);

    assert.ok(!result.sanitizedText.includes("12345678-9"));
    assert.ok(!result.sanitizedText.includes("2345 67890 0101"));
    assert.ok(!result.sanitizedText.includes("87654321K"));
    assert.ok(result.sanitizedText.includes(REDACTION_PLACEHOLDERS.id));
    assert.ok(result.redactionsCount.id >= 2);
  });

  it("redacts physical and mailing addresses to [DIRECCION_REDACTADA]", () => {
    const raw = `
      9 AVE 2-60 ZONA 13 RIVERA DEL RIO
      SAN MIGUEL PETA GUATEMALA 01066 //099762
      30 CALLE 19-43 COLONIA SANTA ROSA 2 APTO Z. 12 ZONA 12 GUATEMALA
    `;
    const result = anonymizeStatementText(raw);

    assert.ok(!result.sanitizedText.includes("RIVERA DEL RIO"));
    assert.ok(!result.sanitizedText.includes("SANTA ROSA"));
    assert.ok(result.sanitizedText.includes(REDACTION_PLACEHOLDERS.address));
    assert.ok(result.redactionsCount.address >= 2);
  });

  it("redacts ACH recipient names and header customer name to [NOMBRE_REDACTADO]", () => {
    const raw = `
      JIMENEZ CU LUIS RICARDO JULIO/25
      04 103490 ACH JHOSELIN IVONE ESPINOZ telefono 180.00
      24 225420 ACH MARTHA ELENA CU YAT almuerzo 250.00
      Titular: CARLOS ALBERTO GOMEZ
    `;
    const result = anonymizeStatementText(raw);

    assert.ok(!result.sanitizedText.includes("JHOSELIN IVONE ESPINOZ"));
    assert.ok(!result.sanitizedText.includes("MARTHA ELENA CU YAT"));
    assert.ok(!result.sanitizedText.includes("JIMENEZ CU LUIS RICARDO"));
    assert.ok(!result.sanitizedText.includes("CARLOS ALBERTO GOMEZ"));
    assert.ok(result.sanitizedText.includes(REDACTION_PLACEHOLDERS.name));
    assert.ok(result.redactionsCount.name >= 3);
  });

  it("redacts user-specified custom terms to [DATO_REDACTADO]", () => {
    const raw = `
      17 258323 pago Yosi 700.00
      27 188175 chuchi 193.00
    `;
    const result = anonymizeStatementText(raw, ["Yosi", "chuchi"]);

    assert.ok(!result.sanitizedText.includes("Yosi"));
    assert.ok(!result.sanitizedText.includes("chuchi"));
    assert.ok(result.sanitizedText.includes(REDACTION_PLACEHOLDERS.custom));
    assert.strictEqual(result.redactionsCount.custom, 2);
  });

  it("redactCustomTerm helper properly replaces terms", () => {
    const text = "Pago confidencial para Proyecto Secreto en Guatemala";
    const sanitized = redactCustomTerm(text, "Proyecto Secreto");
    assert.strictEqual(
      sanitized,
      `Pago confidencial para ${REDACTION_PLACEHOLDERS.custom} en Guatemala`
    );
  });
});

describe("demo3.pdf PII anonymization integration test", () => {
  it("scrubs all sensitive identity data from demo3.pdf", async () => {
    if (!fs.existsSync("./demo/demo3.pdf")) {
      return;
    }

    const buf = fs.readFileSync("./demo/demo3.pdf");
    const rawText = await extractTextFromPDF(new Uint8Array(buf));
    const result = anonymizeStatementText(rawText);

    // Verify all key sensitive PII is stripped
    assert.ok(!result.sanitizedText.includes("JIMENEZ CU LUIS RICARDO"));
    assert.ok(!result.sanitizedText.includes("JHOSELIN IVONE ESPINOZ"));
    assert.ok(!result.sanitizedText.includes("MARTHA ELENA CU YAT"));
    assert.ok(!result.sanitizedText.includes("069-579886-3"));
    assert.ok(!result.sanitizedText.includes("GT75 INDL 0101"));
    assert.ok(!result.sanitizedText.includes("XXXX XXXX XXXX 4123"));
    assert.ok(!result.sanitizedText.includes("9 AVE 2-60 ZONA 13"));
    assert.ok(!result.sanitizedText.includes("PBX 1717"));

    // Verify placeholders are present
    assert.ok(result.sanitizedText.includes(REDACTION_PLACEHOLDERS.account));
    assert.ok(result.sanitizedText.includes(REDACTION_PLACEHOLDERS.name));
    assert.ok(result.sanitizedText.includes(REDACTION_PLACEHOLDERS.address));
    assert.ok(result.sanitizedText.includes(REDACTION_PLACEHOLDERS.contact));

    // Verify non-sensitive transaction descriptions and amounts remain intact
    assert.ok(result.sanitizedText.includes("calico y lai lai"));
    assert.ok(result.sanitizedText.includes("MEMBRESIA CLUB BI"));
    assert.ok(result.sanitizedText.includes("147.50"));
    assert.ok(result.sanitizedText.includes("12,957.50"));
    assert.ok(result.redactionsCount.total >= 10);
  });
});
