# servingmi-appCG — Instrucciones de desarrollo

## Regla de deploy en Render

**Siempre hacer push a `main` después de cada cambio.**

Render está configurado para auto-deploy desde la rama `main`. El flujo correcto es:

1. Desarrollar en la rama de feature asignada.
2. Una vez completado el cambio, hacer merge a `main`.
3. Hacer `git push origin main` para que Render dispare el redeploy automático del backend y frontend.

Sin este push a `main`, los cambios no se reflejarán en producción.
