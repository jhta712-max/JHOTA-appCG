# Crear Suplidor desde Orden de Pago

> **Estado:** APROBADO — listo para implementación.

## Objetivo

Agregar un botón "Nuevo Suplidor" en el formulario de Órdenes de Pago que permita crear un suplidor con su cuenta bancaria sin salir del flujo. El suplidor queda registrado permanentemente en el módulo de Suplidores.

## Contexto

El formulario de OP usa un `<select>` que solo muestra suplidores con cuentas bancarias registradas (`bankAccounts.length > 0`). Si el suplidor no existe o no tiene cuenta bancaria, no aparece en la lista. El usuario actualmente debe ir al módulo de Suplidores, crear el suplidor, agregar la cuenta bancaria, y volver a la OP.

## Flujo

1. Usuario abre modal de nueva OP
2. Junto al `<select>` de suplidor aparece botón **"+ Nuevo"**
3. Se abre `QuickCreateSupplierModal` (modal sobre modal)
4. Usuario llena nombre, RNC opcional, y datos de cuenta bancaria
5. Al guardar:
   - `POST /api/v1/suppliers` → crea suplidor
   - `POST /api/v1/suppliers/:id/bank-accounts` → crea cuenta bancaria
6. Se invalida query `['suppliers', 'active-with-bank']`
7. El nuevo suplidor queda auto-seleccionado en el `<select>` de la OP
8. El suplidor aparece en el módulo `/suplidores` de forma permanente

## Componente nuevo

**`apps/frontend/src/components/suppliers/QuickCreateSupplierModal.tsx`**

Props:
```typescript
interface QuickCreateSupplierModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (supplier: { id: string; name: string }) => void;
}
```

### Campos del formulario

**Sección Suplidor:**
| Campo | Requerido | Notas |
|---|---|---|
| Nombre | ✅ | min 2, max 200 |
| RNC | No | validación DGII inline via `useRncValidation` — auto-rellena nombre si coincide |
| Teléfono | No | max 20 |
| Email | No | formato email |

**Sección Cuenta Bancaria** (requerida para que aparezca en lista de OP):
| Campo | Requerido | Notas |
|---|---|---|
| Banco | ✅ | min 2, max 100 |
| Tipo de cuenta | ✅ | enum: 'Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta Nómina' |
| Número de cuenta | ✅ | min 4, max 50 |
| Moneda | ✅ | enum: 'RD$', 'US$', '€' — default 'RD$' |

### Lógica

1. Submit crea el suplidor primero; si falla, no intenta crear la cuenta
2. Si el suplidor se crea pero la cuenta falla, muestra error y deja el suplidor creado (el usuario puede ir a Suplidores a agregar la cuenta manualmente)
3. Usa `FormModal` de `components/ui/FormModal.tsx` — mismo patrón visual del sistema
4. `useRncValidation(rnc)` con debounce 800ms — si DGII retorna nombre, auto-rellena el campo nombre

## Cambios en `PaymentOrdersPage.tsx`

```tsx
// Junto al <select> de suplidor:
<div className="flex gap-2">
  <select ...existing supplier select... />
  <button
    type="button"
    onClick={() => setQuickCreateOpen(true)}
    className="..."
  >
    + Nuevo
  </button>
</div>

<QuickCreateSupplierModal
  open={quickCreateOpen}
  onClose={() => setQuickCreateOpen(false)}
  onCreated={(supplier) => {
    queryClient.invalidateQueries({ queryKey: ['suppliers', 'active-with-bank'] });
    setValue('supplierId', supplier.id); // auto-seleccionar en el form
    setQuickCreateOpen(false);
  }}
/>
```

## Lo que NO cambia

- `SuppliersPage.tsx` — no se modifica
- El endpoint de creación de suplidores — mismo `POST /suppliers`
- El endpoint de cuentas bancarias — mismo `POST /suppliers/:id/bank-accounts`
- La lógica de filtrado del `<select>` (solo suplidores con cuentas bancarias)
- El módulo de Suplidores en la BD — el suplidor creado es idéntico a uno creado desde la página de Suplidores

## Archivos a modificar/crear

| Acción | Archivo |
|---|---|
| Crear | `apps/frontend/src/components/suppliers/QuickCreateSupplierModal.tsx` |
| Modificar | `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx` |
