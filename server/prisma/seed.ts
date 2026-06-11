import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function d(dateStr: string) { return new Date(dateStr); }

/** Create income records for a tenancy over a range of months */
async function seedIncome(
  tenancyId: number,
  propertyId: number,
  months: { year: number; month: number }[],
  amount: number,
) {
  for (const { year, month } of months) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    // Payment date: 5th of that month
    const paymentDate = d(`${year}-${String(month).padStart(2, '0')}-05`);
    await prisma.rentalIncome.create({
      data: {
        tenancy_id: tenancyId,
        property_id: propertyId,
        income_month: monthStr,
        amount_received: amount,
        payment_date: paymentDate,
        notes: null,
      },
    });
  }
}

/** Generate month list from start to end inclusive */
function months(fromYear: number, fromMonth: number, toYear: number, toMonth: number) {
  const result = [];
  let y = fromYear, m = fromMonth;
  while (y < toYear || (y === toYear && m <= toMonth)) {
    result.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

async function main() {
  console.log('Seeding database…');

  // ── Companies ──────────────────────────────────────────────────────────────
  // Update existing company (id 1) to a realistic name
  await prisma.company.update({
    where: { id: 1 },
    data: {
      name: 'Maju Setia Holdings Sdn Bhd',
      registration_number: '202001012345',
      address: 'Level 5, Menara Maju, Jalan Ampang, 50450 Kuala Lumpur',
      contact_person: 'Tan Sri Ahmad Razif',
    },
  });

  const c2 = await prisma.company.create({ data: {
    name: 'Jaya Bina Properties Sdn Bhd',
    registration_number: '202301045678',
    address: 'No. 12, Jalan Semantan, Damansara Heights, 50490 Kuala Lumpur',
    contact_person: 'Dato\' Lee Weng Keong',
  }});

  const c3 = await prisma.company.create({ data: {
    name: 'Prima Hartanah Sdn Bhd',
    registration_number: '201901089012',
    address: 'A-3-5, Centrepoint, Bukit Utama, 47800 Petaling Jaya',
    contact_person: 'Puan Siti Hajar',
  }});

  // ── Update existing property (No 1) ────────────────────────────────────────
  await prisma.property.update({
    where: { id: 1 },
    data: {
      company_id: 1,
      property_name: 'No. 1 Kepong Shophouse',
      address: 'No. 1, Jalan Kepong, 52100 Kuala Lumpur',
      property_type: 'commercial',
      title_type: 'Freehold',
      purchase_price: 850000,
      purchase_date: d('2018-06-15'),
      annual_assessment: 2400,
      quit_rent: 120,
    },
  });

  // ── New properties ─────────────────────────────────────────────────────────
  const p2 = await prisma.property.create({ data: {
    company_id: 1,
    property_name: 'Taman Desa Apartment',
    address: 'Unit 12-3, Block A, Taman Desa, 58100 Kuala Lumpur',
    title_type: 'Leasehold',
    property_type: 'residential',
    purchase_date: d('2019-03-20'),
    purchase_price: 380000,
    annual_assessment: 600,
    quit_rent: 50,
  }});

  const p3 = await prisma.property.create({ data: {
    company_id: c2.id,
    property_name: 'Sri Petaling Shophouse',
    address: 'No. 45, Jalan Radin Bagus, Sri Petaling, 57000 Kuala Lumpur',
    title_type: 'Freehold',
    property_type: 'commercial',
    purchase_date: d('2017-11-10'),
    purchase_price: 620000,
    annual_assessment: 1800,
    quit_rent: 95,
  }});

  const p4 = await prisma.property.create({ data: {
    company_id: c2.id,
    property_name: 'Bangsar Studio Suite',
    address: 'Unit 8-B, Bangsar Trade Centre, Jalan Ara, 59100 Kuala Lumpur',
    title_type: 'Freehold',
    property_type: 'residential',
    purchase_date: d('2020-08-05'),
    purchase_price: 520000,
    annual_assessment: 840,
    quit_rent: 65,
  }});

  const p5 = await prisma.property.create({ data: {
    company_id: c3.id,
    property_name: 'Mont Kiara Condominium',
    address: 'Unit 15-7, Residensi Mont Kiara, Jalan Kiara, 50480 Kuala Lumpur',
    title_type: 'Leasehold',
    property_type: 'residential',
    purchase_date: d('2021-02-14'),
    purchase_price: 780000,
    annual_assessment: 1200,
    quit_rent: 80,
  }});

  const p6 = await prisma.property.create({ data: {
    company_id: c3.id,
    property_name: 'Cheras Terrace House',
    address: 'No. 22, Jalan Manis 4, Taman Segar, 56100 Cheras, Kuala Lumpur',
    title_type: 'Freehold',
    property_type: 'residential',
    purchase_date: d('2016-09-30'),
    purchase_price: 420000,
    annual_assessment: 720,
    quit_rent: 55,
  }});

  console.log('Properties created.');

  // ── PROPERTY 1 — No. 1 Kepong Shophouse ───────────────────────────────────
  // Previous tenancy: 2024-2025 (terminated)
  const t1prev = await prisma.tenancy.create({ data: {
    property_id: 1,
    tenant_name: 'Ahmad Fadzillah Enterprise',
    tenant_ic_or_ssm: '201901056789',
    contact_number: '60123456789',
    rental_amount: 5500,
    deposit_amount: 11000,
    tenancy_start_date: d('2024-01-01'),
    tenancy_end_date: d('2025-12-31'),
    status: 'terminated',
    termination_date: d('2025-12-31'),
    termination_reason: 'Tenancy expired, tenant relocated',
  }});
  await seedIncome(t1prev.id, 1, months(2024, 1, 2025, 12), 5500);

  // Add 2024 expenses for P1
  await prisma.expense.createMany({ data: [
    { property_id: 1, expense_date: d('2024-03-15'), category: 'Assessment', description: 'Annual assessment 2024', amount: 2400, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-2024-001' },
    { property_id: 1, expense_date: d('2024-04-10'), category: 'Quit Rent', description: 'Quit rent (cukai tanah) 2024', amount: 120, vendor_name: 'Pejabat Tanah WP', invoice_number: 'PT-2024-112' },
    { property_id: 1, expense_date: d('2024-06-20'), category: 'Repair & Maintenance', description: 'Roof repair and waterproofing', amount: 3200, vendor_name: 'Syarikat Repair Pro', invoice_number: 'SRP-240610' },
    { property_id: 1, expense_date: d('2024-09-05'), category: 'Insurance', description: 'Fire & MLTA insurance premium', amount: 1850, vendor_name: 'Takaful Malaysia', invoice_number: 'TKF-240901' },
    { property_id: 1, expense_date: d('2024-11-18'), category: 'Utilities', description: 'Water tank cleaning & maintenance', amount: 450, vendor_name: 'Clean Tank Services', invoice_number: null },
  ]});

  // 2025 expenses for P1
  await prisma.expense.createMany({ data: [
    { property_id: 1, expense_date: d('2025-03-10'), category: 'Assessment', description: 'Annual assessment 2025', amount: 2400, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-2025-001' },
    { property_id: 1, expense_date: d('2025-04-08'), category: 'Quit Rent', description: 'Quit rent (cukai tanah) 2025', amount: 120, vendor_name: 'Pejabat Tanah WP', invoice_number: 'PT-2025-098' },
    { property_id: 1, expense_date: d('2025-07-14'), category: 'Repair & Maintenance', description: 'Electrical rewiring — ground floor', amount: 4800, vendor_name: 'ELite Electrical Sdn Bhd', invoice_number: 'ELE-250712' },
    { property_id: 1, expense_date: d('2025-09-20'), category: 'Insurance', description: 'Fire & MLTA insurance premium', amount: 1850, vendor_name: 'Takaful Malaysia', invoice_number: 'TKF-250919' },
  ]});

  // 2026 expenses for P1 (existing TT dotCom already there, add assessment)
  await prisma.expense.createMany({ data: [
    { property_id: 1, expense_date: d('2026-03-12'), category: 'Assessment', description: 'Annual assessment 2026', amount: 2400, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-2026-001' },
    { property_id: 1, expense_date: d('2026-04-05'), category: 'Quit Rent', description: 'Quit rent (cukai tanah) 2026', amount: 120, vendor_name: 'Pejabat Tanah WP', invoice_number: 'PT-2026-077' },
  ]});

  console.log('P1 seeded.');

  // ── PROPERTY 2 — Taman Desa Apartment ─────────────────────────────────────
  const t2 = await prisma.tenancy.create({ data: {
    property_id: p2.id,
    tenant_name: 'Nurul Ain binti Zulkifli',
    tenant_ic_or_ssm: '920814106543',
    contact_number: '60198765432',
    rental_amount: 1800,
    deposit_amount: 3600,
    tenancy_start_date: d('2024-02-01'),
    tenancy_end_date: d('2026-01-31'),
    status: 'terminated',
    termination_date: d('2026-01-31'),
    termination_reason: 'Tenant purchased own property',
  }});
  await seedIncome(t2.id, p2.id, months(2024, 2, 2026, 1), 1800);

  const t2b = await prisma.tenancy.create({ data: {
    property_id: p2.id,
    tenant_name: 'Rajesh Kumar a/l Subramaniam',
    tenant_ic_or_ssm: '881205085678',
    contact_number: '60112223344',
    rental_amount: 1900,
    deposit_amount: 3800,
    tenancy_start_date: d('2026-03-01'),
    tenancy_end_date: d('2027-02-28'),
    status: 'active',
  }});
  await seedIncome(t2b.id, p2.id, months(2026, 3, 2026, 5), 1900);

  await prisma.expense.createMany({ data: [
    { property_id: p2.id, expense_date: d('2024-05-10'), category: 'Assessment', description: 'Annual assessment 2024', amount: 600, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-TD-2024' },
    { property_id: p2.id, expense_date: d('2024-06-01'), category: 'Quit Rent', description: 'Quit rent 2024', amount: 50, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
    { property_id: p2.id, expense_date: d('2024-08-20'), category: 'Repair & Maintenance', description: 'Air conditioner service & gas top-up', amount: 380, vendor_name: 'CoolAir Services', invoice_number: 'CA-240820' },
    { property_id: p2.id, expense_date: d('2025-05-10'), category: 'Assessment', description: 'Annual assessment 2025', amount: 600, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-TD-2025' },
    { property_id: p2.id, expense_date: d('2025-06-01'), category: 'Quit Rent', description: 'Quit rent 2025', amount: 50, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
    { property_id: p2.id, expense_date: d('2025-10-05'), category: 'Repair & Maintenance', description: 'Water heater replacement', amount: 650, vendor_name: 'HomeFix Sdn Bhd', invoice_number: 'HF-251005' },
    { property_id: p2.id, expense_date: d('2026-02-15'), category: 'Repair & Maintenance', description: 'Painting & touch-up between tenants', amount: 1200, vendor_name: 'Warna Indah Painting', invoice_number: 'WI-260215' },
    { property_id: p2.id, expense_date: d('2026-05-10'), category: 'Assessment', description: 'Annual assessment 2026', amount: 600, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-TD-2026' },
  ]});

  console.log('P2 seeded.');

  // ── PROPERTY 3 — Sri Petaling Shophouse ───────────────────────────────────
  const t3 = await prisma.tenancy.create({ data: {
    property_id: p3.id,
    tenant_name: 'Kedai Runcit Weng Fatt',
    tenant_ic_or_ssm: '201501034567',
    contact_number: '60379876543',
    rental_amount: 3500,
    deposit_amount: 10500,
    tenancy_start_date: d('2024-01-01'),
    tenancy_end_date: d('2026-12-31'),
    status: 'active',
  }});
  await seedIncome(t3.id, p3.id, months(2024, 1, 2026, 5), 3500);

  await prisma.expense.createMany({ data: [
    { property_id: p3.id, expense_date: d('2024-02-20'), category: 'Assessment', description: 'Annual assessment 2024', amount: 1800, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-SP-2024' },
    { property_id: p3.id, expense_date: d('2024-03-15'), category: 'Quit Rent', description: 'Quit rent 2024', amount: 95, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
    { property_id: p3.id, expense_date: d('2024-09-12'), category: 'Repair & Maintenance', description: 'Plumbing repair — main pipe', amount: 780, vendor_name: 'Paip Master Sdn Bhd', invoice_number: 'PM-240912' },
    { property_id: p3.id, expense_date: d('2024-11-30'), category: 'Insurance', description: 'Commercial property insurance', amount: 2200, vendor_name: 'Etiqa Takaful', invoice_number: 'ET-241130' },
    { property_id: p3.id, expense_date: d('2025-02-20'), category: 'Assessment', description: 'Annual assessment 2025', amount: 1800, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-SP-2025' },
    { property_id: p3.id, expense_date: d('2025-03-10'), category: 'Quit Rent', description: 'Quit rent 2025', amount: 95, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
    { property_id: p3.id, expense_date: d('2025-05-22'), category: 'Repair & Maintenance', description: 'Roller shutter motor replacement', amount: 1350, vendor_name: 'Roller Tech Sdn Bhd', invoice_number: 'RT-250522' },
    { property_id: p3.id, expense_date: d('2025-11-28'), category: 'Insurance', description: 'Commercial property insurance', amount: 2200, vendor_name: 'Etiqa Takaful', invoice_number: 'ET-251128' },
    { property_id: p3.id, expense_date: d('2026-02-20'), category: 'Assessment', description: 'Annual assessment 2026', amount: 1800, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-SP-2026' },
    { property_id: p3.id, expense_date: d('2026-03-10'), category: 'Quit Rent', description: 'Quit rent 2026', amount: 95, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
  ]});

  console.log('P3 seeded.');

  // ── PROPERTY 4 — Bangsar Studio Suite ─────────────────────────────────────
  const t4prev = await prisma.tenancy.create({ data: {
    property_id: p4.id,
    tenant_name: 'Chen Li Wei',
    tenant_ic_or_ssm: '950320125678',
    contact_number: '60111234567',
    rental_amount: 2200,
    deposit_amount: 4400,
    tenancy_start_date: d('2024-01-01'),
    tenancy_end_date: d('2024-12-31'),
    status: 'terminated',
    termination_date: d('2024-12-31'),
    termination_reason: 'Tenancy expired',
  }});
  await seedIncome(t4prev.id, p4.id, months(2024, 1, 2024, 12), 2200);

  // Vacant Jan-Mar 2025, new tenant Apr 2025
  const t4 = await prisma.tenancy.create({ data: {
    property_id: p4.id,
    tenant_name: 'Priya Devi a/p Krishnan',
    tenant_ic_or_ssm: '900615126789',
    contact_number: '60169876543',
    rental_amount: 2400,
    deposit_amount: 4800,
    tenancy_start_date: d('2025-04-01'),
    tenancy_end_date: d('2027-03-31'),
    status: 'active',
  }});
  await seedIncome(t4.id, p4.id, months(2025, 4, 2026, 5), 2400);

  await prisma.expense.createMany({ data: [
    { property_id: p4.id, expense_date: d('2024-03-05'), category: 'Assessment', description: 'Annual assessment 2024', amount: 840, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-BS-2024' },
    { property_id: p4.id, expense_date: d('2024-04-01'), category: 'Quit Rent', description: 'Quit rent 2024', amount: 65, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
    { property_id: p4.id, expense_date: d('2024-07-08'), category: 'Repair & Maintenance', description: 'Kitchen cabinet repair & hinges', amount: 420, vendor_name: 'Kraf Kabinet Sdn Bhd', invoice_number: 'KK-240708' },
    { property_id: p4.id, expense_date: d('2024-12-10'), category: 'Management Fee', description: 'Strata maintenance fee Q4 2024', amount: 960, vendor_name: 'Bangsar Trade Centre JMB', invoice_number: 'BTC-Q4-2024' },
    { property_id: p4.id, expense_date: d('2025-01-10'), category: 'Management Fee', description: 'Strata maintenance fee Q1 2025', amount: 960, vendor_name: 'Bangsar Trade Centre JMB', invoice_number: 'BTC-Q1-2025' },
    { property_id: p4.id, expense_date: d('2025-02-20'), category: 'Repair & Maintenance', description: 'Full repaint between tenants', amount: 1800, vendor_name: 'Pro Painters KL', invoice_number: 'PP-250220' },
    { property_id: p4.id, expense_date: d('2025-03-05'), category: 'Assessment', description: 'Annual assessment 2025', amount: 840, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-BS-2025' },
    { property_id: p4.id, expense_date: d('2025-04-01'), category: 'Quit Rent', description: 'Quit rent 2025', amount: 65, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
    { property_id: p4.id, expense_date: d('2025-07-10'), category: 'Management Fee', description: 'Strata maintenance fee Q2-Q3 2025', amount: 1920, vendor_name: 'Bangsar Trade Centre JMB', invoice_number: 'BTC-Q23-2025' },
    { property_id: p4.id, expense_date: d('2026-03-05'), category: 'Assessment', description: 'Annual assessment 2026', amount: 840, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-BS-2026' },
    { property_id: p4.id, expense_date: d('2026-04-01'), category: 'Quit Rent', description: 'Quit rent 2026', amount: 65, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
  ]});

  console.log('P4 seeded.');

  // ── PROPERTY 5 — Mont Kiara Condominium ───────────────────────────────────
  const t5 = await prisma.tenancy.create({ data: {
    property_id: p5.id,
    tenant_name: 'Sophie Laurent',
    tenant_ic_or_ssm: 'FRANCE-456789',
    contact_number: '60175554321',
    rental_amount: 2800,
    deposit_amount: 5600,
    tenancy_start_date: d('2024-03-01'),
    tenancy_end_date: d('2025-02-28'),
    status: 'terminated',
    termination_date: d('2025-02-28'),
    termination_reason: 'Expat assignment ended, returned to France',
  }});
  await seedIncome(t5.id, p5.id, months(2024, 3, 2025, 2), 2800);

  const t5b = await prisma.tenancy.create({ data: {
    property_id: p5.id,
    tenant_name: 'Muhammad Hafizi bin Hassan',
    tenant_ic_or_ssm: '870923075678',
    contact_number: '60134449876',
    rental_amount: 3000,
    deposit_amount: 6000,
    tenancy_start_date: d('2025-04-01'),
    tenancy_end_date: d('2027-03-31'),
    status: 'active',
  }});
  await seedIncome(t5b.id, p5.id, months(2025, 4, 2026, 5), 3000);

  await prisma.expense.createMany({ data: [
    { property_id: p5.id, expense_date: d('2024-03-20'), category: 'Management Fee', description: 'Condo maintenance fee 2024 (annual)', amount: 3600, vendor_name: 'Residensi Mont Kiara MC', invoice_number: 'RMK-2024' },
    { property_id: p5.id, expense_date: d('2024-04-05'), category: 'Assessment', description: 'Annual assessment 2024', amount: 1200, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-MK-2024' },
    { property_id: p5.id, expense_date: d('2024-04-15'), category: 'Quit Rent', description: 'Quit rent 2024', amount: 80, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
    { property_id: p5.id, expense_date: d('2024-10-18'), category: 'Repair & Maintenance', description: 'Built-in wardrobe repair', amount: 550, vendor_name: 'Kraf Interiors', invoice_number: 'KI-241018' },
    { property_id: p5.id, expense_date: d('2025-01-15'), category: 'Repair & Maintenance', description: 'Deep cleaning between tenants', amount: 480, vendor_name: 'Bersih Pro Services', invoice_number: 'BP-250115' },
    { property_id: p5.id, expense_date: d('2025-03-20'), category: 'Management Fee', description: 'Condo maintenance fee 2025 (annual)', amount: 3600, vendor_name: 'Residensi Mont Kiara MC', invoice_number: 'RMK-2025' },
    { property_id: p5.id, expense_date: d('2025-04-05'), category: 'Assessment', description: 'Annual assessment 2025', amount: 1200, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-MK-2025' },
    { property_id: p5.id, expense_date: d('2025-04-15'), category: 'Quit Rent', description: 'Quit rent 2025', amount: 80, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
    { property_id: p5.id, expense_date: d('2026-03-20'), category: 'Management Fee', description: 'Condo maintenance fee 2026 (annual)', amount: 3600, vendor_name: 'Residensi Mont Kiara MC', invoice_number: 'RMK-2026' },
    { property_id: p5.id, expense_date: d('2026-04-05'), category: 'Assessment', description: 'Annual assessment 2026', amount: 1200, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-MK-2026' },
    { property_id: p5.id, expense_date: d('2026-04-15'), category: 'Quit Rent', description: 'Quit rent 2026', amount: 80, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
  ]});

  console.log('P5 seeded.');

  // ── PROPERTY 6 — Cheras Terrace House ─────────────────────────────────────
  const t6 = await prisma.tenancy.create({ data: {
    property_id: p6.id,
    tenant_name: 'Lim Boon Huat',
    tenant_ic_or_ssm: '780512085432',
    contact_number: '60163337788',
    rental_amount: 1500,
    deposit_amount: 3000,
    tenancy_start_date: d('2024-01-01'),
    tenancy_end_date: d('2025-12-31'),
    status: 'terminated',
    termination_date: d('2025-12-31'),
    termination_reason: 'Tenancy not renewed',
  }});
  await seedIncome(t6.id, p6.id, months(2024, 1, 2025, 12), 1500);

  // Vacant Jan-May 2026, new tenant from Jun (just agreed, no income yet)
  const t6b = await prisma.tenancy.create({ data: {
    property_id: p6.id,
    tenant_name: 'Fatimah binti Othman',
    tenant_ic_or_ssm: '910302046789',
    contact_number: '60126668899',
    rental_amount: 1600,
    deposit_amount: 3200,
    tenancy_start_date: d('2026-06-01'),
    tenancy_end_date: d('2028-05-31'),
    status: 'active',
  }});

  await prisma.expense.createMany({ data: [
    { property_id: p6.id, expense_date: d('2024-02-10'), category: 'Assessment', description: 'Annual assessment 2024', amount: 720, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-CH-2024' },
    { property_id: p6.id, expense_date: d('2024-03-01'), category: 'Quit Rent', description: 'Quit rent 2024', amount: 55, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
    { property_id: p6.id, expense_date: d('2024-05-25'), category: 'Repair & Maintenance', description: 'Gate motor & remote replacement', amount: 890, vendor_name: 'AutoGate Master', invoice_number: 'AGM-240525' },
    { property_id: p6.id, expense_date: d('2024-08-14'), category: 'Insurance', description: 'Houseowner insurance 2024', amount: 680, vendor_name: 'AIA Insurance', invoice_number: 'AIA-2024-CH' },
    { property_id: p6.id, expense_date: d('2025-02-10'), category: 'Assessment', description: 'Annual assessment 2025', amount: 720, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-CH-2025' },
    { property_id: p6.id, expense_date: d('2025-03-01'), category: 'Quit Rent', description: 'Quit rent 2025', amount: 55, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
    { property_id: p6.id, expense_date: d('2025-06-18'), category: 'Repair & Maintenance', description: 'Toilet bowl & bathroom fittings', amount: 520, vendor_name: 'Plumb & Fix Sdn Bhd', invoice_number: 'PF-250618' },
    { property_id: p6.id, expense_date: d('2025-08-14'), category: 'Insurance', description: 'Houseowner insurance 2025', amount: 680, vendor_name: 'AIA Insurance', invoice_number: 'AIA-2025-CH' },
    { property_id: p6.id, expense_date: d('2026-01-20'), category: 'Repair & Maintenance', description: 'Full house repaint before new tenant', amount: 2800, vendor_name: 'Pro Painters KL', invoice_number: 'PP-260120' },
    { property_id: p6.id, expense_date: d('2026-02-10'), category: 'Assessment', description: 'Annual assessment 2026', amount: 720, vendor_name: 'Dewan Bandaraya KL', invoice_number: 'DBKL-CH-2026' },
    { property_id: p6.id, expense_date: d('2026-03-01'), category: 'Quit Rent', description: 'Quit rent 2026', amount: 55, vendor_name: 'Pejabat Tanah WP', invoice_number: null },
    { property_id: p6.id, expense_date: d('2026-05-14'), category: 'Insurance', description: 'Houseowner insurance 2026', amount: 680, vendor_name: 'AIA Insurance', invoice_number: 'AIA-2026-CH' },
  ]});

  console.log('P6 seeded.');
  console.log('✅ Seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
