-- Nama pegawai SEBELUM diselaraskan dengan API eNominasi.
-- Dihasilkan 2026-08-11T13:42:32.506Z oleh scripts/nama-enom.ts
-- Jalankan untuk membatalkan: npm run db:sql doc/sql/cadangan-nama-sebelum-enom.sql

UPDATE pegawai SET nama_lengkap = 'Irwan' WHERE id = 2;
UPDATE pegawai SET nama_lengkap = 'Mardi' WHERE id = 5;
UPDATE pegawai SET nama_lengkap = 'Rachma' WHERE id = 9;
UPDATE pegawai SET nama_lengkap = 'Rahmat' WHERE id = 6;
UPDATE pegawai SET nama_lengkap = 'Tasya' WHERE id = 7;
UPDATE pegawai SET nama_lengkap = 'Tina' WHERE id = 8;
UPDATE pegawai SET nama_lengkap = 'Yatno' WHERE id = 3;
