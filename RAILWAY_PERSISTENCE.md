# Persistencia en Railway (SQLite)

Si estás usando Railway y notas que tus publicaciones desaparecen después de cada despliegue (redeploy), es porque el sistema de archivos de Railway es efímero. Para solucionarlo, debes configurar un **Volume**:

1. Ve a tu proyecto en Railway.
2. Haz clic en **+ New** -> **Volume**.
3. Ponle un nombre (ej: `app_data`) y móntalo en la ruta `/app/` (o una subcarpeta como `/app/data`).
4. En las **Variables** de tu servicio `backend`, asegúrate de tener:
   - `DATABASE_URL=sqlite:////app/x_scheduler.db` (fíjate en las 4 barras `/` iniciales para indicar ruta absoluta).

Esto asegurará que el archivo `x_scheduler.db` se guarde en el volumen persistente y no se borre al reiniciar o actualizar la app.
