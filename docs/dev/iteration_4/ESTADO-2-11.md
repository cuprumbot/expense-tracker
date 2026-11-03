# Estado semana 4 (final)

## Cambios entre semana 3 y 4

- Herramienta de presupuestos.
    - Implementación de componentes y funcionalidad.
    - Creación de presupuesto desde cero.
        - Se ofrecen algunas categorías base como sugerencia.
        - Se ofrecen algunos valores base como sugerencia, se puede ajustar la cantidad fácilmente.
    - Creación presupuesto basado en transacciones ya subidas.
        - Se utiliza el promedio para fijar metas.
        - Se puede ajustar la cantidad.
    - Edición de presupuesto creado.
        - Al editarlo se da la opción al usuario si este se quiere aplicar a los meses anteriores o solo a partir del actual.
        - El presupuesto actual y las versiones anteriores se guardan en `localStorage`.
    - Visualización de gastos contra el presupuesto.
        - El usuario puede visualizar sus gastos del mes actual o alguno de los anteriores en comparación con el presupuesto.
        - La herramienta le muestra cuánto tiene aún disponible en alguna categoría.
    - Visualización de rachas y sugerencias para el próximo mes.
        - Se muestra al usuario cuántas metas ha logrado y si mantiene alguna racha de varias semanas con sus gastos bajo control.
        - Se muestra al usuario sugerencias de qué categorías mejorar el siguiente mes.
    
- Ingreso de listas en texto plano.
    - El usuario puede ingresar sus gastos como una lista.
    - Se toma como fecha del gasto la fecha en que este fue ingresado.

- Parsers adicionales.
    - Se agregó parser para tarjetas de crédito de bancos adicionales.
        - Banco Industrial.
        - Banco Cuscatlán.
        - BAC Credomatic.
        - Banco FICOHSA.
        - Banco Agromercantil.
        - Se conservó el parser previamente implementado para Banco GyT Continental.
    - Se removieron los parsers para estados de cuenta monetarios.
        - Las personas que brindaron sus estados de cuenta indicaron que casi no usaban su cuenta monetaria para gastos, solo para transferencias o retiros.

- Cambios menores de UI/UX.


## Funcionalidades no implementadas

Previo a la implementación de semana 4 se conversó con algunas personas que más adelante fueron encuestadas. Según esta conversación previa, se decidió no implementar estas funcionalidades:

- Conexión con Gmail del usuario para obtener PDF de forma automática.
    - Casi nadie se veía interesado.
    - Algunas personas lo veían como una pérdida de privacidad.

- Fotos a facturas para agregar gastos.
    - Las personas prefirieron probar la aplicación en computadora y no en móvil.
    - Varias personas indicaron que no se detendrían a tomar fotos.


## Feedback

Feedback completo en [`ENCUESTA.md`](https://github.com/cuprumbot/expense-tracker/blob/master/ENCUESTA.md)

Visualización de los resultados en [Github Pages](https://cuprumbot.github.io/expense-tracker/)


# Conclusiones y aprendizajes

- La principal barrera de entrada continuó siendo la carga de PDF. Entre los usuarios encuestados esta barrera no se logró superar por distintas razones:
    - Los usuarios conscientes de sus gastos ya tienen otros métodos de control, principalmente Excel. No competimos contra otra aplicación sino contra algo que ellos mismos personalizaron.
    - A algunos usuarios no les importa lo suficiente llevar el control de sus gastos, puedo dividir a estos en dos categorías: 
        - Está bastante bien económicamente y por eso no le importa.
        - Tiene un poco de holgura pero sabe que aunque ahorre un poco más cada mes, no logrará de forma cercana hacer una compra grande.
    - Hay usuarios con deudas a quienes la aplicación les causó estrés. Ya están conscientes de sus deudas y que deben reducir gastos, pero ser recordados de esto por una fuente adicional les causa malestar.
- Fue una minoría quien indicó que sí usaría la aplicación. El desarrollo asistido por IA es tan rápido, que puede que valga la pena generar software aún si la cantidad de usuarios es muy baja.