# INSTRUCCIONES PARA RAILWAY - COPIAR Y PEGAR

## Paso 1: Ve a Railway
1. Abre https://railway.app
2. Selecciona tu proyecto `x_scheduler`
3. Ve a la pestaña **Variables**

## Paso 2: Agrega la Primera Variable

Haz clic en **+ New Variable** y configura:

**Variable Name:**
```
X_COOKIES_JSON
```

**Variable Value:** (copia TODO el bloque de abajo, desde la primera llave `{` hasta la última `}`)

```json
{
    "cookies": [
        {
            "domain": ".x.com",
            "expires": 1769096878.664631,
            "httpOnly": true,
            "name": "__cf_bm",
            "path": "/",
            "sameSite": "None",
            "secure": true,
            "value": "AvrdYLayXmJhk4g3DnRxhQ6s1vFmCgNH5VLR6eaVL38-1769095076.9635973-1.0.1.1-K3d1bQOP_wTA3nlERE.h5HprS04G76cgjjOHjuJtQwtzlIXPEjO8aNGoDh3SEl1NrUTJWPgSwxmO4mhnqJfawQRPhnFKYEY3gNt7DwleWQW1IRUrR9LTQ46qwIGkqP9g"
        },
        {
            "domain": ".x.com",
            "expires": 1803655067,
            "httpOnly": false,
            "name": "__cuid",
            "path": "/",
            "sameSite": "Lax",
            "secure": false,
            "value": "db6c436f935f48c482b94a2eea4fc0f1"
        },
        {
            "domain": ".x.com",
            "expires": 1769154481.291673,
            "httpOnly": true,
            "name": "att",
            "path": "/",
            "sameSite": "None",
            "secure": true,
            "value": "1-S7820IYQ5VWpoCkHhNcSvxpZjKLFNvzKziN4DzuJ"
        },
        {
            "domain": ".x.com",
            "expires": 1803628078.350585,
            "httpOnly": true,
            "name": "auth_token",
            "path": "/",
            "sameSite": "None",
            "secure": true,
            "value": "d150400db5d817dcb524c7030acf7dd0be7d9716"
        },
        {
            "domain": ".x.com",
            "expires": 1803628078.646867,
            "httpOnly": false,
            "name": "ct0",
            "path": "/",
            "sameSite": "Lax",
            "secure": true,
            "value": "53b3a96b26eb1aefa79bb0ba2825522c28df276fee7b84a38c3a92ab840bc46821c377626d7a85b47f1abe33746b0eaba755dbc10763e47124044e13e20dbc01b133062cebf8f251cf47474c2d6d592b"
        },
        {
            "domain": ".x.com",
            "expires": 1769672555.990343,
            "httpOnly": false,
            "name": "external_referer",
            "path": "/",
            "sameSite": "None",
            "secure": true,
            "value": "padhuUp37zh6Cref6jvj%2BPtO9lYzutOI|0|8e8t2xd8A2w%3D"
        },
        {
            "domain": ".x.com",
            "expires": 1784827243.013066,
            "httpOnly": false,
            "name": "guest_id",
            "path": "/",
            "sameSite": "None",
            "secure": true,
            "value": "v1%3A175026724483122364"
        },
        {
            "domain": ".x.com",
            "expires": 1803655064.110685,
            "httpOnly": false,
            "name": "guest_id_ads",
            "path": "/",
            "sameSite": "None",
            "secure": true,
            "value": "v1%3A175026724483122364"
        },
        {
            "domain": ".x.com",
            "expires": 1803655064.111369,
            "httpOnly": false,
            "name": "guest_id_marketing",
            "path": "/",
            "sameSite": "None",
            "secure": true,
            "value": "v1%3A175026724483122364"
        },
        {
            "domain": ".x.com",
            "expires": 1803628078.350117,
            "httpOnly": true,
            "name": "kdt",
            "path": "/",
            "sameSite": "None",
            "secure": true,
            "value": "9tIuoarLDLpXstQQaDTT7z6BtEyYsEUOzUGT1BDj"
        },
        {
            "domain": ".x.com",
            "expires": 1803628007.200049,
            "httpOnly": false,
            "name": "personalization_id",
            "path": "/",
            "sameSite": "None",
            "secure": true,
            "value": "\"v1_tUFAyNu1w1c0cZRq/w1b2Q==\""
        },
        {
            "domain": ".x.com",
            "expires": 1800631068.426347,
            "httpOnly": false,
            "name": "twid",
            "path": "/",
            "sameSite": "None",
            "secure": true,
            "value": "u%3D1993875679830790146"
        }
    ],
    "origins": []
}
```

## Paso 3: Agrega la Segunda Variable

Haz clic en **+ New Variable** nuevamente y configura:

**Variable Name:**
```
X_USERNAME
```

**Variable Value:**
```
bytehazard_
```

## Paso 4: Guarda y Redeploy

Railway detectará los cambios automáticamente y reiniciará el servidor. ¡Listo!

---

> [!IMPORTANT]
> Estas cookies contienen tu sesión activa de X. **NO las compartas con nadie** y asegúrate de que tu repositorio de Railway sea privado.
