# Calisthenics Tracker

Tracker program latihan calisthenics bertahap (Push, Pull, Squat, Muscle-up), dioptimalkan untuk **HP**, dan bisa di-install sebagai **PWA**.

Ringkasan program mengacu pada struktur progresi Yellow Dude / Gravgear Calisthenics Playbook. Atribusi sumber ada di footer app.

## Struktur

```
├── index.html              # Shell HTML
├── styles.css              # Styles
├── app.js                  # Logika app + storage/PWA
├── data/
│   └── catalog.json        # MOVE guide, program, jadwal, baseline
├── manifest.webmanifest    # Metadata PWA
├── sw.js                   # Service worker (offline shell)
├── icons/
│   ├── icon-180.png
│   ├── icon-192.png
│   └── icon-512.png
├── .gitignore
└── README.md
```

Lokal (di-ignore): `.resources/` — ringkasan progresi & sumber OCR.

## Menjalankan lokal

Karena data & script di-load via `fetch`, jalankan lewat HTTP (bukan `file://`):

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
3. App fullscreen; shell tetap bisa dibuka offline setelah kunjungan pertama

## Fitur

| Tab        | Isi                                                            |
| ---------- | -------------------------------------------------------------- |
| **Jalur**  | Pilih Push / Pull / Squat / Muscle-up, lihat level, mulai sesi |
| **Sesi**   | Checklist gerakan, set/rep, timer istirahat, catatan           |
| **Jadwal** | Pola mingguan (stack / split / triplet) + baseline muscle-up   |
| **Log**    | Riwayat sesi, export/import JSON, reset data                   |

Lainnya:

- Level **1→5** per jalur, dengan kriteria naik level
- Deskripsi + cues form per gerakan (dilipat)
- Rantai progresi & pengaturan level dilipat
- Navigasi bawah, tombol sticky, timer istirahat (+30s / selesai)
- Status jalur/level di pojok atas
- PWA: installable + cache offline untuk app shell

## Jalur latihan

| Jalur     | Goal            |
| --------- | --------------- |
| Push      | One-arm push-up |
| Pull      | Pull-up bersih  |
| Squat     | Pistol squat    |
| Muscle-up | Bar muscle-up   |

Prinsip: latihan 2–3×/minggu per skill, istirahat ≥48 jam, gerakan terberat dulu, jangan loncat level.

Update konten program: edit `data/catalog.json` (lalu naikkan `SCHEMA_VERSION` di `app.js` jika bentuk data berubah).

## Penyimpanan data

Progress di `localStorage` perangkat (per origin/browser). Hapus data situs = progress hilang. Reset ada di tab Log.

| Key | Isi |
| --- | --- |
| `…:meta` | Versi schema |
| `…:master-v1` | Jalur aktif, level, jadwal, baseline |
| `…:history-v1` | Riwayat sesi |
| `…:session-v1` | Sesi yang sedang berjalan |

Saat load: migrasi schema (jika perlu) lalu **reconcile** ke katalog program di `data/catalog.json`. History lama tetap sebagai snapshot.

## Catatan

- Alat bantu pribadi — bukan pengganti buku resmi
- Detail form & ilustrasi: [yellowdude.co](https://yellowdude.co) / [thegravgear.com](https://thegravgear.com)
- Panduan umum kebugaran, bukan saran medis
- Font Google butuh jaringan saat pertama kali; setelah itu shell app tetap tersedia offline
