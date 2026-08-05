-- 013_token_api_dev.sql — DIHASILKAN PROGRAM oleh scripts/gen-013-token-api.ts.
-- Jangan disunting tangan; jalankan `npm run db:gen-token-api` untuk membuat ulang.
--
-- Alasan berkas ini ada: hash token di 002_seed.sql adalah placeholder yang tidak
-- berasal dari plaintext mana pun, sehingga /api/v1 tidak bisa diuji sama sekali.
--
-- PERINGATAN: ketiga plaintext di bawah ADA DI REPOSITORI, jadi ia publik.
-- Berlaku HANYA untuk pupr_dev. Token produksi diterbitkan dari halaman
-- Manajemen Token API (acak 256 bit, ditampilkan sekali, tidak pernah disimpan).

-- klien BKN: simt_dev-bkn-hanya-untuk-pupr_dev
-- klien BIROKEPEG-PU: simt_dev-birokepeg-hanya-untuk-pupr_dev
-- klien BKN (dicabut): simt_dev-bkn-lama-sudah-dicabut

UPDATE api_token SET token_hash = 'sha256:696b31e0bb81f8c0dce923b3a67cf0769c259bf767a5258a74153c66fb41f11e' WHERE id = 1;
UPDATE api_token SET token_hash = 'sha256:ecdbae0b8e2afa73e5712a4c8ca9980fe74bc0b28490b674c5967c9bdc6c07e1' WHERE id = 2;
UPDATE api_token SET token_hash = 'sha256:8d1ae3d8211421dfeee884f586aaba6f9d4b8f9abd261a0be6d69183a9cfa781' WHERE id = 3;

-- Sanity: ketiga hash wajib berbeda & berformat sha256:<64 hex>.
SELECT id, label, status, LEFT(token_hash, 14) AS awal_hash, LENGTH(token_hash) AS panjang FROM api_token ORDER BY id;
