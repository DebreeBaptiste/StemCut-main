#!/bin/bash

# StemCut Launcher - One-click startup script
# Lance le backend FastAPI et le frontend Next.js en parallèle

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🎧✂️  Starting StemCut..."
echo ""

# Nettoyer d'éventuels anciens processus sur les ports
echo "🧹 Nettoyage des anciens processus..."

# Kill any process on port 8000
lsof -ti :8000 | xargs kill -9 2>/dev/null || true

# Kill any process on port 3000
lsof -ti :3000 | xargs kill -9 2>/dev/null || true

# Extra cleanup par nom de process
pkill -9 -f "uvicorn main:app" 2>/dev/null || true
pkill -9 -f "next start" 2>/dev/null || true
pkill -9 -f "next dev" 2>/dev/null || true

sleep 1

# Vérifier si l'environnement virtuel existe
if [ ! -d ".venv" ]; then
    echo "❌ Environnement virtuel .venv non trouvé"
    echo "   Créez-le avec: python3 -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt"
    exit 1
fi

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    exit 1
fi

# Créer un dossier pour les logs
mkdir -p logs

# Fonction pour nettoyer les processus au signal SIGINT
cleanup() {
    echo ""
    echo "🛑 Arrêt de StemCut..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    lsof -ti :8000 | xargs kill -9 2>/dev/null || true
    lsof -ti :3000 | xargs kill -9 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Lancer le backend FastAPI avec l'environnement virtuel (sans --reload en prod)
echo "🐍 Démarrage du backend FastAPI..."
cd "$SCRIPT_DIR/backend"
"$SCRIPT_DIR/.venv/bin/python" -m uvicorn main:app --port 8000 > "$SCRIPT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# Attendre que le backend démarre et vérifier qu'il répond
echo "   Attente du backend..."
for i in {1..15}; do
    if curl -s http://localhost:8000/ > /dev/null 2>&1; then
        echo "   ✓ Backend prêt (PID: $BACKEND_PID)"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "   ⚠️  Backend lent à démarrer, on continue..."
    fi
    sleep 1
done

# Lancer le frontend Next.js en mode production
echo "⚛️  Préparation du frontend Next.js..."
cd "$SCRIPT_DIR/frontend"

# Build si .next n'existe pas ou si le code source a changé
if [ ! -d ".next" ] || [ "$(find app components -newer .next/BUILD_ID 2>/dev/null | head -1)" ]; then
    echo "   📦 Building frontend (première fois ou code modifié)..."
    npm run build > ../logs/frontend-build.log 2>&1
    if [ $? -ne 0 ]; then
        echo "   ❌ Build failed! Check logs/frontend-build.log"
        cat ../logs/frontend-build.log | tail -20
        exit 1
    fi
    echo "   ✓ Build terminé"
fi

echo "⚛️  Démarrage du frontend Next.js (production)..."
PORT=3000 npm run start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

# Attendre que le frontend démarre
echo "   Attente du frontend..."
for i in {1..20}; do
    if curl -s http://localhost:3000/ > /dev/null 2>&1; then
        echo "   ✓ Frontend prêt (PID: $FRONTEND_PID)"
        break
    fi
    if [ $i -eq 20 ]; then
        echo "   ⚠️  Frontend lent à démarrer, on continue..."
    fi
    sleep 1
done

echo ""
echo "✅ StemCut est lancé !"
echo ""
echo "📍 Frontend: http://localhost:3000"
echo "📍 Backend:  http://localhost:8000"
echo ""
echo "📝 Logs:"
echo "   - Backend:  logs/backend.log"
echo "   - Frontend: logs/frontend.log"
echo ""
echo "Pour arrêter: Ctrl+C"
echo ""

# Ouvrir le navigateur (macOS)
if command -v open &> /dev/null; then
    sleep 2
    open http://localhost:3000
fi

# Attendre que les processus se terminent
wait $BACKEND_PID $FRONTEND_PID
