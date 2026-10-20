'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BASE_PATH } from '@/lib/base-path'
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2,
  FileSpreadsheet, Search, ShieldCheck, UploadCloud
} from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  pratinjauImporTalentPool, pratinjauFotoTalentPool, konfirmasiImporTalentPool,
  type MasalahImport, type Pratinjau, type Putusan, type PegawaiPreview, type KoreksiProfil,
} from '@/lib/aksi/impor-talenta-review'

type Stage='upload'|'review'|'confirm'|'done'
type HasilImpor={dibuat:number;diperbarui:number;riwayatJabatan:number;pendidikan:number;pelatihan:number;asesmen:number;ditahan:number;fotoTersimpan:number;fotoDilewati:number;fotoGagal:number}
const titleStage:{[k in Stage]:string}={
  upload:'Unggah Excel',review:'Periksa Hasil',confirm:'Konfirmasi',done:'Selesai'
}
function Angka({value,label}:{value:number;label:string}){
  return <div className="rounded-lg border border-border bg-surface-2 p-3">
    <p className="text-2xl font-semibold tabular-nums tracking-tight text-text">{value.toLocaleString('id-ID')}</p>
    <p className="mt-1 text-xs text-text-subtle">{label}</p>
  </div>
}
function tag(k:string){
  return k==='BARU'?'text-success bg-success-subtle':k==='UPDATE'?'text-accent bg-accent-subtle':k==='SAMA'?'text-text-subtle bg-surface-3':'text-warning bg-warning-subtle'
}
function FormField({label,children}:{label:string;children:React.ReactNode}){
  return <label className="block min-w-0 text-xs font-medium text-text">{label}<div className="mt-1">{children}</div></label>
}
const inputClass='w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent-subtle'
export function RuangImporTalenta(){
  const [stage,setStage]=useState<Stage>('upload')
  const [file,setFile]=useState<File|null>(null)
  const [preview,setPreview]=useState<Pratinjau|null>(null)
  const [putusan,setPutusan]=useState<Record<string,Putusan>>({})
  const [activeIssue,setActiveIssue]=useState<MasalahImport|null>(null)
  const [tab,setTab]=useState<'issues'|'held'|'done'|'all'>('issues')
  const [search,setSearch]=useState('')
  const [page,setPage]=useState(1)
  const [form,setForm]=useState({tahun:'',jenis:'',status:'',rating:'',potkom:'',catatan:'',diverifikasi:false})
  const [error,setError]=useState('')
  const [pending,mulai]=useTransition()
  const [result,setResult]=useState<HasilImpor|null>(null)
  const [activeComparison,setActiveComparison]=useState<PegawaiPreview|null>(null)
  const [profilEdit,setProfilEdit]=useState<KoreksiProfil>({})
  const [pilihanKolom,setPilihanKolom]=useState<Record<string,'EXCEL'|'DB'>>({})
  const [pilihanFoto,setPilihanFoto]=useState<Record<string,'GUNAKAN_EXCEL'|'LEWATI'>>({})
  const [activeFoto,setActiveFoto]=useState<Pratinjau['foto'][number]|null>(null)
  const [fotoExcelSrc,setFotoExcelSrc]=useState('')
  const [fotoLoading,setFotoLoading]=useState(false)
  const [fotoError,setFotoError]=useState('')

  const remaining=(preview?.masalah??[]).filter(i=>!putusan[i.id])
  const decided=(preview?.masalah??[]).filter(i=>Boolean(putusan[i.id]))
  const held=(preview?.masalah??[]).filter(i=>putusan[i.id]?.aksi==='TAHAN')
  const filtered=useMemo(()=>{
    if(!preview)return []
    const term=search.trim().toLowerCase()
    return preview.daftar.filter(r=>(!term||r.nama.toLowerCase().includes(term)||r.nip.includes(term))&&(
      tab==='all' ||
      (tab==='issues' && preview.masalah.some(m=>m.nip===r.nip)) ||
      (tab==='held' && preview.masalah.some(m=>m.nip===r.nip&&putusan[m.id]?.aksi==='TAHAN')) ||
      (tab==='done' && preview.masalah.some(m=>m.nip===r.nip&&putusan[m.id]?.aksi==='KOREKSI'))
    ))
  },[preview,search,tab,putusan])
  const pages=Math.max(1,Math.ceil(filtered.length/10))
  const rows=filtered.slice((Math.min(page,pages)-1)*10,Math.min(page,pages)*10)
  const rowIssues=(nip:string)=>preview?.masalah.filter(m=>m.nip===nip)??[]

  const detect=()=>{
    if(!file){setError('Pilih Excel terlebih dahulu.');return}
    mulai(async()=>{
      setError('')
      const fd=new FormData();fd.set('berkas',file)
      const response=await pratinjauImporTalentPool(fd)
      if(!response.ok){setError(response.pesan);return}
      setPreview(response.data);setPutusan({});setPilihanKolom({});setPilihanFoto({});setPage(1);setStage('review')
    })
  }
  const edit=(issue:MasalahImport)=>{
    setActiveIssue(issue);setError('')
    const prior=putusan[issue.id]
    const row=preview?.daftar.find(x=>x.nip===issue.nip)
    setProfilEdit({...row?.sumber,...(prior?.aksi==='KOREKSI'?prior.perbaikan:{})})
    setForm({
      tahun:prior?.aksi==='KOREKSI'?prior.tahun??'':issue.nilai?.tahun??'',
      jenis:prior?.aksi==='KOREKSI'?prior.jenis??'':issue.nilai?.jenis??'',
      status:prior?.aksi==='KOREKSI'?prior.status??'':issue.nilai?.status??'',
      rating:prior?.aksi==='KOREKSI'?prior.rating??'':issue.nilai?.rating??'',
      potkom:prior?.aksi==='KOREKSI'?prior.potkom??'':issue.nilai?.potkom??'',
      catatan:prior?.catatan??'',diverifikasi:Boolean(prior?.diverifikasi)
    })
  }
  const decideHold=()=>{
    if(!activeIssue)return
    setPutusan(old=>({...old,[activeIssue.id]:{id:activeIssue.id,aksi:'TAHAN'}}))
    setActiveIssue(null);setError('')
  }
  const decideSave=()=>{
    if(!activeIssue||activeIssue.kategori!=='asesmen')return
    const tahun=Number(form.tahun),angka=Number(form.potkom.replace(',','.'))
    if(!Number.isInteger(tahun)||tahun<1990||tahun>new Date().getFullYear()+1||
      form.jenis.trim().length<3||!['Berlaku','Draft','Expired'].includes(form.status)||
      !['Sangat Baik','Baik','Butuh Perbaikan','Kurang','Sangat Kurang'].includes(form.rating)||
      !Number.isFinite(angka)||angka<0){
      setError('Isi tahun, jenis, status, rating, serta POTKOM yang valid.');return
    }
    if(angka>100&&(!form.diverifikasi||form.catatan.trim().length<5)){
      setError('Nilai di atas 100 memerlukan konfirmasi pemeriksaan dan catatan.');return
    }
    const put:Putusan={id:activeIssue.id,aksi:'KOREKSI',
      tahun:form.tahun,jenis:form.jenis.trim(),status:form.status,rating:form.rating,
      potkom:form.potkom,catatan:form.catatan,diverifikasi:form.diverifikasi}
    setPutusan(old=>({...old,[put.id]:put}))
    setActiveIssue(null);setError('')
  }
  const decideProfile=()=>{
    if(!activeIssue||activeIssue.kategori!=='pegawai')return
    if((profilEdit.nama||'').trim().length<3||(profilEdit.golongan||'').trim().length<2){
      setError('Periksa nama dan golongan sebelum menyimpan koreksi.');return
    }
    setPutusan(old=>({...old,[activeIssue.id]:{id:activeIssue.id,aksi:'KOREKSI',perbaikan:profilEdit}}))
    setActiveIssue(null);setError('')
  }
  const apply=()=>{
    if(!preview||!file||remaining.length>0)return
    mulai(async()=>{
      setError('')
      const fd=new FormData()
      fd.set('berkas',file);fd.set('sha',preview.sha);fd.set('snapshot',preview.snapshot)
      fd.set('putusan',JSON.stringify(putusan));fd.set('pilihanKolom',JSON.stringify(pilihanKolom));fd.set('pilihanFoto',JSON.stringify(pilihanFoto))
      const response=await konfirmasiImporTalentPool(fd)
      if(!response.ok){setError(response.pesan);return}
      setResult(response.data);setStage('done')
    })
  }
  const lihatFoto=async(p:Pratinjau['foto'][number])=>{
    setActiveFoto(p);setFotoExcelSrc('');setFotoError('');setFotoLoading(true)
    if(!file||!preview){setFotoLoading(false);return}
    const fd=new FormData();fd.set('berkas',file);fd.set('sha',preview.sha)
    try{
      const res=await pratinjauFotoTalentPool(fd,p.nip)
      if(res.ok)setFotoExcelSrc(res.data.gambar)
      else setFotoError(res.pesan)
    }catch{setFotoError('Gagal mengambil pratinjau foto.')}
    finally{setFotoLoading(false)}
  }
  const restart=()=>{
    setFile(null);setPreview(null);setPutusan({});setPilihanKolom({});setPilihanFoto({});setResult(null);setError('');setStage('upload')
  }

  const steps:['upload','review','confirm']=['upload','review','confirm']
  return <div className="space-y-5">
    <div className="pita-kepala flex flex-wrap items-center justify-between gap-4 rounded-lg px-5 py-4 shadow-kartu">
      <div>
        <h1 className="text-xl font-semibold text-kepala-teks">Tambah / Update Pegawai</h1>
        <p className="mt-1 text-sm text-kepala-teks-samar">Unggah Excel, periksa hasilnya, lalu simpan dengan aman.</p>
      </div>
      <Link href="/talenta" className="rounded-md border border-white/30 px-3 py-2 text-xs font-medium text-white hover:bg-white/10">Kembali ke direktori</Link>
    </div>
    <div className="flex items-center gap-3">
      {steps.map((s,i)=><button key={s} type="button" onClick={()=>{if(s==='upload'||(preview&&s==='review')||(preview&&!remaining.length&&s==='confirm'))setStage(s)}} className="min-w-0 flex-1 text-left">
        <div className={'mb-2 h-1 rounded-full '+((steps.indexOf(stage as typeof s)>=i||stage==='done')?'bg-accent':'bg-border-strong')}/>
        <span className={'text-xs '+(stage===s?'font-semibold text-text':'text-text-subtle')}>0{i+1} &nbsp; {titleStage[s]}</span>
      </button>)}
    </div>
    {stage==='upload'&&<section className="rounded-lg border border-border bg-surface p-5 shadow-kartu">
      <h2 className="text-sm font-semibold text-text">Upload data dari Excel</h2>
      <p className="mt-1 text-xs text-text-muted">Format Talent Pool lama maupun file dengan 30 kolom yang sama. Satu file bisa berisi banyak pegawai dan baris riwayat.</p>
      <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface-2 px-5 py-10 text-center hover:border-accent hover:bg-accent-subtle">
        <UploadCloud className="size-9 text-accent"/>
        <span className="text-sm font-medium text-text">{file?file.name:'Klik untuk memilih berkas Excel'}</span>
        <span className="text-xs text-text-muted">{file?(file.size/1024/1024).toFixed(2)+' MB':'File .xlsx sampai 20 MB · tidak perlu mengubah susunan kolom'}</span>
        <input type="file" className="sr-only" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>{setFile(e.target.files?.[0]||null);setError('')}}/>
      </label>
      <p className="mt-4 flex items-center gap-2 text-xs text-text-muted"><ShieldCheck className="size-4"/> Excel hanya diperiksa dahulu. Belum ada perubahan ke database.</p>
      <div className="mt-5 flex justify-end"><Button onClick={detect} disabled={!file} pending={pending} labelPending="Memeriksa Excel…" size="sm">Periksa file <ArrowRight className="ml-1 inline size-4"/></Button></div>
    </section>}
    {stage==='review'&&preview&&<div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface p-5 shadow-kartu">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-sm font-semibold text-text">Hasil pembacaan Excel</h2><p className="mt-1 text-xs text-text-subtle">File belum disimpan ke SIMT. Hanya data yang perlu diperiksa yang memerlukan tindakan.</p></div>
          <span className="inline-flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="size-4"/> Excel terbaca</span>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-3">
          <FileSpreadsheet className="size-7 shrink-0 text-success"/>
          <div className="min-w-0"><p className="truncate text-xs font-semibold">{preview.file}</p><p className="mt-1 text-xs text-text-subtle">{preview.jumlah.toLocaleString('id-ID')} pegawai · {preview.tidakDikenal.length} label tambahan</p></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Angka value={preview.jumlah} label="Pegawai terbaca"/>
          <Angka value={preview.baru} label="Pegawai baru"/>
          <Angka value={preview.daftar.filter(x=>x.sudahAda).length} label="Sudah di SIMT"/>
          <Angka value={remaining.length} label="Perlu keputusan"/>
        </div>
        {preview.foto.length>0&&<div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">
          <FileSpreadsheet className="size-4 shrink-0 text-accent"/>
          <span><b>{preview.foto.length} foto tertanam ditemukan otomatis.</b> Klik tombol Bandingkan foto untuk melihat foto Excel dan memilih apakah foto SIMT perlu diganti.</span>
        </div>}
        {preview.peringatanFoto.length>0&&<div className="mt-2 rounded-md border border-warning-border bg-warning-subtle p-3 text-xs text-text-muted">{preview.peringatanFoto.slice(0,3).join(' · ')}</div>}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-border">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <button type="button" onClick={()=>{setTab('issues');setPage(1)}} className={'border-b-2 pb-3 text-xs font-medium '+(tab==='issues'?'border-accent text-accent':'border-transparent text-text-muted')}>Periksa ({remaining.length} belum selesai)</button>
            <button type="button" onClick={()=>{setTab('held');setPage(1)}} className={'border-b-2 pb-3 text-xs font-medium '+(tab==='held'?'border-accent text-accent':'border-transparent text-text-muted')}>Ditahan ({held.length})</button>
            <button type="button" onClick={()=>{setTab('done');setPage(1)}} className={'border-b-2 pb-3 text-xs font-medium '+(tab==='done'?'border-accent text-accent':'border-transparent text-text-muted')}>Dikoreksi ({decided.length-held.length})</button>
            <button type="button" onClick={()=>{setTab('all');setPage(1)}} className={'border-b-2 pb-3 text-xs font-medium '+(tab==='all'?'border-accent text-accent':'border-transparent text-text-muted')}>Semua ({preview.daftar.length})</button>
          </div>
          <label className="mb-2 flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-text-subtle"><Search className="size-4"/><input className="w-32 bg-transparent text-xs outline-none placeholder:text-text-subtle md:w-44" placeholder="Cari nama / NIP" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></label>
        </div>
        <div className="divide-y divide-border">
          {rows.length===0&&<p className="py-8 text-center text-xs text-text-muted">{tab==='issues'?'Belum ada temuan untuk diperiksa.':'Tidak ada pegawai yang cocok dengan filter ini.'}</p>}
          {rows.map(r=>{
            const issues=rowIssues(r.nip)
            const countHeld=issues.filter(i=>putusan[i.id]?.aksi==='TAHAN').length
            const countCorrected=issues.filter(i=>putusan[i.id]?.aksi==='KOREKSI').length
            return <div key={r.nip+':'+r.baris} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-xs font-semibold text-accent">{r.nama.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</span>
                  <div className="min-w-0"><p className="text-xs font-semibold text-text">{r.nama||'(Tanpa nama)'}</p><p className="mt-1 text-xs text-text-subtle">NIP {r.nip} · Baris Excel {r.baris}</p><p className="mt-1.5 text-xs text-text-muted">{r.ringkas.jabatan} jabatan · {r.ringkas.pelatihan} pelatihan · {r.ringkas.pendidikan} pendidikan · {r.ringkas.asesmen} asesmen</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={'rounded px-2 py-1 text-[10px] font-semibold '+tag(r.kondisi)}>{r.sudahAda?'EXISTING · ':''}{r.kondisi}</span>
                  <Button size="sm" variant="sekunder" onClick={()=>setActiveComparison(r)}>Bandingkan</Button>
                </div>
              </div>
              {r.sudahAda&&<div className="ml-12 mt-2 text-xs text-text-muted">
                Profil: <b>{r.perbedaan.filter(x=>!x.sama).length} berbeda</b> ·
                Riwayat tambahan: <b>{Object.values(r.perbandingan).reduce((sum,x)=>sum+x.akanDitambah,0)} entri</b>
                {r.kondisi==='SAMA'?' · Tidak ada perubahan yang diperlukan':''}
              </div>}
              {preview.foto.some(x=>x.nip===r.nip)&&<div className="ml-12 mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
                <span className="text-xs font-medium text-text">Foto resmi dari Excel</span>
                <span className="text-xs text-text-subtle">{preview.foto.find(x=>x.nip===r.nip)?.sudahAda?'Sudah ada foto di SIMT':'Belum ada foto di SIMT'}</span>
                <Button size="sm" variant="sekunder" onClick={()=>lihatFoto(preview.foto.find(x=>x.nip===r.nip)!)}>Bandingkan foto</Button>
                <span className="text-xs text-accent">
                  {(pilihanFoto[r.nip]||(preview.foto.find(x=>x.nip===r.nip)?.sudahAda?'LEWATI':'GUNAKAN_EXCEL'))==='GUNAKAN_EXCEL'?'Gunakan foto Excel':'Pertahankan foto SIMT'}
                </span>
              </div>}
              {issues.length>0&&<div className="ml-12 mt-3 space-y-2">
                {issues.map(issue=>{
                  const status=putusan[issue.id]?.aksi
                  return <div key={issue.id} className={'flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5 '+(status?'border-border bg-surface-2':'border-warning-border bg-warning-subtle')}>
                    {status?<CheckCircle2 className="size-4 shrink-0 text-success"/>:<AlertCircle className="size-4 shrink-0 text-warning"/>}
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-text">{issue.judul}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{issue.penjelasan}</p>
                      {status&&<p className="mt-1 text-xs font-medium text-accent">{status==='TAHAN'?'Ditahan — tidak ikut impor':'Koreksi tersimpan sebagai draft — belum ke database'}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {status&&<Button variant="sekunder" size="sm" onClick={()=>setPutusan(old=>{const x={...old};delete x[issue.id];return x})}>Batalkan</Button>}
                      <Button variant="sekunder" size="sm" onClick={()=>edit(issue)}>{status?'Periksa ulang':'Perbaiki'}</Button>
                    </div>
                  </div>
                })}
              </div>}
              {(countHeld>0||countCorrected>0)&&<p className="ml-12 mt-2 text-xs text-text-muted">{countHeld} ditahan · {countCorrected} dikoreksi. Semua masih bisa dibuka ulang sebelum konfirmasi.</p>}
            </div>
          })}
        </div>
        {pages>1&&<div className="flex items-center justify-end gap-3 border-t border-border pt-3"><span className="text-xs text-text-muted">Hal. {Math.min(page,pages)} / {pages}</span><Button variant="sekunder" size="sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Sebelumnya</Button><Button variant="sekunder" size="sm" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Berikutnya</Button></div>}
        {decided.length>0&&<p className="mt-3 text-xs text-success">{decided.length} keputusan review tersimpan sementara. Belum mengubah database.</p>}
      </section>
      <div className="flex items-center justify-between gap-2"><Button variant="sekunder" size="sm" onClick={()=>setStage('upload')}><ArrowLeft className="mr-1 inline size-4"/> Kembali</Button><Button size="sm" disabled={remaining.length>0} onClick={()=>setStage('confirm')}>Lanjut ke konfirmasi <ArrowRight className="ml-1 inline size-4"/></Button></div>
      {remaining.length>0&&<p className="text-right text-xs text-text-subtle">{remaining.length} temuan harus dikoreksi atau ditahan sebelum melanjutkan.</p>}
    </div>}
    {stage==='confirm'&&preview&&<section className="rounded-lg border border-border bg-surface p-5 shadow-kartu">
      <h2 className="text-sm font-semibold text-text">Konfirmasi penyimpanan</h2>
      <p className="mt-1 text-xs text-text-muted">Sistem akan memvalidasi ulang file dan kondisi database sebelum menyimpan. Seluruh batch dibatalkan bila ada kegagalan.</p>
      <dl className="mt-5 divide-y divide-border">
        {[['File',preview.file],['Pegawai terbaca',preview.jumlah.toLocaleString('id-ID')],['Berpotensi baru',preview.baru.toLocaleString('id-ID')],['Pegawai existing dengan data impor',preview.berubah.toLocaleString('id-ID')],['Data ditahan',Object.values(putusan).filter(x=>x.aksi==='TAHAN').length.toLocaleString('id-ID')],['Koreksi dari review',Object.values(putusan).filter(x=>x.aksi==='KOREKSI').length.toLocaleString('id-ID')],
          ['Foto dari Excel yang disetujui',preview.foto.filter(x=>(pilihanFoto[x.nip]||(x.sudahAda?'LEWATI':'GUNAKAN_EXCEL'))==='GUNAKAN_EXCEL'&&putusan[x.nip+':pegawai']?.aksi!=='TAHAN').length.toLocaleString('id-ID')]].map(([name,value])=><div key={name} className="flex justify-between gap-3 py-3 text-xs"><dt className="text-text-muted">{name}</dt><dd className="text-right font-semibold text-text">{value}</dd></div>)}
      </dl>
      <div className="mt-4 flex items-start gap-2 rounded-md bg-accent-subtle p-3 text-xs text-accent"><ShieldCheck className="size-4 shrink-0"/>Data tidak dihapus otomatis. Identitas, riwayat, dan asesmen dicocokkan sebelum penulisan.</div>
      <div className="mt-5 flex items-center justify-between"><Button variant="sekunder" size="sm" disabled={pending} onClick={()=>setStage('review')}>Kembali ke review</Button><Button size="sm" pending={pending} onClick={apply} labelPending="Menyimpan ke SIMT…">Konfirmasi & simpan data <Check className="ml-1 inline size-4"/></Button></div>
    </section>}
    {stage==='done'&&result&&<section className="rounded-lg border border-border bg-surface p-6 text-center shadow-kartu">
      <CheckCircle2 className="mx-auto size-11 text-success"/>
      <h2 className="mt-3 text-lg font-semibold text-text">Data berhasil diproses</h2><p className="mt-1 text-xs text-text-muted">Hasil impor dicatat dalam audit SIMT.</p>
      <div className="mx-auto mt-5 grid max-w-xl grid-cols-2 gap-2 md:grid-cols-3">
        <Angka value={result.dibuat} label="Pegawai baru"/><Angka value={result.diperbarui} label="Profil diperbarui"/><Angka value={result.riwayatJabatan} label="Riwayat jabatan"/>
        <Angka value={result.pendidikan} label="Pendidikan"/><Angka value={result.pelatihan} label="Pelatihan"/><Angka value={result.asesmen} label="Asesmen"/><Angka value={result.fotoTersimpan} label="Foto tersimpan"/>
      </div>
      <p className="mt-4 text-xs text-text-subtle">{result.ditahan} entri ditahan · {result.fotoDilewati} foto tidak diubah.</p>
      {result.fotoGagal>0&&<p role="alert" className="mt-2 rounded-md border border-warning-border bg-warning-subtle p-3 text-xs text-warning">{result.fotoGagal} foto gagal disimpan. Data lain telah tersimpan; perbaiki melalui profil pegawai.</p>}
      <div className="mt-6 flex justify-center gap-2"><Button variant="sekunder" size="sm" onClick={restart}>Impor file lain</Button><Link href="/talenta" className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-text">Kembali ke direktori</Link></div>
    </section>}
    {error&&<div role="alert" className="rounded-md border border-danger-border bg-danger-subtle px-4 py-3 text-xs text-danger">{error}</div>}
    {activeFoto&&<Dialog buka onTutup={()=>setActiveFoto(null)} lebar="lg"
      judul="Bandingkan foto pegawai"
      deskripsi={'Foto Excel tertanam · NIP '+activeFoto.nip}
      aksi={<Button size="sm" variant="sekunder" onClick={()=>setActiveFoto(null)}>Selesai</Button>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-2 p-3 text-center">
          <p className="mb-3 text-xs font-semibold text-text">Foto dari Excel</p>
          <div className="flex h-44 items-center justify-center rounded-md bg-surface">
            {fotoLoading?<span className="text-xs text-text-muted">Membaca foto...</span>:
             fotoExcelSrc?<Image unoptimized width={160} height={160} src={fotoExcelSrc} alt="Foto dari file Excel" className="max-h-40 max-w-full rounded object-contain"/>:
             <span className="text-xs text-text-muted">Tidak dapat ditampilkan</span>}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface-2 p-3 text-center">
          <p className="mb-3 text-xs font-semibold text-text">Foto SIMT saat ini</p>
          <div className="flex h-44 items-center justify-center rounded-md bg-surface">
            {activeFoto.sudahAda?
              <Image unoptimized width={160} height={160} src={BASE_PATH+'/api/internal/foto/'+activeFoto.nip} alt="Foto di SIMT sekarang" className="max-h-40 max-w-full rounded object-contain"/>:
              <span className="text-xs text-text-muted">Belum ada foto tersimpan</span>}
          </div>
        </div>
      </div>
      {fotoError&&<p className="mt-3 text-xs text-danger">{fotoError}</p>}
      <div className="mt-4 space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-semibold text-text">Foto mana yang akan dipakai?</p>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-text">
          <input type="radio" name={'pilih-foto-'+activeFoto.nip} className="accent-accent"
            checked={(pilihanFoto[activeFoto.nip]||(activeFoto.sudahAda?'LEWATI':'GUNAKAN_EXCEL'))==='GUNAKAN_EXCEL'}
            onChange={()=>setPilihanFoto(old=>({...old,[activeFoto.nip]:'GUNAKAN_EXCEL'}))}/>
          Gunakan foto Excel {activeFoto.sudahAda?'(ganti foto SIMT)':'(isi foto baru)'}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-text">
          <input type="radio" name={'pilih-foto-'+activeFoto.nip} className="accent-accent"
            checked={(pilihanFoto[activeFoto.nip]||(activeFoto.sudahAda?'LEWATI':'GUNAKAN_EXCEL'))==='LEWATI'}
            onChange={()=>setPilihanFoto(old=>({...old,[activeFoto.nip]:'LEWATI'}))}/>
          {activeFoto.sudahAda?'Pertahankan foto SIMT':'Jangan impor foto ini'}
        </label>
      </div>
      <p className="mt-3 text-xs text-text-muted">Keputusan tersimpan sebagai draft sampai konfirmasi akhir.</p>
    </Dialog>}
    {activeComparison&&<Dialog buka onTutup={()=>setActiveComparison(null)} lebar="lg"
      judul={activeComparison.sudahAda?'Bandingkan dengan data SIMT':'Rincian calon pegawai baru'}
      deskripsi={activeComparison.nama+' · NIP '+activeComparison.nip}
      aksi={<Button size="sm" variant="sekunder" onClick={()=>setActiveComparison(null)}>Selesai</Button>}>
      <div className="space-y-4">
        <div className="rounded-md bg-surface-2 p-3 text-xs text-text-muted">
          {activeComparison.sudahAda?'Hanya field yang berbeda yang akan diperbarui. Pilih sumber nilainya di sebelah kanan.':'Pegawai belum ditemukan di lingkup data Anda. Nilai dari Excel diusulkan untuk membuat profil baru.'}
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-text-subtle"><tr>
              <th className="p-3 font-semibold">Field</th>
              <th className="p-3 font-semibold">Sekarang di SIMT</th>
              <th className="p-3 font-semibold">Dari Excel</th>
              <th className="p-3 font-semibold">Keputusan</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {activeComparison.perbedaan.map(d=><tr key={d.key} className={d.sama?'opacity-70':''}>
                <td className="p-3 font-medium text-text">{d.label}</td>
                <td className="p-3 text-text-muted">{d.lama||'—'}</td>
                <td className="p-3 font-medium text-text">{d.excel||'—'}</td>
                <td className="p-3">
                  {d.sama?<span className="text-success">Sama</span>:activeComparison.sudahAda?
                    <select aria-label={'Pilihan '+d.label} className={inputClass+' min-w-[145px]'}
                      value={pilihanKolom[activeComparison.nip+':'+d.key]||'EXCEL'}
                      onChange={e=>setPilihanKolom(old=>{
                        const value=e.target.value as 'DB'|'EXCEL'
                        const next={...old,[activeComparison.nip+':'+d.key]:value}
                        const other=d.key==='golongan'?'pangkat':d.key==='pangkat'?'golongan':null
                        if(other&&activeComparison.perbedaan.some(x=>x.key===other&&!x.sama))
                          next[activeComparison.nip+':'+other]=value
                        return next
                      })}>
                      <option value="EXCEL">Pakai Excel</option><option value="DB">Pertahankan SIMT</option>
                    </select>:
                    <span className="text-text-muted">Data baru</span>}
                </td>
              </tr>)}
              {!activeComparison.perbedaan.length&&<tr><td className="p-3 text-text-muted" colSpan={4}>Tidak ada field profil yang perlu diperbarui.</td></tr>}
            </tbody>
          </table>
        </div>
        <div><p className="mb-2 text-xs font-semibold text-text">Riwayat dan asesmen</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {([
              ['Riwayat jabatan',activeComparison.perbandingan.jabatan],
              ['Pendidikan',activeComparison.perbandingan.pendidikan],
              ['Pelatihan',activeComparison.perbandingan.pelatihan],
              ['Asesmen',activeComparison.perbandingan.asesmen],
            ] as const).map(([name,v])=><div key={name} className="rounded-md border border-border bg-surface-2 p-3 text-xs">
              <p className="font-semibold">{name}</p>
              <p className="mt-1 text-text-muted">Excel: {v.dariExcel} · SIMT: {v.diSIMT}</p>
              <p className="mt-1 font-medium text-accent">{v.akanDitambah} berbeda / baru</p>
            </div>)}
          </div>
        </div>
        <p className="text-xs text-text-muted">Riwayat yang sama dilewati. Entri ambigu tetap harus diputuskan pada kartu review; perbandingan ini tidak otomatis menghapus data lama.</p>
      </div>
    </Dialog>}
    {activeIssue&&<Dialog buka onTutup={()=>{setActiveIssue(null);setError('')}} lebar="lg"
      judul={activeIssue.kategori==='asesmen'?'Perbaiki data asesmen':'Tinjau data yang perlu diperiksa'}
      deskripsi={(activeIssue.nama||'Pegawai')+' · NIP '+activeIssue.nip+' · dari Excel'}
      aksi={<><Button variant="sekunder" size="sm" onClick={decideHold}>Tahan dulu</Button>{activeIssue.kategori==='asesmen'&&<Button size="sm" onClick={decideSave}>Simpan koreksi</Button>}{activeIssue.kategori==='pegawai'&&<Button size="sm" onClick={decideProfile}>Simpan koreksi profil</Button>}</>}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-subtle">Data asli dari Excel</p>
          {activeIssue.kategori==='asesmen'&&activeIssue.nilai?
            <dl className="space-y-2 text-xs">{[
              ['Jenjang',activeIssue.nilai.jenjang],['Tahun',activeIssue.nilai.tahun],['Jenis',activeIssue.nilai.jenis],['Status',activeIssue.nilai.status],
              ['POTKOM',activeIssue.nilai.potkom],['Rating',activeIssue.nilai.rating],['Kotak 9 sumber',activeIssue.nilai.kotak9]
            ].map(([k,v])=><div key={k} className="flex justify-between gap-2 border-b border-border pb-2"><dt className="text-text-muted">{k}</dt><dd className="text-right font-medium">{v||'—'}</dd></div>)}</dl>:
            <p className="text-xs leading-relaxed text-text-muted">{activeIssue.penjelasan}</p>}
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{activeIssue.kategori==='asesmen'?'Lengkapi data yang kurang':'Keputusan pemeriksaan'}</p>
          {activeIssue.kategori==='asesmen'?<>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tahun asesmen *"><input className={inputClass} value={form.tahun} onChange={e=>setForm({...form,tahun:e.target.value})} placeholder="2025" inputMode="numeric"/></FormField>
              <FormField label="Jenis asesmen *"><input className={inputClass} value={form.jenis} onChange={e=>setForm({...form,jenis:e.target.value})} placeholder="Administrator"/></FormField>
              <FormField label="Status *"><select className={inputClass} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="">Pilih status</option>{['Berlaku','Draft','Expired'].map(x=><option key={x}>{x}</option>)}</select></FormField>
              <FormField label="Rating kinerja *"><select className={inputClass} value={form.rating} onChange={e=>setForm({...form,rating:e.target.value})}><option value="">Pilih rating</option>{['Sangat Baik','Baik','Butuh Perbaikan','Kurang','Sangat Kurang'].map(x=><option key={x}>{x}</option>)}</select></FormField>
            </div>
            <FormField label="POTKOM"><input className={inputClass} value={form.potkom} onChange={e=>setForm({...form,potkom:e.target.value})} inputMode="decimal"/></FormField>
            {Number(form.potkom.replace(',','.'))>100&&<div className="rounded-md bg-warning-subtle p-3 text-xs text-text-muted">POTKOM di atas 100 diperbolehkan oleh aturan SIMT, namun perlu verifikasi sumber.</div>}
            <FormField label="Catatan pemeriksaan"><textarea className={inputClass} rows={2} value={form.catatan} onChange={e=>setForm({...form,catatan:e.target.value})} placeholder="Dasar verifikasi..."/></FormField>
            <label className="flex items-start gap-2 text-xs text-text-muted"><input className="mt-1 accent-accent" type="checkbox" checked={form.diverifikasi} onChange={e=>setForm({...form,diverifikasi:e.target.checked})}/>Saya telah memeriksa nilai ini pada sumber data.</label>
          </>:activeIssue.kategori==='pegawai'?<>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['nama','Nama lengkap'],
                ['golongan','Golongan'],
                ['tingkatPendidikan','Pendidikan terakhir'],
                ['namaJabatan','Nama jabatan'],
                ['unitKerja','Unit kerja'],
                ['tmtGolongan','TMT golongan'],
                ['tmtJabatan','TMT jabatan'],
                ['sekolah','Sekolah terakhir'],
                ['jurusan','Bidang studi'],
              ] as const).map(([key,label])=><div key={key} className={key==='nama'||key==='namaJabatan'||key==='unitKerja'?'col-span-2':''}>
                <FormField label={label}>
                  <input className={inputClass} value={profilEdit[key]||''}
                    onChange={e=>setProfilEdit(old=>({...old,[key]:e.target.value}))}
                    placeholder={key.startsWith('tmt')?'YYYY-MM-DD':label}/>
                </FormField>
              </div>)}
            </div>
            <p className="text-xs text-text-muted">Koreksi menjadi draft. Sistem akan mencocokkan lagi jabatan/unit terhadap master saat konfirmasi.</p>
            {activeIssue.penjelasan.includes('tergeser')&&
              <p className="rounded-md border border-warning-border bg-warning-subtle p-3 text-xs text-text-muted">Susunan kolom Excel kemungkinan bergeser. Koreksi identitas saja tidak cukup; tahan pegawai dan perbaiki sumber agar riwayat tidak salah posisi.</p>}
          </>:<div className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-text-muted">Jenjang SD/SLTP tidak boleh diubah menjadi jenjang lain secara otomatis. Tahan entri ini sampai standar DB mendukungnya, tanpa membuang data sumber.</div>}
        </div>
      </div>
      {error&&<p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
    </Dialog>}
  </div>
}
