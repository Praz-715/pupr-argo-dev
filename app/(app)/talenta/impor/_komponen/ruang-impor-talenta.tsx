'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardCheck,
  FileSpreadsheet, FileUp, Loader2, Search, ShieldCheck, UploadCloud, X
} from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  pratinjauImporTalentPool, konfirmasiImporTalentPool,
  type MasalahImport, type Pratinjau, type Putusan,
} from '@/lib/aksi/impor-talenta-review'

type Stage='upload'|'review'|'confirm'|'done'
type HasilImpor={dibuat:number;diperbarui:number;riwayatJabatan:number;pendidikan:number;pelatihan:number;asesmen:number;ditahan:number}
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
  const [tab,setTab]=useState<'issues'|'all'>('issues')
  const [search,setSearch]=useState('')
  const [page,setPage]=useState(1)
  const [form,setForm]=useState({tahun:'',jenis:'',status:'',rating:'',potkom:'',catatan:'',diverifikasi:false})
  const [error,setError]=useState('')
  const [pending,mulai]=useTransition()
  const [result,setResult]=useState<HasilImpor|null>(null)

  const remaining=(preview?.masalah??[]).filter(i=>!putusan[i.id])
  const decided=(preview?.masalah??[]).filter(i=>Boolean(putusan[i.id]))
  const filtered=useMemo(()=>{
    if(!preview)return []
    const term=search.trim().toLowerCase()
    return preview.daftar.filter(r=>(!term||r.nama.toLowerCase().includes(term)||r.nip.includes(term))&&
      (tab==='all'||preview.masalah.some(m=>m.nip===r.nip&&!putusan[m.id])))
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
      setPreview(response.data);setPutusan({});setPage(1);setStage('review')
    })
  }
  const edit=(issue:MasalahImport)=>{
    setActiveIssue(issue);setError('')
    setForm({
      tahun:issue.nilai?.tahun??'',jenis:issue.nilai?.jenis??'',status:issue.nilai?.status??'',
      rating:issue.nilai?.rating??'',potkom:issue.nilai?.potkom??'',catatan:'',diverifikasi:false
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
  const apply=()=>{
    if(!preview||!file||remaining.length>0)return
    mulai(async()=>{
      setError('')
      const fd=new FormData()
      fd.set('berkas',file);fd.set('sha',preview.sha);fd.set('snapshot',preview.snapshot)
      fd.set('putusan',JSON.stringify(putusan))
      const response=await konfirmasiImporTalentPool(fd)
      if(!response.ok){setError(response.pesan);return}
      setResult(response.data);setStage('done')
    })
  }
  const restart=()=>{
    setFile(null);setPreview(null);setPutusan({});setResult(null);setError('');setStage('upload')
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
          <Angka value={preview.berubah} label="Data existing"/>
          <Angka value={remaining.length} label="Perlu keputusan"/>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-border">
          <div className="flex gap-5">
            <button type="button" onClick={()=>{setTab('issues');setPage(1)}} className={'border-b-2 pb-3 text-xs font-medium '+(tab==='issues'?'border-accent text-accent':'border-transparent text-text-muted')}>Perlu diperiksa ({remaining.length})</button>
            <button type="button" onClick={()=>{setTab('all');setPage(1)}} className={'border-b-2 pb-3 text-xs font-medium '+(tab==='all'?'border-accent text-accent':'border-transparent text-text-muted')}>Semua pegawai ({preview.daftar.length})</button>
          </div>
          <label className="mb-2 flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-text-subtle"><Search className="size-4"/><input className="w-32 bg-transparent text-xs outline-none placeholder:text-text-subtle md:w-44" placeholder="Cari nama / NIP" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></label>
        </div>
        <div className="divide-y divide-border">
          {rows.length===0&&<p className="py-8 text-center text-xs text-text-muted">{tab==='issues'?'Tidak ada masalah yang belum diselesaikan.':'Tidak ada pegawai yang cocok dengan pencarian.'}</p>}
          {rows.map(r=>{
            const issues=rowIssues(r.nip).filter(i=>!putusan[i.id])
            const held=rowIssues(r.nip).filter(i=>putusan[i.id]?.aksi==='TAHAN').length
            return <div key={r.nip+':'+r.baris} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-xs font-semibold text-accent">{r.nama.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</span>
                  <div className="min-w-0"><p className="text-xs font-semibold text-text">{r.nama||'(Tanpa nama)'}</p><p className="mt-1 text-xs text-text-subtle">NIP {r.nip} · Baris Excel {r.baris}</p><p className="mt-1.5 text-xs text-text-muted">{r.ringkas.jabatan} jabatan · {r.ringkas.pelatihan} pelatihan · {r.ringkas.pendidikan} pendidikan · {r.ringkas.asesmen} asesmen</p></div>
                </div>
                <span className={'rounded px-2 py-1 text-[10px] font-semibold '+tag(r.kondisi)}>{r.kondisi}</span>
              </div>
              {issues.length>0&&<div className="ml-12 mt-3 space-y-2">
                {issues.map(issue=><div key={issue.id} className="flex items-center gap-3 rounded-md border border-warning-border bg-warning-subtle px-3 py-2.5">
                  <AlertCircle className="size-4 shrink-0 text-warning"/>
                  <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-text">{issue.judul}</p><p className="mt-0.5 text-xs text-text-muted">{issue.penjelasan}</p></div>
                  <Button variant="sekunder" size="sm" onClick={()=>edit(issue)}>Periksa</Button>
                </div>)}
              </div>}
              {held>0&&<p className="ml-12 mt-2 text-xs text-text-muted">{held} data ditahan dari impor.</p>}
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
        {[['File',preview.file],['Pegawai terbaca',preview.jumlah.toLocaleString('id-ID')],['Berpotensi baru',preview.baru.toLocaleString('id-ID')],['Pegawai existing dengan data impor',preview.berubah.toLocaleString('id-ID')],['Data ditahan',Object.values(putusan).filter(x=>x.aksi==='TAHAN').length.toLocaleString('id-ID')],['Koreksi dari review',Object.values(putusan).filter(x=>x.aksi==='KOREKSI').length.toLocaleString('id-ID')]].map(([name,value])=><div key={name} className="flex justify-between gap-3 py-3 text-xs"><dt className="text-text-muted">{name}</dt><dd className="text-right font-semibold text-text">{value}</dd></div>)}
      </dl>
      <div className="mt-4 flex items-start gap-2 rounded-md bg-accent-subtle p-3 text-xs text-accent"><ShieldCheck className="size-4 shrink-0"/>Data tidak dihapus otomatis. Identitas, riwayat, dan asesmen dicocokkan sebelum penulisan.</div>
      <div className="mt-5 flex items-center justify-between"><Button variant="sekunder" size="sm" disabled={pending} onClick={()=>setStage('review')}>Kembali ke review</Button><Button size="sm" pending={pending} onClick={apply} labelPending="Menyimpan ke SIMT…">Konfirmasi & simpan data <Check className="ml-1 inline size-4"/></Button></div>
    </section>}
    {stage==='done'&&result&&<section className="rounded-lg border border-border bg-surface p-6 text-center shadow-kartu">
      <CheckCircle2 className="mx-auto size-11 text-success"/>
      <h2 className="mt-3 text-lg font-semibold text-text">Data berhasil diproses</h2><p className="mt-1 text-xs text-text-muted">Hasil impor dicatat dalam audit SIMT.</p>
      <div className="mx-auto mt-5 grid max-w-xl grid-cols-2 gap-2 md:grid-cols-3">
        <Angka value={result.dibuat} label="Pegawai baru"/><Angka value={result.diperbarui} label="Profil diperbarui"/><Angka value={result.riwayatJabatan} label="Riwayat jabatan"/>
        <Angka value={result.pendidikan} label="Pendidikan"/><Angka value={result.pelatihan} label="Pelatihan"/><Angka value={result.asesmen} label="Asesmen"/>
      </div>
      <p className="mt-4 text-xs text-text-subtle">{result.ditahan} entri ditahan. Foto tertanam belum ikut impor dan dapat diperbarui di profil talenta.</p>
      <div className="mt-6 flex justify-center gap-2"><Button variant="sekunder" size="sm" onClick={restart}>Impor file lain</Button><Link href="/talenta" className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-text">Kembali ke direktori</Link></div>
    </section>}
    {error&&<div role="alert" className="rounded-md border border-danger-border bg-danger-subtle px-4 py-3 text-xs text-danger">{error}</div>}
    {activeIssue&&<Dialog buka onTutup={()=>{setActiveIssue(null);setError('')}} lebar="lg"
      judul={activeIssue.kategori==='asesmen'?'Perbaiki data asesmen':'Tinjau data yang perlu diperiksa'}
      deskripsi={(activeIssue.nama||'Pegawai')+' · NIP '+activeIssue.nip+' · dari Excel'}
      aksi={<><Button variant="sekunder" size="sm" onClick={decideHold}>Tahan dulu</Button>{activeIssue.kategori==='asesmen'&&<Button size="sm" onClick={decideSave}>Simpan koreksi</Button>}</>}>
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
          </>:<div className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-text-muted">Untuk mencegah perubahan data yang salah, bagian ini ditahan dari impor. Data Excel aslinya tetap utuh. Setelah diperbaiki di sumber/master, file bisa diperiksa ulang.</div>}
        </div>
      </div>
      {error&&<p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
    </Dialog>}
  </div>
}
