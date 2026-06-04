# Guía de Comandos — Para el dueño del proyecto

Esta guía explica **qué comando ejecutar, en qué carpeta ejecutarlo, y para qué sirve**.
No necesitas saber programación para seguirla.

---

## ¿Cómo leer esta guía?

Cada comando tiene este formato:

```
📁 Carpeta donde ejecutar:  /home/user/servingmi-appCG
💻 Comando:  git push origin main
🎯 Para qué: Publica los cambios en producción (Render hace el deploy automático)
```

---

## 1. DEPLOY — Publicar cambios en producción

> Render se actualiza automáticamente cada vez que se hace push a `main`.

```
📁 Carpeta:  /home/user/servingmi-appCG
💻 Comando:  git push origin main
🎯 Para qué: Inicia el deploy automático en Render (backend + frontend)
```

---

## 2. DESARROLLO LOCAL — Iniciar el proyecto en tu computadora

### Iniciar base de datos local (PostgreSQL)
```
📁 Carpeta:  /home/user/servingmi-appCG
💻 Comando:  docker-compose up -d
🎯 Para qué: Levanta la base de datos PostgreSQL localmente
             Acceso a Adminer (visor de BD): http://localhost:8080
```

### Instalar dependencias (una sola vez o cuando hay cambios en package.json)
```
📁 Carpeta:  /home/user/servingmi-appCG
💻 Comando:  pnpm install
🎯 Para qué: Descarga todas las librerías del proyecto
```

### Iniciar el backend (API)
```
📁 Carpeta:  /home/user/servingmi-appCG/apps/backend
💻 Comando:  pnpm dev
🎯 Para qué: Inicia el servidor API en http://localhost:3000
```

### Iniciar el frontend (interfaz web)
```
📁 Carpeta:  /home/user/servingmi-appCG/apps/frontend
💻 Comando:  pnpm dev
🎯 Para qué: Inicia la interfaz web en http://localhost:5173
```

---

## 3. BASE DE DATOS — Migraciones y seed

### Aplicar una migración nueva (cambios de estructura de BD)
```
📁 Carpeta:  /home/user/servingmi-appCG/apps/backend
💻 Comando:  npx prisma migrate dev --name nombre-descripcion
🎯 Para qué: Crea y aplica un cambio de estructura en la base de datos
```

### Cargar datos iniciales (seed)
```
📁 Carpeta:  /home/user/servingmi-appCG/apps/backend
💻 Comando:  npx prisma db seed
🎯 Para qué: Carga los roles, categorías y datos base del sistema
```

### Ver la base de datos visualmente
```
📁 Carpeta:  /home/user/servingmi-appCG/apps/backend
💻 Comando:  npx prisma studio
🎯 Para qué: Abre un visor visual de la BD en http://localhost:5555
```

---

## 4. GIT — Control de versiones

### Ver el estado actual de cambios
```
📁 Carpeta:  /home/user/servingmi-appCG
💻 Comando:  git status
🎯 Para qué: Muestra qué archivos cambiaron
```

### Ver historial de cambios recientes
```
📁 Carpeta:  /home/user/servingmi-appCG
💻 Comando:  git log --oneline -10
🎯 Para qué: Muestra los últimos 10 cambios guardados
```

### Guardar cambios nuevos
```
📁 Carpeta:  /home/user/servingmi-appCG
💻 Comandos:
  git add -A
  git commit -m "Descripción del cambio"
  git push origin main
🎯 Para qué: Guarda y publica los cambios
```

---

## 5. VERIFICAR QUE TODO COMPILA BIEN

### Verificar el frontend (TypeScript)
```
📁 Carpeta:  /home/user/servingmi-appCG/apps/frontend
💻 Comando:  npx tsc --noEmit
🎯 Para qué: Verifica que no hay errores de código en el frontend
             Si no muestra nada = todo bien
```

---

## Resumen de carpetas importantes

| Qué necesitas hacer              | Carpeta donde ejecutar                              |
|----------------------------------|-----------------------------------------------------|
| Deploy, git, instalar todo       | `/home/user/servingmi-appCG`                        |
| Backend, base de datos, Prisma   | `/home/user/servingmi-appCG/apps/backend`           |
| Frontend, TypeScript, interfaz   | `/home/user/servingmi-appCG/apps/frontend`          |
| Ver/editar el schema de la BD    | `/home/user/servingmi-appCG/apps/backend/prisma`    |
| Ver migraciones de BD            | `/home/user/servingmi-appCG/apps/backend/prisma/migrations` |
