# X Scheduler Pro 🚀

Un centro de mando premium para programar contenido de alto impacto en X (Twitter), con soporte para hilos, gestión multimedia y analíticas en tiempo real.

## ✨ Características Principales

- **Centro de Mando Premium**: Interfaz moderna con estética Glassmorphism, modo oscuro y micro-animaciones.
- **Gestión de Hilos & Borradores**: Crea secuencias de posts, guárdalos como borradores y visualízalos antes de publicar.
- **Analíticas en Tiempo Real**: Seguimiento de vistas, likes, reposts y tasas de crecimiento directamente en el dashboard.
- **Automatización Robusta**: Publicación basada en **Playwright** con gestión inteligente de sesiones y cookies.
- **Dockerizado**: Listo para desplegar en cualquier entorno con `docker-compose` o plataformas como Railway.

## 🛠️ Stack Tecnológico

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, TanStack Query.
- **Backend**: FastAPI (Python 3.12), Pydantic V2, SQLAlchemy (SQLite), APScheduler.
- **Infraestructura**: Docker, Nginx (Proxy inverso), Loguru (Logging).

## 🚀 Instalación Rápida (Docker)

La forma más fácil de iniciar el proyecto es usando Docker.

1. **Clona el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/x_scheduler.git
   cd x_scheduler
   ```

2. **Configura las variables de entorno:**
   Crea un archivo `.env` en la raíz (puedes copiar `.env.example`) y define tus credenciales:
   ```bash
   X_USERNAME=tu_usuario
   X_PASSWORD=tu_contraseña
   # Opcional: Cookies en formato JSON para evitar login manual
   X_COOKIES_JSON=[{"name": "auth_token", "value": "..."}]
   ADMIN_TOKEN=tu_token_seguro
   ```

3. **Inicia los contenedores:**
   ```bash
   docker-compose up --build
   ```

4. **Accede a la aplicación:**
   - Frontend: `http://localhost` (Puerto 80)
   - Backend API: `http://localhost:8000/docs`

## 🚂 Despliegue en Railway

Este proyecto está optimizado para Railway.

### Pasos de Despliegue
1. Haz fork de este repositorio.
2. Crea un nuevo proyecto en Railway desde GitHub.
3. Railway detectará automáticamente el `Dockerfile` del backend.

### Variables de Entorno (Railway)
Configura estas variables en la pestaña "Variables" de tu servicio:
- `PORT`: `8000` (Railway lo asigna automáticamente, pero el Dockerfile está preparado para leerlo).
- `X_USERNAME`: Tu usuario de X.
- `X_PASSWORD`: Tu contraseña de X.
- `X_COOKIES_JSON`: (Recomendado) El contenido de tu archivo de cookies exportado en formato JSON string. Esto evita bloqueos de login.
- `ADMIN_TOKEN`: Token para acceder al panel de control.
- `DATABASE_URL`: `sqlite:////app/data/x_scheduler.db` (Usa ruta absoluta si montas un volumen).

### Persistencia de Datos (Evitar pérdida de datos)
Railway tiene un sistema de archivos efímero. Para guardar tus posts y estadísticas:
1. Ve a la configuración del servicio.
2. Añade un **Volume**.
3. Monta el volumen en `/app/data`.
4. Asegúrate que tu `DATABASE_URL` apunte a ese volumen (ej: `sqlite:////app/data/x_scheduler.db`).

## 🔧 Solución de Problemas

### Error 502 Bad Gateway
- **Causa**: El backend no pudo iniciar o no está escuchando en el puerto correcto.
- **Solución**: El `Dockerfile` ya está configurado para usar la variable `PORT` de Railway. Revisa los logs de despliegue para ver si hubo un error de Python (ej: falta de librerías).

### Error 500 en `/api/posts`
- **Causa**: Datos antiguos en la base de datos que no cumplen con el esquema actual (campos faltantes).
- **Solución**: El sistema ahora incluye migraciones automáticas que "sanean" los datos antiguos al iniciar. Simplemente redesplega el backend.

### Login Fallido en X
- **Causa**: X detectó un inicio de sesión sospechoso o pidió confirmación por email.
- **Solución**: Usa `X_COOKIES_JSON` con cookies de una sesión ya iniciada en tu navegador.

---
*Desarrollado con ❤️ para creadores de contenido.*
