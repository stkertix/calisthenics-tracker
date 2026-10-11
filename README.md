# Calisthenics Tracker

Tracker program latihan calisthenics bertahap (Push, Pull, Squat, Muscle-up), dioptimalkan untuk dipakai di **HP**.

Ringkasan program mengacu pada struktur progresi Yellow Dude / Gravgear Calisthenics Playbook. Atribusi sumber ada di footer app.

## Struktur

```
├── app/
│   └── index.html     # App tunggal (HTML + CSS + JS)
├── .gitignore
└── README.md
```

## Menjalankan

Tidak perlu install apa pun.

```bash
open app/index.html
```

Atau buka `app/index.html` di browser.

### Di HP

1. Salin `app/index.html` ke HP (AirDrop, Files, Drive, dll.)
2. Buka di Safari atau Chrome
3. Opsional: **Add to Home Screen** agar seperti app

Progress tersimpan di `localStorage` browser perangkat itu. Hapus data situs = progress hilang.

## Fitur

| Tab        | Isi                                                            |
| ---------- | -------------------------------------------------------------- |
| **Jalur**  | Pilih Push / Pull / Squat / Muscle-up, lihat level, mulai sesi |
| **Sesi**   | Checklist gerakan, set/rep, timer istirahat, catatan           |
| **Jadwal** | Pola mingguan (stack / split / triplet) + baseline muscle-up   |
| **Log**    | Riwayat sesi                                                   |

Lainnya:

- Level **1→5** per jalur, dengan kriteria naik level
- Deskripsi + cues form per gerakan (dilipat agar hemat scroll)
- Rantai progresi & pengaturan level dilipat
- Navigasi bawah, tombol utama sticky
- Status jalur/level di pojok atas (tanpa logo brand)

## Jalur latihan

| Jalur     | Goal            |
| --------- | --------------- |
| Push      | One-arm push-up |
| Pull      | Pull-up bersih  |
| Squat     | Pistol squat    |
| Muscle-up | Bar muscle-up   |

Prinsip: latihan 2–3×/minggu per skill, istirahat ≥48 jam, gerakan terberat dulu, jangan loncat level.

Detail progresi (lokal, tidak di-commit): `.book/ringkasan-program-latihan.md`

## Catatan

- Alat bantu pribadi — bukan pengganti buku resmi
- Detail form & ilustrasi: [yellowdude.co](https://yellowdude.co) / [thegravgear.com](https://thegravgear.com)
- Panduan umum kebugaran, bukan saran medis
