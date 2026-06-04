#!/bin/bash

# setup.sh - Configura el proyecto completo incluyendo Claude skills

set -e  # Detener si hay error

echo "🔧 Configurando proyecto..."
echo ""

# Crear directorio de skills si no existe
mkdir -p .claude/skills

# Variables
TEMP_DIR=$(mktemp -d)
REPO_URL="https://github.com/mattpocock/skills.git"

echo "📥 Descargando skills de Matt Pocock..."
git clone --depth 1 "$REPO_URL" "$TEMP_DIR" 2>/dev/null || {
    echo "⚠️  git clone con --depth falló, intentando sin esa opción..."
    git clone "$REPO_URL" "$TEMP_DIR"
}

echo "📦 Instalando skills..."

# Lista de skills a instalar (puedes modificar esto)
SKILLS_TO_INSTALL=(
    "productivity/grill-me"
)

# Copiar cada skill
for skill in "${SKILLS_TO_INSTALL[@]}"; do
    SKILL_NAME=$(basename "$skill")
    SKILL_SOURCE="$TEMP_DIR/skills/$skill"
    SKILL_DEST=".claude/skills/$SKILL_NAME"

    if [ -d "$SKILL_SOURCE" ]; then
        echo "  ✅ Instalando: $SKILL_NAME"
        cp -r "$SKILL_SOURCE" "$SKILL_DEST"
    else
        echo "  ⚠️  No encontrado: $skill"
    fi
done

# Limpiar descarga temporal
rm -rf "$TEMP_DIR"

echo ""
echo "✅ ¡Setup completado!"
echo ""
echo "📍 Skills disponibles en: .claude/skills/"
echo "🔄 En Claude Code, ejecuta: /skills"
echo ""
echo "💡 Para actualizar skills en el futuro, ejecuta:"
echo "   bash .claude/install-skills.sh"
