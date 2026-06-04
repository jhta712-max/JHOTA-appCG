#!/bin/bash

set -e

SKILLS_DIR=".claude/skills"
MATTPOCOCK_REPO="https://github.com/mattpocock/skills.git"

echo "📥 Actualizando skills de Matt Pocock..."

TEMP_DIR=$(mktemp -d)
git clone --depth 1 "$MATTPOCOCK_REPO" "$TEMP_DIR" 2>/dev/null || \
git clone "$MATTPOCOCK_REPO" "$TEMP_DIR"

SKILLS_TO_INSTALL=(
    "productivity/grill-me"
)

for skill in "${SKILLS_TO_INSTALL[@]}"; do
    SKILL_NAME=$(basename "$skill")
    echo "📦 Actualizando $SKILL_NAME..."
    rm -rf "$SKILLS_DIR/$SKILL_NAME"
    cp -r "$TEMP_DIR/skills/$skill" "$SKILLS_DIR/$SKILL_NAME"
done

rm -rf "$TEMP_DIR"

echo "✅ Skills actualizados"
