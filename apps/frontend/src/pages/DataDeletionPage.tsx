export default function DataDeletionPage() {
  return (
    <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', background: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#1C1C1C', padding: '24px 40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div>
          <p style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#F5C218', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
            SERVINGMI
          </p>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#fff', fontSize: '28px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Eliminación de Datos de Usuario
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: '4px 0 0' }}>
            Instrucciones para solicitar la eliminación de sus datos
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#1C1C1C', borderBottom: '2px solid #F5C218', paddingBottom: '8px', marginBottom: '16px' }}>
            ¿Cómo solicitar la eliminación de sus datos?
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7 }}>
            Si desea que sus datos personales sean eliminados de la plataforma SERVINGMI, puede hacerlo
            a través de cualquiera de los siguientes métodos:
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#1C1C1C', borderBottom: '2px solid #F5C218', paddingBottom: '8px', marginBottom: '16px' }}>
            Opción 1 — Contactar al administrador de su organización
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7 }}>
            Comuníquese con el administrador de su empresa en la plataforma SERVINGMI y solicite
            la eliminación de su cuenta y datos asociados. El administrador podrá procesar
            la solicitud directamente desde el panel de gestión de usuarios.
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#1C1C1C', borderBottom: '2px solid #F5C218', paddingBottom: '8px', marginBottom: '16px' }}>
            Opción 2 — Contactar al soporte de SERVINGMI
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '12px' }}>
            Envíe un correo electrónico a <strong>admin.servingmi7@gmail.com</strong> con el asunto
            <strong> "Solicitud de eliminación de datos"</strong> indicando:
          </p>
          <ul style={{ color: '#374151', lineHeight: 2, paddingLeft: '24px' }}>
            <li>Su nombre completo</li>
            <li>Correo electrónico registrado en la plataforma</li>
            <li>Nombre de la organización a la que pertenece</li>
          </ul>
          <p style={{ color: '#374151', lineHeight: 1.7, marginTop: '12px' }}>
            Procesaremos su solicitud en un plazo máximo de <strong>30 días hábiles</strong>.
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#1C1C1C', borderBottom: '2px solid #F5C218', paddingBottom: '8px', marginBottom: '16px' }}>
            ¿Qué datos se eliminan?
          </h2>
          <ul style={{ color: '#374151', lineHeight: 2, paddingLeft: '24px' }}>
            <li>Información de perfil (nombre, correo electrónico, número de teléfono)</li>
            <li>Historial de conversaciones de WhatsApp vinculadas a su cuenta</li>
            <li>Preferencias y configuración personal</li>
            <li>Registros de acceso e historial de sesiones</li>
          </ul>
          <p style={{ color: '#374151', lineHeight: 1.7, marginTop: '12px' }}>
            <strong>Nota:</strong> Los registros operativos (gastos, nóminas, órdenes de pago) ingresados
            durante su uso de la plataforma pueden conservarse por requerimientos fiscales de la
            legislación dominicana (mínimo 10 años para documentos contables), pero serán desvinculados
            de su identidad personal.
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: '#1C1C1C', borderBottom: '2px solid #F5C218', paddingBottom: '8px', marginBottom: '16px' }}>
            Datos de conexión con Facebook / WhatsApp
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7 }}>
            Si se conectó a SERVINGMI a través de WhatsApp Business, los mensajes intercambiados
            se almacenan por un máximo de 90 días. Para eliminar estos datos antes de ese plazo,
            incluya en su solicitud la frase <strong>"incluyendo datos de WhatsApp"</strong>.
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
