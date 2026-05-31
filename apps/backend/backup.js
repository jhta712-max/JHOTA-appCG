const { Client } = require('pg');
const fs = require('fs');

const DB = 'postgresql://servingmi_user:GOO6vnTK24u4DDcHstGAayckazdn64gJ@dpg-d86e903tqb8s73fja6d0-a.oregon-postgres.render.com/servingmi';

const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
const out = [];

c.connect()
  .then(() => c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"))
  .then(async (r) => {
    const tables = r.rows.map(x => x.table_name);
    console.log('Tablas encontradas:', tables.length, '-', tables.join(', '));

    for (const t of tables) {
      const d = await c.query(`SELECT * FROM "${t}"`);
      out.push(`\n-- TABLE: ${t} (${d.rows.length} rows)`);
      if (d.rows.length > 0) {
        const cols = Object.keys(d.rows[0]);
        for (const row of d.rows) {
          const vals = cols.map(k => {
            if (row[k] === null) return 'NULL';
            if (typeof row[k] === 'string') return "'" + row[k].replace(/'/g, "''") + "'";
            if (row[k] instanceof Date) return "'" + row[k].toISOString() + "'";
            if (typeof row[k] === 'boolean') return row[k] ? 'TRUE' : 'FALSE';
            if (typeof row[k] === 'object') return "'" + JSON.stringify(row[k]).replace(/'/g, "''") + "'";
            return String(row[k]);
          });
          out.push(`INSERT INTO "${t}" (${cols.map(c => '"' + c + '"').join(',')}) VALUES (${vals.join(',')});`);
        }
      }
      console.log(`  ✓ ${t}: ${d.rows.length} filas`);
    }

    const outPath = 'C:/Users/jhta_/OneDrive/Desktop/Gastos Proyectos/backup_servingmi_30mayo2026.sql';
    fs.writeFileSync(outPath, out.join('\n'));
    console.log('\n✅ Backup guardado en:', outPath);
    c.end();
  })
  .catch(e => { console.error('❌ Error:', e.message); c.end(); });
