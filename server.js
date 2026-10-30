const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const carpeta = __dirname;
const puerto = 4173;

const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

const servidor = http.createServer((req, res) => {
  const rutaURL = new URL(req.url, `http://127.0.0.1:${puerto}`);
  let ruta = decodeURIComponent(rutaURL.pathname);

  if (ruta === '/') {
    ruta = '/index.html';
  }

  const archivo = path.resolve(carpeta, '.' + ruta);

  if (!archivo.startsWith(carpeta + path.sep) && archivo !== path.join(carpeta, 'index.html')) {
    res.writeHead(403);
    res.end('Acceso denegado');
    return;
  }

  fs.readFile(archivo, (error, contenido) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No se encontró el archivo: ' + ruta);
      return;
    }

    res.writeHead(200, {
      'Content-Type': tipos[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });

    res.end(contenido);
  });
});

servidor.listen(puerto, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${puerto}`;
  console.log('MARS MATH BASE disponible en: ' + url);
  exec(`start "" "${url}"`);
});

servidor.on('error', (error) => {
  console.error('No se pudo iniciar el servidor:', error.message);
});