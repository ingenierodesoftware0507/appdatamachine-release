# appdatamachine – Despliegue a producción

## En el PC de desarrollo: generar el paquete

```
cd "D:\Brayan Leon\PROYECTOSOFTECRTM\appdatamachine"
npm run release
```

Crea la carpeta `release\` con el código compilado y ofuscado (sin `.map`, sin `.d.ts`, sin `.env`).
Esa carpeta es lo único que se lleva al servidor. Comprímala en un `.zip`.

- `npm run build:prod` solo compila a `build\` (sin ofuscar).
- `npm run ofuscar` solo ofusca lo ya compilado.
- `npm run start:prod` arranca `release\main.js` localmente (usa el `.env` de la raíz).

## En el servidor (Windows)

1. Instalar Node.js LTS, de la misma versión mayor que en desarrollo (`node -v`).
2. Descomprimir `release` en `C:\appdatamachine\`.
3. Instalar dependencias de producción:
   ```
   cd C:\appdatamachine
   npm ci --omit=dev
   npm.cmd ci --omit=dev
   ```
   (Sin internet en el servidor: ejecutar este mismo comando en el PC de desarrollo sobre la carpeta
   copiada y llevar también `node_modules`; debe ser Windows de 64 bits con la misma versión de Node.)
4. Crear el `.env`: copiar `.env.example` como `.env` en la MISMA carpeta que `main.js` y completar
   todos los valores (todos son obligatorios; si falta uno el servidor no arranca), excepto los del
   luxómetro real, que son opcionales (ver sección "Luxómetro").
5. Probar: `node main.js`. Debe decir "Nest application successfully started".
   **El primer arranque después de `npm ci` puede tardar cerca de 20 segundos en Windows
   (antivirus revisando los archivos nuevos); no lo interrumpa. Los siguientes tardan ~2 s.**
   Desde otro PC abrir `http://IP_DEL_SERVIDOR:PUERTO/analizador/estado-conexion` (debe responder JSON).
   Detener con Ctrl+C.
6. Abrir el puerto en el firewall (CMD como administrador; usar el PORT del `.env`):
   ```
   netsh advfirewall firewall add rule name="appdatamachine" dir=in action=allow protocol=TCP localport=3000
   ```
7. Instalar PM2 como servicio de Windows con pm2-installer (https://github.com/jessety/pm2-installer).
   `pm2 startup` NO funciona en Windows; sin este paso la app no arranca al reiniciar el servidor
   si nadie inicia sesión. Se hace una sola vez por servidor.
   - Requisito: Node.js instalado con el instalador oficial (NO con NVM for Windows).
   - Descomprimir el repositorio en una ruta fija, p. ej. `C:\pm2-installer` (no borrarla después:
     se usa para desinstalar).
   - En CMD **como administrador** (clic derecho → Ejecutar como administrador):
   ```
   cd C:\pm2-installer
   npm run configure
   npm run configure-policy
   npm run setup
   ```
   - `configure`: crea `C:\ProgramData\npm\` y hace que npm instale los paquetes globales ahí, donde el
     usuario del servicio (`LOCAL SERVICE`) puede leerlos.
   - `configure-policy`: permite ejecutar scripts de PowerShell (`RemoteSigned`); lo necesita `setup`.
   - `setup`: instala `pm2` y `pm2-logrotate` globalmente y crea el servicio de Windows `pm2`,
     con sus datos en `C:\ProgramData\pm2`.
   - Sin internet en el servidor: en un PC con internet y el mismo Windows, dentro de `pm2-installer`,
     ejecutar `npm run bundle`, copiar la carpeta completa al servidor y ahí ejecutar los tres comandos
     de arriba (`setup` detecta que no hay internet y usa lo descargado).
   - Cerrar esa consola y abrir **una nueva como administrador** (para que tome las variables nuevas).
     Verificar:
     ```
     pm2 --version
     pm2 list
     sc query pm2
     ```
     `sc query pm2` debe decir `STATE : 4 RUNNING`.
   - Para desinstalar: en `C:\pm2-installer` como administrador, `npm run remove` y luego `npm run deconfigure`.
8. Dar permisos al usuario del servicio (`LOCAL SERVICE`) sobre la carpeta y registrar la app:
   ```
   mkdir C:\appdatamachine\logs
   icacls C:\appdatamachine /grant "LOCAL SERVICE":(OI)(CI)RX
   icacls C:\appdatamachine\logs /grant "LOCAL SERVICE":(OI)(CI)M
   cd C:\appdatamachine
   pm2 start ecosystem.config.js
   pm2 save
   ```
   `pm2 save` es obligatorio: guarda la lista de apps que el servicio levanta al reiniciar Windows.
   El `ecosystem.config.js` fija la carpeta de trabajo en la de `main.js`, de donde se lee el `.env`.
   Verificar con `pm2 status` (debe decir `online`) y reiniciar el servidor una vez para confirmar
   que la app sube sola.
9. En cada navegador de AppData, la URL del servidor es `http://IP_DEL_SERVIDOR:PUERTO/`.
   Para cambiarla en un navegador ya configurado: en la consola del navegador
   `localStorage.removeItem('urlserver')` y recargar.

## Luxómetro

appdatamachine levanta un servidor TCP que hace de luxómetro, y la app de pista (Cordova) se conecta a él
como cliente con la `ip`/`puerto` que tenga la máquina en la BD (`getConfMaquina`). Un servidor TCP solo
puede escuchar en una IP del propio PC, así que la app debe apuntar a la IP del PC donde corre
appdatamachine, no a la del equipo real (dos equipos no pueden tener la misma IP en la red).

### Modo puente (equipo real + simulador)

Con el modo puente, la app se conecta a appdatamachine y este reenvía todo al luxómetro real en ambos
sentidos. Así la prueba real funciona normal y además se pueden inyectar tramas simuladas con
`POST /lucesmixta/enviar-dato`.

```
App (tablet) ──► appdatamachine 192.168.40.15:20 ──► Luxómetro real 192.168.40.60:<puerto>
```

1. En el `.env`:
   ```
   # Donde escucha appdatamachine (IP del PC del simulador; la app se conecta aquí)
   IPLUXOEMTROMIXTA = 192.168.40.15
   PUERTOLUXOMETROMIXTA = 20
   IPLUXOMETROMOTOS = 192.168.40.15
   PUERTOLUXOMETROMOTOS = 20

   # Luxómetro REAL (opcional: vacío = solo simulador, sin puente)
   IPLUXOMETROREALMIXTA = 192.168.40.60
   PUERTOLUXOMETROREALMIXTA = <puerto del equipo real>
   IPLUXOMETROREALMOTOS =
   PUERTOLUXOMETROREALMOTOS =
   ```
   Estas cuatro variables `...REAL...` son las únicas opcionales del `.env`. Si el puerto real va vacío
   se usa el mismo puerto del simulador.
2. En la BD, en la configuración de la máquina luxómetro, poner `ip` = `192.168.40.15` y `puerto` = `20`
   (la IP/puerto de appdatamachine, no los del equipo real).
3. Abrir el puerto del simulador en el firewall del PC (CMD como administrador):
   ```
   netsh advfirewall firewall add rule name="appdatamachine luxometro" dir=in action=allow protocol=TCP localport=20
   ```
4. Reiniciar appdatamachine (`pm2 restart datasim_prod`). El puente se levanta solo al arrancar; en el
   log (`pm2 logs datasim_prod`) debe salir `Servidor TCP escuchando en ... (puente hacia 192.168.40.60:...)`.
5. Al abrir la prueba de luces en la app deben salir `Cliente conectado` y `Puente conectado al equipo`.

Qué hace el simulador de luces de AppData en modo puente:
- **Conectar** (`iniciar-servidor`): activa la simulación. No abre sockets nuevos; mientras está activa,
  lo que manda el equipo real se bloquea y a la app solo le llegan las tramas de **Enviar** (`enviar-dato`).
- **Desconectar** (`detener-servidor`): desactiva la simulación. No cierra nada; el equipo real vuelve a
  transmitir a la app.
- El socket del puente nunca se cierra por AppData, solo al detener appdatamachine.
- Sin IP real en el `.env` funciona como antes: Conectar abre el socket y Desconectar lo cierra.

Notas:
- Si el equipo real no responde o se cae, la app sigue conectada al simulador y appdatamachine reintenta
  la conexión con el equipo cada 3 segundos.
- Muchos conversores TCP-serial de estos equipos aceptan una sola conexión: mientras el puente esté
  conectado, nadie más puede conectarse directo al luxómetro real.
- Luxómetro Moon (modo "Moon" en el simulador de AppData): la app pregunta (ID, ST, FN, AB) y el
  simulador responde. **Enviar** no le manda nada a la app: guarda el valor, y se entrega cuando la app
  pide la medición (FN, al terminar la cuenta regresiva de "recibiendo información"). Por eso hay que
  enviar todas las luces antes de que la app pida el FN. En modo puente, mientras la simulación está
  activa responde el simulador; si no, responde el equipo real.
- Luxómetro Capelec 2 serial (modo "Capelec 2 serial"): igual que Moon, **Enviar** guarda el valor. El
  simulador confirma la placa (`0900`) y, cuando en la app se presiona **TRAER DATOS**, entrega de una sola
  vez todas las luces enviadas (con su inclinación en las bajas) y la marca de fin (`0905`). Si no se ha
  enviado ninguna luz responde "sin resultados" (`0906`). Cada TRAER DATOS cuenta como una toma en la app,
  así que entre tomas actualice los valores en AppData.
- Luxómetro Capelec 2 (modo "Capelec 2 (ticket)"): el equipo imprime un ticket de texto por el socket.
  **Enviar** guarda cada luz y el botón **Dato tomado** le manda a la app el ticket con todas juntas
  (bajas con inclinación siempre; altas y antinieblas solo si se enviaron). La intensidad va en enteros de
  3 dígitos (como el equipo real); el decimal lo agrega la app si la máquina tiene `decimal = 1`.
- Luxómetro Capelec (modo "Capelec (archivo RES)"): este equipo **no usa socket**. La app consulta por
  HTTP `http://{ipLux}/et/index.php/pruebas/luxometro/CRluxometro` (setCG / getRES / delRES). Para
  simularlo, en la configuración de la máquina en la BD ponga `ipLux` = `192.168.40.15:3000` (IP y PORT de
  appdatamachine). **Enviar** guarda cada luz y **Dato tomado** deja el archivo RES listo; la app lo lee en
  su siguiente consulta (cada 1 s) y luego lo borra. La app convierte la luz con `round3625(valor) * 0.625`,
  así que puede variar en la 2.ª-4.ª cifra decimal (ej. 41,2 → 41,1875), igual que con el equipo real.
- Moon livianos: si se envió algún valor de antiniebla, la respuesta usa el orden con antinieblas
  (6 luces); si no, el de 4 luces. Debe coincidir con el número de antinieblas elegido en la app.
- Para volver a conectar la app directo al equipo real, poner de nuevo en la BD `ip` = `192.168.40.60`
  y su puerto.

## Actualizar una versión

1. En desarrollo: `npm run release` y comprimir `release`.
2. En el servidor (CMD como administrador): `pm2 stop datasim_prod`.
3. Reemplazar los archivos de `C:\appdatamachine\` por los nuevos, **conservando `.env`, `node_modules`
   y `logs`**. Solo si cambió `package.json`, ejecutar de nuevo `npm ci --omit=dev`.
4. `pm2 restart datasim_prod`. Si cambió `ecosystem.config.js`, en su lugar:
   `pm2 delete datasim_prod`, `pm2 start ecosystem.config.js` y `pm2 save`.

## Actualizar desde AppData (Descargas → Backend)

Alternativa automática a "Actualizar una versión", para cuando AppData corre en el mismo PC que el backend.

**Publicar (PC de desarrollo):** subir la versión en `package.json` y ejecutar `npm run publicar`. Compila,
ofusca y sube `release\` al repo `ingenierodesoftware0507/appdatamachine-release` (clon local en
`..\appdatamachine-release` o en la ruta de la variable `RELEASE_REPO_DIR`), con el tag `v<versión>`.
`npm run publicar -- --dry-run` solo muestra qué cambiaría.

**Instalar (servidor):** en AppData → Descargas → "¿Qué desea actualizar?" → Backend → Actualizar backend.
`scripts\actualizar-backend.ps1` de AppData clona el repo, instala dependencias en una carpeta temporal solo si
cambió `package-lock.json` (con la app aún corriendo), hace copia de seguridad, `pm2 stop`, reemplaza
conservando `.env` y `logs`, `pm2 start ecosystem.config.js`, `pm2 save` y verifica que quede online. Si algo
falla restaura la versión anterior. Variables opcionales en el `.env` de AppData: `BACKEND_PATH`
(`C:\appdatamachine`), `BACKEND_REPO_URL`, `BACKEND_PM2_NAME` (`datasim_prod`).

## Comandos útiles de PM2

- `pm2 status` – estado de la app (online, stopped, errored) y número de reinicios.
- `pm2 logs datasim_prod` – ver el log en vivo (Ctrl+C para salir). Archivos en `C:\appdatamachine\logs\`.
- `pm2 monit` – consumo de CPU y memoria en vivo.
- `pm2 restart datasim_prod` – reiniciar (p. ej. después de cambiar el `.env`).
- La rotación de logs (`pm2-logrotate`) ya la instala pm2-installer; no hay que hacer nada más.
- Los comandos `pm2` se ejecutan siempre en CMD como administrador.

## Notas

- El ofuscado dificulta leer el código, no lo cifra. Los nombres de clases y de las variables del `.env`
  siguen visibles, y `node_modules` no se ofusca.
- No active `renameProperties` ni `selfDefending` en `scripts/ofuscar.js`: rompen los campos JSON de los
  DTO y pueden impedir el arranque.
- El `.env` contiene las IPs de los equipos: restrinja el acceso a la carpeta del servidor.
