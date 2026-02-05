#!/bin/bash

# ===========================================
# Demo FaaS - Azure Functions
# Script interactif pour la demo
# ===========================================

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Charger le .env du backend (contient les secrets)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../backend/.env"

if [ -f "$ENV_FILE" ]; then
    export $(grep -E "^AZURE_FUNCTION_" "$ENV_FILE" | xargs)
fi

# Configuration (depuis .env ou variables d'environnement)
FUNCTION_URL="${AZURE_FUNCTION_URL:-}"
FUNCTION_KEY="${AZURE_FUNCTION_KEY:-}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

# Vérifier que les variables sont configurées
if [ -z "$FUNCTION_URL" ] || [ -z "$FUNCTION_KEY" ]; then
    echo -e "${RED}Erreur: Variables AZURE_FUNCTION_URL et AZURE_FUNCTION_KEY non configurées${NC}"
    echo "Configurez-les dans backend/.env"
    exit 1
fi

# Header
show_header() {
    clear
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════╗"
    echo "║        Demo FaaS - Azure Functions           ║"
    echo "╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Menu principal
show_menu() {
    echo ""
    echo -e "${CYAN}=== MENU ===${NC}"
    echo ""
    echo -e "  ${GREEN}1)${NC} Voir les logs d'aujourd'hui"
    echo -e "  ${GREEN}2)${NC} Voir les logs par action (upload/download/delete)"
    echo -e "  ${GREEN}3)${NC} Voir les logs d'une date specifique"
    echo -e "  ${GREEN}4)${NC} Creer un log de test"
    echo -e "  ${GREEN}5)${NC} Voir les statistiques"
    echo -e "  ${GREEN}6)${NC} Ouvrir l'interface web"
    echo ""
    echo -e "  ${YELLOW}7)${NC} Configurer les variables"
    echo -e "  ${RED}q)${NC} Quitter"
    echo ""
}

# Fonction pour faire un appel API
call_api() {
    local endpoint=$1
    local method=${2:-GET}
    local data=$3

    if [ -n "$FUNCTION_KEY" ]; then
        # Direct call to Azure Function
        if [ "$method" == "POST" ]; then
            curl -s -X POST "${FUNCTION_URL}${endpoint}?code=${FUNCTION_KEY}" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s "${FUNCTION_URL}${endpoint}?code=${FUNCTION_KEY}"
        fi
    else
        # Via backend proxy
        if [ "$method" == "POST" ]; then
            curl -s -X POST "${BACKEND_URL}/api/logs" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s "${BACKEND_URL}/api/logs${endpoint}"
        fi
    fi
}

# 1. Logs d'aujourd'hui
show_today_logs() {
    echo ""
    echo -e "${CYAN}=== Logs d'aujourd'hui ===${NC}"
    local today=$(date +%Y-%m-%d)
    echo -e "${YELLOW}Date: $today${NC}"
    echo ""

    local response
    if [ -n "$FUNCTION_KEY" ]; then
        response=$(curl -s "${FUNCTION_URL}/api/getlogs?date=${today}&code=${FUNCTION_KEY}")
    else
        response=$(curl -s "${BACKEND_URL}/api/logs?date=${today}")
    fi

    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    echo ""
}

# 2. Logs par action
show_logs_by_action() {
    echo ""
    echo -e "${CYAN}=== Filtrer par action ===${NC}"
    echo ""
    echo "Actions disponibles:"
    echo -e "  ${GREEN}1)${NC} upload"
    echo -e "  ${GREEN}2)${NC} download"
    echo -e "  ${GREEN}3)${NC} delete"
    echo -e "  ${GREEN}4)${NC} list"
    echo -e "  ${GREEN}5)${NC} error"
    echo ""
    read -p "Choix: " action_choice

    local action
    case $action_choice in
        1) action="upload" ;;
        2) action="download" ;;
        3) action="delete" ;;
        4) action="list" ;;
        5) action="error" ;;
        *) echo -e "${RED}Choix invalide${NC}"; return ;;
    esac

    echo ""
    echo -e "${YELLOW}Action: $action${NC}"

    local response
    if [ -n "$FUNCTION_KEY" ]; then
        response=$(curl -s "${FUNCTION_URL}/api/getlogs?action=${action}&limit=20&code=${FUNCTION_KEY}")
    else
        response=$(curl -s "${BACKEND_URL}/api/logs?action=${action}&limit=20")
    fi

    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    echo ""
}

# 3. Logs par date
show_logs_by_date() {
    echo ""
    echo -e "${CYAN}=== Logs par date ===${NC}"
    read -p "Date (YYYY-MM-DD): " date_input

    echo ""
    echo -e "${YELLOW}Date: $date_input${NC}"

    local response
    if [ -n "$FUNCTION_KEY" ]; then
        response=$(curl -s "${FUNCTION_URL}/api/getlogs?date=${date_input}&code=${FUNCTION_KEY}")
    else
        response=$(curl -s "${BACKEND_URL}/api/logs?date=${date_input}")
    fi

    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    echo ""
}

# 4. Creer un log de test
create_test_log() {
    echo ""
    echo -e "${CYAN}=== Creer un log de test ===${NC}"
    echo ""

    local data='{
        "action": "upload",
        "fileName": "demo-test.pdf",
        "fileSize": 12345,
        "userId": "demo@prof.fr",
        "details": "Test de demo FaaS"
    }'

    echo -e "${YELLOW}Envoi du log:${NC}"
    echo "$data" | python3 -m json.tool
    echo ""

    local response
    if [ -n "$FUNCTION_KEY" ]; then
        response=$(curl -s -X POST "${FUNCTION_URL}/api/logactivity?code=${FUNCTION_KEY}" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -X POST "${BACKEND_URL}/api/logs" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    echo -e "${GREEN}Reponse:${NC}"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    echo ""
}

# 5. Statistiques
show_stats() {
    echo ""
    echo -e "${CYAN}=== Statistiques ===${NC}"
    local today=$(date +%Y-%m-%d)
    echo -e "${YELLOW}Date: $today${NC}"
    echo ""

    local response=$(curl -s "${BACKEND_URL}/api/logs/stats?date=${today}")
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    echo ""
}

# 6. Ouvrir l'interface web
open_web() {
    echo ""
    echo -e "${CYAN}=== Interface Web ===${NC}"
    echo ""

    local url="${FRONTEND_URL:-http://localhost:5173}/logs"
    echo -e "Ouverture de: ${GREEN}$url${NC}"

    # Detecter l'OS et ouvrir le navigateur
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$url"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "$url" 2>/dev/null || echo "Ouvrez manuellement: $url"
    else
        echo "Ouvrez manuellement: $url"
    fi
    echo ""
}

# 7. Configurer les variables
configure() {
    echo ""
    echo -e "${CYAN}=== Configuration ===${NC}"
    echo ""
    echo "Variables actuelles:"
    echo -e "  FUNCTION_URL: ${GREEN}$FUNCTION_URL${NC}"
    echo -e "  FUNCTION_KEY: ${GREEN}${FUNCTION_KEY:0:10}...${NC}"
    echo -e "  BACKEND_URL:  ${GREEN}$BACKEND_URL${NC}"
    echo ""
    echo "Pour modifier, exportez les variables avant de lancer le script:"
    echo ""
    echo -e "${YELLOW}export AZURE_FUNCTION_URL=\"https://...\"${NC}"
    echo -e "${YELLOW}export AZURE_FUNCTION_KEY=\"votre-cle\"${NC}"
    echo -e "${YELLOW}export BACKEND_URL=\"http://localhost:3001\"${NC}"
    echo ""
}

# Pause
pause() {
    echo ""
    read -p "Appuyez sur Entree pour continuer..."
}

# Boucle principale
main() {
    while true; do
        show_header
        show_menu
        read -p "Choix: " choice

        case $choice in
            1) show_today_logs; pause ;;
            2) show_logs_by_action; pause ;;
            3) show_logs_by_date; pause ;;
            4) create_test_log; pause ;;
            5) show_stats; pause ;;
            6) open_web; pause ;;
            7) configure; pause ;;
            q|Q) echo -e "${GREEN}Au revoir!${NC}"; exit 0 ;;
            *) echo -e "${RED}Choix invalide${NC}"; pause ;;
        esac
    done
}

# Lancement
main
