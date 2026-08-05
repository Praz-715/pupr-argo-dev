import {
  GalatPermintaan,
  GalatScopePersonal,
  GalatTidakAda,
  tanganiV1,
} from '@/lib/api/bungkus'
import { ambilProfil } from '@/lib/kueri/pegawai'

/**
 * `GET /api/v1/pegawai/{nip}` — detail profil satu pegawai (PRD §7.2).
 *
 * **Menuntut scope `data_personal`, tanpa pengecualian.** Endpoint daftar masih
 * bisa dilayani tanpa scope itu dengan menyamarkan `nip`/`nama`, tapi endpoint
 * ini tidak: pemanggilnya **sudah memegang NIP** dan meminta profil satu orang
 * tertentu. Menyamarkannya jadi tidak ada artinya — yang tersisa tetap "data
 * seseorang yang identitasnya sudah diketahui pemanggil", dan itu definisi data
 * pribadi (UU PDP No. 27/2022, PRD §7.3).
 *
 * Jadi tanpa scope personal balasannya **403, bukan 200 yang disamarkan**. Ini
 * pembedaan yang paling mudah salah: menyamarkan di sini akan terasa konsisten
 * dengan endpoint daftar, dan justru itu yang keliru.
 *
 * Yang dikirim adalah **irisan** dari `ambilProfil()`, bukan seluruh isinya.
 * Turunan NIP (tanggal lahir, jenis kelamin, proyeksi pensiun) sengaja TIDAK
 * ikut: ketiganya tidak pernah diminta instansi mana pun, dan mengirimkannya
 * hanya karena tersedia adalah kebalikan dari minimalisasi data.
 */
export const GET = tanganiV1('pegawai', async (ctx) => {
  if (!ctx.klien.scope.dataPersonal) {
    // Dilempar supaya pembungkusnya mencatat & membalas dalam bentuk seragam.
    // 403-nya menyebut sebabnya, karena klien memang perlu tahu apa yang harus
    // diminta ke Super Admin.
    throw new GalatScopePersonal()
  }

  const nip = ctx.url.pathname.split('/').pop() ?? ''
  const bersih = nip.replace(/\D/g, '').slice(0, 18)
  if (bersih.length !== 18) {
    throw new GalatPermintaan('NIP harus 18 digit angka.')
  }

  const p = await ambilProfil(bersih)
  if (p === null) throw new GalatTidakAda('Pegawai dengan NIP itu tidak ditemukan.')

  return {
    data: {
      nip: p.nip,
      nama: p.nama,
      golongan: p.golongan,
      pangkat: p.pangkat,
      tmt_golongan: p.tmtGolongan,
      tmt_jabatan: p.tmtJabatan,
      jabatan: p.namaJabatan,
      jenis_jabatan: p.jenisJabatan,
      jenjang: p.jenjang,
      eselon: p.eselon,
      unit_organisasi: p.namaUnit,
      unit_induk: p.unitInduk,
      tingkat_pendidikan: p.tingkatPendidikan,
      bidang_studi_terakhir: p.bidangStudiTerakhir,
      status_aktif: p.statusAktif,
      masa_kerja_tahun: p.masaKerjaTahun,
    },
    meta: {
      catatan_minimalisasi:
        'Turunan NIP (tanggal lahir, jenis kelamin, proyeksi pensiun) dan riwayat diklat TIDAK disertakan. Ajukan perluasan scope bila memang dibutuhkan dasar hukumnya.',
    },
  }
})

