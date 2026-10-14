#!/bin/bash
# Dê dois cliques neste arquivo para iniciar o servidor local na porta 5500.
# Para desligar: feche esta janela do Terminal (ou aperte Ctrl+C).
cd "$(dirname "$0")" || exit 1
echo ""
echo "  App:    http://localhost:5500/"
echo "  Admin:  http://localhost:5500/admin/admin.html"
echo ""
echo "  Para desligar, feche esta janela ou aperte Ctrl+C."
echo ""
( sleep 1; open "http://localhost:5500/admin/admin.html" ) &
exec python3 -m http.server 5500 --bind 0.0.0.0
