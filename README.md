# X Scheduler Pro - Command Center

Una plataforma premium para la programación y análisis de hilos en X (Twitter), con soporte para hilos automáticos, analíticas en tiempo real y gestión de medios.

## ✨ Características

- **Gestión de Hilos**: Crea secuencias de posts programables con soporte para hilos.
- **Analíticas en Tiempo Real**: Visualiza vistas, likes y reposts directamente en el panel.
- **Sistema Premium**: Diseño responsive con modo oscuro/claro sincronizado y estética moderna.
- **Multimedia**: Soporte para hasta 4 imágenes o 1 video por post.
- **Automatización**: Scraper integrado que publica y recolecta métricas de forma autónoma.

## 🚀 Instalación y Despliegue

### Backend (FastAPI)
1. Instala las dependencias:
   ```bash
   pip install -r requirements.txt
   ```
2. Inicia el servidor:
   ```bash
   uvicorn backend.main:app --reload
   ```

### Frontend (React + Vite)
1. Entra en la carpeta frontend e instala:
   ```bash
   cd frontend
   npm install
   ```
2. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

### Worker (Playwright)
1. Instala los navegadores necesarios:
   ```bash
   playwright install
   ```
2. Realiza el login manual inicial para generar cookies:
   ```bash
   python -m worker.manual_login
   ```

## 🛠️ Tecnologías
- **Frontend**: React, TypeScript, Tailwind CSS, Lucide, FullCalendar.
- **Backend**: FastAPI, SQLAlchemy, SQLite, APScheduler.
- **Automatización**: Playwright.

## 📄 Notas de Entrega
El proyecto ha sido limpiado de archivos temporales y logs. Se ha incluido un archivo `.gitignore` para proteger las bases de datos locales y sesiones sensibles.
