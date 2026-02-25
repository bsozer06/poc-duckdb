# 🦆 DuckDB + MapLibre PoC

Tarayıcıda **DuckDB-WASM** ile **Parquet / CSV** dosyalarını okuyup sorgu sonuçlarını **MapLibre GL JS** haritasında görselleştiren minimal PoC.

Proje **TypeScript** ile yazılmıştır; **Vite** ile derlenir ve servis edilir.

## Proje Yapısı

```
poc-duckdb/
├── src/
│   └── main.ts          # Uygulama giriş noktası (TypeScript)
├── data/
│   ├── capitals.csv     # 194 dünya başkenti (CSV)
│   └── capitals.parquet # 194 dünya başkenti (Parquet – kolonar)
├── index.html           # HTML kabuğu – Vite entry point
├── vite.config.ts       # Vite yapılandırması (COOP/COEP başlıkları)
├── tsconfig.json        # TypeScript yapılandırması
├── generate.cjs         # Başkent verisini CSV/Parquet'e yazan Node script
└── package.json
```

## Kullanılan Teknolojiler

| Paket | Versiyon | Kullanım |
|---|---|---|
| [vite](https://vitejs.dev/) | ^6 | Build aracı + dev sunucu |
| [typescript](https://www.typescriptlang.org/) | ^5.7 | Dil |
| [@duckdb/duckdb-wasm](https://www.npmjs.com/package/@duckdb/duckdb-wasm) | ^1.29 | Tarayıcıda in-memory SQL motoru |
| [maplibre-gl](https://maplibre.org/) | ^4 | Harita render |
| [duckdb](https://www.npmjs.com/package/duckdb) *(devDep)* | ^1.1 | Node.js'te CSV/Parquet üretimi |

## Başlangıç

### 1 – Bağımlılıkları kur

```bash
npm install
```

### 2 – Veri dosyalarını oluştur

```bash
npm run generate
# veya doğrudan: node generate.cjs
```

`data/capitals.csv` ve `data/capitals.parquet` dosyaları oluşturulur.

### 3 – Geliştirme sunucusunu başlat

```bash
npm run dev
# → http://localhost:3333
```

> DuckDB-WASM, **SharedArrayBuffer** kullandığından `file://` protokolü çalışmaz.  
> `vite.config.ts` içinde `Cross-Origin-Opener-Policy: same-origin` ve  
> `Cross-Origin-Embedder-Policy: require-corp` başlıkları otomatik eklenir.

### 4 – Production build (opsiyonel)

```bash
npm run build   # dist/ klasörüne çıktı üretir
npm run preview # build çıktısını önizle
```

## Kullanım

Uygulama açıldığında Parquet dosyası otomatik yüklenir ve varsayılan sorgu çalışır.

- **📦 Parquet / 📄 CSV** butonları ile veri kaynağını anlık değiştirebilirsin
- SQL kutusuna istediğin sorguyu yazıp **▶ Run** ya da `Enter` ile çalıştırabilirsin
- Harita üzerindeki marker'lara tıklayınca popup açılır (başkent, ülke, kıta, nüfus)

### Örnek Sorgular

```sql
-- Tüm başkentler
SELECT * FROM capitals

-- En kalabalık 10 başkent
SELECT name, country, population FROM capitals ORDER BY population DESC LIMIT 10

-- Kıtaya göre özet
SELECT continent, COUNT(*) AS cnt, AVG(population)::INT AS avg_pop
FROM capitals GROUP BY continent ORDER BY cnt DESC

-- Sadece Avrupa
SELECT * FROM capitals WHERE continent = 'Europe'

-- Nüfusu 5 milyonun üzerindekiler
SELECT * FROM capitals WHERE population > 5000000
```

## Mimari — Veri Akışı

```
generate.cjs (Node + duckdb)
    └── JS array → DuckDB in-memory tablo
            ├── COPY TO capitals.csv
            └── COPY TO capitals.parquet

index.html + src/main.ts (Browser + Vite + TypeScript + duckdb-wasm)
    └── fetch('data/capitals.parquet') → Uint8Array
            └── db.registerFileBuffer(...)
                    └── CREATE VIEW capitals AS SELECT * FROM read_parquet(...)
                            └── conn.query(sql) → rows → MapLibre markers
```
