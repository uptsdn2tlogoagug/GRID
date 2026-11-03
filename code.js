/**
 * GRID - Database Google Drive (Google Apps Script)
 * Foto disimpan sebagai file JPG di folder Drive, data fotonya di index.json.
 */
const FOLDER_ID = '1BAe5KuFbZhmVpGUogQ4qlNeVkVdCXNzy';
const KODE = 'polsek123'; // ganti kalau perlu, lalu deploy ulang
const INDEX = 'index.json';
const ACCOUNTS = 'accounts.json';
const BACKUP_PREFIX = 'backup-grid-';

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
function folder_() { return DriveApp.getFolderById(FOLDER_ID); }

function readIdx_() {
  const it = folder_().getFilesByName(INDEX);
  if (!it.hasNext()) return [];
  try { return JSON.parse(it.next().getBlob().getDataAsString()) || []; }
  catch (e) { return []; }
}
function writeIdx_(arr) {
  const it = folder_().getFilesByName(INDEX), s = JSON.stringify(arr);
  if (it.hasNext()) it.next().setContent(s);
  else folder_().createFile(INDEX, s, 'application/json');
}

function readAccounts_() {
  const it = folder_().getFilesByName(ACCOUNTS);
  if (!it.hasNext()) return [];
  try { return JSON.parse(it.next().getBlob().getDataAsString()) || []; }
  catch (e) { throw new Error('File database akun tidak dapat dibaca.'); }
}
function writeAccounts_(arr) {
  const it = folder_().getFilesByName(ACCOUNTS);
  const json = JSON.stringify(arr);
  if (it.hasNext()) it.next().setContent(json);
  else folder_().createFile(ACCOUNTS, json, 'application/json');
}
function hashPassword_(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (b) {
    return ('0' + ((b + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

// Jalankan fungsi ini sekali dari editor untuk memberi izin akses Drive.
function izin() { Logger.log(folder_().getName()); }

function doGet() { return out_({ ok: true, pesan: 'Database GRID aktif' }); }

function doPost(e) {
  let r;
  try { r = JSON.parse(e && e.postData && e.postData.contents || '{}'); }
  catch (x) { return out_({ ok: false, error: 'Permintaan tidak valid' }); }
  if (!r || typeof r !== 'object' || Array.isArray(r)) return out_({ ok: false, error: 'Format permintaan tidak valid.' });
  if (r.kode !== KODE) return out_({ ok: false, error: 'Kode rahasia salah' });

  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(20000);
    locked = true;
    const idx = readIdx_();
    switch (r.action) {
      case 'ping':
        return out_({ ok: true, jumlah: idx.length });
      case 'accountList': {
        const users = readAccounts_().map(function (u) {
          return { username: u.username, role: u.role || 'petugas', createdAt: u.createdAt };
        });
        return out_({ ok: true, data: users });
      }
      case 'accountCreate': {
        if (String(r.adminCode || '') !== KODE) {
          return out_({ ok: false, error: 'Kode admin database salah.' });
        }
        const username = String(r.username || '').trim().toLowerCase();
        const password = String(r.password || '');
        if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
          return out_({ ok: false, error: 'Nama pengguna 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau minus.' });
        }
        if (password.length < 6) {
          return out_({ ok: false, error: 'Kata sandi minimal 6 karakter.' });
        }
        const users = readAccounts_();
        if (users.some(function (u) { return u.username === username; })) {
          return out_({ ok: false, error: 'Nama pengguna sudah digunakan.' });
        }
        users.push({
          username: username,
          passwordHash: hashPassword_(password),
          role: ['admin','petugas','viewer'].indexOf(String(r.role || 'petugas')) >= 0 ? String(r.role || 'petugas') : 'petugas',
          createdAt: new Date().toISOString()
        });
        writeAccounts_(users);
        return out_({ ok: true, data: { username: username } });
      }
      case 'accountSetRole': {
        if (String(r.adminCode || '') !== KODE) return out_({ ok: false, error: 'Kode admin database salah.' });
        const username = String(r.username || '').trim().toLowerCase();
        const role = String(r.role || 'petugas');
        if (['admin', 'petugas', 'viewer'].indexOf(role) < 0) return out_({ ok: false, error: 'Peran tidak valid.' });
        const users = readAccounts_();
        const user = users.find(function (u) { return u.username === username; });
        if (!user) return out_({ ok: false, error: 'Akun tidak ditemukan.' });
        user.role = role;
        user.updatedAt = new Date().toISOString();
        writeAccounts_(users);
        return out_({ ok: true, data: { username: username, role: role } });
      }
      case 'backupCreate': {
        if (String(r.adminCode || '') !== KODE) return out_({ ok: false, error: 'Kode admin database salah.' });
        const now = new Date();
        const id = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 8);
        const accounts = readAccounts_();
        const snapshot = { id: id, name: 'Backup ' + id, createdAt: now.toISOString(), photos: idx.length, index: idx, accounts: accounts };
        folder_().createFile(BACKUP_PREFIX + id + '.json', JSON.stringify(snapshot), 'application/json');
        return out_({ ok: true, data: { id: id, createdAt: snapshot.createdAt, photos: idx.length } });
      }
      case 'backupList': {
        const files = folder_().getFiles();
        const backups = [];
        while (files.hasNext()) {
          const f = files.next();
          const n = f.getName();
          if (n.indexOf(BACKUP_PREFIX) !== 0 || !/\.json$/i.test(n)) continue;
          try {
            const b = JSON.parse(f.getBlob().getDataAsString());
            backups.push({ id: b.id, name: b.name || n, createdAt: b.createdAt || f.getDateCreated().toISOString(), photos: b.photos || 0 });
          } catch (ignore) {}
        }
        backups.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
        return out_({ ok: true, data: backups });
      }
      case 'backupRestore': {
        if (String(r.adminCode || '') !== KODE) return out_({ ok: false, error: 'Kode admin database salah.' });
        const id = String(r.id || '');
        if (!/^[0-9]{8}-[0-9]{6}-[a-f0-9-]{8,}$/i.test(id)) return out_({ ok: false, error: 'ID backup tidak valid.' });
        const it = folder_().getFilesByName(BACKUP_PREFIX + id + '.json');
        if (!it.hasNext()) return out_({ ok: false, error: 'File backup tidak ditemukan.' });
        const snap = JSON.parse(it.next().getBlob().getDataAsString());
        if (!Array.isArray(snap.index) || !Array.isArray(snap.accounts)) return out_({ ok: false, error: 'Format backup tidak valid.' });
        // Pastikan struktur indeks valid dan semua file foto masih tersedia di Drive.
        const valid = snap.index.every(function (m) {
          if (!m || !m.id || !m.fileId) return false;
          try { return DriveApp.getFileById(m.fileId).getMimeType().indexOf('image/') === 0; }
          catch (missingFile) { return false; }
        });
        if (!valid) return out_({ ok: false, error: 'Backup tidak dapat dipulihkan: ada data atau file foto yang tidak valid/tidak ditemukan di Drive.' });
        writeIdx_(snap.index);
        writeAccounts_(snap.accounts);
        return out_({ ok: true, pesan: 'Backup dipulihkan.', jumlah: snap.index.length });
      }
      case 'accountChange': {
        const username = String(r.username || '').trim().toLowerCase();
        const oldPassword = String(r.oldPassword || '');
        const newPassword = String(r.newPassword || '');
        if (newPassword.length < 6) {
          return out_({ ok: false, error: 'Kata sandi baru minimal 6 karakter.' });
        }
        const users = readAccounts_();
        const user = users.find(function (u) { return u.username === username; });
        if (!user || user.passwordHash !== hashPassword_(oldPassword)) {
          return out_({ ok: false, error: 'Nama pengguna atau kata sandi lama salah.' });
        }
        user.passwordHash = hashPassword_(newPassword);
        user.updatedAt = new Date().toISOString();
        writeAccounts_(users);
        return out_({ ok: true, pesan: 'Kata sandi berhasil diubah.' });
      }
      case 'list':
        return out_({ ok: true, data: idx });
      case 'save': {
        if (!r.meta || typeof r.meta !== 'object' || !r.meta.d || typeof r.meta.d !== 'object') {
          return out_({ ok: false, error: 'Metadata foto tidak lengkap.' });
        }
        if (typeof r.image !== 'string' || !r.image || r.image.length > 18 * 1024 * 1024) {
          return out_({ ok: false, error: 'Data foto kosong atau terlalu besar. Coba gunakan foto berukuran lebih kecil.' });
        }
        let bytes;
        try { bytes = Utilities.base64Decode(r.image); }
        catch (decodeError) { return out_({ ok: false, error: 'Format data foto tidak valid.' }); }
        if (!bytes || !bytes.length || bytes.length > 13 * 1024 * 1024) {
          return out_({ ok: false, error: 'Ukuran foto tidak didukung.' });
        }
        const id = Utilities.getUuid().slice(0, 8) + '-' + Date.now().toString(36);
        const blob = Utilities.newBlob(bytes, 'image/jpeg', id + '.jpg');
        const f = folder_().createFile(blob);
        const m = { id: id, fileId: f.getId(), name: String(r.meta.name || 'foto').slice(0, 180),
                    d: r.meta.d, savedAt: new Date().toISOString() };
        idx.push(m);
        writeIdx_(idx);
        return out_({ ok: true, data: m });
      }
      case 'update': {
        const m = idx.find(function (x) { return x.id === r.id; });
        if (!m) return out_({ ok: false, error: 'Data tidak ditemukan' });
        if (!r.meta || typeof r.meta !== 'object' || !r.meta.d || typeof r.meta.d !== 'object') {
          return out_({ ok: false, error: 'Metadata foto tidak lengkap.' });
        }
        m.name = String(r.meta.name || m.name).slice(0, 180);
        m.d = r.meta.d;
        m.updatedAt = new Date().toISOString();
        writeIdx_(idx);
        return out_({ ok: true, data: m });
      }
      case 'get': {
        const m = idx.find(function (x) { return x.id === r.id; });
        if (!m) return out_({ ok: false, error: 'Data tidak ditemukan' });
        const bytes = DriveApp.getFileById(m.fileId).getBlob().getBytes();
        return out_({ ok: true, image: Utilities.base64Encode(bytes), data: m });
      }
      case 'delete': {
        const i = idx.findIndex(function (x) { return x.id === r.id; });
        if (i < 0) return out_({ ok: false, error: 'Data tidak ditemukan' });
        try { DriveApp.getFileById(idx[i].fileId).setTrashed(true); } catch (x) {}
        idx.splice(i, 1);
        writeIdx_(idx);
        return out_({ ok: true });
      }
      default:
        return out_({ ok: false, error: 'Aksi tidak dikenal' });
    }
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    if (locked) lock.releaseLock();
  }
}
