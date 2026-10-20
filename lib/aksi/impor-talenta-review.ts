'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { kueri } from '@/lib/db'
import { gerbangPeran } from '@/lib/aksi/gerbang'
import { lingkupData, tanpaAkses, unitWajib } from '@/lib/lingkup'
import { bacaTalentPool, type BarisTalentPool, type EntriAsesmenExcel } from '@/lib/importer/talentpool-xlsx'
import { ekstrakFotoTalentPool } from '@/lib/importer/foto-xlsx'
import { adaFotoPegawai } from '@/lib/foto-pegawai'
import { simpanFotoPegawai } from '@/lib/foto-pegawai-upload' 

export type JenisMasalah = 'pegawai' | 'asesmen' | 'pendidikan'
export type MasalahImport = {
  id: string
  nip: string
  nama: string
  kategori: JenisMasalah
  judul: string
  penjelasan: string
  index?: number
  nilai?: EntriAsesmenExcel
}
export type SelisihField = {
  key: string
  label: string
  lama: string
  excel: string
  sama: boolean
}
export type RingkasanKategori = { dariExcel: number; diSIMT: number; akanDitambah: number }
export type KoreksiProfil = Partial<Pick<BarisTalentPool,
  'nama'|'golongan'|'tingkatPendidikan'|'namaJabatan'|'unitKerja'|'tmtGolongan'|'tmtJabatan'|'sekolah'|'jurusan'
>>
export type PegawaiPreview = {
  nip: string
  nama: string
  baris: number
  kondisi: 'BARU' | 'UPDATE' | 'SAMA' | 'DITINJAU'
  sudahAda: boolean
  sumber: KoreksiProfil
  perbedaan: SelisihField[]
  perbandingan: {
    jabatan: RingkasanKategori
    pelatihan: RingkasanKategori
    pendidikan: RingkasanKategori
    asesmen: RingkasanKategori
  }
  ringkas: { jabatan: number; pelatihan: number; pendidikan: number; asesmen: number }
}
export type FotoPreview = {nip:string; baris:number; sudahAda:boolean; ukuran:number; tipe:string}
export type Pratinjau = {
  sha: string
  snapshot: string
  file: string
  jumlah: number
  baru: number
  berubah: number
  sama: number
  daftar: PegawaiPreview[]
  masalah: MasalahImport[]
  foto: FotoPreview[]
  peringatanFoto: string[]
  tidakDikenal: string[]
}
export type Putusan = {
  id: string
  aksi: 'TAHAN' | 'KOREKSI'
  tahun?: string
  jenis?: string
  status?: string
  rating?: string
  potkom?: string
  catatan?: string
  diverifikasi?: boolean
  perbaikan?: KoreksiProfil
}
type Hasil<T> = { ok: true; data: T; pesan?: string } | { ok: false; pesan: string }

const PERAN = ['Super Admin', 'Admin Talenta', 'Pengelola Unit'] as const
const JENJANG = new Set(['SLTA','D3','S1_D4','S2','S3'])
const PANGKAT: Record<string,string> = {
  'I/a':'Juru Muda','I/b':'Juru Muda Tingkat I','I/c':'Juru','I/d':'Juru Tingkat I',
  'II/a':'Pengatur Muda','II/b':'Pengatur Muda Tingkat I','II/c':'Pengatur','II/d':'Pengatur Tingkat I',
  'III/a':'Penata Muda','III/b':'Penata Muda Tingkat I','III/c':'Penata','III/d':'Penata Tingkat I',
  'IV/a':'Pembina','IV/b':'Pembina Tingkat I','IV/c':'Pembina Utama Muda',
  'IV/d':'Pembina Utama Madya','IV/e':'Pembina Utama'
}
function bersih(s: unknown) { return String(s ?? '').trim().replace(/\s+/g,' ') }
function kunci(s: unknown) { return bersih(s).toLowerCase().replace(/\bsub\s+(direktorat|bagian|bidang)\b/g,'sub$1').replace(/[^a-z0-9]+/g,' ').trim() }
function jenjang(s: string) { const v=bersih(s).toUpperCase().replace(/\s*\/\s*/g,'_'); return v==='S1'||v==='D4'?'S1_D4':v }
function golongan(s:string) { return bersih(s).replace(/^([IV]+)[.\s-]+([a-e])$/i,(_,a:string,b:string)=>a.toUpperCase()+'/'+b.toLowerCase()) }
function parseTanggal(s:string):string|null {
  const v=bersih(s)
  if (!v||v==='-') return null
  if (/^\d{5}$/.test(v)) {
    const d=new Date(Date.UTC(1899,11,30)+Number(v)*86400000)
    return d.toISOString().slice(0,10)
  }
  let m=v.match(/^(\d{4})-(\d\d?)-(\d\d?)$/)
  if(m)return [m[1],m[2]!.padStart(2,'0'),m[3]!.padStart(2,'0')].join('-')
  m=v.match(/^(\d\d?)[/-](\d\d?)[/-](\d{4})$/)
  if(m)return [m[3],m[2]!.padStart(2,'0'),m[1]!.padStart(2,'0')].join('-')
  return null
}
function daftarPendidikan(s:string) {
  return String(s ?? '').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((row)=>{
    const m=row.match(/^\s*([A-Za-z0-9/-]+)\s*[-–]\s*(.*?)(?:\s*\((\d{4})\))?\s*$/)
    if(!m)return {raw:row,level:'',bidang:'',tahun:null as number|null}
    return {raw:row,level:jenjang(m[1]!),bidang:bersih(m[2]),tahun:m[3]?Number(m[3]):null}
  })
}
type DbPegawai = { riwayatDiklat:unknown; jabatanNama:string|null; unitNama:string|null; id:number; nip:string; nama:string; golongan:string; pangkat:string; pendidikan:string; jabatanId:number|null; sekolah:string|null; bidang:string|null; tmtGolongan:string|null; tmtJabatan:string|null }
type DbJabatan = {id:number; nama:string; unit:string; unitId:number}
type RiwayatDb = { nip:string; nama:string; mulai:string|null; akhir:string|null }
type PendidikanDb = { nip:string; jenjang:string; bidang:string|null; tahun:number|null }
type AsesmenDb = { nip:string; tahun:number; jenis:string; jenjang:string|null; potkom:string|number; rating:string|null; status:string|null }
type RiwayatPembanding = { jabatan:RiwayatDb[]; pendidikan:PendidikanDb[]; asesmen:AsesmenDb[] }
function formatTanggal(v:string|null|undefined){return v ? String(v).slice(0,10):''}
function jenisAsesmen(s:string){return kunci(s).replace(/\s+/g,' ')}
function bandingkanProfil(r:BarisTalentPool, db:DbPegawai|null|undefined, jabatan:DbJabatan|undefined):SelisihField[]{
  const g=golongan(r.golongan)
  const bidang=bersih(r.jurusan)||bersih(r.bidangStudi)
  const data:Array<{key:string;label:string;excel:string;lama:string}>= [
    {key:'nama_lengkap',label:'Nama lengkap',excel:bersih(r.nama),lama:db?.nama||''},
    {key:'golongan',label:'Golongan',excel:g,lama:db?.golongan||''},
    {key:'pangkat',label:'Pangkat (otomatis)',excel:g?PANGKAT[g]||'':'',lama:db?.pangkat||''},
    {key:'tingkat_pendidikan',label:'Pendidikan terakhir',excel:r.tingkatPendidikan?jenjang(r.tingkatPendidikan):'',lama:db?.pendidikan||''},
    {key:'jabatan_id',label:'Jabatan / unit kerja',excel:jabatan?jabatan.nama+' · '+jabatan.unit:'',lama:db?.jabatanNama ? db.jabatanNama+' · '+(db.unitNama||'') : ''},
    {key:'tmt_golongan',label:'TMT golongan',excel:parseTanggal(r.tmtGolongan)||'',lama:formatTanggal(db?.tmtGolongan)},
    {key:'tmt_jabatan',label:'TMT jabatan',excel:parseTanggal(r.tmtJabatan)||'',lama:formatTanggal(db?.tmtJabatan)},
    {key:'sekolah_terakhir',label:'Sekolah terakhir',excel:bersih(r.sekolah),lama:db?.sekolah||''},
    {key:'bidang_studi_terakhir',label:'Bidang studi',excel:bidang,lama:db?.bidang||''},
  ]
  return data.filter(d=>d.excel!=='').map(d=>({...d,sama:d.excel===d.lama}))
}
function kunciRiwayat(r:{nama:string;mulai:string|null;akhir:string|null}){
  return kunci(r.nama)+'|'+formatTanggal(r.mulai)+'|'+formatTanggal(r.akhir)
}
function hitungan(sumber:string[],db:string[]):RingkasanKategori{
  const ada=new Set(db)
  const tambahan=new Set(sumber.filter(v=>!ada.has(v)))
  return {dariExcel:sumber.length,diSIMT:db.length,akanDitambah:tambahan.size}
}
async function dbSnapshot(rows:BarisTalentPool[]) {
  const user=await getCurrentUser()
  const lingkup=lingkupData(user)
  if(tanpaAkses(lingkup)) throw new Error('Tidak ada akses ke direktori.')
  const batas=unitWajib(lingkup)
  const pejabat=new Map<string,DbPegawai>()
  const riwayat=new Map<string,RiwayatPembanding>()
  const ambilRiwayat=(nip:string)=>{
    const found=riwayat.get(nip)
    if(found)return found
    const fresh:RiwayatPembanding={jabatan:[],pendidikan:[],asesmen:[]}
    riwayat.set(nip,fresh)
    return fresh
  }
  const nipUnik=[...new Set(rows.map(r=>r.nip.replace(/\D/g,'')).filter(n=>/^\d{18}$/.test(n)))]
  for(let i=0;i<nipUnik.length;i+=200){
    const ids=nipUnik.slice(i,i+200)
    // Recursive CTE is placed outside IN for broad MySQL compatibility.
    const prefix=batas===null?'':'WITH RECURSIVE turunan AS (SELECT id FROM unit_organisasi WHERE id = ? UNION ALL SELECT u.id FROM unit_organisasi u JOIN turunan t ON u.parent_id=t.id) '
    const suffix=batas===null?'':' AND j.unit_organisasi_id IN (SELECT id FROM turunan)'
    const sql=prefix+'SELECT p.id, p.nip, p.nama_lengkap AS nama, p.golongan, p.pangkat, p.tingkat_pendidikan AS pendidikan, p.jabatan_id AS jabatanId, j.nama_jabatan AS jabatanNama, u.nama_unit AS unitNama, p.riwayat_diklat AS riwayatDiklat, p.sekolah_terakhir AS sekolah, p.bidang_studi_terakhir AS bidang, p.tmt_golongan AS tmtGolongan, p.tmt_jabatan AS tmtJabatan FROM pegawai p LEFT JOIN jabatan j ON j.id=p.jabatan_id LEFT JOIN unit_organisasi u ON u.id=j.unit_organisasi_id WHERE p.nip IN (?)'+suffix
    const found=await kueri<DbPegawai>(sql,batas===null?[ids]:[batas,ids])
    for(const x of found)pejabat.set(String(x.nip),x)
    const aman=found.map(x=>String(x.nip))
    if(aman.length){
      const [jabDb,pendDb,asesDb]=await Promise.all([
        kueri<RiwayatDb>('SELECT p.nip, r.jabatan_nama_mentah AS nama, r.tanggal_mulai AS mulai, r.tanggal_akhir AS akhir FROM riwayat_jabatan r JOIN pegawai p ON p.id=r.pegawai_id WHERE p.nip IN (?)',[aman]),
        kueri<PendidikanDb>('SELECT p.nip, r.jenjang_pendidikan AS jenjang, r.bidang_studi AS bidang, r.tahun_lulus AS tahun FROM riwayat_pendidikan r JOIN pegawai p ON p.id=r.pegawai_id WHERE p.nip IN (?)',[aman]),
        kueri<AsesmenDb>('SELECT p.nip, a.tahun_asesmen AS tahun, a.jenis_asesmen AS jenis, a.jenjang_asesmen AS jenjang, a.potkom, a.rating_kinerja AS rating, a.status_asesmen AS status FROM asesmen_talenta a JOIN pegawai p ON p.id=a.pegawai_id WHERE p.nip IN (?)',[aman])
      ])
      for(const x of jabDb)ambilRiwayat(String(x.nip)).jabatan.push(x)
      for(const x of pendDb)ambilRiwayat(String(x.nip)).pendidikan.push(x)
      for(const x of asesDb)ambilRiwayat(String(x.nip)).asesmen.push(x)
    }
  }
  const jab=await kueri<DbJabatan>('SELECT j.id,j.nama_jabatan AS nama,u.nama_unit AS unit,j.unit_organisasi_id AS unitId FROM jabatan j JOIN unit_organisasi u ON u.id=j.unit_organisasi_id WHERE j.status_jabatan <> ?', ['DIHAPUS'])
  const jabatan=new Map(jab.map(x=>[kunci(x.nama)+'@@'+kunci(x.unit),x]))
  const forbidden=new Set<number>()
  if(batas!==null){
    const allowed=await kueri<{id:number}>('WITH RECURSIVE turunan AS (SELECT id FROM unit_organisasi WHERE id=? UNION ALL SELECT u.id FROM unit_organisasi u JOIN turunan t ON u.parent_id=t.id) SELECT id FROM turunan',[batas])
    const ok=new Set(allowed.map(x=>Number(x.id)))
    for(const j of jab)if(!ok.has(Number(j.unitId)))forbidden.add(Number(j.id))
  }
  return {pejabat,jabatan,riwayat,forbidden,restricted:batas!==null}
}
function kumpul(rows:BarisTalentPool[],existing:Awaited<ReturnType<typeof dbSnapshot>>,file:string,sha:string):Pratinjau {
  let baru=0,berubah=0,sama=0
  const daftar:PegawaiPreview[]=[]
  const masalah:MasalahImport[]=[]
  const seen=new Set<string>()
  const tambah=(r:BarisTalentPool,id:string,kategori:JenisMasalah,judul:string,penjelasan:string,index?:number,nilai?:EntriAsesmenExcel)=>{
    masalah.push({id,nip:r.nip,nama:r.nama,kategori,judul,penjelasan,index,nilai})
  }
  for(const r of rows){
    const nip=r.nip.replace(/\D/g,'')
    const db=existing.pejabat.get(nip)
    let status:PegawaiPreview['kondisi']='DITINJAU'
    const notes:string[]=[]
    if(!/^\d{18}$/.test(nip))notes.push('NIP harus terdiri dari 18 angka.')
    if(seen.has(nip))notes.push('NIP muncul lebih dari sekali dalam file.')
    seen.add(nip)
    const n=bersih(r.nama)
    if(!db&&n.length<3)notes.push('Nama lengkap wajib untuk pegawai baru.')
    if(!db&&!bersih(r.golongan))notes.push('Golongan wajib untuk pegawai baru.')
    if(!db&&!PANGKAT[golongan(r.golongan)])notes.push('Golongan tidak dapat dipetakan menjadi pangkat.')
    if(!db&&!JENJANG.has(jenjang(r.tingkatPendidikan)))notes.push('Pendidikan terakhir wajib dan harus SLTA/D3/S1/D4/S2/S3.')
    if(!db&&existing.restricted&&!r.namaJabatan)notes.push('Pegawai baru harus memiliki jabatan dalam lingkup unit Anda.')
    if(r.namaJabatan&&r.unitKerja){
      const j=existing.jabatan.get(kunci(r.namaJabatan)+'@@'+kunci(r.unitKerja))
      if(!j)notes.push('Pasangan jabatan dan unit kerja belum cocok dengan master SIMT.')
      else if(existing.forbidden.has(Number(j.id)))notes.push('Jabatan berada di luar lingkup unit.')
    }else if(r.namaJabatan&&!r.unitKerja)notes.push('Unit kerja perlu diisi untuk mencocokkan jabatan.')
    for(const warning of r.perluTinjau)notes.push(warning)
    for(const field of ['tmtGolongan','tmtJabatan'] as const)if(r[field]&&parseTanggal(r[field])===null)notes.push('Tanggal '+field+' tidak dapat dibaca.')
    if(notes.length)tambah(r,nip+':pegawai','pegawai','Periksa identitas / jabatan',notes.join(' '))
    const p=daftarPendidikan(r.riwayatPendidikan)
    const ignored=p.filter(x=>x.level&&!JENJANG.has(x.level))
    if(ignored.length)tambah(r,nip+':pendidikan','pendidikan','Jenjang pendidikan perlu ditinjau',ignored.map(x=>x.raw).join(' · ')+' — jenjang ini belum didukung database.')
    r.asesmen.forEach((a,i)=>{
      const incomplete=!/^(19|20)\d{2}$/.test(a.tahun)||!bersih(a.jenis)||!bersih(a.status)||!bersih(a.rating)||!Number.isFinite(Number(a.potkom))
      const high=Number(a.potkom)>100
      if(incomplete||high)tambah(r,nip+':asesmen:'+i,'asesmen','Asesmen perlu diperiksa',incomplete?'Tahun, jenis, status, rating atau POTKOM belum lengkap.': 'POTKOM di atas 100 perlu verifikasi sumber.',i,a)
    })
    const jabMatch=r.namaJabatan&&r.unitKerja
      ? existing.jabatan.get(kunci(r.namaJabatan)+'@@'+kunci(r.unitKerja))
      : undefined
    const perbedaan=bandingkanProfil(r,db,jabMatch)
    const old=existing.riwayat.get(nip)
    const jabSumber=r.riwayatJabatan.map(x=>kunciRiwayat({
      nama:x.nama,mulai:parseTanggal(x.tmtMulaiSerial),akhir:parseTanggal(x.tmtAkhirSerial)
    }))
    const jabDb=(old?.jabatan||[]).map(x=>kunciRiwayat(x))
    const pendSumber=p.filter(x=>JENJANG.has(x.level)&&x.bidang).map(x=>x.level+'|'+kunci(x.bidang)+'|'+(x.tahun||''))
    const pendDb=(old?.pendidikan||[]).map(x=>x.jenjang+'|'+kunci(x.bidang)+'|'+(x.tahun||''))
    const pelatSumber=r.riwayatDiklat.map(kunci).filter(Boolean)
    const pelatDb=jsonDiklat(db?.riwayatDiklat).map(kunci).filter(Boolean)
    const asesSumber=r.asesmen.map(x=>String(x.tahun)+'|'+jenisAsesmen(x.jenis)+'|'+kunci(x.jenjang)+'|'+x.potkom+'|'+kunci(x.rating))
    const asesDb=(old?.asesmen||[]).map(x=>String(x.tahun)+'|'+jenisAsesmen(x.jenis)+'|'+kunci(x.jenjang)+'|'+x.potkom+'|'+kunci(x.rating))
    const perbandingan={
      jabatan:hitungan(jabSumber,jabDb),
      pendidikan:hitungan(pendSumber,pendDb),
      pelatihan:hitungan(pelatSumber,pelatDb),
      asesmen:hitungan(asesSumber,asesDb),
    }
    const riwayatBaru=Object.values(perbandingan).some(x=>x.akanDitambah>0)
    if(notes.length)status='DITINJAU' 
    else if(!db){status='BARU';baru++}
    else if(perbedaan.some(x=>!x.sama)||riwayatBaru){status='UPDATE';berubah++}
    else {status='SAMA';sama++}
    daftar.push({nip:r.nip,nama:r.nama,baris:r.barisExcel,kondisi:status,sudahAda:Boolean(db),
      sumber:{nama:r.nama,golongan:r.golongan,tingkatPendidikan:r.tingkatPendidikan,namaJabatan:r.namaJabatan,
        unitKerja:r.unitKerja,tmtGolongan:r.tmtGolongan,tmtJabatan:r.tmtJabatan,sekolah:r.sekolah,jurusan:r.jurusan},
      perbedaan,perbandingan,ringkas:{jabatan:r.riwayatJabatan.length,pelatihan:r.riwayatDiklat.length,pendidikan:p.length,asesmen:r.asesmen.length}})
  }
  const snapshot=createHash('sha256').update(JSON.stringify({
    pegawai:[...existing.pejabat.values()].sort((a,b)=>a.nip.localeCompare(b.nip)),
    riwayat:[...existing.riwayat].sort(([a],[b])=>a.localeCompare(b))
  })).digest('hex')
  return {sha,snapshot,file,jumlah:rows.length,baru,berubah,sama,daftar,masalah,foto:[],peringatanFoto:[],tidakDikenal:[]}
}
async function siapkan(fd:FormData) {
  const gate=await gerbangPeran(PERAN)
  if(gate)return {error:gate.pesan as string}
  const b=fd.get('berkas')
  if(!(b instanceof File)||!b.name.toLowerCase().endsWith('.xlsx')||b.size===0||b.size>20*1024*1024)
    return {error:'Pilih file .xlsx berukuran maksimal 20 MB.'}
  const buf=Buffer.from(await b.arrayBuffer())
  const sha=createHash('sha256').update(buf).digest('hex')
  try{
    const hasil=bacaTalentPool(buf)
    if(!hasil.baris.length)return {error:'Tidak ditemukan blok pegawai. Pastikan kolom NO berisi angka.'}
    if(hasil.baris.length>10000)return {error:'Maksimal 10.000 pegawai per batch.'}
    return {rows:hasil.baris,file:b.name,sha,labels:hasil.labelTakDikenal,buffer:buf}
  }catch(e){return {error:e instanceof Error?e.message:'File Excel tidak dapat dibaca.'}}
}
export async function pratinjauImporTalentPool(fd:FormData):Promise<Hasil<Pratinjau>>{
  const gate=await gerbangPeran(PERAN)
  if(gate)return {ok:false,pesan:gate.pesan||'Akses tidak diizinkan.'}
  const input=await siapkan(fd)
  if(input.error||!input.rows)return {ok:false,pesan:input.error||'Gagal membaca file.'}
  try{
    const state=await dbSnapshot(input.rows)
    const preview=kumpul(input.rows,state,input.file!,input.sha!)
    const pictures=ekstrakFotoTalentPool(input.buffer!,input.rows)
    preview.foto=await Promise.all(pictures.foto.map(async p=>({
      nip:p.nip,baris:p.barisExcel,sudahAda:state.pejabat.has(p.nip) && await adaFotoPegawai(p.nip),
      ukuran:p.buffer.length,tipe:p.media
    })))
    preview.peringatanFoto=pictures.peringatan
    preview.tidakDikenal=input.labels||[]
    return {ok:true,data:preview}
  }catch(e){return {ok:false,pesan:e instanceof Error?e.message:'Gagal memeriksa database.'}}
}

import mysql from 'mysql2/promise'
import { normalisasiAsesmen } from '@/lib/importer/normalisasi-baris'
import { ambilPengaturan, parameterSkoringDari } from '@/lib/pengaturan'
import { skorPredikat } from '@/lib/scoring'

type RingkasanImpor = {dibuat:number;diperbarui:number;riwayatJabatan:number;pendidikan:number;pelatihan:number;asesmen:number;ditahan:number;fotoTersimpan:number;fotoDilewati:number;fotoGagal:number}
function statusAsesmen(s:string) {
  const v=bersih(s).toLowerCase()
  if(v==='valid'||v==='berlaku')return 'Berlaku'
  if(v==='expired')return 'Expired'
  return 'Draft'
}
function ratingAsesmen(s:string):'Sangat Baik'|'Baik'|'Butuh Perbaikan'|'Kurang'|'Sangat Kurang'|null {
  const v=bersih(s).toLowerCase()
  const valid=['sangat baik','baik','butuh perbaikan','kurang','sangat kurang']
  const i=valid.indexOf(v)
  return i<0?null:(['Sangat Baik','Baik','Butuh Perbaikan','Kurang','Sangat Kurang'] as const)[i]!
}
function jsonDiklat(v:unknown):string[]{
  if(Array.isArray(v))return v.map(String)
  if(typeof v==='string'){try{const x=JSON.parse(v);if(Array.isArray(x))return x.map(String)}catch{}}
  return []
}
export async function konfirmasiImporTalentPool(fd:FormData):Promise<Hasil<RingkasanImpor>>{
  const gate=await gerbangPeran(PERAN)
  if(gate)return {ok:false,pesan:gate.pesan||'Akses tidak diizinkan.'}
  const input=await siapkan(fd)
  if(input.error||!input.rows)return {ok:false,pesan:input.error||'File tidak dapat dibaca.'}
  const hash=String(fd.get('sha')||'')
  const versi=String(fd.get('snapshot')||'')
  if(hash!==input.sha)return {ok:false,pesan:'Berkas sudah berubah sejak preview. Periksa ulang.'}
  let pilihanKolom:Record<string,'EXCEL'|'DB'>={}
  try{
    const mentah=JSON.parse(String(fd.get('pilihanKolom')||'{}'))
    if(!mentah||typeof mentah!=='object'||Array.isArray(mentah))throw new Error()
    pilihanKolom=mentah
    if(Object.values(pilihanKolom).some(x=>x!=='DB'&&x!=='EXCEL'))throw new Error()
  }catch{return {ok:false,pesan:'Pilihan perbandingan kolom tidak sah.'}}
  let pilihanFoto:Record<string,'GUNAKAN_EXCEL'|'LEWATI'>={}
  try{
    const mentah=JSON.parse(String(fd.get('pilihanFoto')||'{}'))
    if(!mentah||typeof mentah!=='object'||Array.isArray(mentah))throw Error()
    pilihanFoto=mentah
    if(Object.values(pilihanFoto).some(x=>x!=='GUNAKAN_EXCEL'&&x!=='LEWATI'))throw Error()
  }catch{return {ok:false,pesan:'Pilihan foto tidak valid.'}}
  let keputusan:Record<string,Putusan>
  try{
    keputusan=JSON.parse(String(fd.get('putusan')||'{}')) as Record<string,Putusan>
    if(!keputusan||typeof keputusan!=='object'||Array.isArray(keputusan))throw new Error()
  }catch{return {ok:false,pesan:'Keputusan review tidak terbaca.'}}
  const state=await dbSnapshot(input.rows)
  const pr=kumpul(input.rows,state,input.file!,input.sha!)
  const gambar=ekstrakFotoTalentPool(input.buffer!,input.rows)
  const validFotos=new Set(gambar.foto.map(x=>x.nip))
  if(Object.keys(pilihanFoto).some(n=>!validFotos.has(n)))
    return {ok:false,pesan:'Pilihan foto tidak sesuai isi file. Periksa ulang.'}
  if(pr.snapshot!==versi)return {ok:false,pesan:'Data di SIMT telah berubah sejak review. Upload kembali untuk memperbarui perbandingan.'}
  const validKolom=new Set(pr.daftar.flatMap(p=>p.perbedaan.filter(x=>!x.sama).map(x=>p.nip+':'+x.key)))
  if(Object.keys(pilihanKolom).some(x=>!validKolom.has(x)))
    return {ok:false,pesan:'Perubahan kolom berbeda dengan pratinjau. Lakukan review ulang.'}
  for(const r of pr.daftar){
    const g=r.perbedaan.some(x=>x.key==='golongan'&&!x.sama)
    const p=r.perbedaan.some(x=>x.key==='pangkat'&&!x.sama)
    if(g&&p){
      const gn=pilihanKolom[r.nip+':golongan']||'EXCEL'
      const pn=pilihanKolom[r.nip+':pangkat']||'EXCEL'
      if(gn!==pn)return {ok:false,pesan:'Golongan dan pangkat harus menggunakan sumber nilai yang sama.'}
    }
  }
  const koreksiProfil=new Map<string,BarisTalentPool>()
  const kolomBoleh=new Set(['nama','golongan','tingkatPendidikan','namaJabatan','unitKerja','tmtGolongan','tmtJabatan','sekolah','jurusan'])
  for(const issue of pr.masalah){
    const p=keputusan[issue.id]
    if(!p||!['TAHAN','KOREKSI'].includes(p.aksi))return {ok:false,pesan:'Masih ada masalah yang belum diputuskan: '+issue.judul}
    if(p.aksi==='KOREKSI'&&issue.kategori==='pendidikan')
      return {ok:false,pesan:'Jenjang pendidikan di luar enum belum bisa dikoreksi otomatis. Tahan bagian tersebut.'}
    if(p.aksi==='KOREKSI'&&issue.kategori==='pegawai'){
      const original=input.rows.find(x=>x.nip===issue.nip)
      if(!original)return {ok:false,pesan:'Pegawai untuk koreksi tidak ditemukan.'}
      const fields=p.perbaikan
      if(!fields||Object.entries(fields).some(([key,value])=>!kolomBoleh.has(key)||typeof value!=='string'||value.length>300))
        return {ok:false,pesan:'Isian koreksi profil tidak sesuai.'}
      const repaired={...original,...fields}
      // A suspected shifted block is unsafe to correct through profile fields only.
      if(original.perluTinjau.length>0)
        return {ok:false,pesan:'Susunan kolom sumber diduga bergeser. Tahan pegawai ini dan perbaiki sumber Excel.'}
      const errors=kumpul([repaired],state,input.file!,input.sha!).masalah.filter(x=>x.kategori==='pegawai')
      if(errors.length)return {ok:false,pesan:'Masih ada masalah profil: '+errors.map(x=>x.penjelasan).join(' ')}
      koreksiProfil.set(issue.nip,repaired)
    }
    if(p.aksi==='KOREKSI'&&issue.kategori==='asesmen'){
      const year=Number(p.tahun),rating=ratingAsesmen(p.rating||''),potkom=Number(String(p.potkom||'').replace(',','.'))
      if(!Number.isInteger(year)||year<1990||year>new Date().getFullYear()+1||!bersih(p.jenis)||!['Berlaku','Draft','Expired'].includes(p.status||'')||!rating||!Number.isFinite(potkom)||potkom<0)
        return {ok:false,pesan:'Koreksi asesmen belum lengkap atau tidak valid.'}
      if(potkom>100&&(!p.diverifikasi||bersih(p.catatan).length<5))return {ok:false,pesan:'POTKOM di atas 100 perlu catatan pemeriksaan sumber.'}
    }
  }
  const { DATABASE_HOST,DATABASE_PORT,DATABASE_USER,DATABASE_PASSWORD,DATABASE_NAME }=process.env
  if(!DATABASE_NAME)return {ok:false,pesan:'Koneksi database belum dikonfigurasi.'}
  const user=await getCurrentUser()
  if(!user)return {ok:false,pesan:'Sesi sudah berakhir.'}
  const par=parameterSkoringDari(await ambilPengaturan())
  const statistik:RingkasanImpor={dibuat:0,diperbarui:0,riwayatJabatan:0,pendidikan:0,pelatihan:0,asesmen:0,ditahan:0,
    fotoTersimpan:0,fotoDilewati:0,fotoGagal:0}
  const db=await mysql.createConnection({
    host:DATABASE_HOST||'127.0.0.1',port:Number(DATABASE_PORT||3306),
    user:DATABASE_USER,password:DATABASE_PASSWORD,database:DATABASE_NAME,dateStrings:true,timezone:'local'
  })
  let committed=false
  try{
    await db.beginTransaction()
    for(const original of input.rows){
      const r=koreksiProfil.get(original.nip)||original
      const nip=r.nip.replace(/\D/g,'')
      if(keputusan[nip+':pegawai']?.aksi==='TAHAN'){
        statistik.ditahan++;continue
      }
      // Protect against stale preview even when another process updates during the commit.
      const [locked]=await db.query<mysql.RowDataPacket[]>('SELECT id,nama_lengkap,golongan,pangkat,tingkat_pendidikan,jabatan_id,sekolah_terakhir,bidang_studi_terakhir,tmt_golongan,tmt_jabatan FROM pegawai WHERE nip=? FOR UPDATE',[nip])
      const prev=state.pejabat.get(nip)
      if((locked.length>0)!==Boolean(prev))throw new Error('Status NIP berubah sejak preview: '+nip)
      if(prev&&locked[0]){
        const l=locked[0]
        if(String(l.nama_lengkap)!==prev.nama||String(l.golongan)!==prev.golongan||String(l.pangkat)!==prev.pangkat||String(l.tingkat_pendidikan)!==prev.pendidikan)
          throw new Error('Profil berubah saat impor: '+nip)
      }
      const kJab=kunci(r.namaJabatan)+'@@'+kunci(r.unitKerja)
      const jab= r.namaJabatan&&r.unitKerja ? state.jabatan.get(kJab) : undefined
      const idJab=jab?.id??null
      if(idJab&&state.forbidden.has(Number(idJab)))throw new Error('Jabatan di luar lingkup.')
      if(!prev&&state.restricted&&!idJab)throw new Error('Penambahan pegawai harus ditautkan ke jabatan dalam lingkup unit.')
      let pegawaiId:number
      const gunakanExcel=(kolom:string)=>pilihanKolom[r.nip+':'+kolom]!=='DB'
      const g=golongan(r.golongan)
      const sekolah=bersih(r.sekolah)||null
      const bidang=bersih(r.jurusan)||bersih(r.bidangStudi)||null
      if(!prev){
        if(!/^\d{18}$/.test(nip)||!bersih(r.nama)||!PANGKAT[g]||!JENJANG.has(jenjang(r.tingkatPendidikan)))
          throw new Error('Identitas pegawai baru belum lengkap.')
        const [ins]=await db.execute<mysql.ResultSetHeader>(
          'INSERT INTO pegawai(nip,nama_lengkap,golongan,pangkat,tingkat_pendidikan,jabatan_id,tmt_golongan,tmt_jabatan,sekolah_terakhir,bidang_studi_terakhir,status_aktif,sumber_sinkron) VALUES(?,?,?,?,?,?,?,?,?,?,"AKTIF","manual")',
          [nip,bersih(r.nama),g,PANGKAT[g],jenjang(r.tingkatPendidikan),idJab,parseTanggal(r.tmtGolongan),parseTanggal(r.tmtJabatan),sekolah,bidang])
        pegawaiId=ins.insertId;statistik.dibuat++
      }else{
        pegawaiId=Number(prev.id)
        const col:string[]=[]
        const val:(string|number|null)[]=[]
        const set=(key:string,value:string|number|null,oldValue:unknown)=>{
          if(value!==null&&value!==''&&String(value)!==String(oldValue??'')){
            col.push(key+'=?');val.push(value)
          }
        }
        if(gunakanExcel('nama_lengkap'))set('nama_lengkap',bersih(r.nama),prev.nama)
        if(gunakanExcel('golongan'))set('golongan',g,prev.golongan)
        if(g&&PANGKAT[g])if(gunakanExcel('pangkat'))set('pangkat',PANGKAT[g],prev.pangkat)
        if(JENJANG.has(jenjang(r.tingkatPendidikan)))if(gunakanExcel('tingkat_pendidikan'))set('tingkat_pendidikan',jenjang(r.tingkatPendidikan),prev.pendidikan)
        if(idJab)if(gunakanExcel('jabatan_id'))set('jabatan_id',idJab,prev.jabatanId)
        if(gunakanExcel('tmt_golongan'))set('tmt_golongan',parseTanggal(r.tmtGolongan),prev.tmtGolongan)
        if(gunakanExcel('tmt_jabatan'))set('tmt_jabatan',parseTanggal(r.tmtJabatan),prev.tmtJabatan)
        if(gunakanExcel('sekolah_terakhir'))set('sekolah_terakhir',sekolah,prev.sekolah)
        if(gunakanExcel('bidang_studi_terakhir'))set('bidang_studi_terakhir',bidang,prev.bidang)
        if(col.length){await db.execute('UPDATE pegawai SET '+col.join(',')+' WHERE id=?',[...val,pegawaiId]);statistik.diperbarui++}
      }
      const [riwDb]=await db.query<mysql.RowDataPacket[]>('SELECT urutan,jabatan_nama_mentah,tanggal_mulai,tanggal_akhir FROM riwayat_jabatan WHERE pegawai_id=?',[pegawaiId])
      const existingRiw=new Set(riwDb.map(x=>kunci(x.jabatan_nama_mentah)+'|'+(x.tanggal_mulai||'')+'|'+(x.tanggal_akhir||'')))
      let urut=Math.max(0,...riwDb.map(x=>Number(x.urutan)||0))
      for(const x of r.riwayatJabatan){
        const begin=parseTanggal(x.tmtMulaiSerial),end=parseTanggal(x.tmtAkhirSerial)
        const key=kunci(x.nama)+'|'+(begin||'')+'|'+(end||'')
        if(!kunci(x.nama)||existingRiw.has(key))continue
        existingRiw.add(key)
        await db.execute('INSERT INTO riwayat_jabatan(pegawai_id,urutan,jabatan_nama_mentah,unit_kerja_mentah,tanggal_mulai,tanggal_akhir) VALUES(?,?,?,?,?,?)',
          [pegawaiId,++urut,x.nama,r.unitKerja||null,begin,end])
        statistik.riwayatJabatan++
      }
      const [pendDb]=await db.query<mysql.RowDataPacket[]>('SELECT urutan,jenjang_pendidikan,bidang_studi,tahun_lulus FROM riwayat_pendidikan WHERE pegawai_id=?',[pegawaiId])
      const existingPend=new Set(pendDb.map(x=>x.jenjang_pendidikan+'|'+kunci(x.bidang_studi)+'|'+(x.tahun_lulus||'')))
      let urutP=Math.max(0,...pendDb.map(x=>Number(x.urutan)||0))
      for(const p of daftarPendidikan(r.riwayatPendidikan)){
        if(!JENJANG.has(p.level)||!p.bidang)continue
        const key=p.level+'|'+kunci(p.bidang)+'|'+(p.tahun||'')
        if(existingPend.has(key))continue
        existingPend.add(key)
        await db.execute('INSERT INTO riwayat_pendidikan(pegawai_id,urutan,jenjang_pendidikan,bidang_studi,nama_sekolah,tahun_lulus) VALUES(?,?,?,?,?,?)',
          [pegawaiId,++urutP,p.level,p.bidang,urutP===1?r.sekolah||null:null,p.tahun])
        statistik.pendidikan++
      }
      const [dikDb]=await db.query<mysql.RowDataPacket[]>('SELECT riwayat_diklat FROM pegawai WHERE id=?',[pegawaiId])
      const current=jsonDiklat(dikDb[0]?.riwayat_diklat)
      const beforeDiklat=current.length
      const seen=new Set(current.map(x=>kunci(x)))
      for(const dik of r.riwayatDiklat){const key=kunci(dik);if(!key||seen.has(key))continue;seen.add(key);current.push(bersih(dik));statistik.pelatihan++}
      if(current.length>beforeDiklat)await db.execute('UPDATE pegawai SET riwayat_diklat=? WHERE id=?',[JSON.stringify(current),pegawaiId])
      for(let i=0;i<r.asesmen.length;i++){
        const a=r.asesmen[i]!
        const decision=keputusan[nip+':asesmen:'+i]
        if(decision?.aksi==='TAHAN'){statistik.ditahan++;continue}
        const sumber=decision?.aksi==='KOREKSI'?{
          ...a,tahun:decision.tahun||'',jenis:decision.jenis||'',status:decision.status||'',
          rating:decision.rating||'',potkom:decision.potkom||''
        }:a
        const year=Number(sumber.tahun),rating=ratingAsesmen(sumber.rating)
        const potkom=Number(String(sumber.potkom).replace(',','.'))
        if(!Number.isInteger(year)||year<1990||!rating||!bersih(sumber.jenis)||!bersih(sumber.status)||!Number.isFinite(potkom))continue
        const y=skorPredikat(rating,par.skalaPredikat)
        if(y===null)continue
        const norm=normalisasiAsesmen({tahunAsesmen:year,jenisAsesmen:sumber.jenis,statusAsesmen:statusAsesmen(sumber.status),
          nilaiKinerjaY:y,potkom,nilaiIntegritas:null,kotak9Sumber:Number(sumber.kotak9)||null},
          {tahunSekarang:new Date().getFullYear(),...par}).nilai
        const [found]=await db.query<mysql.RowDataPacket[]>('SELECT id, potkom, rating_kinerja FROM asesmen_talenta WHERE pegawai_id=? AND tahun_asesmen=? AND jenis_asesmen=? AND COALESCE(jenjang_asesmen,"")=? LIMIT 1 FOR UPDATE',
          [pegawaiId,year,norm.jenisAsesmen||sumber.jenis,sumber.jenjang||''])
        if(found.length){
          const old=found[0]!
          if(Number(old.potkom)===norm.potkom&&old.rating_kinerja===rating)continue
          await db.execute('UPDATE asesmen_talenta SET status_asesmen=?,nilai_kinerja_y=?,nilai_potensial_x=?,potkom=?,nilai_talenta=?,kotak_9=?,kotak_9_sumber=?,rating_kinerja=? WHERE id=?',
            [norm.statusAsesmen,norm.nilaiKinerjaY,norm.nilaiPotensialX,norm.potkom,norm.nilaiTalenta,norm.kotak9,Number(sumber.kotak9)||null,rating,old.id])
        }else{
          await db.execute('INSERT INTO asesmen_talenta(pegawai_id,tahun_asesmen,jenis_asesmen,jenjang_asesmen,status_asesmen,nilai_kinerja_y,nilai_potensial_x,potkom,nilai_integritas,nilai_talenta,kotak_9,kotak_9_sumber,tahun_kinerja,rating_kinerja,sumber_sync) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,"manual")',
            [pegawaiId,year,norm.jenisAsesmen||sumber.jenis,sumber.jenjang||null,norm.statusAsesmen,norm.nilaiKinerjaY,norm.nilaiPotensialX,norm.potkom,null,norm.nilaiTalenta,norm.kotak9,Number(sumber.kotak9)||null,year,rating])
        }
        statistik.asesmen++
      }
    }
    await db.execute('INSERT INTO audit_log(user_id,aksi,entitas,data_sesudah,ip_address) VALUES(?,"IMPOR_EXCEL","pegawai",?,NULL)',
      [user.id,JSON.stringify({nama_berkas:input.file,sha256:input.sha,hasil:statistik})])
    await db.commit()
    committed=true
    // Foto disimpan SETELAH transaksi pegawai berhasil. Kegagalan media
    // dilaporkan terpisah, jangan mengklaim rollback DB yang sudah commit.
    const kegagalanFoto:string[]=[]
    for(const photo of gambar.foto){
      if(keputusan[photo.nip+':pegawai']?.aksi==='TAHAN'){
        statistik.fotoDilewati++;continue
      }
      try{
        const existing=await adaFotoPegawai(photo.nip)
        const policy=pilihanFoto[photo.nip]||(existing?'LEWATI':'GUNAKAN_EXCEL')
        if(policy==='LEWATI'){statistik.fotoDilewati++;continue}
        await simpanFotoPegawai(photo.nip,photo.buffer)
        statistik.fotoTersimpan++
        revalidatePath('/talenta/'+photo.nip)
      }catch{
        statistik.fotoGagal++
        kegagalanFoto.push(photo.nip.slice(0,6)+'…')
      }
    }
    try{
      await db.execute('INSERT INTO audit_log(user_id,aksi,entitas,data_sesudah,ip_address) VALUES(?,"IMPOR_EXCEL","foto_pegawai",?,NULL)',[
        user.id,JSON.stringify({sha256:input.sha,fotoTersimpan:statistik.fotoTersimpan,fotoDilewati:statistik.fotoDilewati,fotoGagal:statistik.fotoGagal})
      ])
    }catch{
      // Tidak mengulang commit pegawai maupun menutup-nutupi hasil media.
    }
    revalidatePath('/talenta')
    return {ok:true,data:statistik,pesan:statistik.fotoGagal
      ?'Data pegawai tersimpan. '+statistik.fotoGagal+' foto gagal disimpan; ulangi perbaikan foto dari profil. Referensi NIP: '+kegagalanFoto.join(', ')
      :'Impor selesai, termasuk '+statistik.fotoTersimpan+' foto yang disetujui.'}
  }catch(e){
    if(!committed){
      await db.rollback()
      return {ok:false,pesan:'Impor dibatalkan, tidak ada data disimpan: '+(e instanceof Error?e.message:'Gagal menjalankan transaksi.')}
    }
    return {ok:false,pesan:'Data pegawai sudah disimpan, tetapi terjadi gangguan pada proses foto setelah commit. Jangan mengulang seluruh batch tanpa meninjau hasilnya.'}
  }finally{await db.end()}
}


/** Ambil foto unggahan untuk satu NIP saja pada modal review; tidak disimpan. */
export async function pratinjauFotoTalentPool(fd:FormData,nip:string):Promise<Hasil<{gambar:string}>>{
  const gate=await gerbangPeran(PERAN)
  if(gate)return {ok:false,pesan:gate.pesan||'Akses ditolak.'}
  if(!/^\d{18}$/.test(nip))return {ok:false,pesan:'NIP tidak valid.'}
  const input=await siapkan(fd)
  if(input.error||!input.rows||!input.buffer)return {ok:false,pesan:input.error||'Excel tidak terbaca.'}
  if(String(fd.get('sha')||'')!==input.sha)return {ok:false,pesan:'Berkas berbeda dari pratinjau.'}
  if(!input.rows.some(x=>x.nip===nip))return {ok:false,pesan:'NIP tidak ada pada berkas.'}
  try{
    const image=ekstrakFotoTalentPool(input.buffer,input.rows).foto.find(x=>x.nip===nip)
    if(!image)return {ok:false,pesan:'Tidak ada foto untuk NIP ini.'}
    const {default:sharp}=await import('sharp')
    const thumb=await sharp(image.buffer,{limitInputPixels:20_000_000,failOn:'error'})
      .rotate().resize({width:240,height:240,fit:'inside'}).jpeg({quality:70}).toBuffer()
    return {ok:true,data:{gambar:'data:image/jpeg;base64,'+thumb.toString('base64')}}
  }catch{return {ok:false,pesan:'Foto tidak valid atau tidak bisa ditampilkan.'}}
}
