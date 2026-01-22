# Guía de Despliegue Online: X Scheduler Pro

Esta guía explica cómo poner tu Command Center en funcionamiento en internet para que sea accesible desde cualquier lugar.

## Opción 1: Railway.app (Recomendada y Fácil)
Ideal para desplegar rápidamente usando el `Dockerfile` que he creado.

1. **Subir a GitHub**: Sigue los pasos que te dejé en el `walkthrough.md` para subir tu código a un repositorio privado.
2. **Crear Proyecto**: En Railway, haz clic en "New Project" -> "Deploy from GitHub repo".
3. **Variables de Entorno**: Configura en Railway:
   - `PORT`: 8000
   - `DATABASE_URL`: Una ruta persistente si usas volúmenes, o simplemente deja que use la interna (se borrará al reiniciar si no usas volúmenes).
4. **Despliegue**: Railway detectará el `Dockerfile` y configurará todo, incluyendo las dependencias de Playwright.

## Opción 2: VPS (DigitalOcean / AWS / Google Cloud)
Ideal si quieres control total y ahorro a largo plazo.

1. **Instalar Docker**: En tu servidor Linux (Ubuntu recomendado):
   ```bash
   sudo apt update && sudo apt install docker.io docker-compose -y
   ```
2. **Clonar e Iniciar**:
   ```bash
   git clone <URL_TU_REPOSO>
   cd x_scheduler
   docker build -t x-scheduler .
   docker run -d -p 80:8000 --name x-app x-scheduler
   ```

## Configuración del Frontend
Si despliegas el backend en `https://mi-backend.up.railway.app`, debes actualizar el frontend:

1. Edita `frontend/src/api.ts` para que apunte a la URL de producción.
2. Construye el proyecto:
   ```bash
   cd frontend
   npm run build
   ```
3. Sube la carpeta `dist` a **Vercel** o **Netlify**.

---

> [!WARNING]
> Debido a que X (Twitter) tiene una política estricta contra logins desde IPs de centros de datos, es posible que Playwright sea detectado. Se recomienda usar proxies o realizar el `manual_login` directamente en el servidor una vez desplegado.
