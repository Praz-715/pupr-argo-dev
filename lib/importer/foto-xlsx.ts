/**
 * Media tertanam pada file Talent Pool Excel.
 * Cocokkan drawing anchor (kolom FOTO RESMI/D, baris Excel) -> blok pegawai -> NIP.
 * Jangan menautkan berdasarkan nama imageN.png karena urutannya tidak dijamin.
 * Berkas personal: tidak dicetak ke log, tidak dipublikasi sebagai static asset.
 */
import { inflateRawSync } from 'node:zlib'
import { posix as path } from 'node:path'
import type { BarisTalentPool } from './talentpool-xlsx'

export type FotoDariExcel = { nip:string; barisExcel:number; buffer:Buffer; media:string }
export type HasilFotoXlsx = { foto:FotoDariExcel[]; peringatan:string[] }

const LIMIT_SATU=5*1024*1024
const LIMIT_TOTAL=80*1024*1024
const LIMIT_FOTO=2500
const PAKET=/^xl\/(?:worksheets\/(?:sheet\d+\.xml|_rels\/sheet\d+\.xml\.rels)|drawings\/(?:drawing\d+\.xml|_rels\/drawing\d+\.xml\.rels)|media\/[^/]+)$/i

function isiZip(buf:Buffer):Map<string,Buffer>{
  if(buf.length<22)throw Error('File Excel terlalu pendek.')
  let end=-1
  for(let i=buf.length-22;i>=0&&i>=buf.length-65557;i--){
    if(buf.readUInt32LE(i)===0x06054b50){end=i;break}
  }
  if(end<0)throw Error('Arsip Excel tidak mempunyai penanda ZIP.')
  const jumlah=buf.readUInt16LE(end+10)
  let offset=buf.readUInt32LE(end+16),total=0,photos=0
  if(offset===0xffffffff)throw Error('ZIP64 belum didukung.')
  const map=new Map<string,Buffer>()
  for(let i=0;i<jumlah;i++){
    if(offset+46>buf.length||buf.readUInt32LE(offset)!==0x02014b50)throw Error('Struktur ZIP Excel rusak.')
    const method=buf.readUInt16LE(offset+10),compressed=buf.readUInt32LE(offset+20)
    const size=buf.readUInt32LE(offset+24),nameLen=buf.readUInt16LE(offset+28)
    const extra=buf.readUInt16LE(offset+30),comment=buf.readUInt16LE(offset+32)
    const local=buf.readUInt32LE(offset+42)
    if(offset+46+nameLen>buf.length)throw Error('Nama entri ZIP tidak sah.')
    const name=buf.subarray(offset+46,offset+46+nameLen).toString('utf8')
    offset+=46+nameLen+extra+comment
    if(!PAKET.test(name))continue
    const isImage=name.startsWith('xl/media/')
    if(isImage){photos++;if(photos>LIMIT_FOTO)throw Error('Foto tertanam melebihi batas 2.500 gambar.')}
    if(isImage&&size>LIMIT_SATU)throw Error('Foto tertanam lebih dari 5 MB.')
    total+=size
    if(total>LIMIT_TOTAL)throw Error('Data gambar Excel melebihi batas aman 80 MB.')
    if(local+30>buf.length||buf.readUInt32LE(local)!==0x04034b50)throw Error('Header lokal ZIP tidak valid.')
    const start=local+30+buf.readUInt16LE(local+26)+buf.readUInt16LE(local+28)
    if(start+compressed>buf.length)throw Error('Isi ZIP berada di luar file.')
    const payload=buf.subarray(start,start+compressed)
    const bytes=method===0?Buffer.from(payload):method===8?inflateRawSync(payload,{maxOutputLength:size+1}):null
    if(!bytes||bytes.length!==size)throw Error('Data gambar Excel tidak valid.')
    map.set(name,bytes)
  }
  return map
}
function attrs(tag:string):Record<string,string>{
  const res:Record<string,string>={}
  for(const m of tag.matchAll(/([\w:.-]+)\s*=\s*["']([^"']*)["']/g))res[m[1]!]=m[2]!
  return res
}
function linked(xml:string,base:string):Map<string,string>{
  const links=new Map<string,string>()
  for(const m of xml.matchAll(/<Relationship\b[^>]*\/?>/g)){
    const a=attrs(m[0]);if(!a.Id||!a.Target||a.TargetMode==='External')continue
    const target=a.Target.startsWith('/')?a.Target.slice(1):path.normalize(path.join(path.dirname(base),a.Target))
    if(!target.startsWith('xl/'))continue
    links.set(a.Id,target)
  }
  return links
}
function formatGambar(b:Buffer):string|null{
  if(b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return 'jpeg'
  if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png'
  if(b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return 'webp'
  return null
}
/** PNG/JPEG/WebP dalam drawing pada worksheet pertama berheader FOTO RESMI. */
export function ekstrakFotoTalentPool(buf:Buffer,pegawai:BarisTalentPool[]):HasilFotoXlsx{
  const entries=isiZip(buf),warnings:string[]=[]
  const photos=new Map<string,FotoDariExcel>()
  const blocked=new Set<string>()
  const sorted=[...pegawai].sort((a,b)=>a.barisExcel-b.barisExcel)
  const sheet=entries.get('xl/worksheets/sheet1.xml')?.toString('utf8')||''
  const sheetRels=linked(entries.get('xl/worksheets/_rels/sheet1.xml.rels')?.toString('utf8')||'','xl/worksheets/sheet1.xml')
  const drawings=[...sheet.matchAll(/<drawing\b[^>]*\/?>/g)].map(x=>sheetRels.get(attrs(x[0])['r:id']||'')).filter((x):x is string=>!!x)
  for(const drawingPath of drawings){
    const drawing=entries.get(drawingPath)?.toString('utf8')||''
    const relFile=path.join(path.dirname(drawingPath),'_rels',path.basename(drawingPath)+'.rels')
    const rels=linked(entries.get(relFile)?.toString('utf8')||'',drawingPath)
    const anchors=drawing.match(/<(?:(?:\w+):)?(?:oneCellAnchor|twoCellAnchor)\b[\s\S]*?<\/(?:(?:\w+):)?(?:oneCellAnchor|twoCellAnchor)>/g)||[]
    for(const chunk of anchors){
      const from=chunk.match(/<(?:\w+:)?from>([\s\S]*?)<\/(?:\w+:)?from>/)?.[1]||''
      const col=Number(from.match(/<(?:\w+:)?col>(\d+)<\/(?:\w+:)?col>/)?.[1])
      const row=Number(from.match(/<(?:\w+:)?row>(\d+)<\/(?:\w+:)?row>/)?.[1])+1
      if(col!==3||!Number.isInteger(row)||row<=0)continue
      const rid=chunk.match(/<a:blip\b[^>]*r:embed=["']([^"']+)/)?.[1]
      if(!rid)continue
      const media=rels.get(rid)
      const img=media?entries.get(media):undefined
      if(!img){warnings.push('Gambar pada baris '+row+' tidak ditemukan dalam paket Excel.');continue}
      const format=formatGambar(img)
      if(!format){warnings.push('Gambar pada baris '+row+' memiliki format tidak didukung.');continue}
      const target=[...sorted].reverse().find(x=>x.barisExcel<=row)
      const next=sorted.find(x=>x.barisExcel>row)
      if(!target||row<target.barisExcel||(next&&row>=next.barisExcel))continue
      const nip=target.nip.replace(/\D/g,'')
      if(!/^\d{18}$/.test(nip)){warnings.push('Foto baris '+row+' tidak bisa dipetakan ke NIP valid.');continue}
      if(photos.has(nip)){photos.delete(nip);blocked.add(nip);warnings.push('Ada lebih dari satu foto untuk NIP di baris '+target.barisExcel+'. Perlu pemeriksaan sumber.');continue}
      if(blocked.has(nip))continue
      photos.set(nip,{nip,barisExcel:target.barisExcel,buffer:img,media:format})
    }
  }
  return {foto:[...photos.values()],peringatan:warnings}
}
