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

KOLOM = {
    "A": "no", "B": "nama", "C": "nip", "E": "tmtGolongan", "F": "golongan",
    "G": "eselon", "H": "namaJabatan", "K": "unitKerja", "L": "tmtJabatan",
    "M": "tmtDiklat", "O": "sekolah", "P": "bidangStudi", "Q": "tingkatPendidikan",
    "R": "jurusan", "S": "riwayatPendidikan", "T": "jenjangAsesmen",
    "U": "tahunAsesmen", "V": "jenisAsesmen", "W": "statusAsesmen",
    "X": "potkom", "Y": "ratingKinerja", "Z": "kotak9Sumber",
}


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
        sys.exit("pakai: python3 scripts/xlsx-ke-json.py <berkas.xlsx>")
    sumber = Path(sys.argv[1])
    z = zipfile.ZipFile(sumber)
    rows = baca_sheet(z)
    fotoPerBaris = baca_foto(z)

    awal = [n for n in sorted(rows) if re.fullmatch(r"\d+", rows[n].get("A", ""))]
    keluar = []
    for i, n in enumerate(awal):
        akhir = (awal[i + 1] - 1) if i + 1 < len(awal) else max(rows)
        inti = rows[n]
        rec = {baru: inti.get(k, "") for k, baru in KOLOM.items()}
        rec["barisExcel"] = n
        rec["riwayatJabatan"] = [
            {"nama": rows[m]["I"], "masaKerja": rows[m].get("J", "")}
            for m in range(n, akhir + 1)
            if rows.get(m, {}).get("I")
        ]
        rec["riwayatDiklat"] = [
            rows[m]["N"] for m in range(n, akhir + 1) if rows.get(m, {}).get("N")
        ]
        # Foto boleh ditambatkan di baris mana pun DI DALAM blok, bukan selalu
        # baris pertamanya — jadi seluruh rentang blok diperiksa.
        rec["foto"] = next(
            (fotoPerBaris[m] for m in range(n, akhir + 1) if m in fotoPerBaris), ""
        )
        keluar.append(rec)

    out = Path("doc/data")
    (out / "foto").mkdir(parents=True, exist_ok=True)
    tersimpan = 0
    for rec in keluar:
        if not rec["foto"] or not rec["nip"]:
            continue
        (out / "foto" / f"{rec['nip']}.png").write_bytes(z.read(rec["foto"]))
        rec["foto"] = f"doc/data/foto/{rec['nip']}.png"
        tersimpan += 1

    (out / "talentpool-es23.json").write_text(
        json.dumps(keluar, ensure_ascii=False, indent=1), encoding="utf8"
    )
    tanpaFoto = [r["nama"] for r in keluar if not r["foto"]]
    print(f"pegawai      : {len(keluar)}")
    print(f"riwayat jabatan: {sum(len(r['riwayatJabatan']) for r in keluar)}")
    print(f"riwayat diklat : {sum(len(r['riwayatDiklat']) for r in keluar)}")
    print(f"foto tersimpan : {tersimpan}" + (f" · TANPA foto: {tanpaFoto}" if tanpaFoto else ""))
    print("keluaran     : doc/data/talentpool-es23.json + doc/data/foto/<nip>.png")


if __name__ == "__main__":
    main()
