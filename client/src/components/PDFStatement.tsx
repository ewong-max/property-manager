import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { StatementData } from '@/lib/api';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmt(n: number) {
  return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB');
}

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 9, fontFamily: 'Helvetica', color: '#1a1a2e' },
  header: { textAlign: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  title: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 8 },
  subtitle: { fontSize: 10, color: '#4a5568', marginTop: 2 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#718096', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 14 },
  table: { width: '100%' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', paddingVertical: 3 },
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#cbd5e0', paddingVertical: 4 },
  totalRow: { flexDirection: 'row', borderTopWidth: 1.5, borderTopColor: '#2d3748', paddingVertical: 4, marginTop: 2 },
  col1: { flex: 3, color: '#4a5568' },
  col2: { flex: 1, textAlign: 'right', fontFamily: 'Courier' },
  bold: { fontFamily: 'Helvetica-Bold' },
  green: { color: '#276749' },
  red: { color: '#c53030' },
  muted: { color: '#718096' },
  propertyBox: { marginBottom: 10 },
  noteBox: { backgroundColor: '#f7fafc', padding: 8, marginBottom: 6, borderRadius: 3 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 10 },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, textAlign: 'center', fontSize: 7, color: '#a0aec0', borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 6 },
});

function StatementPage({ data }: { data: StatementData }) {
  const net = data.totalIncome - data.totalExpenses;
  return (
    <Page size="A4" style={s.page}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.companyName}>{data.property.company.name}</Text>
        <Text style={s.muted}>{data.property.company.registration_number}</Text>
        <Text style={s.muted}>{data.property.company.address}</Text>
        <Text style={s.title}>Income & Expenses Statement</Text>
        <Text style={s.subtitle}>Year of Assessment {data.year}</Text>
      </View>

      {/* Property */}
      <View style={s.propertyBox}>
        <Text style={[s.bold, { fontSize: 9 }]}>Property</Text>
        <Text>{data.property.property_name}</Text>
        <Text style={s.muted}>{data.property.address}</Text>
      </View>

      {/* Part A */}
      <Text style={s.sectionTitle}>Part A — Rental Income</Text>
      <View style={s.table}>
        <View style={s.headerRow}><Text style={[s.col1, s.bold]}>Month</Text><Text style={[s.col2, s.bold]}>Amount (RM)</Text></View>
        {Array.from({ length: 12 }, (_, i) => {
          const key = `${data.year}-${String(i + 1).padStart(2, '0')}`;
          const amt = data.monthlyIncome[key] || 0;
          return (
            <View key={key} style={s.row}>
              <Text style={s.col1}>{MONTHS[i]} {data.year}</Text>
              <Text style={[s.col2, amt > 0 ? {} : s.muted]}>{amt > 0 ? fmt(amt) : '—'}</Text>
            </View>
          );
        })}
        <View style={s.totalRow}>
          <Text style={[s.col1, s.bold]}>Total Gross Rental Income</Text>
          <Text style={[s.col2, s.bold, s.green]}>{fmt(data.totalIncome)}</Text>
        </View>
      </View>

      {/* Part B */}
      <Text style={s.sectionTitle}>Part B — Allowable Expenses</Text>
      {Object.entries(data.expensesByCategory).map(([cat, { items, total }]) => (
        <View key={cat}>
          <Text style={[s.bold, { marginBottom: 2, marginTop: 4 }]}>{cat}</Text>
          {items.map(exp => (
            <View key={exp.id} style={s.row}>
              <Text style={[s.col1, s.muted]}>{fmtDate(exp.expense_date)} · {exp.vendor_name} · {exp.description}</Text>
              <Text style={s.col2}>{fmt(exp.amount)}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', paddingVertical: 2 }}>
            <Text style={[s.col1, s.muted, { fontSize: 8 }]}>Subtotal — {cat}</Text>
            <Text style={[s.col2, s.bold, { fontSize: 8 }]}>{fmt(total)}</Text>
          </View>
        </View>
      ))}
      <View style={s.totalRow}>
        <Text style={[s.col1, s.bold]}>Total Allowable Expenses</Text>
        <Text style={[s.col2, s.bold, s.red]}>{fmt(data.totalExpenses)}</Text>
      </View>

      {/* Part C */}
      <Text style={s.sectionTitle}>Part C — Net Rental Income</Text>
      <View style={s.table}>
        <View style={s.row}><Text style={s.col1}>Gross Rental Income</Text><Text style={s.col2}>{fmt(data.totalIncome)}</Text></View>
        <View style={s.row}><Text style={s.col1}>Less: Total Allowable Expenses</Text><Text style={[s.col2, s.red]}>({fmt(data.totalExpenses)})</Text></View>
        <View style={s.totalRow}>
          <Text style={[s.col1, s.bold]}>Net Rental Income</Text>
          <Text style={[s.col2, s.bold, net >= 0 ? s.green : s.red]}>{fmt(net)}</Text>
        </View>
      </View>

      {/* Part D */}
      <Text style={s.sectionTitle}>Part D — Notes</Text>
      {data.tenancies.map(t => (
        <View key={t.id} style={s.noteBox}>
          <Text style={s.bold}>{t.tenant_name} ({t.status})</Text>
          <Text style={s.muted}>IC/SSM: {t.tenant_ic_or_ssm}   Contact: {t.contact_number}</Text>
          <Text style={s.muted}>Monthly Rental: RM {fmt(t.rental_amount)}   Deposit: RM {fmt(t.deposit_amount)}</Text>
          <Text style={s.muted}>Tenancy Period: {fmtDate(t.tenancy_start_date)} — {t.tenancy_end_date ? fmtDate(t.tenancy_end_date) : 'Ongoing'}</Text>
          {t.termination_reason && <Text style={s.muted}>Termination Reason: {t.termination_reason}</Text>}
        </View>
      ))}

      {/* Footer */}
      <Text style={s.footer}>
        Prepared by {data.property.company.name} | Confidential | Generated {new Date().toLocaleDateString('en-GB')}
      </Text>
    </Page>
  );
}

export function PDFStatement({ statements }: { statements: StatementData[] }) {
  return (
    <Document>
      {statements.map(data => <StatementPage key={data.property.id} data={data} />)}
    </Document>
  );
}
