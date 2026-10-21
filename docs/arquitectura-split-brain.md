# Arquitectura Split-Brain (Cerebro Dividido)

La arquitectura **Split-Brain** (cerebro dividido) es el patrón arquitectónico central de **Control de Gastos (Expense Tracker)**. Su objetivo principal es conciliar dos metas a menudo contradictorias en aplicaciones modernas de inteligencia artificial: **máxima privacidad y eficiencia económica**, junto con **alta capacidad analítica y completitud de datos**.

---

## 1. ¿Qué es la Arquitectura Split-Brain?

En una arquitectura convencional basada en IA generativa ("All-to-LLM"), los documentos completos del usuario (como archivos PDF de estados de cuenta bancarios con nombres, números de cuenta, direcciones y saldos) se envían íntegros a un modelo de lenguaje en la nube para que este extraiga, categorice y resuma la información.

El enfoque **Split-Brain** rechaza este modelo tradicional dividiendo la responsabilidad del sistema en dos hemisferios estrictamente separados:

1. **Hemisferio Local (Cliente y Servidor Interno)**:
   * Realiza todo el procesamiento pesado y determinista: extracción de texto de archivos PDF, parsing de CSVs, validación de formatos, sanitización de datos personales (PII), clasificación por catálogo de comercios conocidos, cálculo de métricas financieras y almacenamiento en `localStorage`.
   * **Garantía absoluta**: Ningún archivo PDF o CSV se envía jamás a un servicio de terceros.
2. **Hemisferio Externo (Modelo LLM en la Nube - Google Gemini)**:
   * Se invoca únicamente como un mecanismo de asistencia especializada cuando las reglas deterministas locales no son suficientes.
   * **Condición indispensable**: Solo recibe datos previamente anonimizados (con marcadores como `[NOMBRE_REDACTADO]` y `[CUENTA_REDACTADA]`) o cifras numéricas agregadas (totales por categoría y nombres de servicios recurrentes), nunca documentos en crudo ni identificadores personales.

---

## 2. Comparativa: Procesamiento Local vs. LLM Externo

La siguiente tabla resume con precisión qué tareas y datos se procesan de forma 100% local y cuáles requieren la intervención del modelo externo:

| Componente / Tarea | Procesamiento Local (Cliente / Servidor Interno) | Procesamiento Externo (Google Gemini Pro) | Formato de Datos Enviado al LLM |
| :--- | :--- | :--- | :--- |
| **Carga y Validación de Archivos** | Sí (100% local). Detección de tipos MIME (`.pdf`, `.csv`), tamaño y cola por lotes de múltiples archivos. | No. | Ninguno. El archivo no sale del entorno local. |
| **Deduplicación de Transacciones** | Sí (100% local). `deduplication.ts` descarta compras exactamente repetidas en lote o sesión activa. | No. | Ninguno. |
| **Parsing de CSV y Conversión Monetaria** | Sí (100% local). `PapaParse` infiere columnas de fecha, descripción, monto y divisa original (USD/GTQ), convirtiendo a Quetzales si aplica. | No. | Ninguno. |
| **Extracción de Texto PDF** | Sí (100% local). `pdf-parse` extrae el contenido de texto en el servidor sin servicios externos. | No. | Ninguno. |
| **Detección de Banco y Parser Especializado** | Sí (100% local). Banco G&T Continental cuenta con parser propio que filtra créditos/pagos y convierte cargos en USD a GTQ (7.85) de forma algorítmica. | No. | Ninguno. |
| **Anonimización y Redacción de PII** | Sí (100% local). Reglas y expresiones regulares eliminan nombres, direcciones, cuentas, IBAN, DPI, NIT y teléfonos. | No. | Ninguno. La anonimización precede a cualquier comunicación externa. |
| **Extracción de Transacciones en Bancos No Soportados** | No (solo la anonimización y el prompting ocurren localmente). | Sí. Gemini Pro extrae las transacciones ignorando pagos, créditos y saldos. | Texto plano **sanitizado** con marcadores de redacción (ej. `ACH [NOMBRE_REDACTADO]`, `Q 150.00`). |
| **Clasificación de Comercios Conocidos** | Sí (100% local). Búsqueda contra `merchant-catalog.json` (12 categorías populares de Guatemala, incluyendo Visacuotas y Financiamiento). | No. | Ninguno. |
| **Clasificación de Gastos Pendientes (<= 10)** | Sí (100% local). Si quedan 10 o menos gastos sin clasificar, se omite el LLM y el usuario clasifica manualmente desde el drawer lateral. | No. | Ninguno. |
| **Clasificación de Gastos Pendientes (> 10)** | Validación previa de seguridad local para certificar la ausencia de PII en las descripciones. El usuario navega directo al dashboard y la IA clasifica en segundo plano con chip animado. | Sí. Gemini Pro categoriza las descripciones desconocidas contra una lista cerrada de categorías. | Array JSON ligero: `[{ "id": "tx-1", "description": "Comercio X", "amount": 120.00 }]`. |
| **Identificación de Suscripciones** | Sí (100% local). Detección inmediata de servicios recurrentes (Netflix, Spotify, gimnasios, etc.). | No. | Ninguno. |
| **Cálculo de Reportes y Dashboard (4 Paneles SVG)** | Sí (100% local). Motor analítico completo: series temporales multimes con curvas Bézier (Panel 1), ranking top 5 de comercios por monto y frecuencia (Panel 2), patrones de consumo con atípicos $\mu + 1.75\sigma$ (Panel 3), y dona de antigüedad en 3 compromisos (Panel 4). Cero llamadas externas. | No. | Ninguno. |
| **Sugerencias de Reducción de Gastos** | Construcción local de payload con totales agregados y servicios de suscripción. | Sí. Genera recomendaciones estratégicas y tácticas de ahorro adaptadas al contexto de Guatemala. | Totales agregados por categoría (`Supermercado: Q 2,500`) y lista de servicios recurrentes (`Netflix: Q 89.00`). |
| **Persistencia y Reinicio de Sesión** | Sí (100% local). Continuidad acumulada en `localStorage` y modal de reinicio selectivo o de fábrica. Cero bases de datos remotas. | No. | Ninguno. |

---

## 3. Las Cuatro Razones Fundamentales de esta Arquitectura

El diseño Split-Brain de Control de Gastos responde a cuatro pilares estratégicos y técnicos:

| Pilar | Justificación y Funcionamiento en la Aplicación |
| :--- | :--- |
| **1. Privacidad (Privacy)** | **No queremos que información financiera ni personal sensible sea enviada a un LLM externo.**<br>Un estado de cuenta bancario contiene la identidad completa del titular: nombre completo, dirección de residencia, número de cuenta bancaria o IBAN, DPI (CUI), NIT, correos y números telefónicos. Mediante el clasificador local de patrones regex y el algoritmo de extracción heurística de titulares, toda la PII es redactada antes de que cualquier fragmento de texto abandone el dispositivo. Además, el usuario confirma visualmente el texto antes de autorizar el envío. |
| **2. Costo (Cost)** | **Podemos procesar la inmensa mayoría de los datos localmente a costo cero de API.**<br>Enviar documentos PDF completos o largas cadenas de transacciones a modelos LLM comerciales consume un alto volumen de tokens de entrada y salida, generando costos recurrentes elevados. Al procesar localmente los CSVs, los estados de cuenta de bancos populares (como Banco G&T) y los comercios locales frecuentes (como Walmart, Shell, Paiz o San Martín), el 90-95% de los datos se procesa sin incurrir en consumo de cuotas de API. |
| **3. Latencia (Latency)** | **La mayor parte de los datos se puede identificar con un parser simple que opera de forma instantánea.**<br>Una llamada de red hacia un modelo LLM en la nube puede tardar entre 2 y 8 segundos en resolver, además de depender de la estabilidad de la conexión. Los parsers algorítmicos locales y el catálogo en memoria procesan cientos de movimientos bancarios en menos de 10 milisegundos, brindando una experiencia de usuario inmediata y fluida. |
| **4. Completitud (Completion)** | **Dado que no podemos identificar cada gasto con reglas fijas, usamos un LLM para dar al usuario la información más completa posible.**<br>Las reglas estáticas y catálogos de palabras clave nunca podrán cubrir la totalidad de descripciones comerciales abreviadas, pequeños negocios locales o formatos no convencionales de estados de cuenta bancarios. El modelo LLM actúa como un complemento de rescate que resuelve ambigüedades y vacíos, evitando que el usuario deba clasificar manualmente decenas de transacciones o transcribir estados de cuenta complejos. |

---

## 4. Frontera de Seguridad y Verificación en Dos Pasos

Para garantizar que la separación entre ambos hemisferios nunca se rompa de manera accidental o maliciosa, la arquitectura implementa una **frontera de doble verificación**:

```
[ Cliente (Navegador) ]
    │
    ├─ 1. Sanitización Local (anonymizer.ts)
    │      Detecta y reemplaza nombres, cuentas, DPI, direcciones
    │
    ├─ 2. Confirmación del Usuario (anonymization-modal.tsx)
    │      El usuario valida el texto redactado y agrega términos personalizados
    │
    ▼ (Envío HTTPS seguro a Route Handler)
[ Servidor Next.js (Node.js) ]
    │
    ├─ 3. Validación de Frontera (validateSanitizedPayload / validateExpenseClassificationPayload)
    │      El servidor rechaza la solicitud si detecta cualquier patrón de IBAN, cuenta, DPI o email
    │
    ▼ (Payload seguro verificado)
[ Google Gemini Pro API ]
```

1. **Paso 1 (Cliente)**: El módulo `anonymizer.ts` sanitiza el contenido y el modal `anonymization-modal.tsx` muestra el resultado al usuario para su consentimiento explícito antes de cualquier transferencia de datos.
2. **Paso 2 (Servidor)**: El Route Handler correspondiente (`/api/extract-transactions`, `/api/classify-expenses` o `/api/suggest-savings`) ejecuta una función de validación estricta de frontera antes de instanciar el cliente `@google/genai`. Si se detecta un patrón de cuenta bancaria o DPI que haya escapado a la sanitización previa, la solicitud es rechazada inmediatamente con un error HTTP 400.

---

## Enlaces de Referencia

* [Volver al README Principal](../README.md)
* [Instalación, Configuración y Ejecución](instalacion-y-ejecucion.md)
* [Estructura del Proyecto](estructura-del-proyecto.md)
* [Herramientas y Arquitectura Técnica](herramientas-y-arquitectura.md)
* [Uso del LLM Externo y Manejo de Fallos](uso-del-llm-y-manejo-de-fallos.md)
* [Privacidad y Anonimización de Datos](privacidad-y-anonimizacion.md)
* [Pruebas Unitarias y Cobertura](pruebas-unitarias.md)
