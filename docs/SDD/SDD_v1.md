Documento de Diseño de Software (SDD) - Hotel Mi Kasa
1. Arquitectura del Sistema
El proyecto sigue una arquitectura de aplicación móvil nativa estructurada en tres capas principales: Entrada, Proceso y Salida.

Entrada: Recopilación de datos del cliente (nombre, cédula, contacto) y parámetros de la reserva.
Proceso: Lógica de verificación de disponibilidad, asignación de habitaciones y generación de códigos de reserva.
Salida: Generación de confirmaciones digitales, notificaciones vía WhatsApp/Correo y reportes administrativos.

2. Metodología de Desarrollo
Se implementa la metodología Mobile-D, diseñada específicamente para ciclos de desarrollo ágiles en dispositivos móviles. Las fases aplicadas son:

Exploración e Inicialización: Definición de requerimientos y configuración del entorno.

Producción: Codificación iterativa del prototipo.

Estabilización y Pruebas: Aseguramiento de la calidad y corrección de errores antes del release.

3. Decisiones Técnicas (Stack Tecnológico)

Lenguaje de Programación:  
TypeScript como lenguaje principal, junto con JavaScript, HTML y CSS para la construcción de la interfaz y lógica de la aplicación.

Framework de Interfaz:  
Ionic Framework integrado con Angular, aprovechando componentes UI modernos y responsivos.

Backend:  
Servicios web levantados en XAMPP, con PHP para la lógica del servidor y conexión a la base de datos.

Base de Datos:  
MySQL, administrado mediante phpMyAdmin, para el almacenamiento persistente de registros.

Entorno de Desarrollo:  
Visual Studio Code (IDE) para la edición y gestión del código, junto con XAMPP para el servidor local.

4. Modelado de Datos
El sistema se apoya en un Modelo Entidad-Relación que organiza las tablas de usuarios_clientes, habitaciones, reservas y usuarios_empleados, permitiendo una gestión operativa eficiente y reduciendo el riesgo de pérdida de información.
