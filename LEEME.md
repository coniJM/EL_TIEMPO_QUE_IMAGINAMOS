# El tiempo que imaginamos

## Usar en la red local

En el computador que hará de servidor, abre una terminal dentro de esta carpeta y ejecuta:

~~~sh
node js/servidor.js
~~~

La experiencia queda en http://localhost:8787 y la visualización independiente en http://localhost:8787/visualizacion.html.

Para abrirlas desde otros dispositivos conectados a la misma red Wi-Fi, reemplaza localhost por la IP local del computador. Mantén el servidor abierto.

Las respuestas locales se guardan en data/respuestas.json. Ese archivo está excluido de Git porque puede contener reflexiones de participantes.

## Publicar para que otras personas accedan por internet

El repositorio incluye render.yaml y package.json para desplegar el servidor en Render. Para que las respuestas compartidas no se pierdan cuando Render reinicie, conecta una base de datos PostgreSQL de Supabase:

1. Sube el proyecto a GitHub.
2. Crea un proyecto de base de datos en Supabase. En Connect, copia la cadena de conexión de Session pooler (puerto 5432). Conserva la cadena en privado.
3. En Render, crea un Web Service desde el repositorio de GitHub y usa el archivo render.yaml, o configura el comando de inicio como npm start.
4. En la configuración del servicio de Render, agrega DATABASE_URL con la cadena de Supabase. No publiques esa cadena ni la guardes en el repositorio.
5. Cuando Render termine el despliegue, comparte la dirección del servicio. La experiencia es la página principal y la flor está en /visualizacion.html.

El servidor crea la tabla de respuestas al iniciar. Las reflexiones se muestran a quien abra la visualización, así que avisa a las personas participantes que sus respuestas serán visibles allí.

La modalidad gratuita puede dormir el servicio de Render tras inactividad y pausar una base de Supabase tras una semana con poca actividad. La primera visita después de dormir puede tardar en abrir.
