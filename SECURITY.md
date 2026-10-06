# Seguridad del sitio y de la cadena de desarrollo

## Auditoría de dependencias (2026-10-06)

`npm audit` reportaba 7 entradas de severidad alta. No eran siete fallos
independientes: todas propagaban **CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm** desde
`braces@3.0.3` por esta cadena de herramientas:

```text
stylelint -> globby / fast-glob -> micromatch -> braces
stylelint-config-standard -> stylelint-config-recommended -> stylelint
```

| Entrada del audit              | Uso en este repositorio                   | Impacto en producción                        |
| ------------------------------ | ----------------------------------------- | -------------------------------------------- |
| `braces`                       | Expansión de patrones del linter CSS      | Ninguno: dependencia exclusiva de desarrollo |
| `micromatch`                   | Patrones usados por Stylelint y Fast Glob | Ninguno: no se publica al navegador          |
| `fast-glob`                    | Descubrimiento de CSS durante el lint     | Ninguno: solo CI/desarrollo                  |
| `globby`                       | Descubrimiento de archivos de Stylelint   | Ninguno: solo CI/desarrollo                  |
| `stylelint`                    | Linter CSS                                | Ninguno: `devDependency`                     |
| `stylelint-config-recommended` | Configuración transitiva del linter       | Ninguno: `devDependency` transitiva          |
| `stylelint-config-standard`    | Configuración del linter                  | Ninguno: `devDependency`                     |

La vulnerabilidad permite agotar la pila de Node con un patrón de llaves
profundamente anidado y no confiable. El sitio es estático, no ejecuta Node en
producción y los visitantes no pueden proporcionar patrones al pipeline. El
riesgo estaba limitado a disponibilidad durante desarrollo/CI.

A fecha de la revisión no existía una versión corregida de `braces` (el aviso
indicaba `first_patched_version: null`). Por ello no se aplicó el downgrade
inseguro sugerido por `npm audit fix --force`: se retiró la cadena afectada y se
sustituyó el lint CSS por `@biomejs/biome`. Después del cambio, `npm audit`
reporta 0 vulnerabilidades. Todas las dependencias directas están fijadas a una
versión exacta y `package-lock.json` se conserva en Git.

Ejecutar antes de integrar cambios:

```sh
npm ci
npm audit
npm run check
```

Dependabot revisa semanalmente tanto dependencias de desarrollo como GitHub
Actions mediante `.github/dependabot.yml`.

## Headers y política del navegador

El hosting actual es **GitHub Pages (legacy, rama `main`)**. GitHub Pages no
ofrece configuración de headers HTTP arbitrarios y no interpreta archivos como
`_headers`; por tanto, no es posible añadir desde este repositorio
`X-Content-Type-Options` ni `Permissions-Policy` como headers de respuesta.
Tampoco se incluyen archivos que aparenten activarlos sin hacerlo realmente.

Como defensa aplicable en el hosting actual, `index.html` incorpora:

- `Content-Security-Policy` mediante `http-equiv`, restringida a recursos
  propios y a los orígenes necesarios de Google Fonts y miniaturas de YouTube;
- `Referrer-Policy` equivalente mediante `<meta name="referrer">` con
  `strict-origin-when-cross-origin`.

La CSP permite `unsafe-inline` **solo para estilos**, porque el documento usa
atributos `style` para iconos y proporciones. Los scripts se limitan a `'self'`
y al hash del bloque JSON-LD. Nexus se usa como destino de enlaces; las imágenes
de mods se sirven localmente y no requieren ampliar `img-src`.

Para disponer de los cuatro headers HTTP solicitados se debe colocar un proxy o
CDN configurable delante de Pages (por ejemplo, Cloudflare) o migrar a un host
que admita reglas de headers. La configuración equivalente recomendada es:

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-fHFIUlfAQBfyPQn1wbPkcYlTBNNkV/386nV2QUuFjlE='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://img.youtube.com; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Al activar esos headers en otro host se debe mantener la meta CSP sincronizada
o retirarla después de comprobar que el header es igual o más restrictivo.
