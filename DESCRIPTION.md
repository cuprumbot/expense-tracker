# App para control de gastos personales

App que permite al usuario ingresar su estado de cuenta y a partir de este calcular sus gastos mensuales. Los gastos se muestran en distintas categorías, las cuales son personalizables. A partir de esto se da sugerencias al usuario para reducir sus gastos.

## Funcionalidades clave

* El usuario podrá ingresar su estado de cuenta de diferentes cuentas bancarias. Los estados de cuenta se ingresan en formato PDF.
* El sistema podrá identificar los gastos.
    * Para los bancos más populares del país se tendrá un parser específico.
    * Para otros se utilizará un modelo de IA para obtener la información. Previo a usar el modelo, de forma local se removerá información privada del usuario como nombre y domicilio.
* El sistema organizará los gastos en diferentes categorías.
    * Para los negocios más populares de Guatemala se tendrá una categoría específica ya definida.
    * Para los demás negocios se utilizará un modelo de IA para obtener la categoría.
    * El usuario podrá personalizar las categorías.
* El usuario podrá ver un reporte de sus gastos.
    * Prototipo/MVP: El reporte se realizará únicamente con los estados de cuenta ingresados en el momento.
    * Desarrollo a largo plazo: Se contará con una base de datos en la que se guardarán los gastos registrados, estos se clasificarán mes a mes.
* El usuario podrá ver estadísticas relevantes.
    * Se mostrarán comparativas sobre el gasto en distintas categorías.
    * Se identificarán suscripciones para alertar al usuario en caso que haya olvidado cancelar alguna.
        * Prototipo/MVP: Se trabajará solo con los estados de cuenta ingresados, entonces se identificarán gastos específicos (e.g. Netflix).
        * Desarrollo a largo plazo: El sistema identificará gastos que suceden en fechas similares.
    * Se mostrarán al usuario sugerencias sobre cómo reducir sus gastos.

## Split brain

Se trabajará una parte del sistema en el cliente/servidor y otra parte usando modelos en la nube.

* Costo: Para reducir costos al llamar a LLM, se identificará toda la información posible de forma local. Al LLM no se evitará enviar PDF y se enviará información estructurada de forma más liviana.
* Privacidad: Al llamar a un LLM, se enviará información anonimizada eliminando datos sensibles como nombre o domicilio.
* Disponibilidad: En caso de fallar la conexión al LLM se clasificarán todos los gastos posibles de forma local y se le dará opción al usuario de clasificar manualmente los restantes.

## Condiciones mínimas

* Componente local y modelo en la nube.
    * Local: Identificar información en los PDF. Remover información sensible. Clasificar gastos conocidos. Calcular gastos totales. Identificar suscripciones conocidas.
    * Nube: Clasificar gastos desconocidos. Generar sugerencias para reducir gastos.
* El nombre y docimilio del usuario, así como cualquier otra información personal que pueda aparecer en el estado de cuenta, no se envian a la nube.
* Las decisiones de qué enviar a la nube se realizan de forma explícita.
* Sin conexión a la nube, la aplicación sigue entregando información útil.

## Entregables

* Aplicación con control de versiones en Github y desplegada a Vercel.
* Documentación completa. README que funciona como índice, documentos adicionales que explican arquitectura, instrucciones para instalación, configuración y despliegue, y decisiones de diseño importantes.