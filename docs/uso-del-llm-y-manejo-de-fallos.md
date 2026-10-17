# Uso del LLM Externo y Manejo de Fallos

Este documento detalla los casos específicos en los que **Control de Gastos (Expense Tracker)** se comunica con un modelo de lenguaje externo (Google Gemini Pro), los formatos de entrada/salida utilizados y la estrategia de resiliencia implementada para garantizar que la aplicación continúe funcionando sin interrupciones si una llamada a la API falla o si se carece de conexión a internet.

---

## 1. ¿Para qué se utiliza el LLM Externo?

Bajo la arquitectura **Split-Brain**, el LLM no es el motor general de la aplicación, sino una herramienta de apoyo especializada que interviene únicamente en tres escenarios delimitados:

### 1.1. Extracción Estructurada desde Estados de Cuenta No Soportados

* **Cuándo ocurre**: Cuando el usuario sube un archivo PDF correspondiente a una entidad bancaria distinta de Banco G&T Continental (banco que cuenta con un parser local determinista).
* **Entrada enviada al LLM**: Texto plano extraído del PDF que ha sido previamente **despojado de toda información personal (PII)** en el cliente y validado por el usuario.
* **Instrucción del sistema**: El modelo actúa como un extractor financiero riguroso. Se le instruye para:
  1. Extraer exclusivamente compras, consumos en comercios, retiros de efectivo y débitos.
  2. Ignorar por completo créditos, depósitos, abonos a tarjeta de crédito, pagos por internet, bonificaciones de cashback y saldos iniciales o finales.
  3. Formatear fechas en formato estándar ISO `YYYY-MM-DD`.
  4. Extraer montos numéricos en Quetzales guatemaltecos (`GTQ`).
  5. Retornar estrictamente un arreglo JSON:
     ```json
     [
       {
         "date": "2026-07-15",
         "description": "FARMACIA [NOMBRE_REDACTADO]",
         "amount": 145.50
       }
     ]
     ```

### 1.2. Clasificación Asistida de Gastos Pendientes

* **Cuándo ocurre**: Tras procesar un estado de cuenta (sea vía CSV, parser local o extracción por IA), el sistema cruza cada movimiento con el catálogo local `merchant-catalog.json`. Si el número de transacciones que permanecen en estado `"Pendiente"` supera el umbral configurado (**más de 10 transacciones pendientes**, configurable mediante la variable de entorno `UNCLASSIFIED_EXPENSES_THRESHOLD`), el sistema solicita la asistencia de Gemini Pro.
* **Optimización de costos**: Si el número de gastos pendientes es de **10 o menos**, la llamada al LLM se **omite intencionalmente** para ahorrar cuota y latencia, permitiendo al usuario asignarlos de forma directa en la interfaz.
* **Entrada enviada al LLM**:
  * Lista de 11 categorías predefinidas en español (`Supermercado`, `Restaurantes y Cafés`, `Servicios Básicos`, `Transporte y Combustible`, `Salud y Farmacia`, `Entretenimiento y Compras`, `Suscripciones`, `Hogar y Mantenimiento`, `Educación y Librerías`, `Mascotas y Veterinaria`, `Cuidado Personal`) junto con cualquier categoría personalizada creada por el usuario.
  * Lista de transacciones pendientes conteniendo únicamente: `id`, `description` (sanitizada) y `amount`.
* **Salida esperada**: Un arreglo JSON asociando cada identificador con su categoría y detectando si corresponde a una suscripción:
  ```json
  [
    {
      "id": "tx-12",
      "category": "Restaurantes y Cafés",
      "isSubscription": false
    }
  ]
  ```

### 1.3. Generación de Sugerencias de Reducción de Gastos y Ahorro

* **Cuándo ocurre**: Cuando el usuario hace clic voluntariamente en el botón **"Obtener sugerencias de ahorro"** dentro del panel de control.
* **Entrada enviada al LLM**: Un payload estrictamente consolidado (`SavingsPayload`) que contiene:
  * Monto total de gastos del período en Quetzales.
  * Desglose consolidado por categoría (total gastado, porcentaje del presupuesto y conteo de compras).
  * Lista de servicios de suscripción y membresías recurrentes detectadas (`serviceName`, `monthlyAmountGTQ`, `chargeDate`).
  * **Cero transacciones individuales no recurrentes ni datos personales.**
* **Salida esperada**: Un objeto estructurado en español con tres dimensiones analíticas:
  1. **Oportunidades Inmediatas**: Acciones directas (e.g., cancelación de suscripciones duplicadas o poco utilizadas) con ahorro mensual estimado en Quetzales.
  2. **Estrategias a Largo Plazo**: Recomendaciones de ajuste presupuestario adaptadas al contexto de consumo en Guatemala.

---

## 2. ¿Qué ocurre si la llamada a la API del LLM Falla?

Uno de los principios de diseño fundamentales de la aplicación es la **alta disponibilidad y degradación elegante** (*graceful degradation*). La aplicación está construida para no bloquearse jamás ante fallos de conectividad, claves de API inválidas o límites de cuota excedidos.

### 2.1. Cascada de Modelos de Fallback (Fallback Hierarchy)

En los módulos del servidor (`src/lib/llm-classifier.ts`, `src/lib/llm-extractor.ts` y `src/lib/savings-advisor.ts`), la llamada al SDK `@google/genai` implementa un ciclo de reintentos automáticos a través de modelos alternativos:

```typescript
const candidateModels = [
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  "gemini-3.8-flash",
  "gemini-2.5-flash",
];
```

Si el modelo principal sufre saturación o indisponibilidad temporal en Google AI Studio, el servidor intenta automáticamente la petición con el siguiente modelo de la lista antes de reportar un error.

---

### 2.2. Comportamiento ante Fallo en Cada Escenario

| Escenario de Llamada | Causa del Fallo | Comportamiento del Sistema | Experiencia para el Usuario |
| :--- | :--- | :--- | :--- |
| **Extracción de Banco No Soportado** (`/api/extract-transactions`) | Error de red, cuota de Gemini agotada o API key ausente. | La petición captura el error y retorna código HTTP 500 con un mensaje explicativo en español. La sesión no se destruye. | Se muestra una alerta informativa en pantalla: *"No se pudo conectar con el servicio de extracción por IA. Verifique su conexión y configuración."* El usuario puede reintentar o cargar sus movimientos mediante archivo CSV. |
| **Clasificación Asistida** (`/api/classify-expenses`) | Error en Gemini Pro o respuesta JSON malformada. | El cliente captura la excepción de forma silenciosa. Las transacciones que ya fueron clasificadas localmente mediante `merchant-catalog.json` se conservan intactas. Las restantes quedan rotuladas como `"Pendiente"`. | Se notifica amigablemente al usuario: *"No se pudo conectar con el servicio de clasificación por IA. Puedes clasificar los gastos pendientes manualmente."* La tabla de transacciones permanece totalmente operativa para clasificación manual individual o masiva. |
| **Sugerencias de Ahorro** (`/api/suggest-savings`) | Timeout de solicitud o error del servidor externo. | El componente `savings-suggestions.tsx` captura el error y desactiva el estado de carga (`isLoading: false`), manteniendo intactas todas las métricas del dashboard. | Se despliega un mensaje claro con botón de reintento. El usuario puede seguir consultando el total de gastos, los gráficos de categorías y el resumen de suscripciones con normalidad. |

---

## 3. Principio de Autonomía Offline

La aplicación cumple con el requerimiento de diseño: **"Sin conexión a la nube, la aplicación sigue entregando información útil"**:

1. **Importación y Análisis de CSV**: Funciona al 100% de manera local en el navegador, sin realizar ninguna llamada a la red.
2. **Importación de Banco G&T Continental**: El parser de texto y detección de movimientos se ejecuta de forma íntegra en el servidor local sin requerir conexión a internet ni consumo de IA.
3. **Clasificación Local por Catálogo**: El diccionario de comercios (`merchant-catalog.json`) categoriza automáticamente los consumos más frecuentes en Guatemala (supermercados, restaurantes, gasolineras, servicios de agua, luz y telecomunicaciones).
4. **Detección de Suscripciones**: Se calcula localmente con reglas deterministas, identificando plataformas como Netflix o Spotify y sumando el compromiso mensual en Quetzales.
5. **Edición, Filtros y Reportes**: La tabla interactiva, filtros por texto o categoría, edición manual de montos y persistencia en `localStorage` continúan funcionando a la perfección en un entorno completamente desconectado.

---

## Enlaces de Referencia

* [Volver al README Principal](../README.md)
* [Instalación, Configuración y Ejecución](instalacion-y-ejecucion.md)
* [Estructura del Proyecto](estructura-del-proyecto.md)
* [Arquitectura Split-Brain](arquitectura-split-brain.md)
* [Herramientas y Arquitectura Técnica](herramientas-y-arquitectura.md)
* [Privacidad y Anonimización de Datos](privacidad-y-anonimizacion.md)
* [Pruebas Unitarias y Cobertura](pruebas-unitarias.md)
