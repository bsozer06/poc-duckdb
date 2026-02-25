# DuckDB + MapLibre PoC

A minimal PoC that reads **Parquet / CSV** files in the browser using **DuckDB-WASM** and visualizes query results on a **MapLibre GL JS** map.

The project is written in **TypeScript** and built/served with **Vite**.

## Project Structure

```
poc-duckdb/
 src/
    main.ts          # Application entry point (TypeScript)
 data/
    capitals.csv     # 194 world capitals (CSV)
    capitals.parquet # 194 world capitals (Parquet  columnar)
 index.html           # HTML shell  Vite entry point
 vite.config.ts       # Vite config (COOP/COEP headers)
 tsconfig.json        # TypeScript config
 generate.cjs         # Node script that writes capital data to CSV/Parquet
 package.json
```

## Tech Stack

| Package | Version | Purpose |
|---|---|---|
| [vite](https://vitejs.dev/) | ^6 | Build tool + dev server |
| [typescript](https://www.typescriptlang.org/) | ^5.7 | Language |
| [@duckdb/duckdb-wasm](https://www.npmjs.com/package/@duckdb/duckdb-wasm) | ^1.29 | In-browser in-memory SQL engine |
| [maplibre-gl](https://maplibre.org/) | ^4 | Map rendering |
| [duckdb](https://www.npmjs.com/package/duckdb) *(devDep)* | ^1.1 | CSV/Parquet generation in Node.js |

## Getting Started

### 1  Install dependencies

```bash
npm install
```

### 2  Generate data files

```bash
npm run generate
# or directly: node generate.cjs
```

This creates `data/capitals.csv` and `data/capitals.parquet`.

### 3  Start the development server

```bash
npm run dev
#  http://localhost:3333
```

> DuckDB-WASM relies on **SharedArrayBuffer**, so the `file://` protocol does not work.  
> `vite.config.ts` automatically adds the `Cross-Origin-Opener-Policy: same-origin` and  
> `Cross-Origin-Embedder-Policy: require-corp` headers.

### 4  Production build (optional)

```bash
npm run build   # outputs to dist/
npm run preview # preview the build output
```

## Usage

When the app opens, the Parquet file is loaded automatically and the default query runs.

- Use the **Parquet / CSV** buttons to switch the data source on the fly
- Type any SQL query in the input box and run it with **Run** or `Enter`
- Click a marker on the map to open a popup (capital, country, continent, population)

### Example Queries

```sql
-- All capitals
SELECT * FROM capitals

-- Top 10 most populous capitals
SELECT * FROM capitals ORDER BY population DESC LIMIT 10

-- Europe only
SELECT * FROM capitals WHERE continent = 'Europe'

-- Population over 5 million
SELECT * FROM capitals WHERE population > 5000000
```

## Architecture  Data Flow

```
generate.cjs (Node + duckdb)
     JS array  DuckDB in-memory table
             COPY TO capitals.csv
             COPY TO capitals.parquet

index.html + src/main.ts (Browser + Vite + TypeScript + duckdb-wasm)
     fetch('data/capitals.parquet')  Uint8Array
             db.registerFileBuffer(...)
                     CREATE VIEW capitals AS SELECT * FROM read_parquet(...)
                             conn.query(sql)  rows  MapLibre markers
```