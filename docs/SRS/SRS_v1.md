Requisitos Funcionales
Estos requisitos describen las acciones específicas que el sistema debe realizar para solucionar los problemas de gestión manual y errores en los registros:

RF1 - Registro de Clientes: El sistema debe permitir recopilar y almacenar los datos personales de los clientes, incluyendo nombre, teléfono, correo.

RF2 - Gestión de Disponibilidad: La aplicación debe realizar una verificación automática de las habitaciones disponibles basándose en fechas de ingreso/salida y el tipo de habitación (simple, doble, matrimonial o suite).

RF3 - Proceso de Reserva: El sistema debe permitir realizar la solicitud de reserva, asignar la habitación correspondiente y generar un código o número de reserva único para el control del cliente y administrador.

RF4 - Notificaciones y Confirmación: Al finalizar el proceso, el sistema debe generar una confirmación de la reserva y enviarla al cliente a través de la notificaciones de la aplicación.


Requisitos No Funcionales 
Estos definen las propiedades y restricciones tecnológicas que garantizan la calidad y el rendimiento del software:

RNF1 - Interfaz de Usuario (Usabilidad): La aplicación debe contar con una interfaz intuitiva, clara y responsiva, diseñada bajo  para mejorar la experiencia del usuario.

RNF2 - Seguridad y Persistencia de Datos: El sistema debe garantizar la integridad de la información mediante una base de datos MySQL, manejando de forma segura los registros de huéspedes para evitar la pérdida de datos que ocurre en los métodos manuales.

RNF3 - Arquitectura de Desarrollo: El software debe estar desarrollado de forma nativa para Android utilizando el lenguaje Kotlin y el entorno Android Studio, asegurando un rendimiento óptimo en dispositivos móviles.