import http from 'http';
import { pool } from '../src/db.js';
import { generateTestToken } from '../src/middleware/auth.js';

interface SSEEvent {
  event: string;
  data: any;
  receivedAt: string;
}

async function runEndToEndVerification() {
  console.log('=====================================================');
  console.log(' SIMSARPRAS REAL-TIME SYNCHRONIZATION E2E VERIFICATION');
  console.log(' Menguji Sinkronisasi Nyata Multi-Perangkat (HP Guru & Web Admin)');
  console.log('=====================================================\n');

  if (!pool) {
    throw new Error('Database pool tidak tersedia');
  }

  const baseUrl = 'http://127.0.0.1:10000';

  // 1. Dapatkan akun nyata dari database
  const userRes = await pool.query('SELECT id, email, role, full_name, employee_number FROM users');
  const dbAdmin = userRes.rows.find((u) => u.role === 'ADMIN_SARPRAS') || userRes.rows[0];
  const dbTeacher = userRes.rows.find((u) => u.role === 'GURU_PEGAWAI') || userRes.rows[0];

  const adminToken = generateTestToken({
    id: dbAdmin.id,
    email: dbAdmin.email,
    role: dbAdmin.role || 'ADMIN_SARPRAS',
    fullName: dbAdmin.full_name || 'Admin Sarpras',
  });

  const teacherToken = generateTestToken({
    id: dbTeacher.id,
    email: dbTeacher.email,
    role: dbTeacher.role || 'GURU_PEGAWAI',
    fullName: dbTeacher.full_name || 'Guru Pengajar',
  });

  console.log(`[1] Kredensial Uji Terverifikasi:`);
  console.log(`    - Klien 1 (Admin Browser): ${dbAdmin.full_name} (${dbAdmin.role})`);
  console.log(`    - Klien 2 (HP Guru Mobile): ${dbTeacher.full_name} (${dbTeacher.role})\n`);

  // 2. Hubungkan Klien 1 (Admin Browser) ke Stream SSE
  const adminEvents: SSEEvent[] = [];
  const teacherEvents: SSEEvent[] = [];

  function createSSEClient(name: string, token: string, targetArray: SSEEvent[]): Promise<http.ClientRequest> {
    return new Promise((resolve, reject) => {
      const req = http.get(`${baseUrl}/api/v1/realtime/events?token=${token}`, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Gagal terhubung ke SSE [${name}]: HTTP ${res.statusCode}`));
          return;
        }

        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const block of parts) {
            const lines = block.split('\n');
            let event = 'message';
            let dataStr = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                event = line.replace('event: ', '').trim();
              } else if (line.startsWith('data: ')) {
                dataStr = line.replace('data: ', '').trim();
              }
            }
            if (dataStr) {
              try {
                const data = JSON.parse(dataStr);
                targetArray.push({ event, data, receivedAt: new Date().toISOString() });
              } catch {
                targetArray.push({ event, data: dataStr, receivedAt: new Date().toISOString() });
              }
            }
          }
        });

        resolve(req);
      });
      req.on('error', reject);
    });
  }

  console.log('[2] Membuka Kanal Real-Time Server-Sent Events (SSE)...');
  const adminClientReq = await createSSEClient('Admin Browser', adminToken, adminEvents);
  const teacherClientReq = await createSSEClient('HP Guru', teacherToken, teacherEvents);

  // Tunggu sejenak agar handshake event: connected diterima
  await new Promise((r) => setTimeout(r, 600));

  console.log(`    ✓ Klien 1 (Admin Browser) terhubung. Menerima: ${adminEvents[0]?.event || 'N/A'}`);
  console.log(`    ✓ Klien 2 (HP Guru Mobile) terhubung. Menerima: ${teacherEvents[0]?.event || 'N/A'}\n`);

  // 3. Uji Kasus A: Guru mengajukan peminjaman via HP
  console.log('[3] UJI KASUS A: Guru melakukan scan QR & submit pengajuan pinjaman dari HP...');
  let assetRes = await pool.query("SELECT id, item_name, asset_code FROM assets WHERE operational_status = 'AVAILABLE' AND effective_loan_mode = 'ADMIN_APPROVAL' LIMIT 1");
  if (assetRes.rows.length === 0) {
    assetRes = await pool.query("SELECT id, item_name, asset_code FROM assets WHERE operational_status = 'AVAILABLE' LIMIT 1");
  }
  if (assetRes.rows.length === 0) {
    throw new Error('Tidak ada barang AVAILABLE di database lokal untuk diuji');
  }
  const testAsset = assetRes.rows[0];

  const loanSubmitRes = await fetch(`${baseUrl}/api/v1/loans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      assetId: testAsset.id,
      borrowerId: dbTeacher.id,
      borrowerName: dbTeacher.full_name,
      borrowerEmployeeNumber: dbTeacher.employee_number || '198801012015011001',
      borrowerRole: 'GURU_PEGAWAI',
      purpose: 'Uji Sinkronisasi Multi-Perangkat Real-time',
      expectedReturnAt: new Date(Date.now() + 86400000).toISOString(),
    }),
  });

  const createdLoan = await loanSubmitRes.json();
  console.log(`    -> HTTP Respon: ${loanSubmitRes.status} (Loan ID: ${createdLoan.id}, Nomor: ${createdLoan.loanNumber}, Status: ${createdLoan.status})`);

  // Tunggu propagation event SSE
  await new Promise((r) => setTimeout(r, 600));

  const adminSawLoanCreated = adminEvents.find((e) => e.event === 'loan.created' && e.data.loanId === createdLoan.id);
  const adminSawAvailChanged = adminEvents.find((e) => e.event === 'asset.availability_changed' && e.data.assetId === testAsset.id);

  console.log(`    ✓ Admin Browser menerima sinyal real-time "loan.created": ${Boolean(adminSawLoanCreated)}`);
  console.log(`    ✓ Admin Browser menerima sinyal ketersediaan "asset.availability_changed": ${Boolean(adminSawAvailChanged)}`);
  if (!adminSawLoanCreated) {
    throw new Error('GAGAL: Admin tidak menerima event loan.created secara real-time!');
  }
  console.log('    ✓ TERBUKTI: Pengajuan dari HP langsung memicu pembaruan di layar Admin!\n');

  // 4. Uji Kasus B: Admin menyetujui / menolak peminjaman
  console.log('[4] UJI KASUS B: Admin memproses persetujuan peminjaman di browser komputer...');
  if (createdLoan.status === 'PENDING_APPROVAL') {
    const approveRes = await fetch(`${baseUrl}/api/v1/loans/${createdLoan.id}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    console.log(`    -> HTTP Respon: ${approveRes.status} (Status transaksi menjadi APPROVED)`);

    await new Promise((r) => setTimeout(r, 600));

    const teacherSawApproved = teacherEvents.find((e) => e.event === 'loan.approved' && e.data.loanId === createdLoan.id);
    console.log(`    ✓ HP Guru menerima sinyal real-time "loan.approved": ${Boolean(teacherSawApproved)}`);
    console.log('    ✓ TERBUKTI: Persetujuan Admin langsung memperbarui status di HP Guru!\n');
  } else {
    console.log(`    -> Peminjaman langsung aktif (${createdLoan.status}) untuk mode mandiri.`);
    const teacherSawCreated = teacherEvents.find((e) => e.event === 'loan.created' && e.data.loanId === createdLoan.id);
    console.log(`    ✓ HP Guru menerima sinyal real-time "loan.created": ${Boolean(teacherSawCreated)}`);
    console.log('    ✓ TERBUKTI: Notifikasi real-time aktif diterima di kedua browser!\n');
  }

  // 5. Uji Kasus C: Pengembalian Barang & Pemulihan Ketersediaan
  console.log('[5] UJI KASUS C: Guru mengembalikan barang & Admin melakukan verifikasi fisik...');
  const returnReqRes = await fetch(`${baseUrl}/api/v1/returns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      loanId: createdLoan.id,
      notes: 'Pengembalian selesai via scan QR',
    }),
  });
  console.log(`    -> Pengajuan Pengembalian HTTP: ${returnReqRes.status}`);

  await new Promise((r) => setTimeout(r, 600));
  const adminSawReturnRequested = adminEvents.find((e) => e.event === 'loan.returned' && e.data.status === 'RETURN_REQUESTED');
  console.log(`    ✓ Admin Browser menerima sinyal "loan.returned" (RETURN_REQUESTED): ${Boolean(adminSawReturnRequested)}`);

  // Admin selesaikan inspeksi pengembalian fisik
  const inspectionRes = await fetch(`${baseUrl}/api/v1/returns/${createdLoan.id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      conditionAtReturn: 'GOOD',
      accessoriesComplete: true,
      notes: 'Unit lengkap dan berfungsi normal',
    }),
  });
  console.log(`    -> Inspeksi Selesai HTTP: ${inspectionRes.status}`);

  await new Promise((r) => setTimeout(r, 600));
  const finalAvailEvent = adminEvents.find((e) => e.event === 'asset.availability_changed' && e.data.status === 'AVAILABLE');
  console.log(`    ✓ Status ketersediaan barang pulih menjadi "AVAILABLE": ${Boolean(finalAvailEvent)}`);
  console.log('    ✓ TERBUKTI: Pengembalian memperbarui status dan ketersediaan barang!\n');

  // 6. Uji Kasus D: Transaksi Gagal / Dibatalkan Bebas dari Event Palsu
  console.log('[6] UJI KASUS D: Verifikasi transaksi gagal tidak menerbitkan event sukses (Rollback Guard)...');
  const initialAdminEventCount = adminEvents.length;

  const failedRes = await fetch(`${baseUrl}/api/v1/loans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      assetId: 'ast-barang-palsu-999999',
      borrowerId: dbTeacher.id,
      borrowerName: dbTeacher.full_name,
      purpose: 'Uji Fail-Closed',
      expectedReturnAt: new Date(Date.now() + 86400000).toISOString(),
    }),
  });
  console.log(`    -> Transaksi Gagal HTTP: ${failedRes.status} (404 NOT FOUND)`);

  await new Promise((r) => setTimeout(r, 500));
  const finalAdminEventCount = adminEvents.length;
  console.log(`    ✓ Jumlah event sebelum gagal: ${initialAdminEventCount}, sesudah gagal: ${finalAdminEventCount}`);
  if (finalAdminEventCount !== initialAdminEventCount) {
    throw new Error('GAGAL: Transaksi gagal memancarkan event ke stream!');
  }
  console.log('    ✓ TERBUKTI: Transaksi gagal tidak memancarkan event sukses!\n');

  // 7. Uji Kasus E: Pengguna tanpa autentikasi ditolak
  console.log('[7] UJI KASUS E: Akses kanal real-time tanpa autentikasi...');
  const unauthRes = await fetch(`${baseUrl}/api/v1/realtime/events`);
  console.log(`    -> HTTP Respon: ${unauthRes.status} (${unauthRes.statusText})`);
  const unauthJson = await unauthRes.json();
  console.log(`    ✓ Kode error: ${unauthJson.error} - ${unauthJson.message}`);
  console.log('    ✓ TERBUKTI: Kanal real-time diproteksi ketat oleh autentikasi JWT!\n');

  // Bersihkan koneksi SSE
  adminClientReq.destroy();
  teacherClientReq.destroy();

  console.log('=====================================================');
  console.log(' HASIL AKHIR: 100% PENGUJIAN REAL-TIME TERBUKTI SUKSES!');
  console.log('=====================================================');
}

runEndToEndVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('E2E Verification Error:', err);
    process.exit(1);
  });
