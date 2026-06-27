export default function PrivacyPolicyPage() {
  return (
    <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', background: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#0D1B48', padding: '24px 40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div>
          <p style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#1D4ED8', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
            SERVINGMI
          </p>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#fff', fontSize: '28px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Política de Privacidad
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: '4px 0 0' }}>
            Última actualización: 16 de junio de 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#0D1B48', borderBottom: '2px solid #1D4ED8', paddingBottom: '8px', marginBottom: '16px' }}>
            1. Identificación del Responsable
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7 }}>
            <strong>SERVINGMI</strong> es un sistema de gestión y control de gastos por proyectos para empresas
            del sector de la construcción, operado por <strong>SERVINGMI S.R.L.</strong>, República Dominicana.
            Para consultas sobre privacidad, puede contactarnos a través de los canales habilitados en la plataforma.
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#0D1B48', borderBottom: '2px solid #1D4ED8', paddingBottom: '8px', marginBottom: '16px' }}>
            2. Datos que Recopilamos
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '12px' }}>
            Recopilamos únicamente los datos necesarios para la operación del sistema:
          </p>
          <ul style={{ color: '#374151', lineHeight: 2, paddingLeft: '24px' }}>
            <li><strong>Datos de cuenta:</strong> nombre, correo electrónico, número de teléfono (para notificaciones WhatsApp opcionales).</li>
            <li><strong>Datos de operación:</strong> registros de gastos, órdenes de pago, nóminas, proyectos y cotizaciones ingresados por los usuarios autorizados de la empresa.</li>
            <li><strong>Datos de comunicación:</strong> mensajes enviados y recibidos a través del chatbot de WhatsApp integrado en la plataforma, para la gestión de solicitudes.</li>
            <li><strong>Datos técnicos:</strong> registros de acceso y auditoría para seguridad del sistema.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#0D1B48', borderBottom: '2px solid #1D4ED8', paddingBottom: '8px', marginBottom: '16px' }}>
            3. Uso de WhatsApp y Mensajería
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '12px' }}>
            SERVINGMI utiliza la API de WhatsApp Business (a través de UltraMsg) para:
          </p>
          <ul style={{ color: '#374151', lineHeight: 2, paddingLeft: '24px' }}>
            <li>Enviar notificaciones operativas a usuarios que han optado por recibirlas (alertas de presupuesto, nóminas, órdenes de pago).</li>
            <li>Recibir y procesar consultas de gestión a través del chatbot automatizado.</li>
          </ul>
          <p style={{ color: '#374151', lineHeight: 1.7, marginTop: '12px' }}>
            La participación en las comunicaciones por WhatsApp es <strong>voluntaria y opt-in</strong>. Los usuarios pueden desactivar este canal en cualquier momento desde la configuración de su perfil.
            Los mensajes intercambiados se almacenan en la plataforma únicamente para fines de auditoría y trazabilidad operativa.
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#0D1B48', borderBottom: '2px solid #1D4ED8', paddingBottom: '8px', marginBottom: '16px' }}>
            4. Finalidad del Tratamiento
          </h2>
          <ul style={{ color: '#374151', lineHeight: 2, paddingLeft: '24px' }}>
            <li>Gestión y control de gastos, nóminas y proyectos de construcción.</li>
            <li>Generación de reportes financieros para uso interno de la empresa.</li>
            <li>Envío de alertas y notificaciones operativas.</li>
            <li>Cumplimiento de obligaciones fiscales (generación de reportes DGII 606).</li>
            <li>Seguridad y auditoría del sistema.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#0D1B48', borderBottom: '2px solid #1D4ED8', paddingBottom: '8px', marginBottom: '16px' }}>
            5. Compartición de Datos con Terceros
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '12px' }}>
            No vendemos ni cedemos datos personales a terceros con fines comerciales. Compartimos datos
            únicamente con proveedores de servicios tecnológicos necesarios para la operación:
          </p>
          <ul style={{ color: '#374151', lineHeight: 2, paddingLeft: '24px' }}>
            <li><strong>Render.com</strong> — infraestructura de alojamiento y base de datos.</li>
            <li><strong>UltraMsg / Meta (WhatsApp Business API)</strong> — envío y recepción de mensajes.</li>
            <li><strong>Anthropic (Claude AI)</strong> — procesamiento de OCR de facturas y chatbot.</li>
            <li><strong>Google (Gmail SMTP)</strong> — envío de notificaciones por correo electrónico.</li>
          </ul>
          <p style={{ color: '#374151', lineHeight: 1.7, marginTop: '12px' }}>
            Todos los proveedores están sujetos a sus propias políticas de privacidad y cumplen con estándares de seguridad reconocidos.
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#0D1B48', borderBottom: '2px solid #1D4ED8', paddingBottom: '8px', marginBottom: '16px' }}>
            6. Retención de Datos
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7 }}>
            Los datos operativos se conservan durante la vigencia del contrato de servicio y por el período
            requerido por la legislación fiscal dominicana (mínimo 10 años para documentos contables).
            Los registros de conversaciones de WhatsApp se conservan por un máximo de 90 días para fines de auditoría.
            Los datos de acceso y logs de seguridad se conservan por 12 meses.
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#0D1B48', borderBottom: '2px solid #1D4ED8', paddingBottom: '8px', marginBottom: '16px' }}>
            7. Derechos de los Usuarios
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '12px' }}>
            Los usuarios de la plataforma tienen derecho a:
          </p>
          <ul style={{ color: '#374151', lineHeight: 2, paddingLeft: '24px' }}>
            <li>Acceder a sus datos personales almacenados en el sistema.</li>
            <li>Solicitar la corrección de datos inexactos.</li>
            <li>Optar por no recibir notificaciones de WhatsApp en cualquier momento.</li>
            <li>Solicitar la eliminación de su cuenta al administrador del sistema.</li>
          </ul>
          <p style={{ color: '#374151', lineHeight: 1.7, marginTop: '12px' }}>
            Para ejercer estos derechos, contacte al administrador de su organización o al soporte de SERVINGMI.
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#0D1B48', borderBottom: '2px solid #1D4ED8', paddingBottom: '8px', marginBottom: '16px' }}>
            8. Seguridad
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7 }}>
            Implementamos medidas técnicas y organizativas para proteger los datos: cifrado en tránsito (HTTPS/TLS),
            autenticación mediante JWT con tokens de corta duración, control de acceso basado en roles (RBAC),
            registros de auditoría de todas las operaciones críticas, y backups automáticos cifrados.
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#0D1B48', borderBottom: '2px solid #1D4ED8', paddingBottom: '8px', marginBottom: '16px' }}>
            9. Cambios a esta Política
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7 }}>
            Podemos actualizar esta política periódicamente. Los cambios significativos serán notificados
            a los usuarios activos. La versión vigente siempre estará disponible en esta URL.
          </p>
        </section>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', marginTop: '48px', textAlign: 'center' }}>
          <p style={{ color: '#9ca3af', fontSize: '13px' }}>
            © 2026 SERVINGMI S.R.L. — República Dominicana
          </p>
          <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>
            Esta página es públicamente accesible sin necesidad de autenticación.
          </p>
        </div>
      </div>
    </div>
  );
}
