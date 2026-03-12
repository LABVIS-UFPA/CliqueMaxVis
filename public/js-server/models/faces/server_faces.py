import http.server
import socketserver
import os

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Habilita CORS e Cache para facilitar testes
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

# Adiciona/Força os MIME types corretos que o navegador exige
Handler.extensions_map.update({
    ".wasm": "application/wasm",
    ".js":   "application/javascript",
    ".task": "application/octet-stream", # Binário genérico
})

print(f"✅ Servidor rodando! Acesse: http://localhost:{PORT}/morphing.html")
print(f"📂 Servindo pasta: {os.getcwd()}")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Servidor parado.")