import { mysqlTable, mysqlSchema, AnyMySqlColumn, index, foreignKey, primaryKey, bigint, varchar, smallint, int, datetime, unique, mysqlEnum, json, text, check, year, decimal, tinyint, date, char } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const apiActivityLog = mysqlTable("api_activity_log", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	apiClientId: bigint("api_client_id", { mode: "number", unsigned: true }).notNull().references(() => apiClient.id, { onDelete: "cascade" } ),
	apiTokenId: bigint("api_token_id", { mode: "number", unsigned: true }).references(() => apiToken.id, { onDelete: "set null" } ),
	endpoint: varchar({ length: 200 }).notNull(),
	method: varchar({ length: 10 }).notNull(),
	responseCode: smallint("response_code", { unsigned: true }).notNull(),
	responseTimeMs: int("response_time_ms", { unsigned: true }),
	ipAddress: varchar("ip_address", { length: 45 }),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_api_activity_client_time").on(table.apiClientId, table.createdAt),
	primaryKey({ columns: [table.id], name: "api_activity_log_id"}),
]);

export const apiClient = mysqlTable("api_client", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	namaInstansi: varchar("nama_instansi", { length: 200 }).notNull(),
	kodeInstansi: varchar("kode_instansi", { length: 40 }).notNull(),
	contactPerson: varchar("contact_person", { length: 150 }),
	email: varchar({ length: 150 }),
	noMou: varchar("no_mou", { length: 100 }),
	status: mysqlEnum(['AKTIF','NONAKTIF','PENDING']).default('PENDING').notNull(),
	scopeAkses: json("scope_akses"),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "api_client_id"}),
	unique("uk_api_client_kode").on(table.kodeInstansi),
]);

export const apiToken = mysqlTable("api_token", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	apiClientId: bigint("api_client_id", { mode: "number", unsigned: true }).notNull().references(() => apiClient.id, { onDelete: "cascade" } ),
	tokenHash: varchar("token_hash", { length: 255 }).notNull(),
	label: varchar({ length: 100 }),
	expiredAt: datetime("expired_at", { mode: 'string'}),
	lastUsedAt: datetime("last_used_at", { mode: 'string'}),
	status: mysqlEnum(['AKTIF','DICABUT']).default('AKTIF').notNull(),
	createdBy: bigint("created_by", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_api_token_client").on(table.apiClientId),
	primaryKey({ columns: [table.id], name: "api_token_id"}),
	unique("uk_api_token_hash").on(table.tokenHash),
]);

export const approvalLog = mysqlTable("approval_log", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	nominasiId: bigint("nominasi_id", { mode: "number", unsigned: true }).notNull().references(() => nominasi.id, { onDelete: "cascade" } ),
	tahap: varchar({ length: 100 }).notNull(),
	status: mysqlEnum(['MENUNGGU','DISETUJUI','DITOLAK','REVISI']).notNull(),
	approverUserId: bigint("approver_user_id", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	catatan: text(),
	tanggalAksi: datetime("tanggal_aksi", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_approval_log_nominasi").on(table.nominasiId),
	primaryKey({ columns: [table.id], name: "approval_log_id"}),
]);

export const asesmenTalenta = mysqlTable("asesmen_talenta", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	pegawaiId: bigint("pegawai_id", { mode: "number", unsigned: true }).notNull().references(() => pegawai.id, { onDelete: "cascade" } ),
	tahunAsesmen: year("tahun_asesmen").notNull(),
	jenisAsesmen: varchar("jenis_asesmen", { length: 60 }).notNull(),
	statusAsesmen: mysqlEnum("status_asesmen", ['Berlaku','Expired','Draft']).default('Berlaku').notNull(),
	nilaiKinerjaY: decimal("nilai_kinerja_y", { precision: 6, scale: 2 }).notNull(),
	nilaiPotensialX: decimal("nilai_potensial_x", { precision: 6, scale: 2 }).notNull(),
	potkom: decimal({ precision: 6, scale: 2 }).notNull(),
	nilaiIntegritas: decimal("nilai_integritas", { precision: 6, scale: 2 }),
	nilaiTalenta: decimal("nilai_talenta", { precision: 6, scale: 2 }).notNull(),
	kotak9: tinyint("kotak_9", { unsigned: true }).notNull(),
	kotak9Sumber: tinyint("kotak_9_sumber", { unsigned: true }),
	tahunKinerja: year("tahun_kinerja"),
	ratingKinerja: mysqlEnum("rating_kinerja", ['Sangat Baik','Baik','Butuh Perbaikan','Kurang','Sangat Kurang']).notNull(),
	sumberSync: mysqlEnum("sumber_sync", ['eNominasi','manual','recalculated']).default('eNominasi').notNull(),
	updatedAt: datetime("updated_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_asesmen_pegawai").on(table.pegawaiId, table.tahunAsesmen),
	primaryKey({ columns: [table.id], name: "asesmen_talenta_id"}),
	check("chk_asesmen_kotak9", sql`(\`kotak_9\` between 1 and 9)`),
]);

export const auditLog = mysqlTable("audit_log", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	userId: bigint("user_id", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	aksi: varchar({ length: 60 }).notNull(),
	entitas: varchar({ length: 60 }).notNull(),
	entitasId: bigint("entitas_id", { mode: "number", unsigned: true }),
	dataSebelum: json("data_sebelum"),
	dataSesudah: json("data_sesudah"),
	ipAddress: varchar("ip_address", { length: 45 }),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_audit_entitas").on(table.entitas, table.entitasId),
	index("idx_audit_user").on(table.userId),
	index("idx_audit_waktu").on(table.createdAt, table.id),
	index("idx_audit_aksi").on(table.aksi, table.createdAt),
	primaryKey({ columns: [table.id], name: "audit_log_id"}),
]);

export const hukumanDisiplin = mysqlTable("hukuman_disiplin", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	pegawaiId: bigint("pegawai_id", { mode: "number", unsigned: true }).notNull().references(() => pegawai.id, { onDelete: "cascade" } ),
	tingkatHukuman: mysqlEnum("tingkat_hukuman", ['Tidak Pernah','Ringan','Sedang','Berat','Sedang Menjalani']).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	tanggalSk: date("tanggal_sk", { mode: 'string' }),
	noSk: varchar("no_sk", { length: 80 }),
	keterangan: text(),
	statusAktif: tinyint("status_aktif").default(1).notNull(),
	inputBy: bigint("input_by", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_hukuman_pegawai").on(table.pegawaiId),
	primaryKey({ columns: [table.id], name: "hukuman_disiplin_id"}),
]);

export const jabatan = mysqlTable("jabatan", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	kodeJabatan: varchar("kode_jabatan", { length: 40 }).notNull(),
	namaJabatan: varchar("nama_jabatan", { length: 250 }).notNull(),
	unitOrganisasiId: bigint("unit_organisasi_id", { mode: "number", unsigned: true }).notNull().references(() => unitOrganisasi.id),
	jenisJabatan: mysqlEnum("jenis_jabatan", ['STRUKTURAL','FUNGSIONAL_TERTENTU','FUNGSIONAL_UMUM']).notNull(),
	jenjang: varchar({ length: 60 }).notNull(),
	eselon: mysqlEnum(['I','II','III','IV','NON_ESELON']).notNull(),
	statusJabatan: mysqlEnum("status_jabatan", ['TERISI','KOSONG','DIHAPUS']).default('TERISI').notNull(),
	updatedAt: datetime("updated_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_jabatan_unit").on(table.unitOrganisasiId),
	index("idx_jabatan_status").on(table.statusJabatan),
	primaryKey({ columns: [table.id], name: "jabatan_id"}),
	unique("uk_jabatan_kode").on(table.kodeJabatan),
]);

export const jabatanTarget = mysqlTable("jabatan_target", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	kodeTarget: varchar("kode_target", { length: 40 }).notNull(),
	namaTarget: varchar("nama_target", { length: 250 }).notNull(),
	deskripsi: text(),
	kataKunciRelevansi: json("kata_kunci_relevansi"),
	status: mysqlEnum(['DRAFT','AKTIF','NONAKTIF']).default('DRAFT').notNull(),
	dibuatOleh: bigint("dibuat_oleh", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	updatedAt: datetime("updated_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "jabatan_target_id"}),
	unique("uk_jabatan_target_kode").on(table.kodeTarget),
]);

export const jabatanTargetAnggota = mysqlTable("jabatan_target_anggota", {
	jabatanTargetId: bigint("jabatan_target_id", { mode: "number", unsigned: true }).notNull().references(() => jabatanTarget.id, { onDelete: "cascade" } ),
	jabatanId: bigint("jabatan_id", { mode: "number", unsigned: true }).notNull().references(() => jabatan.id, { onDelete: "cascade" } ),
},
(table) => [
	index("idx_jta_jabatan").on(table.jabatanId),
	primaryKey({ columns: [table.jabatanTargetId, table.jabatanId], name: "jabatan_target_anggota_jabatan_target_id_jabatan_id"}),
]);

export const jabatanTargetPersyaratan = mysqlTable("jabatan_target_persyaratan", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	jabatanTargetId: bigint("jabatan_target_id", { mode: "number", unsigned: true }).notNull().references(() => jabatanTarget.id, { onDelete: "cascade" } ),
	jenisSyarat: mysqlEnum("jenis_syarat", ['PENDIDIKAN_MIN','BIDANG_ILMU','PENGALAMAN_MIN','LAINNYA']).notNull(),
	deskripsi: text().notNull(),
	nilaiMinimal: varchar("nilai_minimal", { length: 60 }),
},
(table) => [
	index("idx_jtp_target").on(table.jabatanTargetId),
	primaryKey({ columns: [table.id], name: "jabatan_target_persyaratan_id"}),
]);

export const kinerjaPeriode = mysqlTable("kinerja_periode", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	pegawaiId: bigint("pegawai_id", { mode: "number", unsigned: true }).notNull().references(() => pegawai.id, { onDelete: "cascade" } ),
	tahun: year().notNull(),
	periodeSkp: mysqlEnum("periode_skp", ['TW1','TW2','TW3','TAHUNAN']).notNull(),
	nilaiKinerja: decimal("nilai_kinerja", { precision: 5, scale: 2 }),
	nilaiPerilaku: decimal("nilai_perilaku", { precision: 5, scale: 2 }),
	predikat: mysqlEnum(['Sangat Baik','Baik','Butuh Perbaikan','Kurang','Sangat Kurang']).notNull(),
	sumberSync: varchar("sumber_sync", { length: 30 }).default('eKinerja').notNull(),
	syncedAt: datetime("synced_at", { mode: 'string'}),
},
(table) => [
	index("idx_kinerja_periode_pegawai").on(table.pegawaiId, table.tahun),
	primaryKey({ columns: [table.id], name: "kinerja_periode_id"}),
]);

export const masterKategoriRiwayatDiklat = mysqlTable("master_kategori_riwayat_diklat", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	kode: varchar({ length: 60 }).notNull(),
	nama: varchar({ length: 150 }).notNull(),
	jenis: mysqlEnum(['MANAJERIAL','TEKNIS','FUNGSIONAL','SOSIAL_KULTURAL']).notNull(),
	parentId: bigint("parent_id", { mode: "number", unsigned: true }),
	setaraJenjang: mysqlEnum("setara_jenjang", ['II','III','IV']),
	polaCocok: json("pola_cocok"),
	keterangan: varchar({ length: 500 }),
	urutan: smallint({ unsigned: true }).notNull(),
	aktif: tinyint().default(1).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	updatedAt: datetime("updated_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_mkrd_jenis").on(table.jenis),
	index("idx_mkrd_parent").on(table.parentId),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "fk_mkrd_parent"
		}).onDelete("set null"),
	primaryKey({ columns: [table.id], name: "master_kategori_riwayat_diklat_id"}),
	unique("uk_mkrd_kode").on(table.kode),
]);

export const matchScore = mysqlTable("match_score", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	pegawaiId: bigint("pegawai_id", { mode: "number", unsigned: true }).notNull().references(() => pegawai.id, { onDelete: "cascade" } ),
	jabatanTargetId: bigint("jabatan_target_id", { mode: "number", unsigned: true }).notNull().references(() => jabatanTarget.id, { onDelete: "cascade" } ),
	skorPotensiKompetensi: decimal("skor_potensi_kompetensi", { precision: 6, scale: 2 }).notNull(),
	skorKualifikasiJabatan: decimal("skor_kualifikasi_jabatan", { precision: 6, scale: 2 }).notNull(),
	skorIntegritasMoralitas: decimal("skor_integritas_moralitas", { precision: 6, scale: 2 }).notNull(),
	skorTotal: decimal("skor_total", { precision: 6, scale: 2 }).notNull(),
	eligible: tinyint().default(0).notNull(),
	catatanEligibility: text("catatan_eligibility"),
	rubrikSnapshot: json("rubrik_snapshot"),
	computedAt: datetime("computed_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_match_score_pegawai").on(table.pegawaiId),
	index("idx_match_score_target").on(table.jabatanTargetId),
	primaryKey({ columns: [table.id], name: "match_score_id"}),
	unique("uk_match_score_pegawai_target").on(table.pegawaiId, table.jabatanTargetId),
]);

export const matchScoreDetail = mysqlTable("match_score_detail", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	matchScoreId: bigint("match_score_id", { mode: "number", unsigned: true }).notNull().references(() => matchScore.id, { onDelete: "cascade" } ),
	rubrikIndikatorId: bigint("rubrik_indikator_id", { mode: "number", unsigned: true }).notNull().references(() => rubrikIndikator.id, { onDelete: "cascade" } ),
	parentIndikatorId: bigint("parent_indikator_id", { mode: "number", unsigned: true }).references(() => rubrikIndikator.id, { onDelete: "set null" } ),
	bobotIndikator: decimal("bobot_indikator", { precision: 5, scale: 4 }),
	nilaiMentah: varchar("nilai_mentah", { length: 255 }),
	kategoriTerpilih: varchar("kategori_terpilih", { length: 300 }),
	skor: decimal({ precision: 6, scale: 2 }).notNull(),
	sumberNilai: mysqlEnum("sumber_nilai", ['OTOMATIS','MANUAL']).default('OTOMATIS').notNull(),
	perluReview: tinyint("perlu_review").default(0).notNull(),
	catatan: text(),
	diisiOleh: bigint("diisi_oleh", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_msd_match_score").on(table.matchScoreId),
	index("idx_msd_indikator").on(table.rubrikIndikatorId),
	index("idx_msd_review").on(table.perluReview),
	primaryKey({ columns: [table.id], name: "match_score_detail_id"}),
	unique("uk_msd_skor_indikator").on(table.matchScoreId, table.rubrikIndikatorId),
]);

export const nominasi = mysqlTable("nominasi", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	talentPoolId: bigint("talent_pool_id", { mode: "number", unsigned: true }).notNull().references(() => talentPool.id, { onDelete: "cascade" } ),
	diajukanOlehUnitId: bigint("diajukan_oleh_unit_id", { mode: "number", unsigned: true }).notNull().references(() => unitOrganisasi.id),
	diajukanOlehUserId: bigint("diajukan_oleh_user_id", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	tanggalDiajukan: date("tanggal_diajukan", { mode: 'string' }).notNull(),
	status: mysqlEnum(['DIAJUKAN','MENUNGGU_VERIFIKASI','DISETUJUI','DITOLAK']).default('DIAJUKAN').notNull(),
	catatan: text(),
},
(table) => [
	index("idx_nominasi_pool").on(table.talentPoolId),
	index("idx_nominasi_unit").on(table.diajukanOlehUnitId),
	primaryKey({ columns: [table.id], name: "nominasi_id"}),
]);

export const notifikasi = mysqlTable("notifikasi", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" } ),
	peranTujuan: varchar("peran_tujuan", { length: 40 }),
	jenis: mysqlEnum(['NOMINASI_MASUK','NOMINASI_REVISI','NOMINASI_DISETUJUI','NOMINASI_DITOLAK','MENUNGGU_PENETAPAN','SUKSESOR_DITETAPKAN','PENETAPAN_DIBATALKAN']).notNull(),
	judul: varchar({ length: 200 }).notNull(),
	pesan: text().notNull(),
	tautan: varchar({ length: 300 }),
	entitas: varchar({ length: 50 }),
	entitasId: bigint("entitas_id", { mode: "number", unsigned: true }),
	dibacaPada: datetime("dibaca_pada", { mode: 'string'}),
	dibuatOleh: bigint("dibuat_oleh", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_notifikasi_user").on(table.userId, table.dibacaPada, table.id),
	index("idx_notifikasi_entitas").on(table.entitas, table.entitasId),
	primaryKey({ columns: [table.id], name: "notifikasi_id"}),
]);

export const pegawai = mysqlTable("pegawai", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	nip: varchar({ length: 20 }).notNull(),
	namaLengkap: varchar("nama_lengkap", { length: 150 }).notNull(),
	golongan: varchar({ length: 10 }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	tmtGolongan: date("tmt_golongan", { mode: 'string' }),
	pangkat: varchar({ length: 60 }).notNull(),
	jabatanId: bigint("jabatan_id", { mode: "number", unsigned: true }).references(() => jabatan.id, { onDelete: "set null" } ),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	tmtJabatan: date("tmt_jabatan", { mode: 'string' }),
	sekolahTerakhir: varchar("sekolah_terakhir", { length: 200 }),
	bidangStudiTerakhir: varchar("bidang_studi_terakhir", { length: 200 }),
	tingkatPendidikan: mysqlEnum("tingkat_pendidikan", ['SLTA','D3','S1_D4','S2','S3']).notNull(),
	statusAktif: mysqlEnum("status_aktif", ['AKTIF','PENSIUN','MUTASI_KELUAR','NONAKTIF']).default('AKTIF').notNull(),
	sumberSinkron: mysqlEnum("sumber_sinkron", ['eHRM','eNominasi','manual']).default('manual').notNull(),
	lastSyncedAt: datetime("last_synced_at", { mode: 'string'}),
	riwayatDiklat: json("riwayat_diklat"),
	riwayatDivalidasiOleh: bigint("riwayat_divalidasi_oleh", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	riwayatDivalidasiPada: datetime("riwayat_divalidasi_pada", { mode: 'string'}),
	riwayatCatatanValidasi: varchar("riwayat_catatan_validasi", { length: 500 }),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	updatedAt: datetime("updated_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_pegawai_jabatan").on(table.jabatanId),
	index("idx_pegawai_riwayat_validasi").on(table.riwayatDivalidasiPada),
	primaryKey({ columns: [table.id], name: "pegawai_id"}),
	unique("uk_pegawai_nip").on(table.nip),
]);

export const pemetaanDiklat = mysqlTable("pemetaan_diklat", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	namaNormal: varchar("nama_normal", { length: 300 }).notNull(),
	namaMentah: varchar("nama_mentah", { length: 300 }).notNull(),
	kategoriId: bigint("kategori_id", { mode: "number", unsigned: true }).references(() => masterKategoriRiwayatDiklat.id, { onDelete: "set null" } ),
	status: mysqlEnum(['USULAN','TERVALIDASI','DITOLAK']).default('USULAN').notNull(),
	divalidasiOleh: bigint("divalidasi_oleh", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	divalidasiPada: datetime("divalidasi_pada", { mode: 'string'}),
	catatan: varchar({ length: 500 }),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	updatedAt: datetime("updated_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_pemetaan_diklat_kategori").on(table.kategoriId),
	index("idx_pemetaan_diklat_status").on(table.status),
	primaryKey({ columns: [table.id], name: "pemetaan_diklat_id"}),
	unique("uk_pemetaan_diklat_nama").on(table.namaNormal),
]);

export const pengaturanSistem = mysqlTable("pengaturan_sistem", {
	kunci: varchar({ length: 60 }).notNull(),
	nilai: varchar({ length: 255 }).notNull(),
	tipe: mysqlEnum(['ANGKA','TEKS','BOOLEAN']).default('TEKS').notNull(),
	label: varchar({ length: 150 }).notNull(),
	deskripsi: text(),
	nilaiMin: int("nilai_min"),
	nilaiMax: int("nilai_max"),
	diubahOleh: bigint("diubah_oleh", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	diubahPada: datetime("diubah_pada", { mode: 'string'}),
},
(table) => [
	primaryKey({ columns: [table.kunci], name: "pengaturan_sistem_kunci"}),
]);

export const permintaanResetPassword = mysqlTable("permintaan_reset_password", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	email: varchar({ length: 150 }).notNull(),
	userId: bigint("user_id", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "cascade" } ),
	ipAddress: varchar("ip_address", { length: 45 }),
	ditanganiPada: datetime("ditangani_pada", { mode: 'string'}),
	ditanganiOleh: bigint("ditangani_oleh", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	catatan: varchar({ length: 255 }),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_reset_belum_ditangani").on(table.ditanganiPada, table.id),
	index("idx_reset_user").on(table.userId),
	primaryKey({ columns: [table.id], name: "permintaan_reset_password_id"}),
]);

export const rencanaPengembangan = mysqlTable("rencana_pengembangan", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	talentPoolId: bigint("talent_pool_id", { mode: "number", unsigned: true }).notNull().references(() => talentPool.id, { onDelete: "cascade" } ),
	jenisPengembangan: mysqlEnum("jenis_pengembangan", ['DIKLAT','ROTASI','MENTORING','PENUGASAN']).notNull(),
	deskripsi: text().notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	targetSelesai: date("target_selesai", { mode: 'string' }),
	status: mysqlEnum(['DIRENCANAKAN','BERJALAN','SELESAI']).default('DIRENCANAKAN').notNull(),
	dibuatOleh: bigint("dibuat_oleh", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_rp_pool").on(table.talentPoolId),
	primaryKey({ columns: [table.id], name: "rencana_pengembangan_id"}),
]);

export const riwayatJabatan = mysqlTable("riwayat_jabatan", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	pegawaiId: bigint("pegawai_id", { mode: "number", unsigned: true }).notNull().references(() => pegawai.id, { onDelete: "cascade" } ),
	urutan: smallint({ unsigned: true }).notNull(),
	jabatanNamaMentah: varchar("jabatan_nama_mentah", { length: 500 }).notNull(),
	jabatanId: bigint("jabatan_id", { mode: "number", unsigned: true }).references(() => jabatan.id, { onDelete: "set null" } ),
	jenisPenugasan: mysqlEnum("jenis_penugasan", ['DEFINITIF','PLT','PLH']),
	relevanSubstansi: tinyint("relevan_substansi"),
	unitKerjaMentah: varchar("unit_kerja_mentah", { length: 500 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	tanggalMulai: date("tanggal_mulai", { mode: 'string' }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	tanggalAkhir: date("tanggal_akhir", { mode: 'string' }),
	noSk: varchar("no_sk", { length: 80 }),
	urlArsipDigital: varchar("url_arsip_digital", { length: 500 }),
	divalidasiOleh: bigint("divalidasi_oleh", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	divalidasiPada: datetime("divalidasi_pada", { mode: 'string'}),
},
(table) => [
	index("idx_riwayat_jabatan_pegawai").on(table.pegawaiId),
	index("idx_riwayat_jabatan_jabatan").on(table.jabatanId),
	index("idx_riwayat_jabatan_penugasan").on(table.jenisPenugasan),
	primaryKey({ columns: [table.id], name: "riwayat_jabatan_id"}),
]);

export const riwayatPendidikan = mysqlTable("riwayat_pendidikan", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	pegawaiId: bigint("pegawai_id", { mode: "number", unsigned: true }).notNull().references(() => pegawai.id, { onDelete: "cascade" } ),
	urutan: smallint({ unsigned: true }).notNull(),
	jenjangPendidikan: mysqlEnum("jenjang_pendidikan", ['SLTA','D3','S1_D4','S2','S3']).notNull(),
	bidangStudi: varchar("bidang_studi", { length: 200 }).notNull(),
	namaSekolah: varchar("nama_sekolah", { length: 200 }),
	tahunLulus: year("tahun_lulus"),
	urlIjazah: varchar("url_ijazah", { length: 500 }),
	urlTranskrip: varchar("url_transkrip", { length: 500 }),
	noPertekBkn: varchar("no_pertek_bkn", { length: 80 }),
	updatedAt: datetime("updated_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_riwayat_pendidikan_pegawai").on(table.pegawaiId),
	primaryKey({ columns: [table.id], name: "riwayat_pendidikan_id"}),
]);

export const roles = mysqlTable("roles", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	namaRole: varchar("nama_role", { length: 60 }).notNull(),
	deskripsi: text(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "roles_id"}),
	unique("uk_role_nama").on(table.namaRole),
]);

export const rubrikIndikator = mysqlTable("rubrik_indikator", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	rubrikKomponenId: bigint("rubrik_komponen_id", { mode: "number", unsigned: true }).notNull().references(() => rubrikKomponen.id, { onDelete: "cascade" } ),
	parentIndikatorId: bigint("parent_indikator_id", { mode: "number", unsigned: true }),
	namaIndikator: varchar("nama_indikator", { length: 200 }).notNull(),
	kunciSistem: mysqlEnum("kunci_sistem", ['PREDIKAT_KINERJA','POTKOM','TINGKAT_PENDIDIKAN','KESESUAIAN_BIDANG_ILMU','PENGEMBANGAN_KOMPETENSI','LAMA_JABATAN','KERAGAMAN_JABATAN','SUBSTANSI_JABATAN','INTEGRITAS']),
	bobotIndikator: decimal("bobot_indikator", { precision: 5, scale: 4 }),
	modeSkor: mysqlEnum("mode_skor", ['KATEGORI_TETAP','NILAI_LANGSUNG']).default('KATEGORI_TETAP').notNull(),
	kebutuhanData: text("kebutuhan_data"),
	sumberData: varchar("sumber_data", { length: 200 }),
	urutan: smallint({ unsigned: true }).default(1).notNull(),
},
(table) => [
	index("idx_ri_komponen").on(table.rubrikKomponenId),
	index("idx_ri_parent").on(table.parentIndikatorId),
	index("idx_ri_kunci").on(table.kunciSistem),
	foreignKey({
			columns: [table.parentIndikatorId],
			foreignColumns: [table.id],
			name: "fk_ri_parent"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.id], name: "rubrik_indikator_id"}),
]);

export const rubrikKategoriSkor = mysqlTable("rubrik_kategori_skor", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	rubrikIndikatorId: bigint("rubrik_indikator_id", { mode: "number", unsigned: true }).notNull().references(() => rubrikIndikator.id, { onDelete: "cascade" } ),
	namaKategori: varchar("nama_kategori", { length: 300 }).notNull(),
	nilaiSkor: decimal("nilai_skor", { precision: 6, scale: 2 }),
	ambangMin: decimal("ambang_min", { precision: 6, scale: 2 }),
	ambangMax: decimal("ambang_max", { precision: 6, scale: 2 }),
	urutan: smallint({ unsigned: true }).default(1).notNull(),
},
(table) => [
	index("idx_rks_indikator").on(table.rubrikIndikatorId),
	primaryKey({ columns: [table.id], name: "rubrik_kategori_skor_id"}),
]);

export const rubrikKomponen = mysqlTable("rubrik_komponen", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	jabatanTargetId: bigint("jabatan_target_id", { mode: "number", unsigned: true }).references(() => jabatanTarget.id, { onDelete: "cascade" } ),
	sumbu: mysqlEnum(['Y_KINERJA','X_POTENSIAL']).notNull(),
	namaKomponen: varchar("nama_komponen", { length: 150 }).notNull(),
	bobotKomponen: decimal("bobot_komponen", { precision: 5, scale: 4 }).notNull(),
	urutan: smallint({ unsigned: true }).default(1).notNull(),
},
(table) => [
	index("idx_rk_target").on(table.jabatanTargetId),
	primaryKey({ columns: [table.id], name: "rubrik_komponen_id"}),
	check("chk_rk_bobot", sql`((\`bobot_komponen\` >= 0) and (\`bobot_komponen\` <= 1))`),
]);

export const sesi = mysqlTable("sesi", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" } ),
	tokenHash: char("token_hash", { length: 64 }).notNull(),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: varchar("user_agent", { length: 255 }),
	terakhirAktifPada: datetime("terakhir_aktif_pada", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	kedaluwarsaPada: datetime("kedaluwarsa_pada", { mode: 'string'}).notNull(),
	dicabutPada: datetime("dicabut_pada", { mode: 'string'}),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_sesi_user").on(table.userId, table.dicabutPada),
	primaryKey({ columns: [table.id], name: "sesi_id"}),
	unique("uk_sesi_token").on(table.tokenHash),
]);

export const syncLog = mysqlTable("sync_log", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	sumberSistem: mysqlEnum("sumber_sistem", ['eHRM','eNominasi','eKinerja','Manual']).notNull(),
	jenisData: varchar("jenis_data", { length: 100 }).notNull(),
	status: mysqlEnum(['SUKSES','GAGAL','SEBAGIAN']).notNull(),
	jumlahBaris: int("jumlah_baris", { unsigned: true }),
	mulaiPada: datetime("mulai_pada", { mode: 'string'}).notNull(),
	selesaiPada: datetime("selesai_pada", { mode: 'string'}),
	catatanError: text("catatan_error"),
	dijalankanOleh: bigint("dijalankan_oleh", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sync_log_id"}),
]);

export const talentPool = mysqlTable("talent_pool", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	pegawaiId: bigint("pegawai_id", { mode: "number", unsigned: true }).notNull().references(() => pegawai.id, { onDelete: "cascade" } ),
	jabatanTargetId: bigint("jabatan_target_id", { mode: "number", unsigned: true }).notNull().references(() => jabatanTarget.id, { onDelete: "cascade" } ),
	matchScoreId: bigint("match_score_id", { mode: "number", unsigned: true }).references(() => matchScore.id, { onDelete: "set null" } ),
	ranking: int({ unsigned: true }),
	status: mysqlEnum(['KANDIDAT','DINOMINASIKAN','DIVERIFIKASI','DITETAPKAN','DITOLAK']).default('KANDIDAT').notNull(),
	catatanReviewer: text("catatan_reviewer"),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	ditetapkanPada: date("ditetapkan_pada", { mode: 'string' }),
	ditetapkanOleh: bigint("ditetapkan_oleh", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	updatedAt: datetime("updated_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_talent_pool_target_status").on(table.jabatanTargetId, table.status),
	primaryKey({ columns: [table.id], name: "talent_pool_id"}),
	unique("uk_talent_pool_pegawai_target").on(table.pegawaiId, table.jabatanTargetId),
]);

export const unitOrganisasi = mysqlTable("unit_organisasi", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	kodeUnit: varchar("kode_unit", { length: 30 }).notNull(),
	namaUnit: varchar("nama_unit", { length: 200 }).notNull(),
	parentId: bigint("parent_id", { mode: "number", unsigned: true }),
	jenis: mysqlEnum(['DITJEN','SEKRETARIAT','DIREKTORAT','BALAI','BP2JK','SUBDIT','BAGIAN','SEKSI']).notNull(),
	levelEselon: tinyint("level_eselon", { unsigned: true }),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
	updatedAt: datetime("updated_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_unit_parent").on(table.parentId),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "fk_unit_parent"
		}).onDelete("set null"),
	primaryKey({ columns: [table.id], name: "unit_organisasi_id"}),
	unique("uk_unit_kode").on(table.kodeUnit),
]);

export const users = mysqlTable("users", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	nama: varchar({ length: 150 }).notNull(),
	email: varchar({ length: 150 }).notNull(),
	username: varchar({ length: 60 }).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	harusGantiSandi: tinyint("harus_ganti_sandi").default(0).notNull(),
	passwordDiubahPada: datetime("password_diubah_pada", { mode: 'string'}),
	roleId: bigint("role_id", { mode: "number", unsigned: true }).notNull().references(() => roles.id),
	unitOrganisasiId: bigint("unit_organisasi_id", { mode: "number", unsigned: true }).references(() => unitOrganisasi.id, { onDelete: "set null" } ),
	statusAktif: tinyint("status_aktif").default(1).notNull(),
	lastLoginAt: datetime("last_login_at", { mode: 'string'}),
	gagalMasukBeruntun: smallint("gagal_masuk_beruntun", { unsigned: true }).notNull(),
	terkunciSampai: datetime("terkunci_sampai", { mode: 'string'}),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	index("idx_users_role").on(table.roleId),
	index("idx_users_unit").on(table.unitOrganisasiId),
	primaryKey({ columns: [table.id], name: "users_id"}),
	unique("uk_users_email").on(table.email),
	unique("uk_users_username").on(table.username),
]);
