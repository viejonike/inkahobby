---
Task ID: 1
Agent: Main Agent
Task: Agregar área de descarga de la app en la página de login (Android APK + iPhone "Agregar a inicio")

Work Log:
- Leí los archivos actuales del proyecto (page.tsx, LoginScreen.tsx, manifest.json, layout.tsx, sw.js)
- Detecté que no existía ningún botón/área de descarga en la página
- Copié el APK (InkaHobby.apk) a /public/ para que sea servido como archivo estático descargable
- Reescribí LoginScreen.tsx con sección de descarga colapsable "Instalar InkaHobby"
- Detecta plataforma automáticamente (Android/iOS/Desktop) y muestra opciones relevantes
- Android: Botón "Descargar APK" + "Instalar en dispositivo" (si beforeinstallprompt disponible)
- iOS: Instrucciones paso a paso con iconos (Compartir → Agregar a pantalla de inicio)
- Desktop: Muestra ambas opciones
- Actualicé manifest.json con screenshots y mejor configuración PWA
- Actualicé layout.tsx con meta tags completos de Apple (apple-touch-icon, apple-mobile-web-app-capable, etc.)
- Build exitoso sin errores

Stage Summary:
- LoginScreen ahora tiene sección "Instalar InkaHobby" colapsable
- APK disponible en /InkaHobby.apk para descarga directa
- PWA correctamente configurada para instalación en iPhone (Safari) y Android (Chrome)
- Archivos modificados: LoginScreen.tsx, manifest.json, layout.tsx
- Archivos añadidos: /public/InkaHobby.apk
