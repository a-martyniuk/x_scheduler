# X Scheduler Pro 🚀

Un centro de mando premium para programar contenido de alto impacto en X (Twitter), con soporte para hilos, gestión multimedia y analíticas en tiempo real.

## ✨ Características Principales

- **Centro de Mando Premium**: Interfaz moderna con estética Glassmorphism y micro-animaciones.
- **Gestión de Hilos**: Crea y visualiza secuencias de posts antes de publicar.
- **Analíticas en Tiempo Real**: Seguimiento de vistas, likes y reposts directamente en el dashboard.
- **Automatización Robusta**: Publicación basada en Playwright con reintentos inteligentes y bloqueo de recursos innecesarios para mayor eficiencia.
- **Arquitectura Moderna**:
    - **Frontend**: React 19, React Query, Vite, Tailwind CSS, Framer Motion.
    - **Backend**: FastAPI, Pydantic V2 (Settings & Schemas), SQLAlchemy.
    - **Logging**: Sistema de registros profesional con Loguru.

## 🛠️ Stack Tecnológico

- **Frontend**: React, TypeScript, FullCalendar, Lucide-React, Framer Motion, TanStack Query.
- **Backend**: FastAPI (Python), SQLite (SQLAlchemy), APScheduler.
- **Worker**: Playwright (Automatización de Navegador).

## 🚀 Instalación Rápida

### Backend & Worker
1. Crea un entorno virtual: `python -m venv venv`
2. Activa el entorno: `venv\Scripts\activate` (Windows) o `source venv/bin/activate` (Mac/Linux)
3. Instala las dependencias: `pip install -r requirements.txt`
4. Configura el archivo `.env` (mira `.env.example`).
5. Inicia el servidor: `python main.py` (desde la carpeta `backend`).

### Frontend
1. Entra en la carpeta `frontend`: `cd frontend`
2. Instala dependencias: `npm install`
3. Inicia en modo desarrollo: `npm run dev`

## 🐳 Docker (Próximamente)

El proyecto está siendo preparado para ser ejecutado íntegramente en contenedores Docker mediante `docker-compose`.

---
*Desarrollado para creadores que buscan maximizar su presencia en X.*
