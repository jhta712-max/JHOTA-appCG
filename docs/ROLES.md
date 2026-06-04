# Roles y Permisos del Sistema

El sistema tiene **5 roles**. Cada uno ve una interfaz diferente.

---

## Mapa de permisos por rol

| Función                          | Admin | Supervisor | Operador | Auxiliar | Financiero |
|----------------------------------|:-----:|:----------:|:--------:|:--------:|:----------:|
| Ver dashboard                    | ✅    | ✅         | ✅       | ✅       | ✅         |
| Ver proyectos                    | ✅    | ✅         | ✅       | ❌       | ✅         |
| Crear/editar proyectos           | ✅    | ✅         | ❌       | ❌       | ❌         |
| Ver gastos                       | ✅    | ✅         | ✅       | ❌       | ✅         |
| Crear gastos                     | ✅    | ✅         | ✅       | ❌       | ❌         |
| Anular/editar gastos             | ✅    | ✅         | ❌       | ❌       | ❌         |
| Ver cotizaciones                 | ✅    | ✅         | ✅       | ❌       | ✅         |
| Crear cotizaciones               | ✅    | ✅         | ✅       | ❌       | ❌         |
| Gestionar cotizaciones (estados) | ✅    | ✅         | ❌       | ❌       | ❌         |
| Ver nóminas                      | ✅    | ✅         | ✅       | ✅       | ❌         |
| Crear/editar nóminas             | ✅    | ✅         | ✅       | ✅       | ❌         |
| Aprobar/pagar nóminas            | ✅    | ✅         | ❌       | ❌       | ❌         |
| Ver órdenes de pago pendientes   | ✅    | ✅         | ❌       | ✅       | ❌         |
| Crear órdenes de pago            | ✅    | ✅         | ❌       | ❌       | ❌         |
| Marcar órdenes como pagadas      | ✅    | ✅         | ❌       | ✅       | ❌         |
| Ver reportes                     | ✅    | ✅         | ❌       | ❌       | ✅         |
| Exportar a Excel                 | ✅    | ✅         | ❌       | ❌       | ✅         |
| Gastos de oficina                | ✅    | ✅         | ❌       | ❌       | ✅         |
| Administrar usuarios             | ✅    | ❌         | ❌       | ❌       | ❌         |
| Categorías, tarjetas             | ✅    | ❌         | ❌       | ❌       | ❌         |
| Panel de monitoreo               | ✅    | ❌         | ❌       | ❌       | ❌         |
| **Cambiar vista de rol**         | ✅    | ❌         | ❌       | ❌       | ❌         |

---

## Descripción de cada rol

### 👑 Admin
- Acceso total sin restricciones
- Puede ver la interfaz como cualquier otro rol (menú "Vista como...")
- Gestiona usuarios, categorías, tarjetas y monitoreo del sistema

### 🔧 Supervisor
- Gestión completa de proyectos, gastos, cotizaciones, nóminas y órdenes de pago
- No puede administrar usuarios ni ver el panel de monitoreo

### 👷 Operador
- Registra gastos, crea cotizaciones y nóminas
- NO puede aprobar ni eliminar — solo crear y editar en borrador

### 📋 Auxiliar Administrativo
- Su flujo principal: Ver y marcar órdenes de pago pendientes
- Puede crear y editar nóminas (introducir datos de pago)
- NO puede aprobar nóminas ni crear órdenes

### 📊 Financiero
- Solo lectura sobre: proyectos, gastos, cotizaciones, reportes
- Puede exportar a Excel
- NO puede crear ni modificar nada

---

## Flujo de invitación de usuarios

1. Admin va a **Usuarios** → "Invitar usuario"
2. Introduce el email y selecciona el rol
3. El usuario recibe un email con enlace de activación
4. El usuario crea su contraseña y ya puede entrar

---

## Cambiar el rol de un usuario existente

Solo el Admin puede hacerlo desde **Usuarios** → seleccionar el usuario → cambiar rol.
