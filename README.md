# 🦆 DuckDB + MapLibre PoC

Tarayıcıda **DuckDB-WASM** ile **Parquet / CSV** dosyalarını okuyup sorgu sonuçlarını **MapLibre GL JS** haritasında görselleştiren minimal PoC.

## Proje Yapısı

```
poc-duckdb/
├── index.html          # Tek sayfalık uygulama (DuckDB-WASM + MapLibre)
├── generate.js         # Başkent verisini CSV ve Parquet'e yazan Node script
├── package.json
└── data/
    ├── capitals.csv     # 194 dünya başkenti (CSV)
    └── capitals.parquet # 194 dünya başkenti (Parquet – kolonar)
```

## Kullanılan Teknolojiler

| Paket | Versiyon | Kullanım |
|---|---|---|
| [duckdb](https://www.npmjs.com/package/duckdb) | ^1.1.3 | Node.js'te CSV/Parquet üretimi |
| [@duckdb/duckdb-wasm](https://www.npmjs.com/package/@duckdb/duckdb-wasm) | 1.29.0 | Tarayıcıda in-memory SQL motoru |
| [MapLibre GL JS](https://maplibre.org/) | 4 | Harita render |

## Başlangıç

### 1 – Bağımlılıkları kur

```bash
npm install
```

### 2 – Veri dosyalarını oluştur

```bash
node generate.js
# veya
npm run generate
```

`data/capitals.csv` ve `data/capitals.parquet` dosyaları oluşturulur.

### 3 – Local sunucu başlat

```bash
npm run serve
# → http://localhost:3333
```

> DuckDB-WASM, SharedArrayBuffer gerektirdiğinden `file://` protokolü çalışmaz.  
> Bir HTTP sunucusu zorunludur.

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
generate.js (Node + duckdb)
    └── JS array → DuckDB in-memory tablo
            ├── COPY TO capitals.csv
            └── COPY TO capitals.parquet

index.html (Browser + duckdb-wasm)
    └── fetch('data/capitals.parquet') → Uint8Array
            └── db.registerFileBuffer(...)
                    └── CREATE VIEW capitals AS SELECT * FROM read_parquet(...)
                            └── conn.query(sql) → rows → MapLibre markers
```
