# GestorGacF

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.5.

## Development server

To start a local development server, run:

# GestorGacF

Pequeña guía del repo — concisa y orientada a desarrolladores.

Resumen
--
Proyecto Angular (20.x). Arquitectura por features; algunas features siguen un patrón Clean Architecture (domain/application/infrastructure/ui).

Estructura clave
--
- `src/app/core/` — cross-cutting: auth, http, config, utils. Aquí viven los singletons globales.
- `src/app/features/` — features aisladas, lazy-loaded y, cuando aplica, organizadas en domain/app/infra/ui.

Comandos útiles
--
- Desarrollo (dev server):
```powershell
npm start
# (equivalente) ng serve --proxy-config proxy.conf.json
```
- Build producción:
```powershell
npm run build
```
- Tests unitarios:
```powershell
npm test
```

Configuración y providers
--
- El core exporta `CORE_PROVIDERS` (registrado en `app.config.ts`) que incluye interceptores HTTP y singletons como `AuthService` y `LoggerService`.
- Las features deben evitar lógica cross-cutting; usar la API pública del core (guards, tokens, providers).

Notas para desarrolladores
--
- Añadir una nueva feature: crear carpeta bajo `src/app/features/<feature>` y seguir el patrón domain/application/infrastructure/ui si necesitas separación de responsabilidades.
- Para consumir la API: usar los adaptadores/ports del feature o el `AuthService` / `AuthGuard` del core cuando corresponda.
- Mantén `core/` libre de dependencias a features.

Dónde mirar primero
--
- `src/app/core/` — inicio para cross-cutting y configuración global.
- `src/app/features/secretario/publicadores/` — ejemplo de feature refactorizada con Clean Architecture.

Contacto y contribución
--
Si trabajas en el repo, deja PRs pequeños y documenta los cambios de arquitectura en cada feature (`README.md` dentro de la feature si es relevante).

Licencia
--
Proyecto privado / ver NOTICE para detalles de licencia.

----
Breve y práctico: dime si quieres que añada un `README.md` dentro de `core/` o ejemplos de tests para la fachada (`facade.spec.ts`).
