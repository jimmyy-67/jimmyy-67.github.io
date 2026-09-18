#!/usr/bin/env bash
# Descarga la demo personal-use de Megazoid (DJR) probando varios mirrors.
# Solo se usa en el runner de GitHub Actions (tiene internet abierto).
# Imprime diagnóstico abundante porque no podemos ver los logs desde el sandbox.
set -u
DEST_DIR="${1:-$HOME/.local/share/fonts}"
mkdir -p "$DEST_DIR" /tmp/mz
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

try_file() { # url  -> descarga y valida ttf/otf/zip
  local url="$1" f="/tmp/mz/dl.bin"
  echo "== probando archivo directo: $url"
  curl -sL --max-time 60 -A "$UA" -e "https://befonts.com/megazoid-font.html" "$url" -o "$f" -w "   http=%{http_code} bytes=%{size_download} curl_exit=%{exitcode}\n" || true
  [ -s "$f" ] || { echo "   vacio"; return 1; }
  head -c 4 "$f" | od -An -c | head -1
  if head -c 4 "$f" | grep -q "OTTO\|\\x00\\x01\\x00\\x00" ; then
    cp "$f" "$DEST_DIR/megazoid-probe.otf"; echo "   OK fuente binaria"; return 0
  fi
  if head -c 2 "$f" | grep -q "PK"; then
    unzip -o -q "$f" -d /tmp/mz/extract && find /tmp/mz/extract \( -iname '*.otf' -o -iname '*.ttf' \) -print -exec cp {} "$DEST_DIR/" \; && return 0
    echo "   unzip fallo"; return 1
  fi
  echo "   no es fuente ni zip"; return 1
}

# 1) Befonts: enlace /downfile/ extraído de la página
PAGE=$(curl -sL --max-time 60 -A "$UA" "https://befonts.com/megazoid-font.html" -w "befonts_page curl_exit=%{exitcode} http=%{http_code}\n" -o /tmp/mz/befonts.html) || true
echo "$PAGE"
ls -la /tmp/mz/befonts.html 2>/dev/null || true
for URL in $(grep -oE 'https://befonts\.com/downfile/[^"]*' /tmp/mz/befonts.html 2>/dev/null | sort -u | head -3); do
  try_file "$URL" && { echo "EXITO befonts downfile"; exit 0; }
done

# 2) dafontsfree: enlaces directos zip/otf/ttf de la página
curl -sL --max-time 60 -A "$UA" "https://dafontsfree.net/megazoid-regular-font-download.html" -o /tmp/mz/dff.html -w "dff_page http=%{http_code} curl_exit=%{exitcode}\n" || true
for URL in $(grep -oE 'https?://[^"'\'' ]+\.(zip|otf|ttf)' /tmp/mz/dff.html 2>/dev/null | sort -u | head -5); do
  try_file "$URL" && { echo "EXITO dafontsfree"; exit 0; }
done

# 3) usafonts.pro: formatos directos
curl -sL --max-time 60 -A "$UA" "https://usafonts.pro/fonts/megazoid/" -o /tmp/mz/usa.html -w "usa_page http=%{http_code} curl_exit=%{exitcode}\n" || true
for URL in $(grep -oE 'https?://[^"'\'' ]+\.(zip|otf|ttf)[^"'\'' ]*' /tmp/mz/usa.html 2>/dev/null | sort -u | head -5); do
  try_file "$URL" && { echo "EXITO usafonts"; exit 0; }
done

# 4) azfonts.net
curl -sL --max-time 60 -A "$UA" "https://www.azfonts.net/fonts/megazoid/regular-307572" -o /tmp/mz/az.html -w "az_page http=%{http_code} curl_exit=%{exitcode}\n" || true
for URL in $(grep -oE 'https?://[^"'\'' ]+\.(zip|otf|ttf)[^"'\'' ]*' /tmp/mz/az.html 2>/dev/null | sort -u | head -5); do
  try_file "$URL" && { echo "EXITO azfonts"; exit 0; }
done

echo "FRACASO: ningun mirror devolvio la fuente"
ls -la /tmp/mz || true
exit 1
