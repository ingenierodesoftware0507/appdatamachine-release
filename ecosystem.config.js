// ecosystem.config.js
// Configuración de PM2 para producción. Se copia a release\ junto a main.js (ver DESPLIEGUE.md).
// Uso en el servidor: pm2 start ecosystem.config.js && pm2 save
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'datasim_prod',
      script: 'main.js',
      // Obligatorio: el .env se lee de la carpeta de trabajo, que debe ser la de main.js.
      cwd: __dirname,
      out_file: path.join(__dirname, 'logs', 'out.log'),
      error_file: path.join(__dirname, 'logs', 'err.log'),
      time: true, // antepone fecha y hora a cada línea del log
      autorestart: true,
      restart_delay: 5000, // si se cae (p. ej. equipo Modbus no disponible), esperar 5 s antes de reintentar
    },
  ],
};
