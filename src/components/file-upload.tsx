"use client";

import React, { useState, useRef } from "react";
import { Icons } from "@/components/icons";
import {
  validateUploadedFile,
  FileValidationSuccess,
  SupportedFileType,
} from "@/lib/file-validator";

interface FileUploadProps {
  onFileRouted?: (file: File, type: SupportedFileType) => void;
}

export function FileUpload({ onFileRouted }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<FileValidationSuccess | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFile = (file: File) => {
    setErrorMessage(null);
    setRouteStatus(null);

    const validation = validateUploadedFile(file);

    if (!validation.valid) {
      setErrorMessage(validation.error);
      setSelectedFile(null);
      setFileMeta(null);
      return;
    }

    setSelectedFile(file);
    setFileMeta(validation);
  };

  const handleLoadDemoFile = async (fileName: string) => {
    try {
      const res = await fetch(`/demo/${fileName}`);
      if (!res.ok) throw new Error("No se pudo cargar el archivo demo");
      const blob = await res.blob();
      const file = new File([blob], fileName, {
        type: fileName.endsWith(".csv") ? "text/csv" : "application/pdf",
      });
      handleProcessFile(file);
    } catch (err) {
      console.error("Error al cargar archivo demo:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setFileMeta(null);
    setErrorMessage(null);
    setRouteStatus(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleTriggerPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleConfirmRouting = () => {
    if (!selectedFile || !fileMeta) return;

    if (fileMeta.fileType === "csv") {
      setRouteStatus("Archivo CSV verificado. Enrutado al módulo de extracción CSV (US-003).");
    } else {
      setRouteStatus("Estado de cuenta PDF verificado. Enrutado al motor de detección de banco (US-004).");
    }

    if (onFileRouted) {
      onFileRouted(selectedFile, fileMeta.fileType);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        id="file-upload-input"
        accept=".pdf,.csv,text/csv,application/pdf"
        className="sr-only"
        onChange={handleFileChange}
      />

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 p-3.5 rounded-lg border border-red-200 bg-red-50 text-red-900 text-xs dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <div className="flex items-start gap-2.5">
            <Icons.AlertCircle className="w-4 h-4 mt-0.5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"
            aria-label="Cerrar mensaje de error"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Routing Success / Notification */}
      {routeStatus && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <div className="flex items-start gap-2.5">
            <Icons.CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="leading-relaxed font-medium">{routeStatus}</p>
          </div>
          <button
            type="button"
            onClick={() => setRouteStatus(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
            aria-label="Cerrar notificación"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!selectedFile || !fileMeta ? (
        /* Idle Dropzone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleTriggerPicker}
          className={`border border-dashed rounded-lg p-10 sm:p-14 text-center flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors ${
            isDragging
              ? "border-zinc-900 bg-zinc-100/80 dark:border-zinc-200 dark:bg-zinc-900/80"
              : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-600"
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <Icons.Upload className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Arrastra tu estado de cuenta en PDF o archivo CSV
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              O haz clic aquí para seleccionar desde tu dispositivo
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTriggerPicker();
            }}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus:ring-zinc-100"
          >
            <Icons.FileText className="w-3.5 h-3.5" />
            <span>Seleccionar archivo</span>
          </button>

          {/* Quick Demo Loaders */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="text-2xs text-zinc-400 dark:text-zinc-500 mr-1">
              O prueba con un archivo demo:
            </span>
            <button
              type="button"
              id="btn-demo-duplicados"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadDemoFile("gastos_con_duplicados.csv");
              }}
              className="px-2.5 py-1 text-2xs font-medium rounded-md border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              CSV con duplicados
            </button>
            <button
              type="button"
              id="btn-demo-100-duplicados"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadDemoFile("gastos_100_duplicados.csv");
              }}
              className="px-2.5 py-1 text-2xs font-medium rounded-md border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              CSV 100% duplicados
            </button>
          </div>
        </div>
      ) : (
        /* File Selected: Metadata Preview & Actions */
        <div className="border border-zinc-200 rounded-lg bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700 flex-shrink-0 dark:bg-zinc-800 dark:text-zinc-200">
                {fileMeta.fileType === "pdf" ? (
                  <Icons.FileText className="w-5 h-5" />
                ) : (
                  <Icons.FileSpreadsheet className="w-5 h-5" />
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-zinc-900 truncate dark:text-zinc-100">
                    {fileMeta.fileName}
                  </span>
                  <span className="text-2xs px-2 py-0.5 rounded font-mono font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {fileMeta.fileType === "pdf"
                      ? "Estado de cuenta (PDF)"
                      : "Archivo de gastos (CSV)"}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Tamaño: {fileMeta.fileSizeFormatted}</span>
                  <span>&bull;</span>
                  <span>Formato: {fileMeta.fileType.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearFile}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              title="Cancelar y eliminar selección"
              aria-label="Cancelar y eliminar selección"
            >
              <Icons.Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleTriggerPicker}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-400 dark:border-zinc-700 dark:hover:text-zinc-200 dark:hover:bg-zinc-900 transition-colors"
            >
              <Icons.RefreshCw className="w-3.5 h-3.5" />
              <span>Cambiar archivo</span>
            </button>

            <button
              type="button"
              id="btn-confirm-routing"
              onClick={handleConfirmRouting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              <span>Continuar con {fileMeta.fileType.toUpperCase()}</span>
              <Icons.ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Privacy Note */}
      <div className="flex items-start gap-2.5 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
        <Icons.Lock className="w-3.5 h-3.5 mt-0.5 text-zinc-400 flex-shrink-0 dark:text-zinc-500" />
        <p className="leading-relaxed">
          Tus datos personales sensibles (como nombre y número de cuenta) se procesan directamente en tu navegador y no se comparten.
        </p>
      </div>
    </div>
  );
}
