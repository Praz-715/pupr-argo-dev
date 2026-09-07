#!/usr/bin/env python3
"""Ekstrak `DATA TALENT POOL ES 2 & 3 LENGKAP.xlsx` menjadi JSON + berkas foto.

    python3 scripts/xlsx-ke-json.py "/path/DATA TALENT POOL ES 2 & 3 LENGKAP.xlsx"

**Kenapa Python, padahal seluruh skrip lain di repo ini tsx.** Repo tidak punya
pembaca xlsx dan menambah dependensi npm untuk satu berkas masukan adalah
keputusan yang pantas diambil sadar, bukan diselipkan. `.xlsx` sendiri hanya zip
berisi XML, jadi pustaka standar Python sudah cukup — tanpa dependensi apa pun.

**Keluarannya artefak yang bisa DITINJAU**, bukan tulisan langsung ke DB:

    doc/data/talentpool-es23.json     ← data tabular, satu objek per pegawai
    doc/data/foto/<nip>.png           ← foto resmi, dinamai menurut NIP

Importirnya (`npm run impor:talentpool`) membaca JSON itu. Pemisahan ini penting:
berkas Excel bisa direvisi berkali-kali, dan yang perlu di-review saat itu adalah
**selisih JSON-nya**, bukan biner 9 MB.

**Bentuk sumbernya:** satu pegawai membentang beberapa baris. Baris pertama blok
ditandai kolom A (NO) berisi angka; kolom I/J (riwayat jabatan + masa kerja) dan
N (riwayat pelatihan) berulang ke bawah sampai blok berikutnya. Membacanya baris
per baris tanpa mengenali blok akan menghasilkan satu pegawai per riwayat jabatan.

**Foto ditaruh di `doc/data/foto/`, BUKAN `public/`.** Foto pegawai adalah data
pribadi (UU PDP No. 27/2022); apa pun di `public/` dilayani tanpa autentikasi
sama sekali. Menyalinnya ke sana berarti mempublikasikan berkas kepegawaian ke
siapa pun yang menebak alamatnya.
"""

from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
NS_XDR = "{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}"
NS_R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

# ---------------------------------------------------------------------------
# Pemetaan kolom
# ---------------------------------------------------------------------------
#
# DUA berkas dengan tata letak berbeda sudah masuk, dan yang ketiga akan datang:
#
#   DATA TALENT POOL ES 2 & 3 LENGKAP.xlsx  — TANPA baris header
#   TALENT POOL PENGAWAS#2 fix.xlsx         — BERHEADER di baris 1, dan kolomnya
#                                             bergeser (+`FOTO RESMI` di D, +tiga
#                                             kolom masa kerja di J/K/L), sehingga
#                                             POTKOM pindah X→Z, RATING KINERJA
#                                             Y→AA, KOTAK 9 Z→AB.
#
# Karena itu pemetaannya DIGERAKKAN NAMA KOLOM kalau headernya ada, dan hanya
# jatuh ke peta posisi kalau tidak. Menyalin skrip ini per berkas akan membuat
# perbaikan pada satu salinan tidak sampai ke salinan lain — dan yang paling
# mudah salah justru pergeseran kolom yang tak terlihat: `POTKOM` yang terbaca
# dari kolom `RATING KINERJA` tetap berupa teks yang "masuk akal", jadi tidak ada
# yang gagal, hanya angkanya salah.

# Label header (dinormalkan: spasi rapat, huruf besar) → nama field JSON.
LABEL_KE_FIELD = {
    "NO": "no",
    "NAMA LENGKAP": "nama",
    "NIP": "nip",
    "TMT GOLONGAN": "tmtGolongan",
    "GOLONGAN": "golongan",
    "ESELON": "eselon",
    "NAMA JABATAN": "namaJabatan",
    "UNIT KERJA": "unitKerja",
    "TMT JABATAN": "tmtJabatan",
    "SEKOLAH": "sekolah",
    "BIDANG STUDI": "bidangStudi",
    "TINGKAT PENDIDIKAN": "tingkatPendidikan",
    "JURUSAN": "jurusan",
    "RIWAYAT PENDIDIKAN": "riwayatPendidikan",
    "JENJANG ASESMEN": "jenjangAsesmen",
    "TAHUN ASESMEN": "tahunAsesmen",
    "JENIS ASESMEN": "jenisAsesmen",
    "STATUS ASESMEN": "statusAsesmen",
    "POTKOM": "potkom",
    "RATING KINERJA": "ratingKinerja",
    "KOTAK 9": "kotak9Sumber",
}

# Kolom yang BERULANG ke bawah di dalam satu blok pegawai (satu baris per entri).
#
# Berkas Kabalai & Fungsional (2026) memakai label yang SAMA tanpa akhiran " 1"
# — di Pengawas kolomnya bernomor karena ada tiga set masa kerja bersebelahan,
# di kedua berkas baru hanya ada satu set. Keduanya didaftarkan, bukan salah
# satu dinormalkan jadi yang lain: label yang tidak dikenali tidak menghasilkan
# galat apa pun, ia cuma membuat `masaKerja` & `tmtMulai` sunyi jadi kosong —
# kegagalan yang persis pernah terjadi di berkas ES 2 & 3 (229 baris riwayat).
LABEL_BERULANG = {
    "RIWAYAT JABATAN": "riwayatJabatan",
    "RIWAYAT PELATIHAN": "riwayatDiklat",
    "TMT DIKLAT": "tmtDiklat",
    "TMT MASA KERJA 1": "tmtMulai",
    "MASA KERJA JABATAN PENEMPATAN 1": "masaKerja",
    "TMT MASA KERJA": "tmtMulai",
    "MASA KERJA JABATAN PENEMPATAN": "masaKerja",
}

# Peta POSISI untuk berkas tanpa header (ES 2 & 3). Dipertahankan apa adanya —
# ia satu-satunya cara membaca berkas itu, dan mengubahnya berarti data lama
# terbaca berbeda tanpa ada yang memberi tahu.
KOLOM_ES23 = {
    "A": "no", "B": "nama", "C": "nip", "E": "tmtGolongan", "F": "golongan",
    "G": "eselon", "H": "namaJabatan", "K": "unitKerja", "L": "tmtJabatan",
    "O": "sekolah", "P": "bidangStudi", "Q": "tingkatPendidikan",
    "R": "jurusan", "S": "riwayatPendidikan", "T": "jenjangAsesmen",
    "U": "tahunAsesmen", "V": "jenisAsesmen", "W": "statusAsesmen",
    "X": "potkom", "Y": "ratingKinerja", "Z": "kotak9Sumber",
}
BERULANG_ES23 = {"I": "riwayatJabatan", "J": "masaKerja", "M": "tmtDiklat", "N": "riwayatDiklat"}


KATA_UNIT = r"Direktorat|Sekretariat|Balai|Subdirektorat|Bagian|Subbagian|Seksi"

# Jenjang yang sah — dipakai MEMVALIDASI dugaan pergeseran kolom, bukan sekadar
# daftar referensi. Kalau menggeser satu kolom menghasilkan nilai di luar daftar
# ini, dugaannya salah dan barisnya dibiarkan apa adanya.
JENJANG_SAH = {"SD", "SLTP", "SLTA", "D3", "D4", "S1", "S2", "S3", "S1/D4"}


def kolomSebelum(kolom: str) -> str:
    """Huruf kolom Excel sebelumnya: B→A, AA→Z."""
    angka = 0
    for ch in kolom:
        angka = angka * 26 + (ord(ch) - 64)
    angka -= 1
    hasil = ""
    while angka > 0:
        angka, sisa = divmod(angka - 1, 26)
        hasil = chr(65 + sisa) + hasil
    return hasil


def unit_dari_riwayat(riwayat: list) -> str | None:
    """Nama unit dari entri riwayat jabatan pertama (jabatan yang sedang dijabat).

    Bentuknya "<jabatan>, <unit>[, <unit induk>…]", jadi yang diambil segmen
    PERTAMA setelah nama jabatan yang diawali kata kunci unit. Segmen berikutnya
    biasanya unit induk ("…, Direktorat Jenderal Bina Konstruksi") dan sengaja
    tidak dipakai — yang dicari unit tempat orangnya bekerja, bukan puncak
    hierarkinya.
    """
    if not riwayat:
        return None
    teks = re.sub(r"\s+", " ", riwayat[0].get("nama", "")).strip()
    for seg in [x.strip() for x in teks.split(",")][1:]:
        if re.match(rf"^({KATA_UNIT})", seg):
            return seg
    return None


def kolomSetelah(kolom: str) -> str:
    """Huruf kolom Excel berikutnya: A→B, Z→AA, AZ→BA."""
    angka = 0
    for ch in kolom:
        angka = angka * 26 + (ord(ch) - 64)
    angka += 1
    hasil = ""
    while angka:
        angka, sisa = divmod(angka - 1, 26)
        hasil = chr(65 + sisa) + hasil
    return hasil


def rapatkan(t: str) -> str:
    return re.sub(r"\s+", " ", t).strip().upper()


def petaKolom(rows: dict[int, dict[str, str]]) -> tuple[dict[str, str], dict[str, str], int]:
    """Kembalikan (peta tunggal, peta berulang, baris data pertama).

    Header dicari di tiga baris pertama dan hanya diterima kalau MINIMAL 8 label
    dikenali. Ambang itu penting: satu sel berisi kata "NIP" di tengah data tidak
    boleh diperlakukan sebagai header, sebab akibatnya seluruh berkas dibaca
    dengan pergeseran kolom yang salah.
    """
    for n in sorted(rows)[:3]:
        label = {k: rapatkan(v) for k, v in rows[n].items()}
        tunggal = {k: LABEL_KE_FIELD[v] for k, v in label.items() if v in LABEL_KE_FIELD}
        berulang = {k: LABEL_BERULANG[v] for k, v in label.items() if v in LABEL_BERULANG}
        if len(tunggal) >= 8:
            # ── Kolom masa kerja yang HEADER-nya membentang ────────────────────
            #
            # Di `DATA TALENT POOL ES 2 & 3`, header `RIWAYAT JABATAN` merged
            # melintasi I:J, sehingga kolom J — yang berisi masa kerja setiap
            # entri riwayat — TIDAK punya label sendiri. Pemetaan berbasis nama
            # tidak bisa menemukannya, dan akibatnya `masaKerja` sunyi jadi
            # kosong untuk 229 baris riwayat: bukan galat, bukan peringatan,
            # cuma field yang hilang. (Terjadi 24 Agu 2026 dan tertangkap hanya
            # karena keluaran berkas lama dibandingkan sebelum/sesudah.)
            #
            # Aturannya dibuat eksplisit: kolom PERSIS DI KANAN `RIWAYAT JABATAN`
            # yang TIDAK berlabel adalah kolom masa kerja. Di berkas Pengawas
            # kolom itu berlabel (`TMT MASA KERJA 1`), jadi aturan ini tidak
            # menyentuhnya — ia hanya menambal header yang merged.
            kJab = next((k for k, v in berulang.items() if v == "riwayatJabatan"), None)
            if kJab is not None and "masaKerja" not in berulang.values():
                kanan = kolomSetelah(kJab)
                if kanan not in label:
                    berulang[kanan] = "masaKerja"
                    print(f"  header: kolom {kanan} tanpa label → masaKerja (header {kJab} merged)")
            takDikenal = sorted(v for v in label.values() if v not in LABEL_KE_FIELD and v not in LABEL_BERULANG)
            if takDikenal:
                print(f"  header: {len(tunggal)} kolom dikenali · DIABAIKAN: {', '.join(takDikenal)}")
            return tunggal, berulang, n + 1
    print("  header: tidak ada — memakai peta posisi ES 2 & 3")
    return KOLOM_ES23, BERULANG_ES23, 1


def teks_si(si: ET.Element) -> str:
    return "".join(t.text or "" for t in si.iter(f"{NS}t"))


def baca_sheet(z: zipfile.ZipFile) -> dict[int, dict[str, str]]:
    sst = [teks_si(si) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(f"{NS}si")]
    sh = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))

    def nilai(c: ET.Element) -> str:
        t, v, isx = c.get("t"), c.find(f"{NS}v"), c.find(f"{NS}is")
        if t == "s" and v is not None:
            return sst[int(v.text or "0")]
        if t == "inlineStr" and isx is not None:
            return "".join(x.text or "" for x in isx.iter(f"{NS}t"))
        return v.text if v is not None else ""

    rows: dict[int, dict[str, str]] = {}
    for row in sh.iter(f"{NS}row"):
        sel: dict[str, str] = {}
        for c in row.findall(f"{NS}c"):
            val = nilai(c)
            if val is None:
                continue
            val = val.replace("\t", " ").strip()
            if val != "":
                sel[re.match(r"[A-Z]+", c.get("r") or "A").group(0)] = val
        rows[int(row.get("r") or "0")] = sel
    return rows


def baca_foto(z: zipfile.ZipFile) -> dict[int, str]:
    """Petakan BARIS → nama berkas media, lewat anchor di drawing1.xml.

    Tanpa peta ini foto hanya bisa diurutkan menurut nama berkas, dan urutan
    `image1..image26` TIDAK dijamin sama dengan urutan baris — satu foto tertukar
    berarti wajah orang lain menempel di profil seseorang.
    """
    if "xl/drawings/drawing1.xml" not in z.namelist():
        return {}
    rel = ET.fromstring(z.read("xl/drawings/_rels/drawing1.xml.rels"))
    target = {
        r.get("Id"): r.get("Target", "").replace("../", "xl/")
        for r in rel
    }
    dr = ET.fromstring(z.read("xl/drawings/drawing1.xml"))
    peta: dict[int, str] = {}
    for anchor in list(dr):
        frm = anchor.find(f"{NS_XDR}from")
        blip = anchor.find(f".//{NS_A}blip")
        if frm is None or blip is None:
            continue
        baris = int((frm.find(f"{NS_XDR}row").text or "0")) + 1  # 0-based → 1-based
        emb = blip.get(f"{NS_R}embed")
        if emb in target:
            peta[baris] = target[emb]
    return peta


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(
            "pakai: python3 scripts/xlsx-ke-json.py <berkas.xlsx> [--keluar doc/data/nama.json]"
        )
    sumber = Path(sys.argv[1])
    keluarJson = Path("doc/data/talentpool-es23.json")
    if "--keluar" in sys.argv:
        keluarJson = Path(sys.argv[sys.argv.index("--keluar") + 1])

    z = zipfile.ZipFile(sumber)
    rows = baca_sheet(z)
    fotoPerBaris = baca_foto(z)
    print(f"berkas       : {sumber.name}")
    kolom, berulang, barisData = petaKolom(rows)

    # Kolom berulang dibalik: field → huruf kolom, sebab satu field bisa saja
    # tidak ada di berkas tertentu (mis. `tmtMulai` hanya ada di berkas Pengawas).
    kolomUntuk = {v: k for k, v in berulang.items()}
    kolomNo = next((k for k, v in kolom.items() if v == "no"), "A")

    awal = [
        n
        for n in sorted(rows)
        if n >= barisData and re.fullmatch(r"\d+", rows[n].get(kolomNo, ""))
    ]
    keluar = []
    for i, n in enumerate(awal):
        akhir = (awal[i + 1] - 1) if i + 1 < len(awal) else max(rows)
        inti = rows[n]
        rec = {baru: inti.get(k, "") for k, baru in kolom.items()}
        rec["barisExcel"] = n

        kJab = kolomUntuk.get("riwayatJabatan")
        kMasa = kolomUntuk.get("masaKerja")
        kMulai = kolomUntuk.get("tmtMulai")
        rec["riwayatJabatan"] = (
            [
                {
                    "nama": rows[m][kJab],
                    "masaKerja": rows[m].get(kMasa, "") if kMasa else "",
                    # TMT mulai hanya ada di berkas berheader, dan bentuknya
                    # SERIAL Excel (mis. 45940), bukan tanggal terbaca. Disimpan
                    # apa adanya di sini; penerjemahannya tugas importir, supaya
                    # ekstraktor ini tetap sekadar pemindah tanpa tafsir.
                    "tmtMulaiSerial": rows[m].get(kMulai, "") if kMulai else "",
                    # Kolom TEPAT SETELAH kolom mulai adalah tanggal AKHIR.
                    # Headernya di berkas Pengawas cuma "1" sehingga tidak bisa
                    # dipetakan lewat nama — tapi ia BUKAN dugaan: selisih
                    # (akhir − mulai) dicocokkan dengan kolom durasi
                    # "MASA KERJA JABATAN PENEMPATAN" dan cocok **386 dari 386**
                    # entri. Kosong pada entri pertama tiap blok, yaitu jabatan
                    # yang masih dijabat — memang belum ada akhirnya.
                    "tmtAkhirSerial": (
                        rows[m].get(kolomSetelah(kMulai), "") if kMulai else ""
                    ),
                }
                for m in range(n, akhir + 1)
                if rows.get(m, {}).get(kJab)
            ]
            if kJab
            else []
        )

        kDiklat = kolomUntuk.get("riwayatDiklat")
        kTmtDiklat = kolomUntuk.get("tmtDiklat")
        rec["riwayatDiklat"] = (
            [rows[m][kDiklat] for m in range(n, akhir + 1) if rows.get(m, {}).get(kDiklat)]
            if kDiklat
            else []
        )
        # `tmtDiklat` di berkas ES 2 & 3 kolom tunggal, di Pengawas berulang —
        # yang dipakai importir baru nilai pertamanya, jadi cukup itu yang dibawa.
        if kTmtDiklat:
            rec["tmtDiklat"] = rows[n].get(kTmtDiklat, "")

        # ── ASESMEN BERGANDA: satu pegawai, beberapa JENJANG ────────────────
        #
        # Berkas `Database Talenta Fungsional` menilai orang yang sama pada LEBIH
        # DARI SATU jenjang: baris pertama blok memuat jenjang fungsionalnya
        # (mis. AHLI MADYA, potkom 52,08) dan baris KEDUA memuat jenjang
        # struktural (ADMINISTRATOR, potkom 59,86). Terukur: 31 dari 32 pegawai
        # di berkas itu punya dua baris; berkas Kabalai punya satu.
        #
        # Membacanya sebagai kolom TUNGGAL — yang dilakukan versi sebelum ini —
        # menyimpan nilai baris pertama saja dan **membuang diam-diam** yang
        # kedua. Tidak ada galat: potkom baris pertama tetap angka yang masuk
        # akal, jadi yang hilang hanya separuh dasar penilaian.
        #
        # `tahun`/`jenis`/`status` DIWARISI dari baris pertama, dan itu bukan
        # tambalan: terukur 31 dari 31 baris kedua mengosongkan ketiganya, sebab
        # keduanya hasil dari SATU peristiwa asesmen yang dinilai terhadap dua
        # rubrik jenjang. Menyalinnya lebih jujur daripada menyimpan kosong,
        # yang akan terbaca sebagai "tahunnya tidak diketahui".
        hurufUntuk = {v: k for k, v in kolom.items()}
        hJenjang = hurufUntuk.get("jenjangAsesmen")
        hPotkom = hurufUntuk.get("potkom")
        hKotak = hurufUntuk.get("kotak9Sumber")
        asesmen = []
        for m in range(n, akhir + 1):
            brs = rows.get(m, {})
            jenjang = brs.get(hJenjang, "") if hJenjang else ""
            potkom = brs.get(hPotkom, "") if hPotkom else ""
            if not jenjang and not potkom:
                continue
            asesmen.append(
                {
                    "jenjangAsesmen": jenjang,
                    "potkom": potkom,
                    "kotak9Sumber": (brs.get(hKotak, "") if hKotak else ""),
                    "tahunAsesmen": rec.get("tahunAsesmen", ""),
                    "jenisAsesmen": rec.get("jenisAsesmen", ""),
                    "statusAsesmen": rec.get("statusAsesmen", ""),
                    "barisExcel": m,
                }
            )
        rec["asesmen"] = asesmen

        # ── UNIT KERJA yang tergeser, dipulihkan dari riwayat jabatan ─────────
        #
        # Pada `TALENT POOL PENGAWAS#2`, 7 dari 53 baris memuat TANGGAL di kolom
        # UNIT KERJA ("13-10-2025" ×5, "01-08-2025", serial "45943") — selnya
        # tergeser di baris-baris itu. Menyimpannya apa adanya akan menciptakan
        # unit organisasi bernama "13-10-2025" di master data.
        #
        # Entri riwayat jabatan PERTAMA adalah jabatan yang sedang dijabat, dan ia
        # menyebut unitnya eksplisit ("Kepala Subbagian Tata Usaha, Direktorat
        # Keselamatan dan Keberlanjutan Konstruksi"). Jadi unitnya bisa dipulihkan
        # dari situ — dan itu BUKAN tebakan: aturan ini diuji lebih dulu terhadap
        # **46 baris yang unit kerjanya sudah benar** dan cocok **46/46, nol
        # beda**. Barisnya ditandai `unitKerjaDipulihkan` supaya siapa pun yang
        # meninjau JSON-nya tahu angka itu tidak datang dari kolomnya sendiri.
        # ── Blok M..U yang TERGESER SATU KOLOM KE KIRI ────────────────────────
        #
        # Pada 6 dari 53 baris berkas Pengawas, sel `UNIT KERJA` HILANG, sehingga
        # seluruh blok dari situ sampai `RIWAYAT PENDIDIKAN` melorot satu kolom.
        # Akibatnya bukan cuma unitnya salah: `SEKOLAH`, `BIDANG STUDI`,
        # `TINGKAT PENDIDIKAN`, `JURUSAN`, dan `RIWAYAT PENDIDIKAN` semuanya
        # terbaca dari kolom sebelahnya. Terukur: 6 pegawai masuk DB **tanpa satu
        # pun baris riwayat pendidikan**, dan `sekolah_terakhir` mereka berisi
        # "Teknik"/"Non Teknik" — itu nilai BIDANG STUDI, bukan nama sekolah.
        #
        # Kolom V ke kanan (data asesmen) TIDAK tergeser, jadi potkom & rating
        # kinerja mereka selama ini benar.
        #
        # Pergeseran ini DIVALIDASI, tidak diterapkan buta: offset hanya dipakai
        # kalau hasilnya menghasilkan jenjang pendidikan yang sah DAN riwayat
        # pendidikan yang memuat tahun dalam tanda kurung. Itu penting — baris
        # ke-7 yang unitnya juga rusak (serial "45943") ternyata kolom
        # pendidikannya LURUS, dan menggesernya akan merusak yang tadinya benar.
        if not re.search(KATA_UNIT, rec.get("unitKerja", "")):
            # Field yang BENAR-BENAR bergeser satu kolom, diikat ke bukti per
            # field — bukan blok M..U disapu rata.
            #
            # Ada DUA sel yang hilang di baris ini, bukan satu: `UNIT KERJA` dan
            # `SEKOLAH`. Karena itu menggeser semuanya membuat `sekolah` terbaca
            # dari kolom `RIWAYAT PELATIHAN` — terukur: nilainya jadi
            # "Sosialisasi Peningkatan Kesadaran Budaya Kerja…", nama pelatihan,
            # bukan nama sekolah. Jadi `sekolah` dikosongkan (nilainya memang
            # tidak ada di baris itu) dan `unitKerja` dipulihkan dari riwayat
            # jabatan di bawah.
            GESER = ("tmtJabatan", "bidangStudi", "tingkatPendidikan", "jurusan", "riwayatPendidikan")
            kolomDari = {v: k for k, v in kolom.items()}
            geser = {
                f: inti.get(kolomSebelum(kolomDari[f]), "")
                for f in GESER
                if f in kolomDari and len(kolomDari[f]) == 1
            }
            jenjangGeser = geser.get("tingkatPendidikan", "").strip().upper()
            riwayatGeser = geser.get("riwayatPendidikan", "")
            if jenjangGeser in JENJANG_SAH and re.search(r"\((19|20)\d\d\)", riwayatGeser):
                rec.update(geser)
                rec["sekolahMentah"] = rec.get("sekolah", "")
                rec["sekolah"] = ""
                rec["blokTergeserDipulihkan"] = True

        if not re.search(KATA_UNIT, rec.get("unitKerja", "")):
            pulih = unit_dari_riwayat(rec["riwayatJabatan"])
            rec["unitKerjaMentah"] = rec.get("unitKerja", "")
            rec["unitKerja"] = pulih or ""
            rec["unitKerjaDipulihkan"] = bool(pulih)
            # TMT jabatan: kalau geseran sudah memulihkannya (nilai sah di kolom
            # sebelumnya), JANGAN dikosongkan lagi. Yang dikosongkan hanya baris
            # yang geserannya tidak terbukti — di sana TMT-nya memang berisi
            # rentang tanggal diklat, dan menyimpannya berarti tanggal palsu.
            if not rec.get("blokTergeserDipulihkan"):
                rec["tmtJabatanMentah"] = rec.get("tmtJabatan", "")
                rec["tmtJabatan"] = ""

        # Foto boleh ditambatkan di baris mana pun DI DALAM blok, bukan selalu
        # baris pertamanya — jadi seluruh rentang blok diperiksa.
        rec["foto"] = next(
            (fotoPerBaris[m] for m in range(n, akhir + 1) if m in fotoPerBaris), ""
        )
        keluar.append(rec)

    out = Path("doc/data")
    (out / "foto").mkdir(parents=True, exist_ok=True)
    keluarJson.parent.mkdir(parents=True, exist_ok=True)
    tersimpan = 0
    for rec in keluar:
        if not rec["foto"] or not rec["nip"]:
            continue
        (out / "foto" / f"{rec['nip']}.png").write_bytes(z.read(rec["foto"]))
        rec["foto"] = f"doc/data/foto/{rec['nip']}.png"
        tersimpan += 1

    keluarJson.write_text(
        json.dumps(keluar, ensure_ascii=False, indent=1), encoding="utf8"
    )
    tanpaFoto = [r["nama"] for r in keluar if not r["foto"]]
    print(f"pegawai        : {len(keluar)}")
    print(f"riwayat jabatan: {sum(len(r['riwayatJabatan']) for r in keluar)}")
    print(f"riwayat diklat : {sum(len(r['riwayatDiklat']) for r in keluar)}")
    print(f"foto tersimpan : {tersimpan}" + (f" · TANPA foto: {tanpaFoto}" if tanpaFoto else ""))
    print(f"keluaran       : {keluarJson} + doc/data/foto/<nip>.png")


if __name__ == "__main__":
    main()
