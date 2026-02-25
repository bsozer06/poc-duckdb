import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as duckdb from '@duckdb/duckdb-wasm';

// ── Tipler ──────────────────────────────────────────────────────────────────

type DataSource = 'parquet' | 'csv';

interface CapitalRow {
  name: string;
  country: string;
  lat: number;
  lng: number;
  population: number;
  continent: string;
}

// MapLibre'nin Marker listesini map nesnesine bağlamak için genişletme
interface ExtendedMap extends maplibregl.Map {
  _markers?: maplibregl.Marker[];
}

// ── MapLibre ─────────────────────────────────────────────────────────────────

const map: ExtendedMap = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [20, 20],
  zoom: 2,
});

// ── DuckDB-WASM ───────────────────────────────────────────────────────────────

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

let db: duckdb.AsyncDuckDB;
let conn: duckdb.AsyncDuckDBConnection;
let currentSource: DataSource = 'parquet';

async function initDuck(): Promise<void> {
  const status = getEl('status');
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker = await duckdb.createWorker(bundle.mainWorker!);
  db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  conn = await db.connect();

  status.textContent = 'Fetching files…';

  // İki dosyayı paralel fetch et, WASM in-memory'e kaydet
  const [parquetBuf, csvBuf] = await Promise.all([
    fetch('data/capitals.parquet').then(r => r.arrayBuffer()),
    fetch('data/capitals.csv').then(r => r.arrayBuffer()),
  ]);

  await db.registerFileBuffer('capitals.parquet', new Uint8Array(parquetBuf));
  await db.registerFileBuffer('capitals.csv', new Uint8Array(csvBuf));

  // VIEW'lar – kaynak toggle'ı sadece `capitals` view'ını değiştirir
  await conn.query(`CREATE VIEW capitals_parquet AS SELECT * FROM read_parquet('capitals.parquet')`);
  await conn.query(`CREATE VIEW capitals_csv     AS SELECT * FROM read_csv_auto('capitals.csv')`);
  await conn.query(`CREATE VIEW capitals         AS SELECT * FROM capitals_parquet`);

  status.textContent = 'Ready ✓ (parquet)';
  await runQuery();
}

// ── Kaynak değiştir ───────────────────────────────────────────────────────────

async function setSource(src: DataSource): Promise<void> {
  if (!conn) return;
  currentSource = src;

  getEl('btn-parquet').classList.toggle('active', src === 'parquet');
  getEl('btn-csv').classList.toggle('active', src === 'csv');

  await conn.query('DROP VIEW IF EXISTS capitals');
  const view = src === 'parquet' ? 'capitals_parquet' : 'capitals_csv';
  await conn.query(`CREATE VIEW capitals AS SELECT * FROM ${view}`);

  getEl('status').textContent = `Switched → ${src}`;
  await runQuery();
}

// ── Sorgu & harita render ─────────────────────────────────────────────────────

async function runQuery(): Promise<void> {
  if (!conn) return;

  const sql    = (getEl('sql') as HTMLInputElement).value.trim();
  const status = getEl('status');
  status.textContent = 'Running…';

  try {
    const t0     = performance.now();
    const result = await conn.query(sql);
    const ms     = (performance.now() - t0).toFixed(1);
    const rows   = result.toArray().map(r => r.toJSON()) as CapitalRow[];

    // Önceki marker'ları kaldır
    map._markers?.forEach(m => m.remove());
    map._markers = [];

    rows.forEach(row => {
      if (row.lng == null || row.lat == null) return;

      const el = document.createElement('div');
      el.style.cssText = `
        background:#89b4fa; color:#1e1e2e; border-radius:50%;
        width:34px; height:34px; display:flex; align-items:center;
        justify-content:center; font-weight:700; font-size:10px;
        cursor:pointer; border:2px solid #fff; box-shadow:0 1px 4px #0006;
      `;
      el.textContent = row.name?.slice(0, 3) ?? '?';
      el.title       = `${row.name} (${row.country}) — ${row.population.toLocaleString()}`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([Number(row.lng), Number(row.lat)])
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setHTML(`
            <b>${row.name}</b><br>
            🌍 ${row.country}<br>
            🗺 ${row.continent}<br>
            👥 ${row.population.toLocaleString()}
          `)
        )
        .addTo(map);

      map._markers!.push(marker);
    });

    status.textContent = `${rows.length} row(s) · ${ms} ms · ${currentSource}`;
  } catch (err) {
    status.textContent = 'Error ✗';
    alert((err as Error).message);
  }
}

// ── Yardımcılar ───────────────────────────────────────────────────────────────

function getEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

// onclick="..." ile çağrılabiliyor olması için window'a bağla
(window as Window & typeof globalThis & Record<string, unknown>).setSource = setSource;
(window as Window & typeof globalThis & Record<string, unknown>).runQuery  = runQuery;

// Enter ile de çalıştır
(getEl('sql') as HTMLInputElement).addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') void runQuery();
});

void initDuck();
