#!/usr/bin/env python3
"""Ekstrak `Persyaratan Jabatan Struktural di BP2JK dan BJKW.xlsx` → JSON.

Lembar tunggal ("7. BJKW dan 8. BP2JK"), 5 baris jabatan, kolom bernama tetap.
Ditulis sebagai SKRIP dan bukan sekali-jalan supaya hasilnya bisa dilahirkan ulang
saat berkasnya direvisi — pola yang sama dengan `scripts/xlsx-ke-json.py`.

  python3 scripts/persyaratan-balai-ke-json.py "<berkas.xlsx>" --keluar doc/data/persyaratan-balai.json
"""
import argparse, json, zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
T = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'


def baca_sel(berkas):
    z = zipfile.ZipFile(berkas)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        ss = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in ss.findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter(T)))
    sh = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    sel = {}
    for r in sh.findall('.//m:row', NS):
        for c in r.findall('m:c', NS):
            v = c.find('m:v', NS)
            if v is None or v.text is None:
                continue
            teks = shared[int(v.text)] if c.get('t') == 's' else v.text
            teks = teks.strip()
            if teks:
                sel[c.get('r')] = teks
    return sel


def rapikan(teks):
    """Pecah daftar berbutir "- ..." jadi larik; buang tanda kutip nyasar sumbernya."""
    if teks is None:
        return []
    baris = [b.strip().lstrip("'").lstrip('-').strip() for b in teks.split('\n')]
    return [b for b in baris if b]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('berkas')
    ap.add_argument('--keluar', required=True)
    a = ap.parse_args()

    sel = baca_sel(a.berkas)
    hasil = []
    for row in range(7, 12):
        nama = sel.get(f'C{row}')
        if not nama:
            continue
        hasil.append({
            'no': sel.get(f'B{row}'),
            'namaJabatan': nama,
            'tempat': sel.get(f'K{row}'),
            'pendidikanMin': sel.get(f'D{row}'),
            'bidangPendidikan': sel.get(f'E{row}'),
            'pelatihanManajerial': sel.get(f'F{row}'),
            'pelatihanTeknis': sel.get(f'G{row}'),
            'pengalamanKerja': rapikan(sel.get(f'H{row}')),
            'golonganMin': sel.get(f'I{row}'),
            'keterangan': sel.get(f'J{row}'),
        })

    with open(a.keluar, 'w', encoding='utf-8') as f:
        json.dump(hasil, f, ensure_ascii=False, indent=2)
    print(f'{len(hasil)} jabatan → {a.keluar}')
    for h in hasil:
        print(f"  · {h['namaJabatan']} @ {h['tempat']} — {h['pendidikanMin']} · {h['golonganMin']} · {len(h['pengalamanKerja'])} butir pengalaman")


if __name__ == '__main__':
    main()
