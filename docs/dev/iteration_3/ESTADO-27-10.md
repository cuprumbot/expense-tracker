# Estado semana 3

## Cambios entre semana 2 y 3

- UI/UX personalizable
    - Botón de `Reiniciar sesión` y `Borrar datos` se encontraba duplicado. Se conservó uno.
    - Los paneles se pueden redimensionar.
    - Los paneles se pueden minimizar.
    - El estado de los paneles se guarda en la sesión actual (`localStorage`).

- Paneles en general
    - La mayoría de elementos en todos los paneles ahora reaccionan a clicks, al hacerlo abren la lista de transacciones y filtran según donde fue el click.
    - Los paneles tienen un pequeño ícono de información. Al hacer click en este se explica de forma breve que interacciones hay en el panel.

- Panel: Histórico por categoría
    - Al hacer click en una línea de tendencia se ocultan las demás.
        - Feedback original: Las líneas están muy cerca, es difícil ver una línea particular sin que se confunda con las otras.

- Panel: ¿A dónde va mi dinero?
    - Se puede hacer click en un negocio para removerlo de la lista y mostrar los siguientes.
        - Feedback original: Los negocios en el top 1-3 resultan obvios, la información real la encontraban en el top 4-10.
    - Se agregó un menú de configuración para elegir si ocultan al negocio de ambos subpaneles.
        - Feedback original: Parafraseando "Hay negocios como Tigo donde se que hay un monto alto y una cantidad alta de transacciones, no puedo hacer nada al respecto entonces no me interesa en ningún top. Hay negocios como Walmart se que el monto es alto, entonces no lo quiero ver en ese subpanel; lo preocupante es ver que también hay muchas transacciones, allí si lo quiero ver."

- Parsers adicionales
    - Se agregó parser de cuentas monetarias de Banco Industrial.
    - Se agregó parser de cuentas monetarias de Banrural.
    - Bloqueo actual: No se han obtenido estados de cuenta de otros bancos, ni tarjetas de crédito de Banco Industrial y Banrural.

## Nuevo feedback

Se hicieron preguntas a usuarios enfocadas en el Expense Tracker como producto, no como tech demo. Respuestas parafraseadas.

- ¿Tienes este problema? ¿Cómo lo resuelves hoy?
    - Sí, con un Excel personalizado.
    - Sí, no lo resuelvo.
    - Sí, empiezo a hacer un listado de gastos cuando siento que ya gasté mucho en un mes. No aprovecho el listado para nada después.

- ¿Qué es lo primero que buscarías en un software para resolver esto?
    - No buscaría software, uso mi Excel.
    - Quiero hacer un presupuesto pero no se cómo empezar y como ajustarlo.
    - Que me diga si voy mejorando, que me diga si pude controlarme más que el mes pasado.

- ¿Qué hace que valga la pena subir tus PDF? (Pregunta de seguimiento solo para algunos usuarios)
    - Preferiría que fuera integrado en mi aplicación del banco y que no tenga que subir nada. Podría darle acceso a mi correo y que automático obtenga los estados de cuenta que me mandan.
    - No aplica.
    - PDF no se, quiero que entienda mis listas. (Usuario mostró sus listas: durante los fines de semana que sentía que gastó mucho empezaba a hacer un listado sencillo, entradas como "Cine 98", "Gasolina 150", "Campero 146")

## Plan para próxima semana

- Herramienta para presupuesto
    - Usuario puede crear presupuesto desde cero o basado en sus transacciones subidas.
    - Se puede comparar mes a mes si se logró seguir el presupuesto.
    - Le da indicaciones puntuales de qué categoría concentrarse en mejorar el próximo mes.

- Conexión con Gmail del usuario
    - Esta funcionalidad es totalmente opcional, debido a que requiere autorización para acceso al correo y pocos usuarios querran usarla. Los usuarios pueden seguir cargando sus PDF manualmente.
    - Oauth con Gmail, búsqueda automática de estados de cuenta recientes en el correo.
    - Factible para demo, al ser un producto con más usuarios se requiere verificación de parte de Google.

- Más formatos de subida
    - Además de PDF y CSV, el usuario puede subir listas sencillas de gastos.
    - Poder tomar foto a una factura para subir la transacción. Requiere revisar la interfaz en móviles.

- Recomendaciones puntuales
    - Recomendaciones específicas según la información de cada panel.
    - Generar la mayoría de estas de forma local.
    - Dar al usuario sugerencias con cifras, no genéricas.
