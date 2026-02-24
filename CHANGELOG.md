CHANGELOG - Hotel Mi Kasa

Estructura de Repositorio: Creación de carpetas /docs, /src, /config y /tests para la organización de Elementos de Configuración (CIs). 

Documentación de Requisitos (SRS): Definición de 4 requerimientos funcionales críticos (Registro, Disponibilidad, Reserva y Notificación) para mitigar errores de gestión manual. 

Documento de Diseño (SDD): Establecimiento de la arquitectura basada en la metodología Mobile-D y el modelo Entidad-Relación para MySQL. 

Pruebas Unitarias: Script test_v1.ts para validar la lógica de asignación de habitaciones y generación de códigos de reserva. 

Configuración: Plantilla config para la conexión al servidor local XAMPP y entorno de desarrollo Ionic. 
## [1.1.0-beta] - 2026-02-23
### Añadido
- [cite_start]Implementación de la clase Reserva en `src/`. [cite: 126]
- [cite_start]Lógica para la generación automática de códigos de reserva (RF3). [cite: 63]
- [cite_start]Estructura de ramas bajo el modelo GitFlow para control de evolución.
# CHANGELOG - Hotel Mi Kasa

## [1.1.0] - 2026-02-23
### Añadido
- **Módulo de Reservas (RF3):** Implementación completa de la vista de mis reservas en Ionic.
- **Generación de Comprobantes:** Integración de la librería `pdfMake` para generar PDFs automáticos.
- **Validación QR:** Sistema de pases digitales para agilizar el check-in en el hotel.
- **Gestión de Archivos:** Funcionalidad para descargar facturas y compartir comprobantes mediante Capacitor.
*Integración visual de la metodología GitFlow para auditoría funcional.
