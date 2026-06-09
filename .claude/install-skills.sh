#!/bin/bash

set -e

SKILLS_DIR=".claude/skills"

# --- Matt Pocock skills (selective) ---
MATTPOCOCK_REPO="https://github.com/mattpocock/skills.git"
echo "📥 Actualizando skills de Matt Pocock..."
TEMP1=$(mktemp -d)
git clone --depth 1 "$MATTPOCOCK_REPO" "$TEMP1" 2>/dev/null || git clone "$MATTPOCOCK_REPO" "$TEMP1"

MATTPOCOCK_SKILLS=(
    "productivity/grill-me"
)
for skill in "${MATTPOCOCK_SKILLS[@]}"; do
    SKILL_NAME=$(basename "$skill")
    echo "📦 $SKILL_NAME..."
    rm -rf "$SKILLS_DIR/$SKILL_NAME"
    cp -r "$TEMP1/skills/$skill" "$SKILLS_DIR/$SKILL_NAME"
done
rm -rf "$TEMP1"

# --- obra/superpowers (all skills) ---
SUPERPOWERS_REPO="https://github.com/obra/superpowers.git"
echo "📥 Actualizando skills de obra/superpowers..."
TEMP2=$(mktemp -d)
git clone --depth 1 "$SUPERPOWERS_REPO" "$TEMP2" 2>/dev/null || git clone "$SUPERPOWERS_REPO" "$TEMP2"

for skill_dir in "$TEMP2/skills"/*/; do
    SKILL_NAME=$(basename "$skill_dir")
    echo "📦 $SKILL_NAME..."
    rm -rf "$SKILLS_DIR/$SKILL_NAME"
    cp -r "$skill_dir" "$SKILLS_DIR/$SKILL_NAME"
done
rm -rf "$TEMP2"

echo "✅ Skills actualizados"
