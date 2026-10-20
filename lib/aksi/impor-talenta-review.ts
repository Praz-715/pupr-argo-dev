'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { kueri } from '@/lib/db'
import { gerbangPeran } from '@/lib/aksi/gerbang'
import { lingkupData, tanpaAkses, unitWajib } from '@/lib/lingkup'
import { bacaTalentPool, type BarisTalentPool, type EntriAsesmenExcel } from '@/lib/importer/talentpool-xlsx'

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
export type PegawaiPreview = {
  nip: string
  nama: string
  baris: number
  kondisi: 'BARU' | 'UPDATE' | 'SAMA' | 'DITINJAU'
  ringkas: { jabatan: number; pelatihan: number; pendidikan: number; asesmen: number }
}
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
type DbPegawai = { id:number; nip:string; nama:string; golongan:string; pangkat:string; pendidikan:string; jabatanId:number|null; sekolah:string|null; bidang:string|null; tmtGolongan:string|null; tmtJabatan:string|null }
type DbJabatan = {id:number; nama:string; unit:string; unitId:number}
async function dbSnapshot(rows:BarisTalentPool[]) {
  const user=await getCurrentUser()
  const lingkup=lingkupData(user)
  if(tanpaAkses(lingkup)) throw new Error('Tidak ada akses ke direktori.')
  const batas=unitWajib(lingkup)
  const pejabat=new Map<string,DbPegawai>()
  const nipUnik=[...new Set(rows.map(r=>r.nip.replace(/\D/g,'')).filter(n=>/^\d{18}$/.test(n)))]
  for(let i=0;i<nipUnik.length;i+=200){
    const ids=nipUnik.slice(i,i+200)
    // Recursive CTE is placed outside IN for broad MySQL compatibility.
    const prefix=batas===null?'':'WITH RECURSIVE turunan AS (SELECT id FROM unit_organisasi WHERE id = ? UNION ALL SELECT u.id FROM unit_organisasi u JOIN turunan t ON u.parent_id=t.id) '
    const suffix=batas===null?'':' AND j.unit_organisasi_id IN (SELECT id FROM turunan)'
    const sql=prefix+'SELECT p.id, p.nip, p.nama_lengkap AS nama, p.golongan, p.pangkat, p.tingkat_pendidikan AS pendidikan, p.jabatan_id AS jabatanId, p.sekolah_terakhir AS sekolah, p.bidang_studi_terakhir AS bidang, p.tmt_golongan AS tmtGolongan, p.tmt_jabatan AS tmtJabatan FROM pegawai p LEFT JOIN jabatan j ON j.id=p.jabatan_id WHERE p.nip IN (?)'+suffix
    const found=await kueri<DbPegawai>(sql,batas===null?[ids]:[batas,ids])
    for(const x of found)pejabat.set(String(x.nip),x)
  }
  const jab=await kueri<DbJabatan>('SELECT j.id,j.nama_jabatan AS nama,u.nama_unit AS unit,j.unit_organisasi_id AS unitId FROM jabatan j JOIN unit_organisasi u ON u.id=j.unit_organisasi_id WHERE j.status_jabatan <> ?', ['DIHAPUS'])
  const jabatan=new Map(jab.map(x=>[kunci(x.nama)+'@@'+kunci(x.unit),x]))
  const forbidden=new Set<number>()
  if(batas!==null){
    const allowed=await kueri<{id:number}>('WITH RECURSIVE turunan AS (SELECT id FROM unit_organisasi WHERE id=? UNION ALL SELECT u.id FROM unit_organisasi u JOIN turunan t ON u.parent_id=t.id) SELECT id FROM turunan',[batas])
    const ok=new Set(allowed.map(x=>Number(x.id)))
    for(const j of jab)if(!ok.has(Number(j.unitId)))forbidden.add(Number(j.id))
  }
  return {pejabat,jabatan,forbidden,restricted:batas!==null}
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
    if(notes.length)status='DITINJAU'
    else if(!db){status='BARU';baru++}
    else {
      const changes=[
        n&&n!==db.nama,golongan(r.golongan)&&golongan(r.golongan)!==db.golongan,
        r.tingkatPendidikan&&jenjang(r.tingkatPendidikan)!==db.pendidikan,
        r.sekolah&&r.sekolah!==db.sekolah,r.jurusan&&r.jurusan!==db.bidang,
        r.tmtGolongan&&parseTanggal(r.tmtGolongan)!==db.tmtGolongan,
      ].some(Boolean)
      if(changes||r.riwayatJabatan.length||r.riwayatDiklat.length||p.length||r.asesmen.length){status='UPDATE';berubah++}
      else {status='SAMA';sama++}
    }
    daftar.push({nip:r.nip,nama:r.nama,baris:r.barisExcel,kondisi:status,ringkas:{jabatan:r.riwayatJabatan.length,pelatihan:r.riwayatDiklat.length,pendidikan:p.length,asesmen:r.asesmen.length}})
  }
  const snapshot=createHash('sha256').update(JSON.stringify([...existing.pejabat.values()].sort((a,b)=>a.nip.localeCompare(b.nip)))).digest('hex')
  return {sha,snapshot,file,jumlah:rows.length,baru,berubah,sama,daftar,masalah,tidakDikenal:[]}
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
    return {rows:hasil.baris,file:b.name,sha,labels:hasil.labelTakDikenal}
  }catch(e){return {error:e instanceof Error?e.message:'File Excel tidak dapat dibaca.'}}
}
export async function pratinjauImporTalentPool(fd:FormData):Promise<Hasil<Pratinjau>>{
  const input=await siapkan(fd)
  if(input.error||!input.rows)return {ok:false,pesan:input.error||'Gagal membaca file.'}
  try{
    const state=await dbSnapshot(input.rows)
    const preview=kumpul(input.rows,state,input.file!,input.sha!)
    preview.tidakDikenal=input.labels||[]
    return {ok:true,data:preview}
  }catch(e){return {ok:false,pesan:e instanceof Error?e.message:'Gagal memeriksa database.'}}
}

import mysql from 'mysql2/promise'
import { normalisasiAsesmen } from '@/lib/importer/normalisasi-baris'
import { ambilPengaturan, parameterSkoringDari } from '@/lib/pengaturan'
import { skorPredikat } from '@/lib/scoring'

type RingkasanImpor = {dibuat:number;diperbarui:number;riwayatJabatan:number;pendidikan:number;pelatihan:number;asesmen:number;ditahan:number}
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
  const input=await siapkan(fd)
  if(input.error||!input.rows)return {ok:false,pesan:input.error||'File tidak dapat dibaca.'}
  const hash=String(fd.get('sha')||'')
  const versi=String(fd.get('snapshot')||'')
  if(hash!==input.sha)return {ok:false,pesan:'Berkas sudah berubah sejak preview. Periksa ulang.'}
  let keputusan:Record<string,Putusan>
  try{
    keputusan=JSON.parse(String(fd.get('putusan')||'{}')) as Record<string,Putusan>
    if(!keputusan||typeof keputusan!=='object'||Array.isArray(keputusan))throw new Error()
  }catch{return {ok:false,pesan:'Keputusan review tidak terbaca.'}}
  const state=await dbSnapshot(input.rows)
  const pr=kumpul(input.rows,state,input.file!,input.sha!)
  if(pr.snapshot!==versi)return {ok:false,pesan:'Data di SIMT telah berubah sejak review. Upload kembali untuk memperbarui perbandingan.'}
  for(const issue of pr.masalah){
    const p=keputusan[issue.id]
    if(!p||!['TAHAN','KOREKSI'].includes(p.aksi))return {ok:false,pesan:'Masih ada masalah yang belum diputuskan: '+issue.judul}
    if(p.aksi==='KOREKSI'&&issue.kategori!=='asesmen')return {ok:false,pesan:'Jenis koreksi ini belum didukung. Tahan data sampai dapat diperiksa lebih lanjut.'}
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
  const statistik:RingkasanImpor={dibuat:0,diperbarui:0,riwayatJabatan:0,pendidikan:0,pelatihan:0,asesmen:0,ditahan:0}
  const db=await mysql.createConnection({
    host:DATABASE_HOST||'127.0.0.1',port:Number(DATABASE_PORT||3306),
    user:DATABASE_USER,password:DATABASE_PASSWORD,database:DATABASE_NAME,dateStrings:true,timezone:'local'
  })
  try{
    await db.beginTransaction()
    for(const r of input.rows){
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
        set('nama_lengkap',bersih(r.nama),prev.nama)
        set('golongan',g,prev.golongan)
        if(g&&PANGKAT[g])set('pangkat',PANGKAT[g],prev.pangkat)
        if(JENJANG.has(jenjang(r.tingkatPendidikan)))set('tingkat_pendidikan',jenjang(r.tingkatPendidikan),prev.pendidikan)
        if(idJab)set('jabatan_id',idJab,prev.jabatanId)
        set('tmt_golongan',parseTanggal(r.tmtGolongan),prev.tmtGolongan)
        set('tmt_jabatan',parseTanggal(r.tmtJabatan),prev.tmtJabatan)
        set('sekolah_terakhir',sekolah,prev.sekolah)
        set('bidang_studi_terakhir',bidang,prev.bidang)
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
    revalidatePath('/talenta')
    return {ok:true,data:statistik,pesan:'Impor selesai. Semua perubahan tercatat dalam audit.'}
  }catch(e){
    await db.rollback()
    return {ok:false,pesan:'Impor dibatalkan, tidak ada data disimpan: '+(e instanceof Error?e.message:'Gagal menjalankan transaksi.')}
  }finally{await db.end()}
}

