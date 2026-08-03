# Diagram Arsitektur — SIMT DJBK Modular Monolith

> **Transkrip dari [`WhatsApp Image 2026-07-31 at 4.40.35 PM.jpeg`](WhatsApp%20Image%202026-07-31%20at%204.40.35%20PM.jpeg).**
> Gambar ini **sama** dengan gambar §4 "Gambar Arsitektur" di
> [`00_Blueprint_Arsitektur_Talenta.md`](00_Blueprint_Arsitektur_Talenta.md)
> ([`media/image1.png`](media/image1.png)) — versi WhatsApp-nya beresolusi lebih rendah.
> Yang ditulis di bawah adalah isi kotak & panah apa adanya, bukan tafsiran.

![Diagram arsitektur SIMT DJBK](media/image1.png)

---

## Aliran data

```mermaid
flowchart TD
    subgraph SUMBER["SISTEM SUMBER YANG DAPAT DIGANTI"]
        S1["eHRM / SIASN / Sistem Pegawai"]
        S2["eKinerja"]
        S3["Sistem Asesmen"]
        S4["eNominasi"]
        S5["CSV / Excel / DB Legacy"]
    end

    GW["Integration Gateway<br>Source Registry + Adapter + Auth + Scheduler"]
    RAW["Raw Intake<br>Payload asli, batch, hash, timestamp"]
    STG["Staging &amp; Data Quality<br>Validasi, normalisasi, dedup, mapping, quarantine"]
    CANON["Canonical Talent Database<br>Pegawai, Jabatan, Unit, Riwayat, Asesmen, Kinerja, Disiplin"]
    API["Internal Application API / Service Layer"]

    S1 --> GW
    S2 --> GW
    S3 --> GW
    S4 --> GW
    S5 --> GW
    GW --> RAW --> STG --> CANON --> API

    subgraph MONO["MODULAR MONOLITH SIMT"]
        M1["Master Data Module"]
        M2["Target Position Module"]
        M3["Dashboard &amp; Reporting"]
        M4["IAM, Audit, Configuration"]
        M5["Eligibility Engine"]
        M6["Scoring Engine<br>Versioned Rules &amp; Weights"]
        M7["Nomination &amp; Approval"]

        M5 -- "eligible/review" --> M6
        M6 -- "ranking" --> M7
    end

    API --> M1
    API --> M2
    API --> M3
    API --> M4
    API --> M5
    API --> M6
    API --> M7

    WEB["Web Dashboard<br>Selector Jabatan, Kandidat, Ranking, Data Health"]

    M1 --> WEB
    M2 --> WEB
    M3 --> WEB
    M4 --> WEB
    M5 --> WEB
    M6 --> WEB
    M7 --> WEB
```

---

## Isi tiap kotak

### Sistem sumber yang dapat diganti *(kotak bergaris putus-putus)*

| Kotak |
|---|
| eHRM / SIASN / Sistem Pegawai |
| eKinerja |
| Sistem Asesmen |
| eNominasi |
| CSV / Excel / DB Legacy |

Kelima sumber menunjuk ke **satu** tujuan yang sama: Integration Gateway.

### Jalur pipa data *(berurutan, satu arah)*

| Urutan | Kotak | Keterangan di dalam kotak |
|---|---|---|
| 1 | Integration Gateway | Source Registry + Adapter + Auth + Scheduler |
| 2 | Raw Intake | Payload asli, batch, hash, timestamp |
| 3 | Staging & Data Quality | Validasi, normalisasi, dedup, mapping, quarantine |
| 4 | Canonical Talent Database | Pegawai, Jabatan, Unit, Riwayat, Asesmen, Kinerja, Disiplin |
| 5 | Internal Application API / Service Layer | — |

### Modul di dalam "MODULAR MONOLITH SIMT"

| Modul | Keterangan di dalam kotak |
|---|---|
| Master Data Module | — |
| Target Position Module | — |
| Dashboard & Reporting | — |
| IAM, Audit, Configuration | — |
| Eligibility Engine | — |
| Scoring Engine | Versioned Rules & Weights |
| Nomination & Approval | — |

### Panah berlabel di dalam monolith

| Dari | Label | Ke |
|---|---|---|
| Eligibility Engine | `eligible/review` | Scoring Engine |
| Scoring Engine | `ranking` | Nomination & Approval |

### Muara

Seluruh modul bermuara ke satu kotak paling bawah:

> **Web Dashboard** — Selector Jabatan, Kandidat, Ranking, Data Health
