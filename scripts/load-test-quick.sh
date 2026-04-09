#!/bin/bash
# ============================================================
# Test de charge rapide (sans k6) - utilise 'hey' ou 'ab'
# Usage: ./scripts/load-test-quick.sh [URL]
# ============================================================

TARGET_URL="${1:-https://app-cloudazure-backend-dev.azurewebsites.net}"
HEALTH_URL="${TARGET_URL}/health"

echo "=========================================="
echo " Test de charge rapide"
echo " Cible: ${TARGET_URL}"
echo "=========================================="

# Détection de l'outil disponible
if command -v hey &> /dev/null; then
    TOOL="hey"
elif command -v ab &> /dev/null; then
    TOOL="ab"
else
    echo "Erreur: installez 'hey' (brew install hey) ou 'ab' (inclus avec Apache)"
    exit 1
fi

echo "Outil: ${TOOL}"
echo ""

run_hey() {
    local phase="$1" concurrency="$2" requests="$3" duration="$4"
    echo "--- Phase: ${phase} (${concurrency} concurrent, ${duration}) ---"
    hey -c "${concurrency}" -z "${duration}" "${HEALTH_URL}"
    echo ""
}

run_ab() {
    local phase="$1" concurrency="$2" requests="$3"
    echo "--- Phase: ${phase} (${concurrency} concurrent, ${requests} requêtes) ---"
    ab -c "${concurrency}" -n "${requests}" -s 10 "${HEALTH_URL}/"
    echo ""
}

if [ "$TOOL" = "hey" ]; then
    echo "Phase 1 : Warm-up"
    run_hey "Warm-up" 5 500 "30s"

    echo "Phase 2 : Montée en charge"
    run_hey "Charge moyenne" 30 2000 "60s"

    echo "Phase 3 : Charge soutenue (déclenche autoscale)"
    run_hey "Charge forte" 80 5000 "180s"

    echo "Phase 4 : Pic de charge"
    run_hey "Pic" 120 3000 "60s"

    echo "Phase 5 : Retour au calme"
    run_hey "Cool-down" 10 500 "60s"
else
    echo "Phase 1 : Warm-up"
    run_ab "Warm-up" 5 200

    echo "Phase 2 : Montée en charge"
    run_ab "Charge moyenne" 30 1000

    echo "Phase 3 : Charge soutenue"
    run_ab "Charge forte" 80 3000

    echo "Phase 4 : Pic de charge"
    run_ab "Pic" 120 2000

    echo "Phase 5 : Retour au calme"
    run_ab "Cool-down" 10 300
fi

echo "=========================================="
echo " Test terminé !"
echo " Vérifiez le portail Azure pour observer :"
echo "  - CPU % du App Service Plan"
echo "  - Nombre d'instances (autoscale)"
echo "  - Métriques Application Gateway"
echo "=========================================="
