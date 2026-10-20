import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { punyaPeran } from '@/lib/peran'
import { RuangImporTalenta } from './_komponen/ruang-impor-talenta'

export const metadata={title:'Impor Excel Pegawai'}

export default async function ImporTalentPoolPage(){
  const user=await getCurrentUser()
  if(!punyaPeran(user,['Super Admin','Admin Talenta','Pengelola Unit']))notFound()
  return <RuangImporTalenta/>
}
