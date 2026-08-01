import { relations } from "drizzle-orm/relations";
import { apiClient, apiActivityLog, apiToken, users, approvalLog, nominasi, pegawai, asesmenTalenta, auditLog, hukumanDisiplin, unitOrganisasi, jabatan, jabatanTarget, jabatanTargetAnggota, jabatanTargetPersyaratan, kinerjaPeriode, matchScore, matchScoreDetail, rubrikIndikator, talentPool, notifikasi, pengaturanSistem, permintaanResetPassword, rencanaPengembangan, riwayatJabatan, riwayatPendidikan, rubrikKomponen, rubrikKategoriSkor, sesi, syncLog, roles } from "./schema";

export const apiActivityLogRelations = relations(apiActivityLog, ({one}) => ({
	apiClient: one(apiClient, {
		fields: [apiActivityLog.apiClientId],
		references: [apiClient.id]
	}),
	apiToken: one(apiToken, {
		fields: [apiActivityLog.apiTokenId],
		references: [apiToken.id]
	}),
}));

export const apiClientRelations = relations(apiClient, ({many}) => ({
	apiActivityLogs: many(apiActivityLog),
	apiTokens: many(apiToken),
}));

export const apiTokenRelations = relations(apiToken, ({one, many}) => ({
	apiActivityLogs: many(apiActivityLog),
	apiClient: one(apiClient, {
		fields: [apiToken.apiClientId],
		references: [apiClient.id]
	}),
	user: one(users, {
		fields: [apiToken.createdBy],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	apiTokens: many(apiToken),
	approvalLogs: many(approvalLog),
	auditLogs: many(auditLog),
	hukumanDisiplins: many(hukumanDisiplin),
	jabatanTargets: many(jabatanTarget),
	matchScoreDetails: many(matchScoreDetail),
	nominasis: many(nominasi),
	notifikasis_dibuatOleh: many(notifikasi, {
		relationName: "notifikasi_dibuatOleh_users_id"
	}),
	notifikasis_userId: many(notifikasi, {
		relationName: "notifikasi_userId_users_id"
	}),
	pengaturanSistems: many(pengaturanSistem),
	permintaanResetPasswords_ditanganiOleh: many(permintaanResetPassword, {
		relationName: "permintaanResetPassword_ditanganiOleh_users_id"
	}),
	permintaanResetPasswords_userId: many(permintaanResetPassword, {
		relationName: "permintaanResetPassword_userId_users_id"
	}),
	rencanaPengembangans: many(rencanaPengembangan),
	sesis: many(sesi),
	syncLogs: many(syncLog),
	talentPools: many(talentPool),
	role: one(roles, {
		fields: [users.roleId],
		references: [roles.id]
	}),
	unitOrganisasi: one(unitOrganisasi, {
		fields: [users.unitOrganisasiId],
		references: [unitOrganisasi.id]
	}),
}));

export const approvalLogRelations = relations(approvalLog, ({one}) => ({
	user: one(users, {
		fields: [approvalLog.approverUserId],
		references: [users.id]
	}),
	nominasi: one(nominasi, {
		fields: [approvalLog.nominasiId],
		references: [nominasi.id]
	}),
}));

export const nominasiRelations = relations(nominasi, ({one, many}) => ({
	approvalLogs: many(approvalLog),
	talentPool: one(talentPool, {
		fields: [nominasi.talentPoolId],
		references: [talentPool.id]
	}),
	unitOrganisasi: one(unitOrganisasi, {
		fields: [nominasi.diajukanOlehUnitId],
		references: [unitOrganisasi.id]
	}),
	user: one(users, {
		fields: [nominasi.diajukanOlehUserId],
		references: [users.id]
	}),
}));

export const asesmenTalentaRelations = relations(asesmenTalenta, ({one}) => ({
	pegawai: one(pegawai, {
		fields: [asesmenTalenta.pegawaiId],
		references: [pegawai.id]
	}),
}));

export const pegawaiRelations = relations(pegawai, ({one, many}) => ({
	asesmenTalentas: many(asesmenTalenta),
	hukumanDisiplins: many(hukumanDisiplin),
	kinerjaPeriodes: many(kinerjaPeriode),
	matchScores: many(matchScore),
	jabatan: one(jabatan, {
		fields: [pegawai.jabatanId],
		references: [jabatan.id]
	}),
	riwayatJabatans: many(riwayatJabatan),
	riwayatPendidikans: many(riwayatPendidikan),
	talentPools: many(talentPool),
}));

export const auditLogRelations = relations(auditLog, ({one}) => ({
	user: one(users, {
		fields: [auditLog.userId],
		references: [users.id]
	}),
}));

export const hukumanDisiplinRelations = relations(hukumanDisiplin, ({one}) => ({
	user: one(users, {
		fields: [hukumanDisiplin.inputBy],
		references: [users.id]
	}),
	pegawai: one(pegawai, {
		fields: [hukumanDisiplin.pegawaiId],
		references: [pegawai.id]
	}),
}));

export const jabatanRelations = relations(jabatan, ({one, many}) => ({
	unitOrganisasi: one(unitOrganisasi, {
		fields: [jabatan.unitOrganisasiId],
		references: [unitOrganisasi.id]
	}),
	jabatanTargetAnggotas: many(jabatanTargetAnggota),
	pegawais: many(pegawai),
	riwayatJabatans: many(riwayatJabatan),
}));

export const unitOrganisasiRelations = relations(unitOrganisasi, ({one, many}) => ({
	jabatans: many(jabatan),
	nominasis: many(nominasi),
	unitOrganisasi: one(unitOrganisasi, {
		fields: [unitOrganisasi.parentId],
		references: [unitOrganisasi.id],
		relationName: "unitOrganisasi_parentId_unitOrganisasi_id"
	}),
	unitOrganisasis: many(unitOrganisasi, {
		relationName: "unitOrganisasi_parentId_unitOrganisasi_id"
	}),
	users: many(users),
}));

export const jabatanTargetRelations = relations(jabatanTarget, ({one, many}) => ({
	user: one(users, {
		fields: [jabatanTarget.dibuatOleh],
		references: [users.id]
	}),
	jabatanTargetAnggotas: many(jabatanTargetAnggota),
	jabatanTargetPersyaratans: many(jabatanTargetPersyaratan),
	matchScores: many(matchScore),
	rubrikKomponens: many(rubrikKomponen),
	talentPools: many(talentPool),
}));

export const jabatanTargetAnggotaRelations = relations(jabatanTargetAnggota, ({one}) => ({
	jabatan: one(jabatan, {
		fields: [jabatanTargetAnggota.jabatanId],
		references: [jabatan.id]
	}),
	jabatanTarget: one(jabatanTarget, {
		fields: [jabatanTargetAnggota.jabatanTargetId],
		references: [jabatanTarget.id]
	}),
}));

export const jabatanTargetPersyaratanRelations = relations(jabatanTargetPersyaratan, ({one}) => ({
	jabatanTarget: one(jabatanTarget, {
		fields: [jabatanTargetPersyaratan.jabatanTargetId],
		references: [jabatanTarget.id]
	}),
}));

export const kinerjaPeriodeRelations = relations(kinerjaPeriode, ({one}) => ({
	pegawai: one(pegawai, {
		fields: [kinerjaPeriode.pegawaiId],
		references: [pegawai.id]
	}),
}));

export const matchScoreRelations = relations(matchScore, ({one, many}) => ({
	pegawai: one(pegawai, {
		fields: [matchScore.pegawaiId],
		references: [pegawai.id]
	}),
	jabatanTarget: one(jabatanTarget, {
		fields: [matchScore.jabatanTargetId],
		references: [jabatanTarget.id]
	}),
	matchScoreDetails: many(matchScoreDetail),
	talentPools: many(talentPool),
}));

export const matchScoreDetailRelations = relations(matchScoreDetail, ({one}) => ({
	user: one(users, {
		fields: [matchScoreDetail.diisiOleh],
		references: [users.id]
	}),
	rubrikIndikator_rubrikIndikatorId: one(rubrikIndikator, {
		fields: [matchScoreDetail.rubrikIndikatorId],
		references: [rubrikIndikator.id],
		relationName: "matchScoreDetail_rubrikIndikatorId_rubrikIndikator_id"
	}),
	matchScore: one(matchScore, {
		fields: [matchScoreDetail.matchScoreId],
		references: [matchScore.id]
	}),
	rubrikIndikator_parentIndikatorId: one(rubrikIndikator, {
		fields: [matchScoreDetail.parentIndikatorId],
		references: [rubrikIndikator.id],
		relationName: "matchScoreDetail_parentIndikatorId_rubrikIndikator_id"
	}),
}));

export const rubrikIndikatorRelations = relations(rubrikIndikator, ({one, many}) => ({
	matchScoreDetails_rubrikIndikatorId: many(matchScoreDetail, {
		relationName: "matchScoreDetail_rubrikIndikatorId_rubrikIndikator_id"
	}),
	matchScoreDetails_parentIndikatorId: many(matchScoreDetail, {
		relationName: "matchScoreDetail_parentIndikatorId_rubrikIndikator_id"
	}),
	rubrikKomponen: one(rubrikKomponen, {
		fields: [rubrikIndikator.rubrikKomponenId],
		references: [rubrikKomponen.id]
	}),
	rubrikIndikator: one(rubrikIndikator, {
		fields: [rubrikIndikator.parentIndikatorId],
		references: [rubrikIndikator.id],
		relationName: "rubrikIndikator_parentIndikatorId_rubrikIndikator_id"
	}),
	rubrikIndikators: many(rubrikIndikator, {
		relationName: "rubrikIndikator_parentIndikatorId_rubrikIndikator_id"
	}),
	rubrikKategoriSkors: many(rubrikKategoriSkor),
}));

export const talentPoolRelations = relations(talentPool, ({one, many}) => ({
	nominasis: many(nominasi),
	rencanaPengembangans: many(rencanaPengembangan),
	user: one(users, {
		fields: [talentPool.ditetapkanOleh],
		references: [users.id]
	}),
	pegawai: one(pegawai, {
		fields: [talentPool.pegawaiId],
		references: [pegawai.id]
	}),
	matchScore: one(matchScore, {
		fields: [talentPool.matchScoreId],
		references: [matchScore.id]
	}),
	jabatanTarget: one(jabatanTarget, {
		fields: [talentPool.jabatanTargetId],
		references: [jabatanTarget.id]
	}),
}));

export const notifikasiRelations = relations(notifikasi, ({one}) => ({
	user_dibuatOleh: one(users, {
		fields: [notifikasi.dibuatOleh],
		references: [users.id],
		relationName: "notifikasi_dibuatOleh_users_id"
	}),
	user_userId: one(users, {
		fields: [notifikasi.userId],
		references: [users.id],
		relationName: "notifikasi_userId_users_id"
	}),
}));

export const pengaturanSistemRelations = relations(pengaturanSistem, ({one}) => ({
	user: one(users, {
		fields: [pengaturanSistem.diubahOleh],
		references: [users.id]
	}),
}));

export const permintaanResetPasswordRelations = relations(permintaanResetPassword, ({one}) => ({
	user_ditanganiOleh: one(users, {
		fields: [permintaanResetPassword.ditanganiOleh],
		references: [users.id],
		relationName: "permintaanResetPassword_ditanganiOleh_users_id"
	}),
	user_userId: one(users, {
		fields: [permintaanResetPassword.userId],
		references: [users.id],
		relationName: "permintaanResetPassword_userId_users_id"
	}),
}));

export const rencanaPengembanganRelations = relations(rencanaPengembangan, ({one}) => ({
	user: one(users, {
		fields: [rencanaPengembangan.dibuatOleh],
		references: [users.id]
	}),
	talentPool: one(talentPool, {
		fields: [rencanaPengembangan.talentPoolId],
		references: [talentPool.id]
	}),
}));

export const riwayatJabatanRelations = relations(riwayatJabatan, ({one}) => ({
	jabatan: one(jabatan, {
		fields: [riwayatJabatan.jabatanId],
		references: [jabatan.id]
	}),
	pegawai: one(pegawai, {
		fields: [riwayatJabatan.pegawaiId],
		references: [pegawai.id]
	}),
}));

export const riwayatPendidikanRelations = relations(riwayatPendidikan, ({one}) => ({
	pegawai: one(pegawai, {
		fields: [riwayatPendidikan.pegawaiId],
		references: [pegawai.id]
	}),
}));

export const rubrikKomponenRelations = relations(rubrikKomponen, ({one, many}) => ({
	rubrikIndikators: many(rubrikIndikator),
	jabatanTarget: one(jabatanTarget, {
		fields: [rubrikKomponen.jabatanTargetId],
		references: [jabatanTarget.id]
	}),
}));

export const rubrikKategoriSkorRelations = relations(rubrikKategoriSkor, ({one}) => ({
	rubrikIndikator: one(rubrikIndikator, {
		fields: [rubrikKategoriSkor.rubrikIndikatorId],
		references: [rubrikIndikator.id]
	}),
}));

export const sesiRelations = relations(sesi, ({one}) => ({
	user: one(users, {
		fields: [sesi.userId],
		references: [users.id]
	}),
}));

export const syncLogRelations = relations(syncLog, ({one}) => ({
	user: one(users, {
		fields: [syncLog.dijalankanOleh],
		references: [users.id]
	}),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	users: many(users),
}));