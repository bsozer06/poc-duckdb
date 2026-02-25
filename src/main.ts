import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as duckdb from '@duckdb/duckdb-wasm';
import type { FeatureCollection } from 'geojson';


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

//  GeoJSON layer setup (runs once after map load) 

function setupLayers(): void {
  // Source -- starts with an empty FeatureCollection
  map.addSource('points', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  // 1) Circle layer -- rendered via WebGL, no DOM elements -> handles 1M points smoothly
  map.addLayer({
    id: 'points-circle',
    type: 'circle',
    source: 'points',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 8, 9],
      'circle-color': '#89b4fa',
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#1e1e2e',
      'circle-opacity': 0.85,
    },
  });

  // 2) Symbol (label) layer -- show name at zoom >= 5
  map.addLayer({
    id: 'points-label',
    type: 'symbol',
    source: 'points',
    minzoom: 5,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#cdd6f4',
      'text-halo-color': '#1e1e2e',
      'text-halo-width': 1.5,
    },
  });

  // 3) Click -> popup (feature properties come directly from GeoJSON)
  map.on('click', 'points-circle', e => {
    const feature = e.features?.[0];
    if (!feature) return;
    const p = feature.properties as CapitalRow;
    new maplibregl.Popup({ offset: 12 })
      .setLngLat(e.lngLat)
      .setHTML(`
        <b>${p.name}</b><br>
         ${p.country}<br>
         ${p.continent}<br>
         ${Number(p.population).toLocaleString()}
      `)
      .addTo(map);
  });

  map.on('mouseenter', 'points-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'points-circle', () => { map.getCanvas().style.cursor = ''; });
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

  const sql    = (getEl('sql') as HTMLInputElement).value.trim();
  const status = getEl('status');
  status.textContent = 'Running...';

  try {
    const t0     = performance.now();
    const result = await conn.query(sql);
    const ms     = (performance.now() - t0).toFixed(1);
    const rows   = result.toArray().map(r => r.toJSON()) as CapitalRow[];

    // Convert all rows into a single GeoJSON FeatureCollection.
    // setData() -> single WebGL draw call, zero DOM manipulation.
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: rows
        .filter(row => row.lng != null && row.lat != null)
        .map(row => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [Number(row.lng), Number(row.lat)] },
          properties: row,
        })),
    };

    (map.getSource('points') as maplibregl.GeoJSONSource)?.setData(geojson);

    status.textContent = `${rows.length} row(s)  ${ms} ms  ${currentSource}`;
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