# Calisthenics Tracker

Tracker program latihan calisthenics bertahap (Push, Pull, Squat, Muscle-up), dioptimalkan untuk **HP**, dan bisa di-install sebagai **PWA**.

Ringkasan program mengacu pada struktur progresi Yellow Dude / Gravgear Calisthenics Playbook. Atribusi sumber ada di footer app.

## Struktur

```
├── index.html
├── styles.css
├── data/
│   └── catalog.json        # Program, guide, jadwal, baseline
├── js/
│   ├── main.js             # Bootstrap
│   ├── config.js           # Konstanta & schema
│   ├── catalog.js          # Load JSON + guideFor
│   ├── storage.js          # localStorage / migrasi
│   ├── context.js          # Shared UI context
│   ├── rest.js             # Timer istirahat
│   ├── pwa.js              # Service worker register
│   ├── lib/
│   │   └── dom.js          # $, toast, formatDate
│   └── ui/
│       ├── tabs.js
│       ├── home.js         # Tab Jalur
│       ├── workout.js      # Tab Sesi
│       ├── schedule.js     # Tab Jadwal
│       └── history.js      # Tab Log (+ export/import)
├── manifest.webmanifest
├── sw.js
├── icons/
├── .gitignore
└── README.md
```

Lokal (di-ignore): `.resources/`

## Menjalankan lokal

Jalankan lewat HTTP (module + `fetch` tidak jalan di `file://`):

```bash
python3 -m http.server 8080
# http://localhost:8080
```

## GitHub Pages

1. **Settings** → **Pages**
2. Source: branch `main`, folder `/ (root)`
3. URL: https://stkertix.github.io/calisthenics-tracker/

### Install di HP

1. Buka URL di Chrome (Android) atau Safari (iOS)
2. **Add to Home Screen** / **Install app**
3. Shell offline setelah kunjungan pertama

## Fitur

| Tab        | Isi                                                            |
| ---------- | -------------------------------------------------------------- |
| **Jalur**  | Pilih Push / Pull / Squat / Muscle-up, lihat level, mulai sesi |
| **Sesi**   | Checklist gerakan, set/rep, timer istirahat, catatan           |
| **Jadwal** | Pola mingguan (stack / split / triplet) + baseline muscle-up   |
| **Log**    | Riwayat sesi, export/import JSON, reset data                   |

Lainnya: level 1→5, cues form, PWA offline shell.

## Jalur latihan

| Jalur     | Goal            |
| --------- | --------------- |
| Push      | One-arm push-up |
| Pull      | Pull-up bersih  |
| Squat     | Pistol squat    |
| Muscle-up | Bar muscle-up   |

Update konten program: edit `data/catalog.json`. Ubah bentuk storage: naikkan `SCHEMA_VERSION` di `js/config.js` + tambah step di `MIGRATIONS`.

## Penyimpanan data

Progress di `localStorage` per perangkat. Reset di tab Log.

| Key | Isi |
| --- | --- |
| `…:meta` | Versi schema |
| `…:master-v1` | Jalur aktif, level, jadwal, baseline |
| `…:history-v1` | Riwayat sesi |
| `…:session-v1` | Sesi berjalan |

## Catatan

- Alat bantu pribadi — bukan pengganti buku resmi
- Detail form: [yellowdude.co](https://yellowdude.co) / [thegravgear.com](https://thegravgear.com)
- Panduan kebugaran umum, bukan saran medis
