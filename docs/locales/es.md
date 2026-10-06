# PopChat for Twitch

Extensión no oficial, no proporcionada ni avalada por Twitch.

## Instalar el paquete local

1. Extrae el ZIP de ejecución/tienda en una carpeta propia. `manifest.json` está en la raíz del ZIP.
2. Abre `chrome://extensions` en Chrome o `edge://extensions` en Edge y activa el modo de desarrollador.
3. Elige “Cargar descomprimida” y selecciona esa misma carpeta extraída. Si usas el ZIP de código fuente, selecciona `popchat-for-twitch/extension` dentro del paquete extraído. En ambos casos, elige la carpeta que contiene directamente `manifest.json`.
4. Al instalarla por primera vez, se abre automáticamente una página local de la extensión en una pestaña nueva. Revisa la información y elige “Activar” si estás de acuerdo. Elige “Ahora no” para dejarla desactivada.
5. Recarga las páginas de Twitch si es necesario.

La ventana de la extensión en la barra de herramientas muestra si está activada. Elige “Ayuda y ajustes” para abrir la página dedicada o volver a su pestaña si ya está abierta. Puedes activar o desactivar las funciones desde esa página en cualquier momento.

## Uso

En la página de un canal de Twitch en directo, haz clic en la rueda dentada del reproductor. Elige “Ventana emergente” para una ventana normal o “Ventana emergente (siempre visible)” para mantenerla por encima de las demás. Elige la disposición del chat en la parte superior de la ventana pequeña.

AUTO se adapta a la ventana; SIDE coloca el chat a la derecha; BOTTOM lo coloca debajo del vídeo; HIDE lo oculta manteniéndolo cargado. Elige otro modo para volver a mostrarlo. “Recargar” actualiza el chat oficial. “Otra ventana” abre solo el chat oficial por separado.

Mantén abierta la pestaña original de Twitch mientras uses la ventana siempre visible. Si cierras, recargas o cambias de página en la pestaña original, la ventana pequeña también se cierra. Al cerrar la ventana pequeña, el vídeo vuelve a la pestaña original.

## Compatibilidad y límites

Para Chrome y Edge de escritorio con Document Picture-in-Picture (Chromium 116 o posterior). No incluye móviles, Firefox, VOD ni clips. La opción solo se añade si la extensión reconoce la estructura del menú de Twitch; una actualización de Twitch podría impedir que aparezca. Cerrar, recargar o cambiar de página en la pestaña original cierra la ventana siempre visible. Algunos ajustes y elementos superpuestos del reproductor de Twitch no acompañan al vídeo. El inicio de sesión y el envío de mensajes dependen de Twitch y de los ajustes del navegador.

La ventana siempre visible usa Document Picture-in-Picture. Esta función no añade chat al PiP normal que solo muestra vídeo.

## Privacidad

Una vez activada, la extensión usa localmente la URL del canal actual, el elemento de vídeo existente y la estructura del reproductor y del menú para organizar vídeo y chat. El chat oficial se conecta directamente a Twitch y puede usar tu sesión de Twitch. Solo se guardan localmente los ajustes de visualización y tu decisión de consentimiento; no se envían datos al desarrollador.

La extensión no lee la URL del canal ni la estructura del reproductor o del menú, ni carga el chat oficial, hasta que la actives. Abre “Ayuda y ajustes” desde la ventana de la extensión en la barra de herramientas y elige “Desactivar” en la página dedicada para retirar tu consentimiento. Se cierran el chat integrado y la ventana siempre visible gestionados por la extensión y se devuelve el vídeo a su lugar, manteniendo tus ajustes de visualización.

La extensión no tiene análisis, publicidad ni servidor propio. Lee el canal de la URL actual solo para mostrar su chat oficial. Solo guarda el modo de disposición, el ancho y alto de la ventana y tu decisión de consentimiento en el almacenamiento local de la extensión, sin sincronización. No guarda chats, historial de navegación, nombres de canales o usuarios, credenciales ni cookies, y no lee el contenido del marco del chat oficial. Los elementos integrados oficiales se conectan directamente a Twitch y usan su sesión cuando lo permite el navegador. Twitch gestiona el inicio de sesión y el chat según sus propias políticas. Solo se usa el permiso storage, en páginas HTTPS de www.twitch.tv y player.twitch.tv.

## Actualizar

Cierra la ventana pequeña. Sustituye toda la carpeta cargada en la misma ruta registrada en el navegador, sin mezclar archivos nuevos con los antiguos. Recarga la extensión en el gestor de extensiones del navegador y después todas las páginas de Twitch abiertas. Las actualizaciones normales conservan los ajustes de disposición guardados.

Las actualizaciones y el inicio del navegador no abren automáticamente la página de ayuda. También se conserva tu decisión de consentimiento guardada en la versión 1.5.0. Los ajustes de visualización existentes no cuentan por sí solos como consentimiento. Al actualizar desde una versión sin confirmación de consentimiento, abre “Ayuda y ajustes” desde la ventana de la extensión en la barra de herramientas, revisa la información y elige “Activar” antes de usar las funciones.
