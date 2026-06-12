// apps/frontend/src/utils/routeMeta.ts
export const PAGE_META: Record<string, { module: string; title: string }> = {
  '/expenses':          { module: 'MÓDULO / GASTOS',        title: 'Gastos'        },
  '/payrolls':          { module: 'MÓDULO / NÓMINAS',       title: 'Nóminas'       },
  '/projects':          { module: 'MÓDULO / PROYECTOS',     title: 'Proyectos'     },
  '/suppliers':         { module: 'MÓDULO / SUPLIDORES',    title: 'Suplidores'    },
  '/payment-orders':    { module: 'MÓDULO / PAGOS',         title: 'Órd. de Pago'  },
  '/pending-orders':    { module: 'MÓDULO / PAGOS',         title: 'Pend. de Pago' },
  '/office-expenses':   { module: 'MÓDULO / OFICINA',       title: 'Gtos. Oficina' },
  '/quotations':        { module: 'MÓDULO / COTIZACIONES',  title: 'Cotizaciones'  },
  '/reports':           { module: 'MÓDULO / REPORTES',      title: 'Reportes'      },
  '/export':            { module: 'MÓDULO / REPORTES',      title: 'Exportar'      },
};
