import Image from 'next/image'

import { LogoPU } from '@/components/ui/logo-pu'
import { fotoMasuk, logoResmi } from '@/lib/aset-publik'

/**
 * Panel bermerek di sisi kiri halaman autentikasi — tempat foto pegawai PUPR.
 *
 * **Fotonya opsional dan keberadaannya diperiksa di server**, bukan diserahkan
 * ke `<img>` yang gagal memuat. Alasannya: gambar yang 404 menghasilkan panel
 * kosong berisi ikon gambar rusak — dan halaman MASUK adalah layar pertama yang
 * dilihat pengguna. Aplikasi yang tampak rusak di layar pertama akan dilaporkan
 * sebagai rusak, apa pun keadaan sebenarnya. Jadi tanpa foto, panel ini
 * menampilkan komposisi lambang yang memang dirancang untuk berdiri sendiri.
 *
 * Menaruh fotonya: simpan sebagai salah satu dari `BERKAS_LATAR` di `public/`,
 * mis. `public/masuk-latar.jpg`. Tidak ada langkah lain — panel ini memakainya
 * di permintaan berikutnya.
 *
 * Catatan kepatuhan yang tidak boleh hilang: foto pegawai yang dapat
 * diidentifikasi adalah data pribadi (UU PDP No. 27/2022, lihat `doc/PRD.md`
 * §7.3). Layar masuk bersifat PRA-AUTENTIKASI — siapa pun yang bisa menjangkau
 * alamatnya bisa melihatnya, termasuk dari luar jaringan internal. Pakai foto
 * yang memang disiapkan untuk publikasi (dokumentasi humas, foto kegiatan resmi)
 * dan yang subjeknya sudah menyetujui, bukan foto dari berkas kepegawaian.
 */

export function PanelMerek() {
  const latar = fotoMasuk()
  const logo = logoResmi()

  return (
    // Disembunyikan di bawah lg: di layar sempit, panel ini akan mendorong
    // formulirnya ke paruh bawah layar dan menuntut orang menggulir untuk masuk.
    <aside className="relative hidden overflow-hidden lg:flex lg:w-[46%] lg:max-w-[46rem] lg:shrink-0">
      {latar ? (
        <>
          <Image
            src={latar}
            alt=""
            fill
            priority
            sizes="46vw"
            className="object-cover"
          />
          {/* Scrim navy dari kiri-bawah: teksnya duduk di bagian paling gelap.
              Kepekatannya dipilih supaya kontras teks tidak bergantung pada isi
              fotonya — foto pegawai bisa terang atau gelap, dan panel ini harus
              terbaca untuk KEDUANYA tanpa perlu diukur ulang tiap kali fotonya
              diganti. Karena itu ada dua lapis: satu gradien arah, satu rata. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_top,rgb(23_37_84/0.96)_0%,rgb(23_37_84/0.82)_38%,rgb(30_64_138/0.55)_100%)]"
          />
          <div aria-hidden className="absolute inset-0 bg-merek-900/25" />
        </>
      ) : (
        // Tanpa foto: komposisi lambang yang berdiri sendiri. Bukan kotak
        // penampung yang menunggu diisi — ia harus terlihat sebagai pilihan
        // desain, karena mungkin memang tidak pernah diisi.
        <>
          <div aria-hidden className="permukaan-sidebar absolute inset-0" />
          {/* Watermark di kanan-ATAS, bukan kanan-bawah seperti konvensi biasa.
              Panelnya hanya ~660px lebar di layar 1440 sementara blok teksnya
              `max-w-md` (448px) dan duduk di bawah — watermark kanan-bawah pasti
              melintas di belakang paragraf & daftar butir, dan versi pertama
              memang begitu: hurufnya terbaca menembus teks. Kanan-atas kosong
              sepenuhnya (baris merek ada di kiri-atas).

              Tanpa mix-blend-*: mode blend memaksa lapisan komposit sendiri, dan
              itu memunculkan kotak-batas SVG-nya sebagai persegi terang di atas
              gradien. Opacity biasa sudah cukup. */}
          <div aria-hidden className="absolute -top-20 -right-24 opacity-[0.06]">
            <LogoPU sumber={logo} size={420} varian="emas" />
          </div>
        </>
      )}

      {/* Garis emas di tepi kanan menyambung ke kolom formulir — motif yang sama
          dengan tepi sidebar di dalam aplikasi. */}
      <div aria-hidden className="absolute inset-y-0 right-0 w-[3px] bg-emas" />

      {/* pb-24, bukan p-10 rata: sudut kiri-bawah harus tetap lapang. Di dev,
          indikator Next.js duduk di sana dan memotong baris terakhir daftar —
          terjadi pada versi pertama panel ini, sama seperti yang sudah
          didokumentasikan untuk sidebar. */}
      <div className="relative flex flex-1 flex-col justify-between p-10 pb-24">
        <div className="flex items-center gap-3">
          <LogoPU sumber={logo} size={44} varian="kotak" bermakna />
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold text-white">
              Kementerian Pekerjaan Umum
            </span>
            <span className="block text-[12px] text-kepala-teks-samar">
              Direktorat Jenderal Bina Konstruksi
            </span>
          </span>
        </div>

        <div className="max-w-md">
          <h2 className="text-[26px] leading-tight font-semibold tracking-tight text-white">
            Sistem Informasi Manajemen Talenta
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-kepala-teks-samar">
            Pemetaan talenta ASN, talent pool jabatan target, dan rencana suksesi
            Direktorat Jenderal Bina Konstruksi — dalam satu tempat.
          </p>

          <ul className="mt-6 space-y-2">
            {[
              'Sebaran Kotak 9 & profil talenta',
              'Penilaian jabatan target berbasis rubrik',
              'Nominasi & persetujuan suksesi',
            ].map((butir) => (
              <li key={butir} className="flex items-start gap-2.5 text-[13px] text-white/90">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-emas" />
                {butir}
              </li>
            ))}
          </ul>
        </div>

        {/* Sudut kiri-bawah sengaja DIBIARKAN KOSONG. Di dev, indikator Next.js
            duduk tepat di sana dan memotong teks apa pun yang ditaruh di situ —
            aturan yang sudah berlaku untuk sidebar (lihat komentarnya) dan
            terbukti lagi di sini: kalimat kepatuhan sempat tertutup separuh.
            Kalimat itu sekarang hidup di footer kolom formulir, satu tempat. */}
      </div>
    </aside>
  )
}
