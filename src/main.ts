import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as duckdb from '@duckdb/duckdb-wasm';
import { PointLayer } from './PointLayer';


type DataSource = 'parquet' | 'csv';

interface CapitalRow {
  name: string;
  country: string;
  lat: number;
  lng: number;
  population: number;
  continent: string;
}

//  MapLibre 
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [20, 20],
  zoom: 2,
});

// Start both map 'load' and DuckDB init as independent Promises to avoid
// a race condition; wait for both together at the end.
const mapReady = new Promise<void>(resolve => map.once('load', () => resolve()));

//  DuckDB-WASM 

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

let db: duckdb.AsyncDuckDB;
let conn: duckdb.AsyncDuckDBConnection;
let currentSource: DataSource = 'parquet';

// Custom WebGL layer instance -- receives Float32Array directly from DuckDB
const pointLayer = new PointLayer('wasm-points', {
  pointSize:   10,
  color:        [0.537, 0.706, 0.980, 0.9],   // #89b4fa
  strokeColor:  [0.118, 0.118, 0.180, 1.0],   // #1e1e2e
  strokeWidth:  1.5,
});

// Keeps the last query rows in sync for popup lookups
let currentRows: CapitalRow[] = [];

async function initDuck(): Promise<void> {
  const status = getEl('status');
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker = await duckdb.createWorker(bundle.mainWorker!);
  db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  conn = await db.connect();

  status.textContent = 'Fetching files...';

  // Fetch both files in parallel and register them in WASM in-memory storage
  const [parquetBuf] = await Promise.all([
    fetch('data/capitals.parquet').then(r => r.arrayBuffer()),
    // fetch('data/capitals.csv').then(r => r.arrayBuffer()),
  ]);

  await db.registerFileBuffer('capitals.parquet', new Uint8Array(parquetBuf));
  // await db.registerFileBuffer('capitals.csv', new Uint8Array(csvBuf));

  // VIEWs -- the source toggle only swaps the `capitals` view
  await conn.query(`CREATE VIEW capitals_parquet AS SELECT * FROM read_parquet('capitals.parquet')`);
  // await conn.query(`CREATE VIEW capitals_csv AS SELECT * FROM read_csv_auto('capitals.csv')`);
  await conn.query(`CREATE VIEW capitals AS SELECT * FROM capitals_parquet`);

  status.textContent = 'Ready (parquet)';
}

// ── Custom WebGL layer setup (runs once after map load) ─────────────────────────
// No GeoJSON source needed -- PointLayer owns its own GPU buffer.

function setupLayers(): void {
  // Add the custom WebGL layer directly; it draws via gl.drawArrays(POINTS)
  map.addLayer(pointLayer);

  // Click -> find nearest point via screen-space proximity, then show popup
  map.on('click', e => {
    const idx = pointLayer.findNearest(map, e.lngLat, 12);
    if (idx === -1) return;
    const p = currentRows[idx];
    new maplibregl.Popup({ offset: 12 })
      .setLngLat([Number(p.lng), Number(p.lat)])
      .setHTML(`
        <b>${p.name}</b><br>
        🌍 ${p.country}<br>
        🗺 ${p.continent}<br>
        👥 ${Number(p.population).toLocaleString()}
      `)
      .addTo(map);
  });

  // Cursor feedback: pointer when hovering near a point
  map.on('mousemove', e => {
    const hit = pointLayer.findNearest(map, e.lngLat, 10);
    map.getCanvas().style.cursor = hit !== -1 ? 'pointer' : '';
  });
}

//  Switch data source 

async function setSource(src: DataSource): Promise<void> {
  if (!conn) return;
  currentSource = src;

  getEl('btn-parquet').classList.toggle('active', src === 'parquet');
  // getEl('btn-csv').classList.toggle('active', src === 'csv');

  await conn.query('DROP VIEW IF EXISTS capitals');
  const view = src === 'parquet' ? 'capitals_parquet' : 'capitals_csv';
  await conn.query(`CREATE VIEW capitals AS SELECT * FROM ${view}`);

  getEl('status').textContent = `Switched -> ${src}`;
  await runQuery();
}

//  Query & map render 
async function runQuery(): Promise<void> {
  if (!conn) return;

  const sql = (getEl('sql') as HTMLInputElement).value.trim();

  if (!/^\s*SELECT\b/i.test(sql)) {
    alert('Only SELECT queries are allowed.');
    return;
  }

  const forbidden = /\b(DROP|CREATE|INSERT|UPDATE|DELETE|ALTER|TRUNCATE)\b/i;
  if (forbidden.test(sql)) {
    alert('DDL/DML statements are not allowed.');
    return;
  }

  const status = getEl('status');
  status.textContent = 'Running...';

  try {
    const t0     = performance.now();
    const result = await conn.query(sql);
    const ms     = (performance.now() - t0).toFixed(1);
    const rows   = result.toArray().map(r => r.toJSON()) as CapitalRow[];

    // Filter rows that have valid coordinates
    currentRows = rows.filter(row => row.lng != null && row.lat != null);

    // Build a flat Float32Array: [lng0, lat0, lng1, lat1, ...]
    // Zero JS object overhead -- data goes from DuckDB Arrow -> typed array -> GPU.
    const coords = new Float32Array(currentRows.length * 2);
    for (let i = 0; i < currentRows.length; i++) {
      coords[i * 2]     = Number(currentRows[i].lng);
      coords[i * 2 + 1] = Number(currentRows[i].lat);
    }

    // Single GPU buffer upload -- one draw call regardless of point count
    pointLayer.setData(coords);

    status.textContent = `${currentRows.length} row(s)  ${ms} ms  ${currentSource}`;
  } catch (err) {
    status.textContent = 'Error';
    alert((err as Error).message);
  }
}

//  Helpers 

function getEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

// Expose functions to window so they can be called from onclick="..." attributes
(window as Window & typeof globalThis & Record<string, unknown>).setSource = setSource;
(window as Window & typeof globalThis & Record<string, unknown>).runQuery  = runQuery;

// Also trigger query on Enter key
(getEl('sql') as HTMLInputElement).addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') void runQuery();
});

// Run map load and DuckDB init in parallel;
// once both are done, set up the layers and run the initial query.
void Promise.all([mapReady, initDuck()]).then(async () => {
  setupLayers();
  await runQuery();
});