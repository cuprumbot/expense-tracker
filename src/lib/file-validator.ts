export type SupportedFileType = "pdf" | "csv";

export interface FileValidationSuccess {
  valid: true;
  fileType: SupportedFileType;
  fileName: string;
  fileSizeFormatted: string;
  sizeBytes: number;
}

export interface FileValidationError {
  valid: false;
  error: string;
}

export type FileValidationResult = FileValidationSuccess | FileValidationError;

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB limit

/**
 * Formats byte size into human-readable Spanish notation (B, KB, MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0 || Number.isNaN(bytes)) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Validates whether an uploaded file has a supported format (.pdf or .csv)
 * and conforms to size limits.
 */
export function validateUploadedFile(file: {
  name: string;
  size: number;
  type?: string;
}): FileValidationResult {
  if (!file || !file.name) {
    return {
      valid: false,
      error: "No se seleccionó ningún archivo.",
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: "El archivo seleccionado está vacío (0 bytes).",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `El archivo supera el tamaño máximo permitido de ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`,
    };
  }

  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

  if (extension === ".pdf" || file.type === "application/pdf") {
    return {
      valid: true,
      fileType: "pdf",
      fileName: file.name,
      fileSizeFormatted: formatFileSize(file.size),
      sizeBytes: file.size,
    };
  }

  if (
    extension === ".csv" ||
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel"
  ) {
    return {
      valid: true,
      fileType: "csv",
      fileName: file.name,
      fileSizeFormatted: formatFileSize(file.size),
      sizeBytes: file.size,
    };
  }

  return {
    valid: false,
    error: `Formato de archivo no compatible ("${extension || "desconocido"}"). Por favor sube un archivo PDF o CSV.`,
  };
}
