# Flujos de Negocio del Sistema

Estos son los procesos principales del sistema y los pasos correctos para completarlos.

---

## 1. Flujo de Orden de Pago → Nómina → Exportar

Este es el flujo más importante del sistema.

```
[1] Crear Orden de Pago (tipo: Nómina)
        ↓
[2] Crear Nómina (estado: Borrador)
        ↓
[3] Desde la Nómina → "Vincular orden de pago"
    (seleccionar la orden creada en el paso 1)
        ↓
[4] Desde la Nómina → "Importar líneas"
    (copia automáticamente los datos de la orden)
        ↓
[5] Revisar las líneas importadas
        ↓
[6] Aprobar la Nómina (solo Supervisor/Admin)
        ↓
[7] Exportar → Excel o Word
```

**Roles que participan:**
- Paso 1: Admin, Supervisor
- Pasos 2-4: Admin, Supervisor, Operador, Auxiliar
- Pasos 5-7: Admin, Supervisor

---

## 2. Flujo de Gasto de Materiales/Servicios

Cuando una orden de pago de materiales o servicios se marca como pagada, el gasto se crea automáticamente en el proyecto.

```
[1] Crear Orden de Pago (tipo: Materiales o Servicios)
        ↓
[2] Marcar la Orden como Pagada
        ↓
[3] ✅ El sistema crea automáticamente un Gasto en el proyecto
    - Tipo Materiales → Categoría "Materiales"
    - Tipo Servicios  → Categoría "Servicios"
        ↓
[4] El gasto aparece en la lista de Gastos del proyecto
```

**Roles que pueden marcar como pagada:** Admin, Supervisor, Auxiliar

---

## 3. Flujo de Cotizaciones

```
[1] Crear Cotización (estado: Pendiente)
        ↓
[2] Cambiar estado a Aprobada
        ↓
[3] Registrar pago de anticipo (si aplica) → estado: Anticipo pagado
        ↓
[4] Estado: En proceso → Parcialmente facturada → Facturada
        ↓
[5] Registrar pago final → estado: Pagada
```

**Nota:** Cada cambio de estado puede tener una nota explicativa.

---

## 4. Flujo de Registro de Gasto Manual

```
[1] Ir a Gastos → "Nuevo gasto"
[2] Seleccionar proyecto, categoría, fecha y monto
[3] Si tiene comprobante fiscal: activar NCF e introducir datos
[4] Opcional: adjuntar foto del recibo (con análisis por IA)
[5] Guardar
```

**Importación masiva desde CSV:**
- Ir a Gastos → "Importar CSV"
- Columnas requeridas: fecha, descripcion, categoria, monto, proyecto
- Columnas opcionales: proveedor, metodo_pago, notas

---

## 5. Flujo de Presupuesto de Proyecto

```
[1] Crear proyecto con Presupuesto estimado
[2] A medida que se registran gastos, el sistema calcula:
    - Total gastado
    - % del presupuesto utilizado
    - Disponible restante
[3] Al llegar al 90% del presupuesto → indicador rojo de alerta
```

---

## 6. Estados de los modelos

### Nóminas
| Estado       | Significado                              |
|-------------|------------------------------------------|
| Borrador     | En edición, se pueden agregar líneas     |
| Aprobada     | Bloqueada para edición, lista para pago  |
| Pagada       | Pago confirmado                          |
| Anulada      | Cancelada (requiere motivo)              |

### Órdenes de Pago
| Estado   | Significado              |
|---------|--------------------------|
| Pendiente | Sin procesar            |
| Pagada   | Marcada como pagada      |
| Anulada  | Cancelada                |

### Gastos
| Estado | Significado          |
|--------|----------------------|
| Activo | Gasto válido         |
| Anulado| Cancelado (con motivo)|

### Cotizaciones
`Pendiente → Aprobada → Anticipo pagado → En proceso → Parcialmente facturada → Facturada → Pagada`
(o en cualquier punto) `→ Cancelada`
