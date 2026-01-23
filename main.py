import uvicorn
import os
import sys
from loguru import logger

# Asegurar que el directorio actual esté en el PATH para resolver el paquete 'backend'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.main import app

if __name__ == "__main__":
    # Railway y otros servicios PaaS proporcionan el puerto en la variable de entorno 'PORT'
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"Starting X Scheduler on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
