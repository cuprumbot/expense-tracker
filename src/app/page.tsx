import { Icons } from "@/components/icons";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 antialiased selection:bg-zinc-900 selection:text-white dark:bg-zinc-950 dark:text-zinc-100">
      {/* Minimal Top Header */}
      <header className="border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-900 text-white flex items-center justify-center dark:bg-zinc-100 dark:text-zinc-900">
              <Icons.Wallet className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Control de Gastos
            </span>
          </div>

          <div className="text-xs text-zinc-500 font-mono tracking-tight dark:text-zinc-400">
            GTQ · Q
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-16 space-y-8">
        {/* Title & Introduction */}
        <section className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Organiza tus gastos mensuales
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Carga tu estado de cuenta bancario o archivo de movimientos para clasificar tus consumos, supervisar suscripciones y obtener un resumen claro de tus finanzas.
          </p>
        </section>

        {/* File Ingestion Workspace */}
        <section className="border border-zinc-200 rounded-xl bg-zinc-50/50 p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/40 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-200/80 pb-4 dark:border-zinc-800/80">
            <span className="text-xs font-medium tracking-tight text-zinc-700 dark:text-zinc-300">
              Carga de documento
            </span>
            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span>PDF</span>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <span>CSV</span>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div className="border border-dashed border-zinc-300 rounded-lg bg-white p-10 sm:p-14 text-center flex flex-col items-center justify-center gap-4 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-600">
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Icons.Upload className="w-5 h-5" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Arrastra tu archivo aquí o selecciona uno desde tu dispositivo
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Estados de cuenta en PDF (Banco G&amp;T Continental y otros bancos) o archivos CSV
              </p>
            </div>

            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus:ring-zinc-100"
            >
              <Icons.FileText className="w-3.5 h-3.5" />
              <span>Seleccionar archivo</span>
            </button>
          </div>

          {/* Privacy Note */}
          <div className="flex items-start gap-2.5 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
            <Icons.Lock className="w-3.5 h-3.5 mt-0.5 text-zinc-400 flex-shrink-0 dark:text-zinc-500" />
            <p className="leading-relaxed">
              Tus datos personales sensibles (como nombre y número de cuenta) se procesan directamente en tu navegador y no se comparten.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
