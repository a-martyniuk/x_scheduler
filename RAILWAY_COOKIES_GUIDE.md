# Guía: Transferir Cookies de X a Railway

Esta guía te permitirá usar las cookies de sesión de X que generaste localmente en tu servidor de Railway.

## Paso 1: Obtener las Cookies Locales

1. Abre el archivo `d:\Projects\x_scheduler\worker\cookies.json` en tu editor de texto.
2. **Copia TODO el contenido** del archivo (es un JSON grande con todas tus cookies de sesión).

## Paso 2: Convertir a Variable de Entorno

Railway no permite subir archivos directamente, así que usaremos variables de entorno.

1. Ve a tu proyecto en Railway: https://railway.app
2. Selecciona tu servicio `x_scheduler`.
3. Ve a la pestaña **Variables**.
4. Haz clic en **+ New Variable**.
5. Configura:
   - **Name**: `X_COOKIES_JSON`
   - **Value**: Pega TODO el contenido del archivo `cookies.json` que copiaste.

> [!WARNING]
> Asegúrate de copiar el JSON completo, incluyendo las llaves `{` y `}` de apertura y cierre.

## Paso 3: Agregar Variable de Usuario

También necesitamos decirle al sistema qué usuario usar:

1. En la misma sección de Variables, agrega otra:
   - **Name**: `X_USERNAME`
   - **Value**: `bytehazard_` (o el nombre de usuario que usaste para el login)

## Paso 4: Redeploy

1. Haz clic en **Deploy** o simplemente espera a que Railway detecte los cambios.
2. El servidor se reiniciará automáticamente y cargará las cookies desde la variable de entorno.

## Verificación

Una vez que el deploy termine:
1. Ve a tu frontend en Vercel.
2. Deberías ver tu cuenta como "En Línea" en la barra lateral.
3. Intenta crear y programar un post de prueba.

---

## Renovación de Cookies (Cuando Expiren)

Las cookies de X eventualmente expirarán (días o semanas). Cuando eso pase:

1. Ejecuta `python -m worker.manual_login` en tu PC local.
2. Vuelve a copiar el nuevo `cookies.json`.
3. Actualiza la variable `X_COOKIES_JSON` en Railway.
4. Redeploy.

---

> [!NOTE]
> Este método es temporal pero funcional. Para una solución más robusta a largo plazo, considera usar un proxy residencial o un VPS con IP no bloqueada.
