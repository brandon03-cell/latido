# Latido

Web de ejemplo para conectar hospitales y centros de transfusión que necesitan sangre con personas que quieren donar. Es un sitio estático (HTML, CSS y JavaScript), sin dependencias ni build.

**Ver la web:** https://latido-psi.vercel.app

## Desplegar tu propia copia en Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fbrandon03-cell%2Flatido)

1. Pulsa el botón y entra con tu cuenta de GitHub.
2. Deja los ajustes por defecto y pulsa **Deploy**.
3. En un minuto tendrás tu propia URL.

## Verla en local

Abre `index.html` en el navegador. No hace falta instalar nada.

Los datos (citas y solicitudes) se guardan solo en el navegador de cada persona.

## Datos para el Atomic Design

Colores, fuentes, medidas y componentes sacados de `css/styles.css` e `index.html`, para pasarlos a Figma. **Plana** = entra en una versión sencilla y plana; **Deco** = decoración o animación que se puede quitar.
### 1. Colores (tema claro)

| Variable CSS | Hex | Para qué se usa | Uso |
|---|---|---|---|
| `--bg` | `#FBF7F7` | Fondo de la página | Plana |
| `--bg-alt` | `#F5ECEE` | Fondo de secciones alternas (Qué donar, Compatibilidad, FAQ) | Plana |
| `--surface` | `#FFFFFF` | Fondo de tarjetas, inputs, filtros, modal | Plana |
| `--surface-2` | `#FCF3F4` | Fondo suave: control segmentado, tarjeta cubierta, chip de tipo | Plana |
| `--ink` | `#25090E` | Texto principal y títulos | Plana |
| `--ink-2` | `#5A3940` | Texto secundario (párrafos, metadatos) | Plana |
| `--muted` | `#86666C` | Texto apagado (letra pequeña, iconos, leyendas) | Plana |
| `--line` | `#EBDADD` | Bordes finos de tarjetas y separadores | Plana |
| `--line-strong` | `#D8BCC2` | Bordes de inputs, chips y botón secundario | Plana |
| `--crimson` | `#B0102C` | Rojo de marca: enlaces, texto de grupo sanguíneo, borde en foco | Plana |
| `--crimson-hot` | `#D6243E` | Rojo vivo: gota del logo, subrayado del menú | Plana |
| `--crimson-soft` | `#FBE4E8` | Fondo rosa de las insignias de grupo y del anillo de foco | Plana |
| `--crimson-line` | `rgba(176,16,44,.28)` | Borde de insignia de grupo y de tarjeta crítica | Plana |
| `--btn-bg` | `#B0102C` | Botón principal, chip seleccionado, insignia "Crítica" | Plana |
| `--btn-bg-hover` | `#920B23` | Botón principal al pasar el ratón | Plana |
| `--plasma` | `#D99A12` | Ámbar: iconos de plasma y plaquetas | Plana |
| `--plasma-soft` | `#FCF0D4` | Fondo ámbar suave | Plana |
| `--plasma-ink` | `#7A5200` | Texto sobre fondo ámbar | Plana |
| `--scrub` | `#0E7A70` | Verde quirófano: urgencia "Normal", "cubierta", éxito | Plana |
| `--scrub-soft` | `#DDF2EE` | Fondo de la insignia "Normal" | Plana |
| `--warn` | `#B93C0A` | Naranja: urgencia "Urgente" | Plana |
| `--warn-soft` | `#FDEBDD` | Fondo de la insignia "Urgente" | Plana |
| `--error` | `#B0102C` | Mensajes de error de formulario | Plana |
| `--focus` | `#D6243E` | Contorno de foco del teclado (3px) | Plana |
| `--header-bg` | `rgba(251,247,247,.84)` | Cabecera translúcida con desenfoque | Deco (usar `#FFFFFF` sólido) |
| `--glass-bg` / `--glass-line` | `rgba(255,255,255,.55)` / `rgba(90,40,50,.28)` | Efecto cristal | Deco |

Colores fijos de las zonas oscuras:

| Dónde | Hex | Uso |
|---|---|---|
| Fondo del hero | degradado `#5A0B1C` → `#2A0610` → `#140205` | Plana con color sólido `#2A0610` (o `#5A0B1C` si se quiere más rojo); el degradado es Deco |
| Texto sobre oscuro (`--scene-ink`) | `#FFF1F3` | Plana |
| Texto secundario sobre oscuro (`--scene-muted`) | `#F0C3CB` | Plana |
| Rojo destacado sobre oscuro (`--scene-hot`) | `#FF4D66` | Plana (segunda línea del titular, "Su latido.") |
| Banda de urgentes (fondo) | `#B0102C` | Plana, como franja fija sin movimiento |
| Banda de urgentes (etiqueta "Urgente") | `#7E0A1F` | Plana |
| Pie y sección Centros (`.band-dark`) fondo | `#1A0409` | Plana |
| Pie: superficie / texto / texto 2 / borde | `#280B13` / `#FFEFF2` / `#E6C3CA` / `#4A1C27` | Plana |
| Pie: rojo y botón | `#FF5A70` / `#D91F3E` | Plana |

Modo oscuro completo (`--bg #12070A`, `--surface #1F0D12`, `--ink #F7E8EA`, `--crimson #FF5A70`, etc.): **Deco**, no lo necesitamos.

Nota: la referencia no usa azul. Si queremos rojos y azules como dice nuestro plan, el verde `#0E7A70` es el que hace de color secundario; se podría cambiar por un azul, pero sería una decisión del grupo.

### 2. Tipografía

Fuentes de Google Fonts:
- **Archivo** (todo el texto). Pesos usados: 400, 600, 650, 700, 750, 800, 900. La referencia ensancha las letras de los títulos (`font-stretch` 105 a 125%); en la versión plana basta con Archivo normal.
- **IBM Plex Mono** (datos: grupos sanguíneos, contadores, etiquetas en mayúsculas). Pesos 400, 500, 600.

| Estilo | Fuente | Tamaño | Peso | Interlineado / espaciado | Uso |
|---|---|---|---|---|---|
| Titular del hero (h1) | Archivo | 42 a 106px (en escritorio ~96px) | 800 | 0.94 / -3.5% | Plana (sin animación letra a letra) |
| Título de sección (h2) | Archivo | 32 a 56px | 800 | 1.02 / -2.5% | Plana |
| Título de tarjeta (h3) | Archivo | 20.5px | 750 | 1.2 / -1% | Plana |
| Nombre del centro en tarjeta | Archivo | 20px | 750 | 1.2 | Plana |
| Texto base | Archivo | 17px | 400 | 1.6 | Plana |
| Entradilla de sección | Archivo | 17 a 19px | 400 | 1.6, color `--ink-2` | Plana |
| Texto pequeño | Archivo | 13.5px | 400 | 1.5, color `--muted` | Plana |
| Botón | Archivo | 15.7px (16) | 700 | 1.15 | Plana |
| Enlace del menú | Archivo | 15px | 600 | color `--ink-2` | Plana |
| Logo "Latido" | Archivo | 22px | 800 | 1 / -3% | Plana |
| Eyebrow (antetítulo) | IBM Plex Mono | 12px | 500 | +14%, MAYÚSCULAS, rojo, con raya de 22x2px delante | Plana |
| Insignia de grupo (A+, O-...) | IBM Plex Mono | 14.7px | 600 | 1.3 | Plana |
| Etiquetas de urgencia | IBM Plex Mono | 11px | 600 | +10%, MAYÚSCULAS | Plana |
| Número grande de estadística | Archivo | 30 a 48px | 800 | 1 / -2% | Plana |
| Rótulo de estadística | IBM Plex Mono | 11px | 400 | +10%, MAYÚSCULAS | Plana |
| Palabra gigante del pie | Archivo | 64 a 264px | 900 | contorno 1.5px | Deco |

### 3. Radios, sombras y espaciado

| Elemento | Valor | Uso |
|---|---|---|
| `--radius`: tarjetas de solicitud, panel de filtros | 20px | Plana |
| Tarjetas de "Qué donar" | 24px | Plana |
| Modal | 26px | Plana |
| Tarjeta destacada del hero | 22px | Plana |
| Inputs, chips de grupo | 12px | Plana |
| Insignia de grupo | 8px | Plana |
| Checkbox | 7px | Plana |
| Botones, buscador, etiquetas, interruptor | 999px (píldora) | Plana |
| `--shadow-1` | `0 1px 2px rgba(60,10,20,.05), 0 6px 20px rgba(60,10,20,.06)` | Plana (sombra suave de tarjetas; en estilo plano se puede quitar y dejar solo el borde) |
| `--shadow-2` | `0 2px 6px rgba(60,10,20,.07), 0 22px 50px rgba(60,10,20,.14)` | Deco (sombra al pasar el ratón) |
| Sombra del botón principal | `0 8px 22px -10px rgba(176,16,44,.7)` | Deco |
| Ancho máximo del contenido | 1240px | Plana |
| Márgenes laterales (`--gutter`) | 16 a 40px | Plana |
| Alto de la cabecera | 68px | Plana |
| Separación vertical de secciones | 72 a 136px | Plana |
| Separación entre tarjetas | 20px (columnas de mínimo 330px) | Plana |
| Relleno de tarjeta | 22px (las de "Qué donar" 24px) | Plana |
| Contorno de foco | 3px `--focus`, separado 3px | Plana |

### 4. Átomos

| Átomo | Estilo | Uso |
|---|---|---|
| Botón principal | Fondo `#B0102C`, texto blanco, 700 16px, relleno 13x22px, píldora. Hover `#920B23` | Plana |
| Botón secundario | Transparente, borde 1.5px `#D8BCC2`, texto `#25090E`. Hover borde `#25090E` | Plana |
| Botón sobre fondo oscuro | Fondo `rgba(255,255,255,.06)`, borde `rgba(255,230,235,.32)`, texto `#FFF1F3` | Plana (sin desenfoque) |
| Tamaños de botón | sm: 14.4px, relleno 9x16px. lg: 16.6px, relleno 17x28px | Plana |
| Botón icono | Círculo 42px, icono 20px, hover fondo gris 14% | Plana |
| Enlace botón | Texto `--muted` 14px 600, subrayado al pasar | Plana |
| Chip de grupo sanguíneo (filtro) | 42px alto, mín. 50px ancho, radio 12px, borde 1.5px `#D8BCC2`, fondo blanco, Plex Mono 15px 600. Seleccionado: fondo `#B0102C`, texto blanco | Plana |
| Insignia de grupo sanguíneo | Fondo `#FBE4E8`, borde 1px `crimson-line`, texto `#B0102C`, Plex Mono 14.7px 600, radio 8px, mín. 43px ancho | Plana |
| Etiqueta Crítica | Fondo `#B0102C`, texto blanco, punto de 7px | Plana (el punto que late es Deco) |
| Etiqueta Urgente | Fondo `#FDEBDD`, texto `#B93C0A` | Plana |
| Etiqueta Normal | Fondo `#DDF2EE`, texto `#0E7A70` | Plana |
| Chip de tipo de donación | Píldora, borde `#EBDADD`, fondo `#FCF3F4`, 13.4px 650, icono rojo (sangre) o ámbar (plasma, plaquetas) | Plana |
| Input / select / textarea | 48px alto, radio 12px, borde 1.5px `#D8BCC2`, 16px. Foco: borde `#B0102C` y anillo 4px `#FBE4E8`. Error: borde y fondo rosa | Plana |
| Buscador | 46px alto, píldora, icono lupa a 15px de la izquierda | Plana |
| Interruptor (switch) | 46x26px, bola 20px blanca. Apagado `#D8BCC2`, encendido `#B0102C` | Plana |
| Checkbox | 22px, radio 7px, borde 2px `#D8BCC2`. Marcado fondo `#B0102C` con check blanco | Plana |
| Control segmentado (Todas/Sangre/Plaquetas/Plasma) | Contenedor radio 24px, relleno 4px, fondo `#FCF3F4`. Opción 14.7px 650, relleno 9x17px. Activa: fondo `#25090E`, texto `#FBF7F7` | Plana |
| Barra de progreso (donantes) | 8px alto, píldora, fondo `#EBDADD`, relleno `#B0102C` (verde `#0E7A70` si está cubierta) | Plana (el brillo que se mueve es Deco) |
| Eyebrow | Ver tipografía | Plana |
| Contador del menú | Píldora 20px, fondo `#B0102C`, Plex Mono 11.5px | Plana |
| Iconos | Línea de 1.8px, extremos redondeados, caja 24x24, color heredado | Plana |

Iconos del sprite: gota (sangre), gota con onda (plasma), plaquetas, chincheta (ubicación), reloj, calendario, check, cruz, flecha, corazón, copiar, alerta, edificio (hospital), lupa, sol, luna, menú, células, cordón umbilical, info, recargar. Para nuestro Atomic Design bastan gota, plasma, plaquetas, chincheta, reloj, calendario, edificio, flecha, check, menú y lupa. Sol y luna son del modo oscuro: Deco.

Logo: gota `#D6243E` con una línea de electro blanca de 2px, 26x32px, al lado el nombre. Plana; el latido del logo es Deco.

### 5. Moléculas

| Molécula | Composición | Uso |
|---|---|---|
| Tarjeta de solicitud | Fondo blanco, borde `#EBDADD`, radio 20px, relleno 22px, separación 14px. Arriba: etiqueta de urgencia + chip de tipo. Nombre del centro, ubicación con chincheta, insignias de grupo, nota, barra de progreso con "X de Y donantes", y pie con línea discontinua `#D8BCC2`, plazo con reloj y botón "Reservar cita". Si es crítica, borde `crimson-line` | Plana (la línea de electro que corre, la entrada animada y la elevación al pasar son Deco) |
| Tarjeta destacada "La más urgente" (hero) | Radio 22px, relleno 22px, borde `rgba(255,210,218,.22)` | Plana con fondo sólido `#3D0B17` o blanco al 8%; el cristal, la flotación y la inclinación 3D son Deco |
| Estadística del hero | Número grande + rótulo mono, separadas por línea `rgba(255,210,218,.14)` | Plana (el salto del número es Deco) |
| Campo de formulario | Etiqueta 14.7px 650 + input + ayuda o error 13.6px 600 rojo | Plana |
| Grupo de filtro sanguíneo | Rótulo mono 11.5px MAYÚSCULAS `--muted` + fila de chips | Plana |
| Tarjeta de tipo de donación | Radio 24px, borde, arriba ilustración, abajo título, texto y tabla de datos (rótulo mono a la izquierda, valor a la derecha, separadas por línea) | Plana (la ola que sube en la gota es Deco; usar imagen fija) |
| Tarjeta mini (opciones futuras) | Radio 24px, relleno 24px, icono en círculo 52px `#FBE4E8` | Plana |
| Paso del proceso | Número en círculo + título + texto + tiempo | Plana (el encendido al hacer scroll es Deco) |
| Pregunta FAQ | Línea `#D8BCC2`, pregunta en negrita, + que gira, respuesta `--ink-2` | Plana |
| Nodo de compatibilidad | Chip de grupo grande; resaltado si es compatible | Plana (las líneas y partículas animadas son Deco) |

### 6. Organismos

| Organismo | Notas | Uso |
|---|---|---|
| Cabecera / navbar | 68px de alto, logo a la izquierda, enlaces a la derecha, botón "Quiero donar". Fondo blanco con borde inferior `#EBDADD`. En móvil, menú hamburguesa | Plana (transparencia sobre el hero, desenfoque y barra de progreso de scroll son Deco) |
| Hero | Fondo oscuro sólido, eyebrow, titular de 2 líneas (la segunda en `#FF4D66`), texto, 2 botones, tarjeta destacada y fila de 4 estadísticas | Plana. **Deco: el canvas de glóbulos rojos, la línea de electro, el titular letra a letra y el brillo del titular** |
| Banda de urgentes | Franja `#B0102C` con etiqueta `#7E0A1F` | Plana como franja fija; el desplazamiento continuo es Deco |
| Panel de filtros | Fondo blanco, borde, radio 20px, relleno 18px. Segmentado, buscador, interruptor "Solo urgentes", chips de grupo | Plana |
| Rejilla de solicitudes | Tarjetas de solicitud en columnas de mín. 330px, separación 20px | Plana |
| Qué donar | 3 tarjetas de tipo + 2 tarjetas mini | Plana |
| Tres vidas | En la referencia es una centrifugadora animada | Deco. En nuestra versión son 3 tarjetas (ya decidido) |
| Compatibilidad | Dos filas de grupos y resultado | Plana como rejilla de chips, sin líneas animadas |
| Cómo donar | 4 pasos | Plana; la bolsa que se llena y el test son Deco (ya decidido) |
| Formulario de centros | Sección oscura `#1A0409`, bloques de formulario | Plana |
| Pie | Fondo `#1A0409`, 3 columnas (marca, enlaces, emergencias 112 en `#FF5A70`), línea inferior | Plana; la palabra gigante con relleno animado es Deco |
| Modal de reservar cita | Ancho 620px, radio 26px, fondo blanco | Plana (opcional) |
| Aviso (toast) | Mensaje pequeño abajo | Opcional |

### 7. Resumen de lo que no hacemos (Deco)

Canvas de glóbulos rojos del hero, línea de electro del hero y de las tarjetas, titular letra a letra y su brillo, logo que late, tarjeta flotante con inclinación 3D, efecto cristal y desenfoques, degradados del hero, banda que se desplaza, brillo en las barras de progreso, efecto onda al pulsar botones, números que saltan, centrifugadora, bolsa que se llena, partículas de compatibilidad, palabra gigante del pie, modo oscuro y las 36 animaciones `@keyframes`. Lo único que sí animamos es lo que pide el enunciado: el giro de las 4 tarjetas flip al pasar el ratón.
