# Usar imagen oficial de Playwright con Python
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de requerimientos e instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Instalar navegadores de Playwright (solo necesarios si no están en la imagen base)
RUN python -m patchright install chromium

# Copiar el resto del código del proyecto
COPY . .

# Asegurar que la carpeta de subidas exista
RUN mkdir -p uploads

# Exponer el puerto del API
EXPOSE 8000

# Variables de entorno por defecto
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

# Comando para iniciar el backend
# Nota: Esto también iniciará el scheduler configurado en backend/main.py
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
