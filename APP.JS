
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const contenedor = document.getElementById('escena3d');
const mensajeCarga = document.getElementById('cargando');
const mensajeError = document.getElementById('error3d');

let escena;
let camara;
let renderizador;
let controles;
let reloj;

let rover;
let grupoTerreno;
let grupoBase;
let grupoPaneles;
let grupoRuta;
let grupoRecursos;
let grupoTrayectoriaMatematica;
let grupoLaboratorio;
let grupoEstacion;
let ruedasRover = [];

let curvaRuta;
let rutasRover = {};
let rutaActual = 'principal';
let parametroRutaRover = 0;
let velocidadRuta = 0;

let xRover = -4.5;
let zRover = -2.7;
let velocidadX = 0;
let velocidadZ = 0;
let teclas = {};

const VELOCIDAD_ROVER = 3.0;

/* ==========================================
   INICIO Y MANEJO DE ERRORES
   ========================================== */

function mostrarError(error) {
  if (mensajeCarga) mensajeCarga.hidden = true;

  if (mensajeError) {
    mensajeError.hidden = false;
    mensajeError.textContent =
      'No se pudo cargar el modelo 3D.\n\n' +
      (error?.message || String(error)) +
      '\n\nComprueba tu conexión a internet y abre la página desde http://127.0.0.1:4173.';
  }

  console.error(error);
}

try {
  iniciar();
} catch (error) {
  mostrarError(error);
}

function iniciar() {
  if (!contenedor) {
    throw new Error('No se encontró el contenedor de la escena 3D.');
  }

  escena = new THREE.Scene();
  escena.background = new THREE.Color('#d4c3c0');
  escena.fog = new THREE.Fog('#d4c3c0', 28, 65);

  camara = new THREE.PerspectiveCamera(
    48,
    contenedor.clientWidth / contenedor.clientHeight,
    0.1,
    150
  );

  camara.position.set(13, 12, 16);

  renderizador = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
  });

  renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderizador.setSize(contenedor.clientWidth, contenedor.clientHeight);
  renderizador.outputColorSpace = THREE.SRGBColorSpace;
  renderizador.shadowMap.enabled = true;
  renderizador.shadowMap.type = THREE.PCFSoftShadowMap;

  contenedor.appendChild(renderizador.domElement);

  controles = new OrbitControls(camara, renderizador.domElement);
  controles.target.set(-0.5, 0.3, 0);
  controles.enableDamping = true;
  controles.dampingFactor = 0.06;
  controles.minDistance = 5;
  controles.maxDistance = 35;
  controles.maxPolarAngle = Math.PI * 0.48;
  controles.update();

  escena.add(new THREE.HemisphereLight('#fff0e8', '#76554d', 2.2));

  const luzSol = new THREE.DirectionalLight('#fff0d9', 3);
  luzSol.position.set(-8, 15, 8);
  luzSol.castShadow = true;
  escena.add(luzSol);

  grupoTerreno = new THREE.Group();
  grupoBase = new THREE.Group();
  grupoPaneles = new THREE.Group();
  grupoRuta = new THREE.Group();
  grupoRecursos = new THREE.Group();
  grupoTrayectoriaMatematica = new THREE.Group();
  grupoLaboratorio = new THREE.Group();
  grupoEstacion = new THREE.Group();

  escena.add(
    grupoTerreno,
    grupoBase,
    grupoPaneles,
    grupoRuta,
    grupoRecursos,
    grupoTrayectoriaMatematica,
    grupoLaboratorio,
    grupoEstacion
  );

  crearTerreno();
  crearRuta();
  crearRutasAdicionales();
  crearTrayectoriaMatematica();

  crearBase();
  crearBasePruebas();
  crearPaneles();
  crearRover();
  crearPiedras();
  crearCráteres();
  crearDomoHabitacional();
  crearZonaHieloYExtraccion();
  crearLaboratorio();
  crearEstacionMeteorologica();

  crearSelectorRutas();

  if (mensajeCarga) mensajeCarga.hidden = true;

  reloj = new THREE.Clock();

  configurarControles();
  configurarVisibilidad();
  configurarPestanas();

  window.addEventListener('resize', ajustarTamanio);

  actualizarCoordenadas();
  animar();
}

/* ==========================================
   FUNCIÓN DE ALTURA DEL TERRENO
   Se conserva la función que ya tenía el proyecto.
   ========================================== */

// Función matemática del informe: z = f(x,y).
// En Three.js el segundo eje horizontal del informe (y) se representa como z.
// Se conserva un desplazamiento vertical de 20 unidades para que las
// instalaciones existentes sigan apoyadas sobre el terreno sin moverlas.
function elevacionMatematica(x, y) {
  const exp1 = Math.exp(-((x - 3) ** 2 + (y - 7) ** 2) / 4);
  const exp2 = Math.exp(-((x - 7) ** 2 + (y - 3) ** 2) / 4);
  return 20 + 8 * exp1 - 6 * exp2 + 0.5 * x + 0.3 * y;
}

function altura(x, z) {
  return (elevacionMatematica(x, z) - 20) * 0.18;
}

function derivadaX(x, y) {
  const e1 = Math.exp(-((x - 3) ** 2 + (y - 7) ** 2) / 4);
  const e2 = Math.exp(-((x - 7) ** 2 + (y - 3) ** 2) / 4);
  return -4 * (x - 3) * e1 + 3 * (x - 7) * e2 + 0.5;
}

function derivadaY(x, y) {
  const e1 = Math.exp(-((x - 3) ** 2 + (y - 7) ** 2) / 4);
  const e2 = Math.exp(-((x - 7) ** 2 + (y - 3) ** 2) / 4);
  return -4 * (y - 7) * e1 + 3 * (y - 3) * e2 + 0.3;
}

function derivadasSegundas(x, y) {
  const h = 0.001;
  const f = elevacionMatematica;
  const fxx = (f(x + h, y) - 2 * f(x, y) + f(x - h, y)) / (h * h);
  const fyy = (f(x, y + h) - 2 * f(x, y) + f(x, y - h)) / (h * h);
  const fxy = (f(x + h, y + h) - f(x + h, y - h) - f(x - h, y + h) + f(x - h, y - h)) / (4 * h * h);
  return { fxx, fyy, fxy, discriminante: fxx * fyy - fxy * fxy };
}

/* ==========================================
   TERRENO Y CURVAS DE NIVEL
   ========================================== */

function crearTerreno() {
  const geometria = new THREE.PlaneGeometry(20, 20, 100, 100);
  geometria.rotateX(-Math.PI / 2);

  const posiciones = geometria.attributes.position;
  const colores = [];

  const colorBajo = new THREE.Color('#a66f68');
  const colorMedio = new THREE.Color('#c9958b');
  const colorAlto = new THREE.Color('#e3bdb0');

  for (let i = 0; i < posiciones.count; i++) {
    const x = posiciones.getX(i);
    const z = posiciones.getZ(i);
    const y = altura(x, z);

    posiciones.setY(i, y);

    const t = THREE.MathUtils.clamp((y + 0.8) / 2.1, 0, 1);

    const color = t < 0.5
      ? colorBajo.clone().lerp(colorMedio, t * 2)
      : colorMedio.clone().lerp(colorAlto, (t - 0.5) * 2);

    colores.push(color.r, color.g, color.b);
  }

  geometria.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colores, 3)
  );

  geometria.computeVertexNormals();

  const terreno = new THREE.Mesh(
    geometria,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0
    })
  );

  terreno.receiveShadow = true;
  grupoTerreno.add(terreno);

  const rejilla = new THREE.GridHelper(
    20,
    20,
    '#f5e4dd',
    '#bc8d83'
  );

  rejilla.position.y = -0.06;
  grupoTerreno.add(rejilla);

  // Curvas de nivel reales: cada línea une puntos con la misma elevación.
  // Se usa interpolación lineal sobre una cuadrícula y niveles equidistantes.
  const segmentosNivel = [];
  const n = 100;
  const min = -10;
  const paso = 20 / n;
  const valores = [];
  let minimo = Infinity;
  let maximo = -Infinity;
  for (let i = 0; i <= n; i++) {
    valores[i] = [];
    for (let j = 0; j <= n; j++) {
      const v = altura(min + i * paso, min + j * paso);
      valores[i][j] = v;
      minimo = Math.min(minimo, v);
      maximo = Math.max(maximo, v);
    }
  }
  const niveles = 7;
  for (let k = 1; k <= niveles; k++) {
    const nivel = minimo + (maximo - minimo) * k / (niveles + 1);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x0 = min + i * paso, x1 = x0 + paso;
        const z0 = min + j * paso, z1 = z0 + paso;
        const esquinas = [
          { x: x0, z: z0, v: valores[i][j] },
          { x: x1, z: z0, v: valores[i + 1][j] },
          { x: x1, z: z1, v: valores[i + 1][j + 1] },
          { x: x0, z: z1, v: valores[i][j + 1] }
        ];
        const cruces = [];
        for (let e = 0; e < 4; e++) {
          const a = esquinas[e], b = esquinas[(e + 1) % 4];
          if ((a.v < nivel && b.v >= nivel) || (b.v < nivel && a.v >= nivel)) {
            const t = (nivel - a.v) / (b.v - a.v);
            cruces.push(new THREE.Vector3(
              a.x + (b.x - a.x) * t,
              nivel + 0.045,
              a.z + (b.z - a.z) * t
            ));
          }
        }
        if (cruces.length >= 2) {
          segmentosNivel.push(cruces[0], cruces[1]);
          if (cruces.length === 4) segmentosNivel.push(cruces[2], cruces[3]);
        }
      }
    }
  }
  const curvasReales = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(segmentosNivel),
    new THREE.LineBasicMaterial({ color: '#f6e2d6', transparent: true, opacity: 0.88 })
  );
  curvasReales.name = 'Curvas de nivel matemáticas f(x,y)=constante';
  grupoTerreno.add(curvasReales);
}

/* ==========================================
   CREAR CARRETERAS Y RUTAS
   ========================================== */

function crearCarretera(curva, nombre, ancho = 1.15, color = '#716e70') {
  const segmentos = 140;
  const vertices = [];
  const indices = [];
  const bordeIzq = [];
  const bordeDer = [];

  for (let i = 0; i <= segmentos; i++) {
    const t = i / segmentos;
    const punto = curva.getPoint(t);
    const tangente = curva.getTangent(t).normalize();

    const nx = -tangente.z;
    const nz = tangente.x;
    const y = altura(punto.x, punto.z) + 0.12;

    vertices.push(
      punto.x + nx * ancho / 2, y,
      punto.z + nz * ancho / 2
    );

    vertices.push(
      punto.x - nx * ancho / 2, y,
      punto.z - nz * ancho / 2
    );

    bordeIzq.push(
      new THREE.Vector3(
        punto.x + nx * ancho / 2,
        y + 0.025,
        punto.z + nz * ancho / 2
      )
    );

    bordeDer.push(
      new THREE.Vector3(
        punto.x - nx * ancho / 2,
        y + 0.025,
        punto.z - nz * ancho / 2
      )
    );

    if (i < segmentos) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometria = new THREE.BufferGeometry();

  geometria.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );

  geometria.setIndex(indices);
  geometria.computeVertexNormals();

  const carretera = new THREE.Mesh(
    geometria,
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.96,
      side: THREE.DoubleSide
    })
  );

  carretera.receiveShadow = true;
  carretera.name = nombre;
  grupoRuta.add(carretera);

  for (const puntos of [bordeIzq, bordeDer]) {
    const linea = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(puntos),
        segmentos,
        0.025,
        6,
        false
      ),
      new THREE.MeshStandardMaterial({
        color: '#e5d7c9',
        roughness: 0.9
      })
    );

    grupoRuta.add(linea);
  }

  // Marcas centrales de la carretera.
  for (let t = 0.04; t < 0.98; t += 0.09) {
    const punto = curva.getPoint(t);
    const tangente = curva.getTangent(t).normalize();

    const marca = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.035, 0.065),
      new THREE.MeshStandardMaterial({ color: '#f4e8d7' })
    );

    marca.position.set(
      punto.x,
      altura(punto.x, punto.z) + 0.16,
      punto.z
    );

    marca.rotation.y = Math.atan2(tangente.x, tangente.z);
    grupoRuta.add(marca);
  }
}

function crearRuta() {
  const puntosRuta = [
    new THREE.Vector3(-4.5, 0, -2.7),
    new THREE.Vector3(-4.2, 0, -1.8),
    new THREE.Vector3(-3.2, 0, -1.0),
    new THREE.Vector3(-1.8, 0, -0.45),
    new THREE.Vector3(-0.2, 0, 0.0),
    new THREE.Vector3(1.5, 0, 0.75),
    new THREE.Vector3(3.0, 0, 1.65),
    new THREE.Vector3(4.25, 0, 2.35),
    new THREE.Vector3(5.4, 0, 2.8)
  ];

  curvaRuta = new THREE.CatmullRomCurve3(
    puntosRuta,
    false,
    'centripetal'
  );

  rutasRover.principal = curvaRuta;
  crearCarretera(curvaRuta, 'Carretera principal', 1.35);
}

/* ==========================================
   RUTAS INDEPENDIENTES DEL ROVER
   ========================================== */

function crearRutasAdicionales() {
  rutasRover.paneles = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.5, 0, -2.7),
    new THREE.Vector3(-4.2, 0, -4.0),
    new THREE.Vector3(-3.6, 0, -5.0),
    new THREE.Vector3(-2.7, 0, -5.8),
    new THREE.Vector3(-1.3, 0, -6.1),
    new THREE.Vector3(0.0, 0, -6.1)
  ]);

  rutasRover.agua = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.5, 0, -2.7),
    new THREE.Vector3(-2.8, 0, -1.7),
    new THREE.Vector3(-0.8, 0, -0.8),
    new THREE.Vector3(1.4, 0, 0.0),
    new THREE.Vector3(3.6, 0, 1.1),
    new THREE.Vector3(5.0, 0, 2.0),
    new THREE.Vector3(5.4, 0, 3.7)
  ]);

  rutasRover.base = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.5, 0, -2.7),
    new THREE.Vector3(-4.5, 0, -2.15),
    new THREE.Vector3(-4.5, 0, -1.35),
    new THREE.Vector3(-4.5, 0, -1.15)
  ]);

  // Ruta hacia la base de pruebas. Se aproxima por el lado norte
  // para evitar atravesar las instalaciones y los paneles solares.
  rutasRover.pruebas = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.5, 0, -2.7),
    new THREE.Vector3(-3.0, 0, -2.25),
    new THREE.Vector3(-1.0, 0, -1.9),
    new THREE.Vector3(1.0, 0, -1.9),
    new THREE.Vector3(2.6, 0, -2.25),
    new THREE.Vector3(3.6, 0, -3.0)
  ]);

  // Ruta hacia el aeropuerto espacial. Se aproxima por el lado norte
  // de la pista, sin cruzar su plataforma.
  rutasRover.aeropuerto = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.5, 0, -2.7),
    new THREE.Vector3(-2.8, 0, -1.8),
    new THREE.Vector3(-0.5, 0, -1.0),
    new THREE.Vector3(2.0, 0, -1.2),
    new THREE.Vector3(4.2, 0, -1.8),
    new THREE.Vector3(6.0, 0, -2.8),
    new THREE.Vector3(7.0, 0, -4.0)
  ]);

  rutasRover.laboratorio = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.5, 0, -2.7),
    new THREE.Vector3(-3.0, 0, 0.0),
    new THREE.Vector3(-1.5, 0, 2.0),
    new THREE.Vector3(0.0, 0, 3.2),
    new THREE.Vector3(1.8, 0, 4.2),
    new THREE.Vector3(3.0, 0, 4.7)
  ]);

  rutasRover.estacion = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.5, 0, -2.7),
    new THREE.Vector3(-5.0, 0, -4.0),
    new THREE.Vector3(-6.0, 0, -5.0),
    new THREE.Vector3(-7.0, 0, -5.8),
    new THREE.Vector3(-8.0, 0, -6.2)
  ]);

  crearCarretera(rutasRover.paneles, 'Ruta hacia paneles solares', 0.85, '#807b78');
  crearCarretera(rutasRover.agua, 'Ruta hacia extracción de agua', 0.85, '#807b78');
  crearCarretera(rutasRover.base, 'Ruta hacia base científica', 0.85, '#807b78');
  crearCarretera(rutasRover.laboratorio, 'Ruta hacia laboratorio', 0.85, '#807b78');
  crearCarretera(rutasRover.estacion, 'Ruta hacia estación meteorológica', 0.85, '#807b78');
  crearCarretera(rutasRover.pruebas, 'Ruta hacia base de pruebas', 0.85, '#807b78');
  crearCarretera(rutasRover.aeropuerto, 'Ruta hacia aeropuerto espacial', 0.85, '#807b78');

  crearPuntoDestino(-0.1, -6.1, 'PANELES SOLARES', '#f5e1a6');
  crearPuntoDestino(5.4, 3.7, 'EXTRACCIÓN DE AGUA', '#d9f5ff');
  crearPuntoDestino(-4.5, -1.15, 'BASE CIENTÍFICA', '#ffffff');
  crearPuntoDestino(3.6, -3.0, 'BASE DE PRUEBAS', '#ffffff');
  crearPuntoDestino(7.0, -4.0, 'AEROPUERTO ESPACIAL', '#d9e8f5');
  crearPuntoDestino(3.0, 4.7, 'LABORATORIO', '#d9e8f5');
  crearPuntoDestino(-8.0, -6.2, 'ESTACIÓN METEOROLÓGICA', '#ffffff');
}

function crearPuntoDestino(x, z, texto, color) {
  const y = altura(x, z);

  const aro = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.045, 8, 24),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25
    })
  );

  aro.rotation.x = Math.PI / 2;
  aro.position.set(x, y + 0.1, z);
  grupoRuta.add(aro);

  const etiqueta = crearEtiqueta(texto, color);
  etiqueta.position.set(x, y + 1.0, z);
  grupoRuta.add(etiqueta);
}

/* ==========================================
   SELECTOR DE RUTAS EN LA INTERFAZ
   Se crea automáticamente. No requiere HTML nuevo.
   ========================================== */

function crearSelectorRutas() {
  if (document.getElementById('selectorRutasRover')) return;

  const panel = document.createElement('div');
  panel.id = 'selectorRutasRover';

  panel.style.cssText = `
    position: absolute;
    z-index: 20;
    top: 12px;
    left: 12px;
    width: min(260px, calc(100% - 24px));
    padding: 12px;
    border-radius: 12px;
    background: rgba(43, 48, 54, 0.9);
    color: white;
    font-family: Arial, sans-serif;
    box-shadow: 0 4px 14px rgba(0,0,0,.25);
  `;

  panel.innerHTML = `
    <label for="destinoRover" style="display:block;font-weight:bold;margin-bottom:7px;">
      DESTINO DEL ROVER
    </label>
    <select id="destinoRover" style="
      width:100%;
      padding:9px;
      border-radius:7px;
      border:0;
      margin-bottom:8px;
      background:#f4eee9;
      color:#333;
    ">
      <option value="principal">Carretera principal</option>
      <option value="paneles">Paneles solares</option>
      <option value="agua">Extracción de hielo y agua</option>
      <option value="base">Base científica</option>
      <option value="pruebas">Base de pruebas</option>
      <option value="aeropuerto">Aeropuerto espacial</option>
      <option value="laboratorio">Laboratorio</option>
      <option value="estacion">Estación meteorológica</option>
    </select>
    <button id="iniciarRutaRover" type="button" style="
      width:100%;
      padding:9px;
      border:0;
      border-radius:7px;
      background:#c98778;
      color:white;
      font-weight:bold;
      cursor:pointer;
    ">IR AL DESTINO</button>
    <div id="nombreDestinoRover" style="margin-top:8px;font-size:12px;">
      Ruta seleccionada: carretera principal
    </div>
  `;

  contenedor.style.position = 'relative';
  contenedor.appendChild(panel);

  document.getElementById('destinoRover')?.addEventListener('change', evento => {
    const nombres = {
      principal: 'carretera principal',
      paneles: 'paneles solares',
      agua: 'extracción de hielo y agua',
      base: 'base científica',
      pruebas: 'base de pruebas',
      aeropuerto: 'aeropuerto espacial',
      laboratorio: 'laboratorio',
      estacion: 'estación meteorológica'
    };

    const texto = document.getElementById('nombreDestinoRover');
    if (texto) {
      texto.textContent = `Ruta seleccionada: ${nombres[evento.target.value]}`;
    }
  });

  document.getElementById('iniciarRutaRover')?.addEventListener('click', () => {
    const destino = document.getElementById('destinoRover')?.value;
    iniciarRutaDestino(destino);
  });
}

function iniciarRutaDestino(destino) {
  if (!rutasRover[destino]) return;

  rutaActual = destino;
  curvaRuta = rutasRover[destino];
  parametroRutaRover = 0;

  const puntoInicial = curvaRuta.getPointAt(0);
  xRover = puntoInicial.x;
  zRover = puntoInicial.z;

  rover.position.set(
    xRover,
    altura(xRover, zRover) + 0.02,
    zRover
  );

  const tangente = curvaRuta.getTangentAt(0);
  rover.rotation.y = Math.atan2(tangente.x, tangente.z);

  velocidadRuta = 1;
  actualizarCoordenadas();
  actualizarEstado('Rover viajando al destino seleccionado');
}

/* ==========================================
   TRAYECTORIA MATEMÁTICA DEL INFORME
   r(t) = (2 + 5 cos t, -3 + 5 sin t, 4)
   Se mantiene separada de las rutas operativas.
   ========================================== */

function crearTrayectoriaMatematica() {
  const puntos = [];
  const muestras = 240;

  for (let i = 0; i <= muestras; i++) {
    const t = (i / muestras) * Math.PI * 2;

    puntos.push(
      new THREE.Vector3(
        2 + 5 * Math.cos(t),
        4,
        -3 + 5 * Math.sin(t)
      )
    );
  }

  const trayectoria = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(puntos),
    new THREE.LineBasicMaterial({
      color: '#e4a6d1',
      transparent: true,
      opacity: 0.9
    })
  );

  trayectoria.name = 'Trayectoria matemática r(t) del informe';
  grupoTrayectoriaMatematica.add(trayectoria);

  const esfera = new THREE.Mesh(
    new THREE.SphereGeometry(5, 28, 18),
    new THREE.MeshBasicMaterial({
      color: '#a8b7c4',
      wireframe: true,
      transparent: true,
      opacity: 0.12
    })
  );

  esfera.position.set(2, 4, -3);
  esfera.name = 'Esfera de radio 5, centro (2,-3,4)';
  grupoTrayectoriaMatematica.add(esfera);

  const centro = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 14, 10),
    new THREE.MeshBasicMaterial({ color: '#ffffff' })
  );

  centro.position.set(2, 4, -3);
  grupoTrayectoriaMatematica.add(centro);

  const etiqueta = crearEtiqueta(
    'REFERENCIA MATEMÁTICA r(t)',
    '#f5d9ee'
  );

  etiqueta.position.set(2, 5.1, -3);
  grupoTrayectoriaMatematica.add(etiqueta);
}

/* ==========================================
   FUNCIÓN PARA CREAR CAJAS
   ========================================== */

function crearCaja(grupo, ancho, alto, fondo, color, x, y, z) {
  const objeto = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, alto, fondo),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.75,
      metalness: 0.08
    })
  );

  objeto.position.set(x, y, z);
  objeto.castShadow = true;
  objeto.receiveShadow = true;

  grupo.add(objeto);
  return objeto;
}

/* ==========================================
   BASE CIENTÍFICA PRINCIPAL
   ========================================== */

function crearBase() {
  crearCaja(grupoBase, 3.8, 0.22, 2.8, '#e5d9d2', -4.5, 0.22, -3.8);
  crearCaja(grupoBase, 2, 1.4, 1.6, '#eee3d9', -4.9, 1, -3.8);
  crearCaja(grupoBase, 0.8, 0.75, 1, '#b5c4ce', -3.5, 0.7, -3.8);

  const antena = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.3, 10),
    new THREE.MeshStandardMaterial({ color: '#f7f1ec', metalness: 0.5 })
  );

  antena.position.set(-4.8, 2.35, -3.8);
  grupoBase.add(antena);

  const plato = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 20, 12),
    new THREE.MeshStandardMaterial({ color: '#f7f1ec', metalness: 0.3 })
  );

  plato.scale.set(1, 0.35, 1);
  plato.position.set(-4.8, 2.85, -3.8);
  grupoBase.add(plato);

  const ventana = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.4, 0.04),
    new THREE.MeshStandardMaterial({
      color: '#7fabb9',
      metalness: 0.3,
      roughness: 0.3
    })
  );

  ventana.position.set(-4.6, 1.2, -2.98);
  grupoBase.add(ventana);

  crearCaja(grupoBase, 0.35, 0.7, 0.04, '#b6a4a4', -5.4, 0.68, -2.97);

  const tanque = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.85, 20),
    new THREE.MeshStandardMaterial({
      color: '#9cbec7',
      metalness: 0.35,
      roughness: 0.35
    })
  );

  tanque.position.set(-6.4, altura(-6.4, -3.6) + 0.62, -3.6);
  tanque.castShadow = true;
  grupoBase.add(tanque);

  const tapa = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.34, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2
    ),
    new THREE.MeshStandardMaterial({ color: '#d8e6e9', metalness: 0.2 })
  );

  tapa.position.set(-6.4, tanque.position.y + 0.42, -3.6);
  grupoBase.add(tapa);

  const etiqueta = crearEtiqueta('BASE CIENTÍFICA', '#ffffff');
  etiqueta.position.set(-4.6, 3.3, -3.8);
  grupoBase.add(etiqueta);
}

/* ==========================================
   BASE DE PRUEBAS
   ========================================== */

function crearBasePruebas() {
  const x = 3.6;
  const z = -5.5;
  const suelo = altura(x, z);

  crearCaja(grupoBase, 3.2, 0.18, 2.5, '#d8d5d2', x, suelo + 0.16, z);
  crearCaja(grupoBase, 2.85, 0.035, 2.15, '#777d83', x, suelo + 0.27, z);

  const materialMarcas = new THREE.MeshStandardMaterial({ color: '#f0d8a8' });

  for (const desplazamiento of [-1.35, 1.35]) {
    const marca = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.025, 2.05),
      materialMarcas
    );

    marca.position.set(x + desplazamiento, suelo + 0.30, z);
    grupoBase.add(marca);
  }

  crearCaja(grupoBase, 0.65, 0.65, 0.55, '#c4d4d9', x, suelo + 0.60, z);

  const instrumento = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.12, 24),
    new THREE.MeshStandardMaterial({
      color: '#8dc6d8',
      metalness: 0.35,
      roughness: 0.3
    })
  );

  instrumento.position.set(x, suelo + 1.0, z);
  grupoBase.add(instrumento);

  const etiqueta = crearEtiqueta('BASE DE PRUEBAS', '#ffffff');
  etiqueta.position.set(x, suelo + 1.65, z);
  grupoBase.add(etiqueta);
}

/* ==========================================
   PANELES SOLARES
   ========================================== */

function crearPaneles() {
  for (let i = 0; i < 3; i++) {
    const x = -2 + i * 1.45;
    const y = altura(x, -5.2) + 0.8;

    crearCaja(grupoPaneles, 1.1, 0.09, 1.6, '#596f91', x, y, -5.2);

    const bordes = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(1.1, 0.09, 1.6)
    );

    const lineas = new THREE.LineSegments(
      bordes,
      new THREE.LineBasicMaterial({ color: '#a8c9da' })
    );

    lineas.position.set(x, y, -5.2);
    grupoPaneles.add(lineas);

    const soporte = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.75, 8),
      new THREE.MeshStandardMaterial({
        color: '#d5d1d0',
        metalness: 0.4
      })
    );

    soporte.position.set(x, altura(x, -5.2) + 0.4, -5.2);
    grupoPaneles.add(soporte);
  }

  const etiqueta = crearEtiqueta('CAMPO DE PANELES SOLARES', '#f5e1a6');
  etiqueta.position.set(-1.0, altura(-1, -5.2) + 1.8, -5.2);
  grupoPaneles.add(etiqueta);
}

/* ==========================================
   ROVER
   ========================================== */

function crearRover() {
  rover = new THREE.Group();

  crearCaja(rover, 1.15, 0.36, 0.85, '#e2d1b9', 0, 0.78, 0);
  crearCaja(rover, 0.55, 0.18, 0.5, '#d6a17e', 0, 1.04, 0);

  const camaraRover = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 18, 12),
    new THREE.MeshStandardMaterial({
      color: '#9acbd2',
      metalness: 0.45,
      roughness: 0.2
    })
  );

  camaraRover.position.set(0, 1.18, 0.42);
  rover.add(camaraRover);

  const mastil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.6, 10),
    new THREE.MeshStandardMaterial({
      color: '#e8e1db',
      metalness: 0.4
    })
  );

  mastil.position.set(0, 1.35, -0.1);
  rover.add(mastil);

  for (const z of [-0.38, 0.38]) {
    for (const x of [-0.66, 0.66]) {
      const rueda = new THREE.Mesh(
        new THREE.CylinderGeometry(0.23, 0.23, 0.17, 20),
        new THREE.MeshStandardMaterial({ color: '#55545a', roughness: 0.95 })
      );

      rueda.rotation.z = Math.PI / 2;
      rueda.position.set(x, 0.38, z);
      rueda.castShadow = true;
      rover.add(rueda);
      ruedasRover.push(rueda);

      const centro = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.095, 0.185, 16),
        new THREE.MeshStandardMaterial({
          color: '#d9b4a0',
          metalness: 0.4
        })
      );

      centro.rotation.z = Math.PI / 2;
      centro.position.set(x, 0.38, z);
      rover.add(centro);
    }
  }

  for (const x of [-0.22, 0.22]) {
    const antena = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.45, 8),
      new THREE.MeshStandardMaterial({ color: '#f1e6d9' })
    );

    antena.position.set(x, 1.42, -0.18);
    rover.add(antena);
  }

  rover.position.set(
    xRover,
    altura(xRover, zRover) + 0.02,
    zRover
  );

  escena.add(rover);
}

/* ==========================================
   DOMO HABITACIONAL
   ========================================== */

function crearDomoHabitacional() {
  const x = -6.7;
  const z = -1.7;
  const baseY = altura(x, z) + 0.05;

  const aro = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.12, 32),
    new THREE.MeshStandardMaterial({ color: '#e5d9d2', roughness: 0.7 })
  );

  aro.position.set(x, baseY + 0.06, z);
  grupoBase.add(aro);

  const domo = new THREE.Mesh(
    new THREE.SphereGeometry(
      1.02, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2
    ),
    new THREE.MeshPhysicalMaterial({
      color: '#b9dce5',
      transparent: true,
      opacity: 0.48,
      roughness: 0.25,
      metalness: 0.05,
      side: THREE.DoubleSide
    })
  );

  domo.position.set(x, baseY + 0.1, z);
  domo.castShadow = true;
  grupoBase.add(domo);

  for (let i = -1; i <= 1; i++) {
    const nervio = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.95, 8),
      new THREE.MeshStandardMaterial({ color: '#e9eff0', metalness: 0.2 })
    );

    nervio.position.set(x + i * 0.35, baseY + 0.55, z);
    nervio.rotation.z = i * 0.28;
    grupoBase.add(nervio);
  }

  const etiqueta = crearEtiqueta('DOMO HABITACIONAL', '#ffffff');
  etiqueta.position.set(x, baseY + 1.7, z);
  grupoBase.add(etiqueta);
}

/* ==========================================
   HIELO, EXTRACCIÓN, AGUA Y TUBERÍAS
   ========================================== */

function crearZonaHieloYExtraccion() {
  const x = 5.4;
  const z = 2.8;
  const superficie = altura(x, z);

  const borde = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.12, 12, 48),
    new THREE.MeshStandardMaterial({ color: '#a87d75', roughness: 1 })
  );

  borde.rotation.x = Math.PI / 2;
  borde.position.set(x, superficie + 0.07, z);
  grupoRecursos.add(borde);

  const pozo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.68, 0.65, 32, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#694f55',
      side: THREE.DoubleSide,
      roughness: 1
    })
  );

  pozo.position.set(x, superficie - 0.19, z);
  grupoRecursos.add(pozo);

  const hielo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.55, 0.34, 24),
    new THREE.MeshStandardMaterial({
      color: '#91d9f0',
      emissive: '#287c9b',
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.9,
      roughness: 0.25
    })
  );

  hielo.position.set(x, superficie - 0.37, z);
  grupoRecursos.add(hielo);

  for (let i = 0; i < 7; i++) {
    const cristal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18 + (i % 3) * 0.055),
      new THREE.MeshStandardMaterial({
        color: '#d9f5ff',
        emissive: '#5ab6d6',
        emissiveIntensity: 0.25,
        roughness: 0.2,
        metalness: 0.1
      })
    );

    const a = i * Math.PI * 2 / 7;

    cristal.position.set(
      x + Math.cos(a) * 0.42,
      superficie - 0.18 + (i % 2) * 0.08,
      z + Math.sin(a) * 0.42
    );

    cristal.rotation.set(i * 0.2, i * 0.4, i * 0.3);
    grupoRecursos.add(cristal);
  }

  crearCaja(
    grupoRecursos, 0.62, 0.52, 0.62,
    '#dce6e9', x + 1.2, superficie + 0.3, z
  );

  const taladro = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.045, 0.9, 12),
    new THREE.MeshStandardMaterial({ color: '#778d9b', metalness: 0.55 })
  );

  taladro.position.set(x + 1.2, superficie - 0.23, z);
  grupoRecursos.add(taladro);

  const aroTaladro = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.035, 8, 20),
    new THREE.MeshStandardMaterial({ color: '#b7d9e5', metalness: 0.3 })
  );

  aroTaladro.rotation.x = Math.PI / 2;
  aroTaladro.position.set(x + 1.2, superficie + 0.58, z);
  grupoRecursos.add(aroTaladro);

  const puntosTuberia = [
    new THREE.Vector3(x - 0.45, superficie + 0.18, z),
    new THREE.Vector3(4.25, altura(4.25, 2.25) + 0.42, 2.25),
    new THREE.Vector3(3.0, altura(3.0, 1.55) + 0.42, 1.55),
    new THREE.Vector3(1.5, altura(1.5, 0.65) + 0.42, 0.65),
    new THREE.Vector3(-0.2, altura(-0.2, -0.1) + 0.42, -0.1),
    new THREE.Vector3(-1.8, altura(-1.8, -0.55) + 0.42, -0.55),
    new THREE.Vector3(-3.2, altura(-3.2, -1.1) + 0.42, -1.1),
    new THREE.Vector3(-4.5, altura(-4.5, -2.35) + 0.52, -2.35),
    new THREE.Vector3(-5.9, altura(-5.9, -2.6) + 0.52, -2.6)
  ];

  const curvaTuberia = new THREE.CatmullRomCurve3(puntosTuberia);

  const tubo = new THREE.Mesh(
    new THREE.TubeGeometry(curvaTuberia, 140, 0.085, 10, false),
    new THREE.MeshStandardMaterial({
      color: '#78c9e3',
      metalness: 0.4,
      roughness: 0.25,
      emissive: '#216c89',
      emissiveIntensity: 0.28
    })
  );

  grupoRecursos.add(tubo);

  for (let t = 0.12; t < 0.94; t += 0.13) {
    const punto = curvaTuberia.getPoint(t);

    const soporte = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.22, 8),
      new THREE.MeshStandardMaterial({
        color: '#d5d2ce',
        metalness: 0.35,
        roughness: 0.6
      })
    );

    soporte.position.set(punto.x, punto.y - 0.12, punto.z);
    grupoRecursos.add(soporte);
  }

  crearCaja(
    grupoRecursos, 0.55, 0.5, 0.55,
    '#b9cbd0', -4.9, altura(-4.9, -2.5) + 0.35, -2.5
  );

  const bomba = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.3, 16),
    new THREE.MeshStandardMaterial({
      color: '#668b9a',
      metalness: 0.45,
      roughness: 0.3
    })
  );

  bomba.rotation.z = Math.PI / 2;
  bomba.position.set(-4.9, altura(-4.9, -2.5) + 0.55, -2.5);
  grupoRecursos.add(bomba);

  const tanque = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.9, 24),
    new THREE.MeshStandardMaterial({
      color: '#d9e7e9',
      metalness: 0.28,
      roughness: 0.32
    })
  );

  tanque.position.set(-5.9, altura(-5.9, -2.6) + 0.55, -2.6);
  tanque.castShadow = true;
  grupoRecursos.add(tanque);

  const agua = new THREE.Mesh(
    new THREE.CylinderGeometry(0.315, 0.315, 0.48, 24),
    new THREE.MeshPhysicalMaterial({
      color: '#4cb9e8',
      transparent: true,
      opacity: 0.82,
      roughness: 0.15,
      metalness: 0.05
    })
  );

  agua.position.set(-5.9, tanque.position.y - 0.08, -2.6);
  grupoRecursos.add(agua);

  const tapaTanque = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.38, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2
    ),
    new THREE.MeshStandardMaterial({
      color: '#eef5f5',
      metalness: 0.25,
      roughness: 0.3
    })
  );

  tapaTanque.position.set(-5.9, tanque.position.y + 0.45, -2.6);
  grupoRecursos.add(tapaTanque);

  const etiqueta = crearEtiqueta('HIELO SUBTERRÁNEO · ZONA CONCEPTUAL', '#d9f5ff');
  etiqueta.position.set(x, superficie + 1.45, z);
  grupoRecursos.add(etiqueta);

  const etiquetaTubo = crearEtiqueta('TUBERÍA Y DEPÓSITO SELLADO', '#e4f8ff');
  etiquetaTubo.position.set(-1.0, altura(-1.0, -0.2) + 1.05, -0.2);
  grupoRecursos.add(etiquetaTubo);
}

/* ==========================================
   LABORATORIO CIENTÍFICO
   ========================================== */

function crearLaboratorio() {
  const x = 3.0;
  const z = 6.0;
  const y = altura(x, z);

  // Plataforma separada de las demás instalaciones.
  crearCaja(grupoLaboratorio, 3.5, 0.2, 2.8, '#d8d6d2', x, y + 0.12, z);

  // Edificio principal.
  crearCaja(grupoLaboratorio, 2.1, 1.65, 1.7, '#e6e5df', x, y + 1.0, z);

  // Techo.
  crearCaja(grupoLaboratorio, 2.25, 0.12, 1.85, '#aabac2', x, y + 1.88, z);

  // Ventana frontal.
  crearCaja(grupoLaboratorio, 0.85, 0.55, 0.045, '#77b6ca', x, y + 1.15, z - 0.88);

  // Puerta.
  crearCaja(grupoLaboratorio, 0.42, 0.85, 0.05, '#8c7772', x + 0.75, y + 0.65, z - 0.89);

  // Antena del laboratorio.
  const antena = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.8, 10),
    new THREE.MeshStandardMaterial({ color: '#d9e3e5', metalness: 0.5 })
  );

  antena.position.set(x - 0.65, y + 2.35, z);
  grupoLaboratorio.add(antena);

  const etiqueta = crearEtiqueta('LABORATORIO DE INVESTIGACIÓN', '#ffffff');
  etiqueta.position.set(x, y + 2.65, z);
  grupoLaboratorio.add(etiqueta);

  // Equipos exteriores.
  crearCaja(
    grupoLaboratorio, 0.55, 0.55, 0.55,
    '#9db5bd', x - 1.25, y + 0.45, z + 1.0
  );

  const cilindro = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.7, 18),
    new THREE.MeshStandardMaterial({
      color: '#b8cbd1',
      metalness: 0.35
    })
  );

  cilindro.position.set(x + 1.3, y + 0.55, z + 0.8);
  grupoLaboratorio.add(cilindro);
}

/* ==========================================
   ESTACIÓN METEOROLÓGICA
   ========================================== */

function crearEstacionMeteorologica() {
  const x = -8.0;
  const z = -6.2;
  const y = altura(x, z);

  crearCaja(grupoEstacion, 1.8, 0.14, 1.5, '#d9d7d3', x, y + 0.08, z);

  const mastil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 2.3, 12),
    new THREE.MeshStandardMaterial({
      color: '#d9e0e2',
      metalness: 0.45
    })
  );

  mastil.position.set(x, y + 1.25, z);
  grupoEstacion.add(mastil);

  // Sensor superior.
  const sensor = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    new THREE.MeshStandardMaterial({
      color: '#c8e0e7',
      metalness: 0.3
    })
  );

  sensor.position.set(x, y + 2.45, z);
  grupoEstacion.add(sensor);

  // Brazos de medición.
  const brazo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.85, 8),
    new THREE.MeshStandardMaterial({ color: '#dfe6e8' })
  );

  brazo.rotation.z = Math.PI / 2;
  brazo.position.set(x + 0.35, y + 1.8, z);
  grupoEstacion.add(brazo);

  // Anemómetro.
  const eje = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8),
    new THREE.MeshStandardMaterial({ color: '#dfe6e8' })
  );

  eje.position.set(x + 0.72, y + 1.95, z);
  grupoEstacion.add(eje);

  const etiqueta = crearEtiqueta('ESTACIÓN METEOROLÓGICA', '#ffffff');
  etiqueta.position.set(x, y + 3.0, z);
  grupoEstacion.add(etiqueta);
}

/* ==========================================
   ETIQUETAS 3D
   ========================================== */

function crearEtiqueta(texto, colorTexto = '#ffffff') {
  const canvas = document.createElement('canvas');

  canvas.width = 512;
  canvas.height = 96;

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(47, 58, 68, 0.82)';
  ctx.beginPath();
  ctx.roundRect(4, 4, 504, 88, 18);
  ctx.fill();

  ctx.font = 'bold 25px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colorTexto;
  ctx.fillText(texto, 256, 48, 480);

  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;

  const etiqueta = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: textura,
      transparent: true,
      depthTest: false
    })
  );

  etiqueta.scale.set(3.8, 0.72, 1);
  return etiqueta;
}

/* ==========================================
   ROCAS
   ========================================== */

function crearPiedras() {
  const material = new THREE.MeshStandardMaterial({
    color: '#b78577',
    roughness: 1
  });

  for (let i = 0; i < 28; i++) {
    const piedra = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.12 + (i % 3) * 0.06, 0),
      material
    );

    const x = Math.sin(i * 12.3) * 9;
    let z = Math.cos(i * 7.1) * 9;

    if (Math.abs(z) < 0.65) {
      z += z < 0 ? -0.9 : 0.9;
    }

    piedra.position.set(x, altura(x, z) + 0.1, z);
    piedra.rotation.set(i * 0.4, i * 0.6, i * 0.3);
    piedra.castShadow = true;

    escena.add(piedra);
  }
}

/* ==========================================
   CRÁTERES
   ========================================== */

function crearCráteres() {
  const posiciones = [
    [-7.4, 3.7, 0.8],
    [-1.7, 5.7, 0.58],
    [7.9, -5.2, 0.9],
    [2.4, -6.6, 0.65],
    [-8.1, -6.8, 0.55],
    [7.2, 6.8, 0.5]
  ];

  posiciones.forEach(([x, z, radio], i) => {
    const y = altura(x, z) + 0.025;

    const crater = new THREE.Mesh(
      new THREE.CircleGeometry(radio, 32),
      new THREE.MeshStandardMaterial({
        color: '#805c57',
        roughness: 1,
        side: THREE.DoubleSide
      })
    );

    crater.rotation.x = -Math.PI / 2;
    crater.position.set(x, y, z);
    escena.add(crater);

    const borde = new THREE.Mesh(
      new THREE.TorusGeometry(radio, 0.09, 8, 32),
      new THREE.MeshStandardMaterial({
        color: i % 2 ? '#d1a093' : '#c28e80',
        roughness: 1
      })
    );

    borde.rotation.x = Math.PI / 2;
    borde.position.set(x, y + 0.045, z);
    escena.add(borde);
  });
}

/* ==========================================
   CONTROLES DEL ROVER
   ========================================== */

function configurarControles() {
  const botonAdelante = document.getElementById('adelante');
  const botonAtras = document.getElementById('atras');
  const botonIzquierda = document.getElementById('izquierda');
  const botonDerecha = document.getElementById('derecha');
  const botonDetener = document.getElementById('detener');

  botonAdelante?.addEventListener('click', () => {
    velocidadRuta = 1;
    actualizarEstado('Avanzando por la ruta seleccionada');
  });

  botonAtras?.addEventListener('click', () => {
    velocidadRuta = -1;
    actualizarEstado('Retrocediendo por la ruta seleccionada');
  });

  botonIzquierda?.addEventListener('click', () => {
    if (rover) rover.rotation.y += 0.18;
  });

  botonDerecha?.addEventListener('click', () => {
    if (rover) rover.rotation.y -= 0.18;
  });

  botonDetener?.addEventListener('click', detenerRover);

  document.getElementById('reiniciar')?.addEventListener('click', () => {
    rutaActual = 'principal';
    curvaRuta = rutasRover.principal;
    parametroRutaRover = 0;
    velocidadRuta = 0;

    if (curvaRuta && rover) {
      const punto = curvaRuta.getPointAt(0);

      xRover = punto.x;
      zRover = punto.z;

      rover.position.set(
        xRover,
        altura(xRover, zRover) + 0.02,
        zRover
      );

      const tangente = curvaRuta.getTangentAt(0);
      rover.rotation.y = Math.atan2(tangente.x, tangente.z);
    }

    velocidadX = 0;
    velocidadZ = 0;

    ruedasRover.forEach(rueda => {
      rueda.rotation.x = 0;
    });

    const selector = document.getElementById('destinoRover');
    if (selector) selector.value = 'principal';

    camara.position.set(13, 12, 16);
    controles.target.set(-0.5, 0.3, 0);
    controles.update();

    actualizarCoordenadas();
    actualizarEstado('En espera');
  });

  window.addEventListener('keydown', evento => {
    const tecla = evento.key.toLowerCase();

    if (
      ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(tecla)
    ) {
      evento.preventDefault();
    }

    teclas[tecla] = true;
    actualizarMovimientoTeclado();
  });

  window.addEventListener('keyup', evento => {
    const tecla = evento.key.toLowerCase();

    delete teclas[tecla];
    actualizarMovimientoTeclado();
  });

  window.addEventListener('blur', detenerRover);
}

function actualizarMovimientoTeclado() {
  const arriba = teclas.w || teclas.arrowup;
  const abajo = teclas.s || teclas.arrowdown;
  const izquierda = teclas.a || teclas.arrowleft;
  const derecha = teclas.d || teclas.arrowright;

  if (teclas[' ']) {
    detenerRover();
    return;
  }

  if (arriba && !abajo) {
    velocidadRuta = 1;
    actualizarEstado('Avanzando por la ruta seleccionada');
  } else if (abajo && !arriba) {
    velocidadRuta = -1;
    actualizarEstado('Retrocediendo por la ruta seleccionada');
  } else {
    velocidadRuta = 0;

    if (izquierda && rover) rover.rotation.y += 0.035;
    if (derecha && rover) rover.rotation.y -= 0.035;

    if (!izquierda && !derecha) {
      actualizarEstado('En espera');
    }
  }
}

/* ==========================================
   VISIBILIDAD DE LOS ELEMENTOS
   ========================================== */

function configurarVisibilidad() {
  document.getElementById('verTerreno')?.addEventListener('change', evento => {
    grupoTerreno.visible = evento.target.checked;
  });

  document.getElementById('verRuta')?.addEventListener('change', evento => {
    grupoRuta.visible = evento.target.checked;
  });

  document.getElementById('verTrayectoriaMatematica')?.addEventListener('change', evento => {
    grupoTrayectoriaMatematica.visible = evento.target.checked;
  });

  document.getElementById('verBase')?.addEventListener('change', evento => {
    grupoBase.visible = evento.target.checked;
    grupoLaboratorio.visible = evento.target.checked;
    grupoEstacion.visible = evento.target.checked;
  });

  document.getElementById('verPaneles')?.addEventListener('change', evento => {
    grupoPaneles.visible = evento.target.checked;
  });

  document.getElementById('verRover')?.addEventListener('change', evento => {
    rover.visible = evento.target.checked;
  });
}

/* ==========================================
   PESTAÑAS
   ========================================== */

function configurarPestanas() {
  const botones = [...document.querySelectorAll('.pestana')];

  botones.forEach((boton, indice) => {
    boton.addEventListener('click', () => activarPestana(boton));

    boton.addEventListener('keydown', evento => {
      let siguiente = indice;

      if (evento.key === 'ArrowRight') {
        siguiente = (indice + 1) % botones.length;
      } else if (evento.key === 'ArrowLeft') {
        siguiente = (indice - 1 + botones.length) % botones.length;
      } else {
        return;
      }

      evento.preventDefault();
      botones[siguiente].focus();
      activarPestana(botones[siguiente]);
    });
  });
}

function activarPestana(botonSeleccionado) {
  document.querySelectorAll('.pestana').forEach(boton => {
    const activa = boton === botonSeleccionado;

    boton.classList.toggle('activa', activa);
    boton.setAttribute('aria-selected', String(activa));
    boton.tabIndex = activa ? 0 : -1;
  });

  document.querySelectorAll('.contenido-pestana').forEach(panel => {
    panel.hidden = panel.id !== botonSeleccionado.dataset.pestana;
  });
}

/* ==========================================
   COORDENADAS Y ESTADO
   ========================================== */

function actualizarCoordenadas() {
  const x = xRover.toFixed(1);
  const y = zRover.toFixed(1);

  const valorX = document.getElementById('valorX');
  const valorY = document.getElementById('valorY');
  const valorX2 = document.getElementById('valorX2');
  const valorY2 = document.getElementById('valorY2');

  if (valorX) valorX.textContent = x;
  if (valorY) valorY.textContent = y;
  if (valorX2) valorX2.textContent = x;
  if (valorY2) valorY2.textContent = y;
}

function actualizarEstado(estado) {
  const elemento = document.getElementById('estadoRover');

  if (elemento) {
    elemento.textContent = estado;
  }
}

function detenerRover() {
  velocidadRuta = 0;
  velocidadX = 0;
  velocidadZ = 0;
  teclas = {};

  actualizarEstado('En espera');
}

/* ==========================================
   AJUSTAR TAMAÑO DE LA ESCENA
   ========================================== */

function ajustarTamanio() {
  if (!camara || !renderizador || !contenedor) return;

  const ancho = contenedor.clientWidth;
  const alto = contenedor.clientHeight;

  if (ancho <= 0 || alto <= 0) return;

  camara.aspect = ancho / alto;
  camara.updateProjectionMatrix();

  renderizador.setSize(ancho, alto);
}

/* ==========================================
   ANIMACIÓN Y MOVIMIENTO DEL ROVER
   ========================================== */

function animar() {
  requestAnimationFrame(animar);

  if (!reloj || !renderizador || !escena) return;

  const delta = Math.min(reloj.getDelta(), 0.05);

  if (rover && curvaRuta && velocidadRuta !== 0) {
    const longitudRuta = curvaRuta.getLength();

    parametroRutaRover +=
      velocidadRuta * (VELOCIDAD_ROVER * delta) / longitudRuta;

    if (parametroRutaRover >= 1) {
      parametroRutaRover = 1;
      velocidadRuta = 0;
      actualizarEstado('El rover llegó al destino');
    } else if (parametroRutaRover <= 0) {
      parametroRutaRover = 0;
      velocidadRuta = 0;
      actualizarEstado('El rover llegó al inicio de la ruta');
    }

    const punto = curvaRuta.getPointAt(parametroRutaRover);

    // Las rutas automáticas también se detienen antes de una instalación.
    if (hayColisionRover(xRover, zRover, punto.x, punto.z)) {
      velocidadRuta = 0;
      actualizarEstado('Ruta detenida: hay una instalación en el camino');
    } else {
      const tangente = curvaRuta.getTangentAt(parametroRutaRover).normalize();
      xRover = punto.x;
      zRover = punto.z;

    rover.position.set(
      xRover,
      altura(xRover, zRover) + 0.02,
      zRover
    );

    rover.rotation.y =
      Math.atan2(tangente.x, tangente.z) +
      (velocidadRuta < 0 ? Math.PI : 0);

    ruedasRover.forEach(rueda => {
      rueda.rotation.x += VELOCIDAD_ROVER * delta * velocidadRuta;
    });

      actualizarCoordenadas();
    }
  }

  controles.update();
  renderizador.render(escena, camara);
}



/* =========================================================
   MEJORAS ADICIONALES
   IMPORTANTE: ESTE BLOQUE SE AGREGA AL FINAL DEL ARCHIVO.
   NO REEMPLAZA NI ELIMINA EL CÓDIGO ANTERIOR.
   ========================================================= */

/* ==========================================
   1. AEROPUERTO ESPACIAL DE MARTE
   ========================================== */

function crearAeropuertoEspacial() {
  const aeropuerto = new THREE.Group();

  const x = 7;
  const z = -7;
  const y = altura(x, z);

  // Plataforma principal.
  const plataforma = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 0.16, 2.6),
    new THREE.MeshStandardMaterial({
      color: '#aaa5a0',
      roughness: 0.85
    })
  );

  plataforma.position.set(x, y + 0.08, z);
  plataforma.receiveShadow = true;
  aeropuerto.add(plataforma);

  // Pista de aterrizaje.
  const pista = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.035, 0.75),
    new THREE.MeshStandardMaterial({
      color: '#55565b',
      roughness: 0.9
    })
  );

  pista.position.set(x, y + 0.18, z);
  aeropuerto.add(pista);

  // Líneas de la pista.
  for (let i = -2; i <= 2; i++) {
    const linea = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.025, 0.045),
      new THREE.MeshStandardMaterial({ color: '#ffffff' })
    );

    linea.position.set(x + i * 0.65, y + 0.21, z);
    aeropuerto.add(linea);
  }

  // Letra H de aterrizaje.
  const materialH = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#ffffff',
    emissiveIntensity: 0.15
  });

  const barraH1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.03, 0.55),
    materialH
  );

  barraH1.position.set(x - 0.18, y + 0.22, z + 0.85);
  aeropuerto.add(barraH1);

  const barraH2 = barraH1.clone();
  barraH2.position.x = x + 0.18;
  aeropuerto.add(barraH2);

  const centroH = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.03, 0.09),
    materialH
  );

  centroH.position.set(x, y + 0.22, z + 0.85);
  aeropuerto.add(centroH);

  // Luces de la pista.
  for (let i = -2; i <= 2; i++) {
    for (const lado of [-1, 1]) {
      const luz = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 12, 8),
        new THREE.MeshStandardMaterial({
          color: '#bdeeff',
          emissive: '#62c9ff',
          emissiveIntensity: 1.5
        })
      );

      luz.position.set(
        x + i * 0.8,
        y + 0.27,
        z + lado * 0.58
      );

      aeropuerto.add(luz);
    }
  }

  // Torre de control.
  const torre = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.38, 1.5, 16),
    new THREE.MeshStandardMaterial({
      color: '#d9d9d5',
      metalness: 0.2
    })
  );

  torre.position.set(x + 2.1, y + 0.85, z - 0.7);
  aeropuerto.add(torre);

  const cabina = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 0.35, 16),
    new THREE.MeshStandardMaterial({
      color: '#8dc5d8',
      transparent: true,
      opacity: 0.8
    })
  );

  cabina.position.set(x + 2.1, y + 1.65, z - 0.7);
  aeropuerto.add(cabina);

  // Antena.
  const antena = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: '#eeeeee' })
  );

  antena.position.set(x + 2.1, y + 2.2, z - 0.7);
  aeropuerto.add(antena);

  const etiqueta = crearEtiqueta('AEROPUERTO ESPACIAL', '#d9f5ff');
  etiqueta.position.set(x, y + 1.25, z);
  aeropuerto.add(etiqueta);

  escena.add(aeropuerto);
}


/* ==========================================
   2. REDUCIR TAMAÑO DE LAS ETIQUETAS
   ========================================== */

function reducirEtiquetasLugares() {
  escena.traverse(objeto => {
    if (objeto.isSprite && objeto.material?.map) {
      objeto.scale.multiplyScalar(0.68);
    }
  });
}


/* ==========================================
   3. PANEL DE INFORMACIÓN EN VIVO
   ========================================== */

let panelDatosRover;

function crearPanelDatosRover() {
  if (document.getElementById('panelDatosRover')) return;

  const panelRover = document.getElementById('contenido-rover');
  if (!panelRover) return;

  panelDatosRover = document.createElement('div');
  panelDatosRover.id = 'panelDatosRover';
  panelDatosRover.style.cssText = `
    margin-top: 14px;
    padding: 13px;
    box-sizing: border-box;
    border-radius: 12px;
    background: #f3e9e5;
    color: #4b4140;
    font-family: Arial, sans-serif;
    font-size: 13px;
    line-height: 1.8;
    border: 1px solid #e2d1ca;
  `;

  panelDatosRover.innerHTML = `
    <div style="font-size:14px;font-weight:bold;color:#98685d;margin-bottom:8px;border-bottom:1px solid #d8c5bd;padding-bottom:6px;">
      INFORMACIÓN EN TIEMPO REAL
    </div>
    <div>Elevación actual (altura del terreno): <strong id="datoRoverElevacion">0.00</strong></div>
    <div>Coordenada y del informe (eje Z visual): <strong id="datoRoverZ">0.00</strong></div>
    <div style="margin-top:8px;color:#668b9a;font-weight:bold;">
      MÁXIMO LOCAL DEL TERRENO
    </div>
    <div>Altura máxima: <strong id="datoMaximoAltura">0.00</strong></div>
    <div>Coordenada X: <strong id="datoMaximoX">0.0</strong></div>
    <div>Coordenada Z: <strong id="datoMaximoZ">0.0</strong></div>
    <div style="margin-top:8px;border-top:1px solid #d8c5bd;padding-top:6px;">
      Modo de conducción: <strong id="datoModoRover">Rutas</strong>
    </div>
  `;

  // Las coordenadas X e Y se muestran en la tarjeta que ya existe
  // en la pestaña Rover. Aquí se agregan únicamente los datos nuevos.
  panelRover.appendChild(panelDatosRover);

  // Se conserva el HTML original y se evita repetir las coordenadas
  // que antes aparecían debajo de la escena 3D.
  if (!document.getElementById('estiloDatosEnPanel')) {
    const estilo = document.createElement('style');
    estilo.id = 'estiloDatosEnPanel';
    estilo.textContent = `
      .panel-escena > .estado-rover {
        display: none !important;
      }
    `;
    document.head.appendChild(estilo);
  }
}

/* ==========================================
   4. CALCULAR EL MÁXIMO LOCAL DEL TERRENO
   ========================================== */

function calcularMaximoLocal(xCentro, zCentro) {
  const radio = 1.5;
  const paso = 0.15;

  let maximo = {
    x: xCentro,
    z: zCentro,
    altura: elevacionMatematica(xCentro, zCentro)
  };

  for (let x = xCentro - radio; x <= xCentro + radio; x += paso) {
    for (let z = zCentro - radio; z <= zCentro + radio; z += paso) {

      // Solo se revisan puntos dentro del círculo de búsqueda.
      const distancia = Math.sqrt(
        (x - xCentro) ** 2 + (z - zCentro) ** 2
      );

      if (distancia > radio) continue;

      // El terreno mide 20 por 20 unidades.
      if (Math.abs(x) > 10 || Math.abs(z) > 10) continue;

      const elevacion = elevacionMatematica(x, z);

      if (elevacion > maximo.altura) {
        maximo = {
          x,
          z,
          altura: elevacion
        };
      }
    }
  }

  return maximo;
}


/* ==========================================
   5. ACTUALIZAR LOS DATOS EN TIEMPO REAL
   ========================================== */

let ultimoCalculoMaximo = 0;
let maximoLocalActual = null;

function actualizarDatosRover(tiempo = 0) {
  if (!rover) return;

  const elevacion = elevacionMatematica(xRover, zRover);

  const elementoElevacion = document.getElementById('datoRoverElevacion');

  if (elementoElevacion) {
    elementoElevacion.textContent = elevacion.toFixed(3) + ' unidades';
  }

  const elementoZActual = document.getElementById('datoRoverZ');

  if (elementoZActual) {
    elementoZActual.textContent = zRover.toFixed(3) + ' unidades';
  }

  // El máximo local se vuelve a calcular cada 150 milisegundos.
  if (!maximoLocalActual || tiempo - ultimoCalculoMaximo > 150) {
    maximoLocalActual = calcularMaximoLocal(xRover, zRover);
    ultimoCalculoMaximo = tiempo;
  }

  const elementoAltura = document.getElementById('datoMaximoAltura');
  const elementoMaximoX = document.getElementById('datoMaximoX');
  const elementoMaximoZ = document.getElementById('datoMaximoZ');

  if (elementoAltura) {
    elementoAltura.textContent = maximoLocalActual.altura.toFixed(3) + ' unidades';
  }

  if (elementoMaximoX) {
    elementoMaximoX.textContent = maximoLocalActual.x.toFixed(2);
  }

  if (elementoMaximoZ) {
    elementoMaximoZ.textContent = maximoLocalActual.z.toFixed(2);
  }

  const modo = document.getElementById('datoModoRover');

  if (modo) {
    modo.textContent = conduccionLibreActiva ? 'Conducción libre' : 'Rutas';
  }
}


/* ==========================================
   6. CONDUCCIÓN LIBRE DEL ROVER
   ========================================== */

let conduccionLibreActiva = false;
let teclasConduccionLibre = {};
let ultimoTiempoConduccion = 0;

const VELOCIDAD_LIBRE_ROVER = 2.2;
const VELOCIDAD_GIRO_ROVER = 2.0;

function activarConduccionLibre() {
  conduccionLibreActiva = true;

  velocidadRuta = 0;
  velocidadX = 0;
  velocidadZ = 0;
  teclas = {};
  teclasConduccionLibre = {};

  actualizarEstado('Conducción libre activada. Usa las flechas o WASD.');

  const boton = document.getElementById('botonConduccionLibre');

  if (boton) {
    boton.textContent = 'DESACTIVAR CONDUCCIÓN LIBRE';
    boton.style.background = '#9b665b';
  }
}

function desactivarConduccionLibre() {
  conduccionLibreActiva = false;
  teclasConduccionLibre = {};

  const boton = document.getElementById('botonConduccionLibre');

  if (boton) {
    boton.textContent = 'ACTIVAR CONDUCCIÓN LIBRE';
    boton.style.background = '#c98778';
  }

  actualizarEstado('Conducción libre desactivada');
}



/* ==========================================
   PROTECCIÓN DE COLISIONES DEL ROVER
   Evita atravesar las instalaciones de la base.
   ========================================== */

const RADIO_COLISION_ROVER = 0.72;

const zonasColisionRover = [
  { tipo: 'rectangulo', x: -4.5, z: -3.8, hx: 1.9, hz: 1.4 },
  { tipo: 'circulo', x: -6.7, z: -1.7, radio: 1.15 },
  { tipo: 'rectangulo', x: -0.55, z: -5.2, hx: 2.15, hz: 1.25 },
  { tipo: 'rectangulo', x: 3.6, z: -5.5, hx: 1.75, hz: 1.4 },
  { tipo: 'circulo', x: 5.4, z: 2.8, radio: 1.55 },
  { tipo: 'rectangulo', x: 3.0, z: 6.0, hx: 1.9, hz: 1.65 },
  { tipo: 'rectangulo', x: -8.0, z: -6.2, hx: 1.25, hz: 1.15 },
  { tipo: 'rectangulo', x: 7.0, z: -7.0, hx: 2.45, hz: 1.55 }
];

function medirZonaColision(x, z, zona) {
  if (zona.tipo === 'circulo') {
    return Math.hypot(x - zona.x, z - zona.z) -
      (zona.radio + RADIO_COLISION_ROVER);
  }

  const dx = Math.abs(x - zona.x);
  const dz = Math.abs(z - zona.z);
  const hx = zona.hx + RADIO_COLISION_ROVER;
  const hz = zona.hz + RADIO_COLISION_ROVER;
  return Math.max(dx - hx, dz - hz);
}

function hayColisionRover(xActual, zActual, xNuevo, zNuevo) {
  for (const zona of zonasColisionRover) {
    const distanciaActual = medirZonaColision(xActual, zActual, zona);
    const distanciaNueva = medirZonaColision(xNuevo, zNuevo, zona);

    if (distanciaNueva < 0) {
      // Si comienza dentro de una zona, puede salir, pero no entrar más.
      if (distanciaActual >= 0 || distanciaNueva < distanciaActual) {
        return true;
      }
    }
  }
  return false;
}

/* ==========================================
   7. MOVIMIENTO LIBRE Y DIRECCIÓN DEL ROVER
   ========================================== */

function moverRoverLibre(delta) {
  if (!conduccionLibreActiva || !rover) return;

  const arriba =
    teclasConduccionLibre.arrowup ||
    teclasConduccionLibre.w;

  const abajo =
    teclasConduccionLibre.arrowdown ||
    teclasConduccionLibre.s;

  const izquierda =
    teclasConduccionLibre.arrowleft ||
    teclasConduccionLibre.a;

  const derecha =
    teclasConduccionLibre.arrowright ||
    teclasConduccionLibre.d;

  if (izquierda && !derecha) {
    rover.rotation.y += VELOCIDAD_GIRO_ROVER * delta;
  }

  if (derecha && !izquierda) {
    rover.rotation.y -= VELOCIDAD_GIRO_ROVER * delta;
  }

  let direccion = 0;

  if (arriba && !abajo) direccion = 1;
  if (abajo && !arriba) direccion = -1;

  if (direccion !== 0) {
    const distancia = VELOCIDAD_LIBRE_ROVER * delta * direccion;

    const siguienteX =
      xRover + Math.sin(rover.rotation.y) * distancia;

    const siguienteZ =
      zRover + Math.cos(rover.rotation.y) * distancia;

    // Mantener el rover dentro de los límites del terreno.
    const xLimitado = THREE.MathUtils.clamp(siguienteX, -9.1, 9.1);
    const zLimitado = THREE.MathUtils.clamp(siguienteZ, -9.1, 9.1);

    // No permitir que el rover atraviese edificios, paneles o estaciones.
    if (hayColisionRover(xRover, zRover, xLimitado, zLimitado)) {
      actualizarEstado('Obstáculo: no se puede atravesar esta instalación');
      return;
    }

    xRover = xLimitado;
    zRover = zLimitado;

    rover.position.set(
      xRover,
      altura(xRover, zRover) + 0.02,
      zRover
    );

    ruedasRover.forEach(rueda => {
      rueda.rotation.x += distancia * 2;
    });

    actualizarEstado(
      direccion > 0
        ? 'Rover avanzando libremente'
        : 'Rover retrocediendo libremente'
    );

    actualizarCoordenadas();
  } else if (izquierda || derecha) {
    actualizarEstado('Girando el rover');
  } else {
    actualizarEstado('Conducción libre: rover detenido');
  }
}


/* ==========================================
   8. BOTÓN PARA ACTIVAR LA CONDUCCIÓN LIBRE
   ========================================== */

function crearBotonConduccionLibre() {
  if (document.getElementById('botonConduccionLibre')) return;

  const panelRutas = document.getElementById('selectorRutasRover');

  if (!panelRutas) return;

  const boton = document.createElement('button');

  boton.id = 'botonConduccionLibre';
  boton.type = 'button';
  boton.textContent = 'ACTIVAR CONDUCCIÓN LIBRE';

  boton.style.cssText = `
    width:100%;
    padding:9px;
    margin-top:9px;
    border:0;
    border-radius:7px;
    background:#c98778;
    color:white;
    font-weight:bold;
    cursor:pointer;
  `;

  boton.addEventListener('click', () => {
    if (conduccionLibreActiva) {
      desactivarConduccionLibre();
    } else {
      activarConduccionLibre();
    }
  });

  panelRutas.appendChild(boton);
}


/* ==========================================
   9. CONTROL CON FLECHAS Y TECLAS WASD
   ========================================== */

function configurarTecladoConduccionLibre() {
  window.addEventListener('keydown', evento => {
    const tecla = evento.key.toLowerCase();

    const teclasPermitidas = [
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
      'w',
      'a',
      's',
      'd'
    ];

    if (!conduccionLibreActiva) return;
    if (!teclasPermitidas.includes(tecla)) return;

    evento.preventDefault();
    evento.stopImmediatePropagation();

    teclasConduccionLibre[tecla] = true;
  }, true);

  window.addEventListener('keyup', evento => {
    const tecla = evento.key.toLowerCase();

    if (!conduccionLibreActiva) return;

    if (teclasConduccionLibre[tecla]) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      delete teclasConduccionLibre[tecla];
    }
  }, true);

  window.addEventListener('blur', () => {
    teclasConduccionLibre = {};
  });
}


/* ==========================================
   10. CONTROL CON LOS BOTONES DE MOVIMIENTO
   ========================================== */

function configurarBotonesMovimientoLibre() {
  const controlesBotones = [
    ['adelante', 'arrowup'],
    ['atras', 'arrowdown'],
    ['izquierda', 'arrowleft'],
    ['derecha', 'arrowright']
  ];

  controlesBotones.forEach(([id, tecla]) => {
    const boton = document.getElementById(id);

    if (!boton) return;

    boton.addEventListener('pointerdown', evento => {
      if (!conduccionLibreActiva) return;

      evento.preventDefault();
      evento.stopImmediatePropagation();

      teclasConduccionLibre[tecla] = true;

      boton.setPointerCapture?.(evento.pointerId);
    }, true);

    const soltar = evento => {
      if (!conduccionLibreActiva) return;

      evento.preventDefault();
      evento.stopImmediatePropagation();

      delete teclasConduccionLibre[tecla];
    };

    boton.addEventListener('pointerup', soltar, true);
    boton.addEventListener('pointercancel', soltar, true);
    boton.addEventListener('lostpointercapture', soltar, true);

    boton.addEventListener('click', evento => {
      if (!conduccionLibreActiva) return;

      evento.preventDefault();
      evento.stopImmediatePropagation();
    }, true);
  });

  const botonDetener = document.getElementById('detener');

  botonDetener?.addEventListener('click', evento => {
    if (!conduccionLibreActiva) return;

    evento.preventDefault();
    evento.stopImmediatePropagation();

    teclasConduccionLibre = {};
    actualizarEstado('Rover detenido');
  }, true);
}


/* ==========================================
   11. AL SELECCIONAR UNA RUTA, SALIR DEL
       MODO DE CONDUCCIÓN LIBRE
   ========================================== */

function configurarCambioDeRuta() {
  document.getElementById('iniciarRutaRover')?.addEventListener('click', () => {
    if (conduccionLibreActiva) {
      desactivarConduccionLibre();
    }
  }, true);
}


/* ==========================================
   12. ACTUALIZACIÓN CONTINUA
   ========================================== */

function animarMejorasRover(tiempo) {
  requestAnimationFrame(animarMejorasRover);

  if (!rover || !renderizador) return;

  if (ultimoTiempoConduccion === 0) {
    ultimoTiempoConduccion = tiempo;
  }

  const delta = Math.min(
    (tiempo - ultimoTiempoConduccion) / 1000,
    0.05
  );

  ultimoTiempoConduccion = tiempo;

  moverRoverLibre(delta);
  actualizarDatosRover(tiempo);
  actualizarPanelMatematico();
}


/* ==========================================
   13. INICIAR TODAS LAS MEJORAS
   ========================================== */


/* ==========================================
   PANEL MATEMÁTICO DINÁMICO DEL INFORME
   Se agrega dentro de la pestaña existente; no elimina su contenido.
   ========================================== */
function integrarTerrenoEnDisco(n = 160) {
  const R = 5;
  const h = (2 * R) / n;
  let sumaF = 0, sumaArea = 0, sumaSuperficie = 0;
  for (let i = 0; i < n; i++) {
    const x = -R + (i + 0.5) * h;
    for (let j = 0; j < n; j++) {
      const y = -R + (j + 0.5) * h;
      if (x * x + y * y > R * R) continue;
      const fx = derivadaX(x, y), fy = derivadaY(x, y);
      const dA = h * h;
      sumaF += elevacionMatematica(x, y) * dA;
      sumaArea += dA;
      sumaSuperficie += Math.sqrt(1 + fx * fx + fy * fy) * dA;
    }
  }
  return { integralF: sumaF, area: sumaArea, promedio: sumaF / sumaArea, areaReal: sumaSuperficie };
}

function buscarExtremosDisco(n = 220) {
  const R = 5, paso = 2 * R / n;
  let max = { f: -Infinity, x: 0, y: 0 };
  let min = { f: Infinity, x: 0, y: 0 };
  let bordeMax = { f: -Infinity, x: 0, y: 0 };
  let bordeMin = { f: Infinity, x: 0, y: 0 };
  for (let i = 0; i <= n; i++) {
    const x = -R + i * paso;
    for (let j = 0; j <= n; j++) {
      const y = -R + j * paso;
      if (x * x + y * y > R * R) continue;
      const f = elevacionMatematica(x, y);
      if (f > max.f) max = { f, x, y };
      if (f < min.f) min = { f, x, y };
    }
  }
  // La frontera circular se muestrea también, que es la condición restringida g=x²+y²−25=0.
  for (let i = 0; i < 1440; i++) {
    const t = 2 * Math.PI * i / 1440;
    const x = R * Math.cos(t), y = R * Math.sin(t);
    const f = elevacionMatematica(x, y);
    if (f > max.f) max = { f, x, y };
    if (f < min.f) min = { f, x, y };
    if (f > bordeMax.f) bordeMax = { f, x, y };
    if (f < bordeMin.f) bordeMin = { f, x, y };
  }
  const lambdaMax = (derivadaX(bordeMax.x, bordeMax.y) * bordeMax.x + derivadaY(bordeMax.x, bordeMax.y) * bordeMax.y) / (2 * R * R);
  const lambdaMin = (derivadaX(bordeMin.x, bordeMin.y) * bordeMin.x + derivadaY(bordeMin.x, bordeMin.y) * bordeMin.y) / (2 * R * R);
  return { max, min, bordeMax, bordeMin, lambdaMax, lambdaMin };
}

function crearPanelCalculosDinamicos() {
  const contenedorCalculos = document.getElementById('contenido-calculos');
  if (!contenedorCalculos || document.getElementById('calculosDinamicos')) return;
  const panel = document.createElement('section');
  panel.id = 'calculosDinamicos';
  panel.style.cssText = 'margin-top:16px;padding:14px;border:1px solid #ddc9c0;border-radius:12px;background:#fffaf7;color:#51413d;font:13px/1.65 Arial,sans-serif;';
  panel.innerHTML = `
    <h3 style="color:#98685d;margin:0 0 8px">Resultados matemáticos calculados</h3>
    <p>Modelo del informe: f(x,y)=20+8e<sup>-((x-3)²+(y-7)²)/4</sup>−6e<sup>-((x-7)²+(y-3)²)/4</sup>+0.5x+0.3y.</p>
    <div style="font-weight:bold;margin-top:10px">Evaluación en la posición actual del rover</div>
    <div>f(x,y): <strong id="mathF">—</strong></div>
    <div>fₓ: <strong id="mathFx">—</strong> · fᵧ: <strong id="mathFy">—</strong></div>
    <div>Gradiente ∇f: <strong id="mathGrad">—</strong></div>
    <div>Derivada direccional en dirección de máximo ascenso: <strong id="mathDireccional">—</strong></div>
    <div>Plano tangente local: <strong id="mathPlano">—</strong></div>
    <div>fₓₓ: <strong id="mathFxx">—</strong> · fᵧᵧ: <strong id="mathFyy">—</strong> · fₓᵧ: <strong id="mathFxy">—</strong></div>
    <div>Discriminante D: <strong id="mathD">—</strong></div>
    <div style="font-weight:bold;margin-top:10px">Optimización restringida en x²+y²≤25</div>
    <div>Máximo aproximado: <strong id="mathMax">—</strong></div>
    <div>Mínimo aproximado: <strong id="mathMin">—</strong></div>
    <div>Candidatos sobre la frontera (Lagrange, muestreo numérico): <strong id="mathLagrange">—</strong></div>
    <div style="font-weight:bold;margin-top:10px">Integrales dobles en el disco x²+y²≤25</div>
    <div>Área proyectada aproximada: <strong id="mathArea">—</strong></div>
    <div>Valor medio de f: <strong id="mathPromedio">—</strong></div>
    <div>Integral ∬<sub>R</sub> f dA: <strong id="mathIntegral">—</strong></div>
    <div>Área real aproximada de la superficie: <strong id="mathAreaReal">—</strong></div>
    <div style="font-weight:bold;margin-top:10px">Trayectoria matemática de referencia</div>
    <div>r(t)=(2+5cos t, −3+5sin t, 4)</div>
    <div>v(t)=(-5sin t, 5cos t, 0); a(t)=(-5cos t, -5sin t, 0)</div>
    <div>|v(t)|: <strong>5 unidades/t</strong> · |a(t)|: <strong>5 unidades/t²</strong> · curvatura: <strong>0.2</strong> · longitud por vuelta: <strong>10π ≈ 31.416 unidades</strong></div>
    <div style="font-weight:bold;margin-top:10px">Domo semiesférico (R=5)</div>
    <div>Volumen: <strong>250π/3 ≈ 261.799 unidades³</strong></div>
    <div>Integral triple: ∫₀²π∫₀⁵∫₀√(25−r²) ρr dz dr dθ = <strong>(250π/3)ρ</strong></div>
    <div>Masa con densidad uniforme ρ: <strong>(250π/3)ρ</strong></div>
    <div>Centro de masa: <strong>a 3R/8 = 1.875 unidades del plano de la base, sobre el eje de simetría</strong></div>
    <p style="margin:10px 0 0;color:#78635c"><strong>Nota:</strong> las integrales del terreno se aproximan numéricamente por suma de puntos medios. La densidad ρ queda simbólica porque el informe no especifica un valor. D se muestra en la posición actual; la clasificación de máximos, mínimos o silla solo aplica cuando el gradiente es cero.</p>
  `;
  contenedorCalculos.appendChild(panel);
  const resultados = integrarTerrenoEnDisco();
  document.getElementById('mathArea').textContent = resultados.area.toFixed(3) + ' unidades²';
  document.getElementById('mathIntegral').textContent = resultados.integralF.toFixed(3) + ' unidades³';
  document.getElementById('mathPromedio').textContent = resultados.promedio.toFixed(4) + ' unidades';
  document.getElementById('mathAreaReal').textContent = resultados.areaReal.toFixed(3) + ' unidades²';
  const extremos = buscarExtremosDisco();
  document.getElementById('mathMax').textContent = `${extremos.max.f.toFixed(4)} en (${extremos.max.x.toFixed(2)}, ${extremos.max.y.toFixed(2)})`;
  document.getElementById('mathMin').textContent = `${extremos.min.f.toFixed(4)} en (${extremos.min.x.toFixed(2)}, ${extremos.min.y.toFixed(2)})`;
  document.getElementById('mathLagrange').textContent = `máx. ${extremos.bordeMax.f.toFixed(4)}, λ≈${extremos.lambdaMax.toFixed(4)}; mín. ${extremos.bordeMin.f.toFixed(4)}, λ≈${extremos.lambdaMin.toFixed(4)}`;
}

function actualizarPanelMatematico() {
  const x = xRover, y = zRover;
  const f = elevacionMatematica(x, y);
  const fx = derivadaX(x, y), fy = derivadaY(x, y);
  const h = derivadasSegundas(x, y);
  const put = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  put('mathF', f.toFixed(4));
  put('mathFx', fx.toFixed(4));
  put('mathFy', fy.toFixed(4));
  put('mathGrad', `(${fx.toFixed(4)}, ${fy.toFixed(4)}); magnitud ${(Math.hypot(fx, fy)).toFixed(4)}`);
  put('mathDireccional', Math.hypot(fx, fy).toFixed(4) + ' unidades por unidad');
  put('mathPlano', `z=${f.toFixed(3)} ${fx >= 0 ? '+' : '−'} ${Math.abs(fx).toFixed(3)}(x−${x.toFixed(2)}) ${fy >= 0 ? '+' : '−'} ${Math.abs(fy).toFixed(3)}(y−${y.toFixed(2)})`);
  put('mathFxx', h.fxx.toFixed(4)); put('mathFyy', h.fyy.toFixed(4)); put('mathFxy', h.fxy.toFixed(4));
  put('mathD', h.discriminante.toFixed(5) + (Math.hypot(fx, fy) < 0.01 ? ' (punto estacionario: aplicar clasificación)' : ' (no es punto crítico: ∇f ≠ 0)'));
}

function iniciarMejorasAdicionales() {
  crearAeropuertoEspacial();
  reducirEtiquetasLugares();
  crearPanelDatosRover();
  crearPanelCalculosDinamicos();
  actualizarPanelMatematico();
  crearBotonConduccionLibre();

  configurarTecladoConduccionLibre();
  configurarBotonesMovimientoLibre();
  configurarCambioDeRuta();

  actualizarDatosRover(performance.now());

  requestAnimationFrame(animarMejorasRover);
}

// Ejecutar las mejoras sin modificar las funciones anteriores.
iniciarMejorasAdicionales();
