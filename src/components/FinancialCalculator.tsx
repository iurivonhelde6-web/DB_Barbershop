import React, { useState } from 'react';
import jsPDF from 'jspdf';
import { PLANS_LIST, SERVICES_LIST } from '../data/barberData';
import {
  DollarSign,
  TrendingUp,
  PieChart as PieIcon,
  Users,
  CalendarCheck,
  Percent,
  Scissors,
  CheckCircle,
  HelpCircle,
  BarChart3,
  Activity,
  ArrowUpRight,
  Layers,
  Download,
  Printer,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

export const FinancialCalculator: React.FC = () => {
  // Business simulation controls - starts zerado (R$ 0,00 e 0 assinantes)
  const [activeSubscribersCount, setActiveSubscribersCount] = useState<number>(0);
  const [avulsoCutsPerMonth, setAvulsoCutsPerMonth] = useState<number>(0);
  const [numBarbers, setNumBarbers] = useState<number>(6);
  const [avgPlanPrice, setAvgPlanPrice] = useState<number>(140);
  const [avgAvulsoPrice, setAvgAvulsoPrice] = useState<number>(35);

  // Filter service for split detail table
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('all');

  // Calculations
  const monthlySubscriptionRevenue = activeSubscribersCount * avgPlanPrice;
  const monthlyAvulsoRevenue = avulsoCutsPerMonth * avgAvulsoPrice;
  const totalGrossRevenue = monthlySubscriptionRevenue + monthlyAvulsoRevenue;

  // Average 55% to barber, 45% to house after costs
  const estimatedBarberTotalCommission = totalGrossRevenue * 0.55;
  const estimatedHouseNetProfit = totalGrossRevenue * 0.45;

  // Capacity calculation (e.g. 1 barber = ~120 cuts/month max)
  const maxBarberCapacity = numBarbers * 120;
  const totalCutsExecuted = activeSubscribersCount * 4 + avulsoCutsPerMonth;
  const occupancyRate = Math.min(100, Math.round((totalCutsExecuted / maxBarberCapacity) * 100));

  const filteredPlansTable = PLANS_LIST.filter(
    (p) => selectedServiceFilter === 'all' || p.serviceId === selectedServiceFilter
  );

  // Recharts Data Prep
  const recurrencePercentage = totalGrossRevenue > 0
    ? Math.round((monthlySubscriptionRevenue / totalGrossRevenue) * 100)
    : 0;

  // Revenue composition pie chart data
  const revenueCompositionData = [
    { name: 'Receita Recorrente (Assinaturas)', value: monthlySubscriptionRevenue, color: '#94a288' },
    { name: 'Receita Avulsa (Atendimentos)', value: monthlyAvulsoRevenue, color: '#eab308' },
  ];

  // Dashboard timeframe selector: 6 months or 12 months
  const [dashboardTimeframe, setDashboardTimeframe] = useState<'6m' | '12m'>('6m');

  const months6List = ['Mês 1 (Atual)', 'Mês 2', 'Mês 3', 'Mês 4', 'Mês 5', 'Mês 6'];
  const months12List = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];

  const activeMonthsList = dashboardTimeframe === '6m' ? months6List : months12List;

  // 1. Recharts Dataset: Receita Mensal (Recorrente, Avulsa, Faturamento Total e Lucro Líquido)
  const monthlyRevenueChartData = activeMonthsList.map((month, idx) => {
    const growthFactor = Math.pow(1.08, idx);
    const subCount = Math.round(activeSubscribersCount * growthFactor);
    const recurrent = subCount * avgPlanPrice;
    const avulso = Math.round(avulsoCutsPerMonth * (1 + idx * 0.02)) * avgAvulsoPrice;
    const total = recurrent + avulso;
    const houseProfit = total * 0.45;

    return {
      month,
      'Receita Recorrente': recurrent,
      'Receita Avulsa': avulso,
      'Faturamento Total': total,
      'Lucro Líquido': houseProfit,
    };
  });

  // 2. Recharts Dataset: Crescimento da Base de Assinantes Ativos
  const activeSubscribersChartData = activeMonthsList.map((month, idx) => {
    const growthRate = 0.08; // 8% monthly growth
    const activeCount = Math.round(activeSubscribersCount * Math.pow(1 + growthRate, idx));
    const newSignups = activeCount > 0 ? Math.max(1, Math.round(activeCount * 0.12)) : 0;
    const churn = Math.max(0, Math.round(activeCount * 0.04));

    return {
      month,
      'Assinantes Ativos': activeCount,
      'Novas Adesões': newSignups,
      'Cancelamentos (Churn)': churn,
    };
  });

  // Capacity breakdown chart data
  const capacityBreakdownData = [
    { name: 'Atendimentos de Assinantes', quantidade: activeSubscribersCount * 4, color: '#94a288' },
    { name: 'Atendimentos Avulsos', quantidade: avulsoCutsPerMonth, color: '#eab308' },
    { name: 'Capacidade Livre', quantidade: Math.max(0, maxBarberCapacity - totalCutsExecuted), color: '#262626' },
  ];

  // 6-Month Recurrent Revenue Projection (MRR + 8% monthly subscriber growth simulation)
  const monthLabels = ['Mês Atual', 'Mês +1', 'Mês +2', 'Mês +3', 'Mês +4', 'Mês +5'];
  const mrrProjectionData = monthLabels.map((month, idx) => {
    const subscriberGrowthFactor = Math.pow(1.08, idx);
    const projectedSubs = Math.round(activeSubscribersCount * subscriberGrowthFactor);
    const projectedMRR = projectedSubs * avgPlanPrice;
    const projectedTotalRevenue = projectedMRR + monthlyAvulsoRevenue;
    const projectedNetProfit = projectedTotalRevenue * 0.45;

    return {
      month,
      Assinantes: projectedSubs,
      'Receita Recorrente (MRR)': projectedMRR,
      'Faturamento Total': projectedTotalRevenue,
      'Lucro Líquido Barbearia': projectedNetProfit,
    };
  });

  // Recharts Custom Dark Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0a0a0a] border border-[#94a288]/40 p-3 rounded shadow-2xl text-xs space-y-1 z-50">
          <p className="font-bold text-white uppercase tracking-wider border-b border-white/10 pb-1 font-mono">
            {label}
          </p>
          {payload.map((entry: any, index: number) => {
            const isCurrency =
              typeof entry.value === 'number' &&
              (entry.name.toLowerCase().includes('mrr') ||
                entry.name.toLowerCase().includes('receita') ||
                entry.name.toLowerCase().includes('faturamento') ||
                entry.name.toLowerCase().includes('lucro') ||
                entry.name.toLowerCase().includes('comissão') ||
                entry.name.toLowerCase().includes('valor'));

            return (
              <p key={`item-${index}`} className="text-stone-300 flex items-center justify-between gap-4 font-mono">
                <span className="flex items-center gap-1.5" style={{ color: entry.color || entry.fill }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color || entry.fill }} />
                  {entry.name}:
                </span>
                <span className="font-bold text-white">
                  {isCurrency
                    ? `R$ ${entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : entry.value}
                </span>
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Export PDF State & Handler
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const currentDate = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      // Header Banner
      doc.setFillColor(20, 20, 20);
      doc.rect(0, 0, 210, 32, 'F');

      doc.setTextColor(170, 200, 100);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('DED BLACK BARBERSHOP', 14, 14);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Relatório Estratégico de Gestão Financeira & Margens', 14, 21);

      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text(`Emissão: ${currentDate} | Perfil: Gestão de Administração D•B`, 14, 27);

      // Section 1: KPIs Overview
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Indicadores Chave de Desempenho (KPIs)', 14, 42);

      doc.setLineWidth(0.4);
      doc.setDrawColor(85, 107, 47);
      doc.line(14, 44, 196, 44);

      const formattedGross = totalGrossRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const formattedRecurrence = monthlySubscriptionRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const formattedProfit = estimatedHouseNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const formattedCommissions = estimatedBarberTotalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

      // Box 1: Revenue
      doc.setFillColor(245, 245, 240);
      doc.roundedRect(14, 48, 88, 28, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(70, 70, 70);
      doc.text('FATURAMENTO BRUTO MENSAL', 18, 55);
      doc.setFontSize(13);
      doc.setTextColor(85, 107, 47);
      doc.text(`R$ ${formattedGross}`, 18, 63);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Recorrência (MRR): R$ ${formattedRecurrence} (${recurrencePercentage}%)`, 18, 69);

      // Box 2: Profit Split
      doc.setFillColor(245, 245, 240);
      doc.roundedRect(108, 48, 88, 28, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(70, 70, 70);
      doc.text('LUCRO LÍQUIDO DA BARBEARIA (45%)', 112, 55);
      doc.setFontSize(13);
      doc.setTextColor(40, 120, 60);
      doc.text(`R$ ${formattedProfit}`, 112, 63);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Repasse Equipe (55%): R$ ${formattedCommissions}`, 112, 69);

      // Section 2: Parameters
      let y = 84;
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('2. Parâmetros da Simulação Operacional', 14, y);
      doc.line(14, y + 2, 196, y + 2);

      y += 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Assinantes Ativos: ${activeSubscribersCount} membros (Ticket Médio: R$ ${avgPlanPrice.toFixed(2)})`, 18, y);
      y += 6;
      doc.text(`• Atendimentos Avulsos por Mês: ${avulsoCutsPerMonth} cortes (Preço Médio: R$ ${avgAvulsoPrice.toFixed(2)})`, 18, y);
      y += 6;
      doc.text(`• Profissionais Barbeiros: ${numBarbers} barbeiros em atividade`, 18, y);
      y += 6;
      doc.text(`• Taxa de Ocupação da Equipe: ${occupancyRate}% (${totalCutsExecuted} cortes / ${maxBarberCapacity} cap. total)`, 18, y);

      // Section 3: MRR 6 Months Projection Table
      y += 12;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('3. Projeção de Crescimento da Recorrência (MRR - 6 Meses)', 14, y);
      doc.line(14, y + 2, 196, y + 2);

      y += 8;
      doc.setFillColor(230, 230, 225);
      doc.rect(14, y, 182, 7, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('MÊS', 18, y + 5);
      doc.text('ASSINANTES', 50, y + 5);
      doc.text('RECEITA RECORRENTE (MRR)', 88, y + 5);
      doc.text('FATURAMENTO TOTAL', 135, y + 5);
      doc.text('LUCRO LÍQUIDO', 170, y + 5);

      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);

      mrrProjectionData.forEach((row, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 248, 248);
          doc.rect(14, y, 182, 6, 'F');
        }
        doc.text(row.month, 18, y + 4.5);
        doc.text(`${row.Assinantes} subs`, 50, y + 4.5);
        doc.text(`R$ ${row['Receita Recorrente (MRR)'].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 88, y + 4.5);
        doc.text(`R$ ${row['Faturamento Total'].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 135, y + 4.5);
        doc.text(`R$ ${row['Lucro Líquido Barbearia'].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 170, y + 4.5);
        y += 6;
      });

      // Section 4: Plans Split
      y += 10;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text('4. Tabela de Divisão por Planos (Comissão x Retenção)', 14, y);
      doc.line(14, y + 2, 196, y + 2);

      y += 8;
      doc.setFillColor(230, 230, 225);
      doc.rect(14, y, 182, 7, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('PLANO', 18, y + 5);
      doc.text('VALOR MENSAL', 70, y + 5);
      doc.text('COMISSÃO BARBEIRO (55%)', 115, y + 5);
      doc.text('RETENÇÃO CASA (45%)', 160, y + 5);

      y += 7;
      doc.setFont('helvetica', 'normal');
      PLANS_LIST.slice(0, 5).forEach((plan, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 248, 248);
          doc.rect(14, y, 182, 6, 'F');
        }
        const val = plan.totalPrice;
        const barb = plan.totalBarberCommission || val * 0.55;
        const house = plan.totalHouseMargin || val * 0.45;

        doc.text(`${plan.tierLabel} - ${plan.serviceName}`, 18, y + 4.5);
        doc.text(`R$ ${val.toFixed(2)}`, 70, y + 4.5);
        doc.text(`R$ ${barb.toFixed(2)}`, 115, y + 4.5);
        doc.text(`R$ ${house.toFixed(2)}`, 160, y + 4.5);
        y += 6;
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text('Ded Black Barbershop - Relatório Oficial de Gestão Financeira Interna.', 14, 285);

      doc.save(`relatorio-financeiro-dedblack-${new Date().toISOString().split('T')[0]}.pdf`);
      setPdfToast('Relatório PDF baixado com sucesso!');
      setTimeout(() => setPdfToast(null), 3500);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      setPdfToast('Erro ao exportar PDF. Tente novamente.');
      setTimeout(() => setPdfToast(null), 3500);
    }
  };

  return (
    <div className="bg-[#0c0c0c] min-h-screen text-[#e0e0e0] px-4 sm:px-6 lg:px-8 py-8 space-y-10 pb-16">
      {/* Toast Notification for PDF Export */}
      {pdfToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#181818] border border-[#94a288] text-[#94a288] px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 font-bold text-xs animate-in slide-in-from-bottom">
          <CheckCircle className="w-5 h-5 text-[#94a288]" />
          <span>{pdfToast}</span>
        </div>
      )}

      {/* Page Title Header */}
      <div className="border-b border-[#94a288]/30 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#94a288]/20 text-[#94a288] text-[10px] font-bold uppercase tracking-[0.3em] mb-2 border border-[#94a288]/40">
            <PieIcon className="w-3.5 h-3.5 text-[#94a288]" />
            Gestão Financeira &amp; Margem D•B
          </span>
          <h2 className="text-3xl font-serif italic text-white">
            Painel de Indicadores &amp; Calculadora Financeira
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-1 max-w-3xl opacity-80">
            Acompanhe os KPIs estratégicos de faturamento mensal, ocupação dos planos e projeção de receita recorrente (MRR), além do repasse de comissões para a equipe.
          </p>
        </div>

        {/* PDF Export Actions */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 rounded-lg bg-[#94a288] hover:bg-[#68833a] text-black font-bold uppercase text-xs tracking-wider transition shadow-lg flex items-center gap-2 group"
          >
            <Download className="w-4 h-4 text-black group-hover:scale-110 transition-transform" />
            <span>Exportar Relatório PDF</span>
          </button>
        </div>
      </div>

      {/* KPI DASHBOARD HEADER CARDS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#94a288] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#94a288]" />
            Indicadores Chave de Desempenho (KPIs)
          </h3>
          <span className="text-[10px] text-stone-500 font-mono">Atualizado em Tempo Real</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* KPI 1: Faturamento Mensal Total */}
          <div className="bg-[#151515] p-6 rounded border border-[#94a288]/30 shadow-xl relative overflow-hidden group hover:border-[#94a288]/60 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                Faturamento Mensal Total
              </span>
              <div className="p-2 rounded bg-[#94a288]/20 text-[#94a288] border border-[#94a288]/30">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="text-3xl font-serif font-bold text-white tracking-tight">
              R$ {totalGrossRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-stone-400 text-[11px]">Recorrência vs Avulso:</span>
              <span className="text-[#94a288] font-bold font-mono flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-[#94a288]" />
                {recurrencePercentage}% Recorrente
              </span>
            </div>

            <div className="mt-2 w-full h-1.5 bg-[#0a0a0a] rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-[#94a288] transition-all duration-500"
                style={{ width: `${Math.min(100, recurrencePercentage)}%` }}
              />
            </div>
          </div>

          {/* KPI 2: Taxa de Ocupação dos Planos */}
          <div className="bg-[#151515] p-6 rounded border border-[#94a288]/30 shadow-xl relative overflow-hidden group hover:border-[#94a288]/60 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                Taxa de Ocupação dos Planos
              </span>
              <div className="p-2 rounded bg-yellow-950/30 text-yellow-500 border border-yellow-500/30">
                <Percent className="w-5 h-5" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-serif font-bold text-white tracking-tight">
                {occupancyRate}%
              </div>
              <span className="text-xs text-stone-400 font-mono">
                ({totalCutsExecuted} / {maxBarberCapacity} ATD)
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-stone-400 text-[11px]">Capacidade da Equipe:</span>
              <span
                className={`font-bold font-mono text-[11px] ${
                  occupancyRate >= 80
                    ? 'text-[#94a288]'
                    : occupancyRate >= 50
                    ? 'text-yellow-400'
                    : 'text-stone-400'
                }`}
              >
                {occupancyRate >= 80 ? '🔥 Alta Ocupação' : occupancyRate >= 50 ? '⚡ Ocupação Média' : '💡 Capacidade Livre'}
              </span>
            </div>

            <div className="mt-2 w-full h-1.5 bg-[#0a0a0a] rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-yellow-500 transition-all duration-500"
                style={{ width: `${Math.min(100, occupancyRate)}%` }}
              />
            </div>
          </div>

          {/* KPI 3: Projeção de Receita Recorrente (MRR) */}
          <div className="bg-[#151515] p-6 rounded border border-[#94a288]/30 shadow-xl relative overflow-hidden group hover:border-[#94a288]/60 transition sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                Projeção Receita Recorrente (MRR)
              </span>
              <div className="p-2 rounded bg-purple-950/30 text-purple-400 border border-purple-500/30">
                <CalendarCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="text-3xl font-serif font-bold text-white tracking-tight">
              R$ {monthlySubscriptionRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-stone-400 text-[11px]">Assinantes Cadastrados:</span>
              <span className="text-purple-400 font-bold font-mono text-[11px]">
                {activeSubscribersCount} Membros Ativos
              </span>
            </div>

            <div className="mt-2 text-[10px] text-stone-400 flex items-center justify-between">
              <span>Projeção 6 Meses (+8%/mês):</span>
              <strong className="text-white font-mono">
                R$ {(mrrProjectionData[5]['Receita Recorrente (MRR)']).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mês
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* RECHARTS METRICS DASHBOARD SECTION */}
      <section className="space-y-6">
        <div className="bg-[#111111] p-6 rounded-xl border border-[#94a288]/40 shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <span className="text-[10px] font-bold text-[#94a288] uppercase tracking-[0.25em] flex items-center gap-1.5 mb-1">
                <BarChart3 className="w-4 h-4 text-[#94a288]" />
                Dashboard Analítico de Desempenho (Recharts)
              </span>
              <h3 className="text-2xl font-serif italic text-white">
                Métricas de Receita Mensal &amp; Crescimento de Assinantes
              </h3>
              <p className="text-xs text-stone-400 mt-1 opacity-80">
                Visualização detalhada da evolução financeira e expansão da base de membros recorrentes.
              </p>
            </div>

            {/* Timeframe Selector Buttons */}
            <div className="flex items-center gap-2 bg-[#0a0a0a] p-1.5 rounded-lg border border-[#94a288]/30 shrink-0">
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider px-2">
                Período:
              </span>
              <button
                onClick={() => setDashboardTimeframe('6m')}
                className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                  dashboardTimeframe === '6m'
                    ? 'bg-[#94a288] text-black shadow'
                    : 'text-stone-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Semestral (6 Meses)
              </button>
              <button
                onClick={() => setDashboardTimeframe('12m')}
                className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                  dashboardTimeframe === '12m'
                    ? 'bg-[#94a288] text-black shadow'
                    : 'text-stone-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Anual (12 Meses)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* CHART 1: Receita Mensal (BarChart / ComposedChart) */}
            <div className="bg-[#151515] p-5 rounded-lg border border-[#94a288]/30 shadow-xl flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/5 pb-3 mb-3">
                <div>
                  <h4 className="text-base font-serif italic text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[#94a288]" />
                    Evolução da Receita Mensal
                  </h4>
                  <p className="text-[11px] text-stone-400">
                    Composição da Receita Recorrente vs. Avulsa vs. Total
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono shrink-0">
                  <span className="flex items-center gap-1 text-[#94a288]">
                    <span className="w-2.5 h-2.5 rounded bg-[#94a288]" /> Recorrente
                  </span>
                  <span className="flex items-center gap-1 text-yellow-500">
                    <span className="w-2.5 h-2.5 rounded bg-yellow-500" /> Avulsa
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Total
                  </span>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyRevenueChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis dataKey="month" stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 10 }} />
                    <YAxis
                      stroke="#737373"
                      tick={{ fill: '#a3a3a3', fontSize: 10 }}
                      tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Receita Recorrente" fill="#94a288" radius={[4, 4, 0, 0]} stackId="a" barSize={20} />
                    <Bar dataKey="Receita Avulsa" fill="#eab308" radius={[4, 4, 0, 0]} stackId="a" barSize={20} />
                    <Line
                      type="monotone"
                      dataKey="Faturamento Total"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ fill: '#10b981', r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-stone-400">
                <span>Último Faturamento do Período:</span>
                <strong className="text-emerald-400 font-mono text-xs">
                  R$ {monthlyRevenueChartData[monthlyRevenueChartData.length - 1]['Faturamento Total'].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            {/* CHART 2: Crescimento de Assinantes Ativos (AreaChart + Line) */}
            <div className="bg-[#151515] p-5 rounded-lg border border-[#94a288]/30 shadow-xl flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/5 pb-3 mb-3">
                <div>
                  <h4 className="text-base font-serif italic text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    Crescimento de Assinantes Ativos
                  </h4>
                  <p className="text-[11px] text-stone-400">
                    Expansão da base de membros ativos e ritmo de novas adesões
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono shrink-0">
                  <span className="flex items-center gap-1 text-[#94a288]">
                    <span className="w-2.5 h-2.5 rounded bg-[#94a288]" /> Assinantes Ativos
                  </span>
                  <span className="flex items-center gap-1 text-purple-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Novas Adesões
                  </span>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activeSubscribersChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSubscribers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a288" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#94a288" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis dataKey="month" stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 10 }} />
                    <YAxis stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="Assinantes Ativos"
                      stroke="#94a288"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorSubscribers)"
                    />
                    <Line
                      type="monotone"
                      dataKey="Novas Adesões"
                      stroke="#c084fc"
                      strokeWidth={2}
                      dot={{ fill: '#c084fc', r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-stone-400">
                <span>Base Final do Período:</span>
                <strong className="text-purple-400 font-mono text-xs">
                  {activeSubscribersChartData[activeSubscribersChartData.length - 1]['Assinantes Ativos']} Membros Ativos
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RECHARTS PROJECTION & COMPOSITION SECTION */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CHART 1: Area Chart - Projeção de Recorrência e MRR (8 cols) */}
        <div className="lg:col-span-8 bg-[#151515] p-6 rounded border border-[#94a288]/30 shadow-xl flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
            <div>
              <span className="text-[10px] font-bold text-[#94a288] uppercase tracking-widest flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> Projeção de Escala 6 Meses
              </span>
              <h4 className="text-lg font-serif italic text-white mt-0.5">
                Projeção de Receita Recorrente (MRR) &amp; Faturamento Total
              </h4>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-[#94a288]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#94a288]" /> MRR (Recorrência)
              </span>
              <span className="flex items-center gap-1 text-yellow-500">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Faturamento Total
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mrrProjectionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMRR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a288" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#94a288" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#eab308" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="month" stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 11 }} />
                <YAxis
                  stroke="#737373"
                  tick={{ fill: '#a3a3a3', fontSize: 10 }}
                  tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Faturamento Total"
                  stroke="#eab308"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                />
                <Area
                  type="monotone"
                  dataKey="Receita Recorrente (MRR)"
                  stroke="#94a288"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorMRR)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[11px] text-stone-400 mt-3 pt-3 border-t border-white/5 opacity-80 flex items-center justify-between">
            <span>Simula crescimento de 8% ao mês na base de assinantes contratados.</span>
            <strong className="text-[#94a288]">Meta Mês 6: {mrrProjectionData[5].Assinantes} Assinantes</strong>
          </p>
        </div>

        {/* CHART 2: Donut PieChart - Composição do Faturamento (4 cols) */}
        <div className="lg:col-span-4 bg-[#151515] p-6 rounded border border-[#94a288]/30 shadow-xl flex flex-col justify-between">
          <div className="border-b border-white/5 pb-4 mb-2">
            <span className="text-[10px] font-bold text-[#94a288] uppercase tracking-widest flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" /> Composição de Receita
            </span>
            <h4 className="text-lg font-serif italic text-white mt-0.5">
              Recorrente vs Avulso
            </h4>
          </div>

          <div className="h-56 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueCompositionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {revenueCompositionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#0a0a0a" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Donut Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-serif font-bold text-white font-mono">{recurrencePercentage}%</span>
              <span className="text-[9px] text-stone-400 uppercase tracking-widest">Recorrente</span>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-white/5 text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-[#0a0a0a] border border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#94a288]" />
                <span className="text-stone-300">Planos Recorrentes</span>
              </div>
              <span className="font-bold text-white font-mono">
                R$ {monthlySubscriptionRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#0a0a0a] border border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-yellow-500" />
                <span className="text-stone-300">Cortes Avulsos</span>
              </div>
              <span className="font-bold text-white font-mono">
                R$ {monthlyAvulsoRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CHART 3: BarChart - Capacidade da Equipe & Atendimentos */}
      <section className="bg-[#151515] p-6 rounded border border-[#94a288]/30 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
          <div>
            <span className="text-[10px] font-bold text-[#94a288] uppercase tracking-widest flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> Distribuição da Capacidade Produtiva
            </span>
            <h4 className="text-lg font-serif italic text-white mt-0.5">
              Atendimentos de Assinantes vs Cortes Avulsos vs Capacidade Livre
            </h4>
          </div>
          <span className="text-xs font-mono text-stone-400 bg-[#0a0a0a] px-3 py-1 rounded border border-white/5">
            Total Capacidade: <strong className="text-white">{maxBarberCapacity} ATD/mês</strong> ({numBarbers} barbeiros)
          </span>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={capacityBreakdownData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
              <XAxis type="number" stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" stroke="#737373" tick={{ fill: '#e0e0e0', fontSize: 11 }} width={140} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} barSize={24}>
                {capacityBreakdownData.map((entry, index) => (
                  <Cell key={`bar-cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      {/* 4 Pillars Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#151515] p-5 rounded border border-[#94a288]/20 flex items-start gap-3">
          <div className="p-2.5 rounded bg-[#94a288]/20 text-[#94a288] border border-[#94a288]/30">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase text-[#94a288] tracking-widest">1. Taxa de Ocupação</h4>
            <p className="text-sm font-bold text-white mt-0.5 font-serif">Preenchimento de Cadeira</p>
            <p className="text-[11px] text-stone-400 mt-1 opacity-80">Elimina horários ociosos durante a semana.</p>
          </div>
        </div>

        <div className="bg-[#151515] p-5 rounded border border-[#94a288]/20 flex items-start gap-3">
          <div className="p-2.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800/40">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase text-blue-400 tracking-widest">2. Novos Clientes</h4>
            <p className="text-sm font-bold text-white mt-0.5 font-serif">Atração &amp; Conversão</p>
            <p className="text-[11px] text-stone-400 mt-1 opacity-80">Transforma avulsos em assinantes recorrentes.</p>
          </div>
        </div>

        <div className="bg-[#151515] p-5 rounded border border-[#94a288]/20 flex items-start gap-3">
          <div className="p-2.5 rounded bg-yellow-900/30 text-yellow-400 border border-yellow-800/40">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase text-yellow-400 tracking-widest">3. Ticket Médio</h4>
            <p className="text-sm font-bold text-white mt-0.5 font-serif">Combos &amp; Upsell</p>
            <p className="text-[11px] text-stone-400 mt-1 opacity-80">Inclusão de barba, tesoura e pomadas.</p>
          </div>
        </div>

        <div className="bg-[#151515] p-5 rounded border border-[#94a288]/20 flex items-start gap-3">
          <div className="p-2.5 rounded bg-purple-900/30 text-purple-400 border border-purple-800/40">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase text-purple-400 tracking-widest">4. Recorrência (MRR)</h4>
            <p className="text-sm font-bold text-white mt-0.5 font-serif">Receita Previsível</p>
            <p className="text-[11px] text-stone-400 mt-1 opacity-80">Faturamento garantido todo dia 1º do mês.</p>
          </div>
        </div>
      </div>

      {/* Interactive Business Projection Simulator */}
      <section className="bg-[#111111] p-6 sm:p-8 rounded border border-[#94a288]/30 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-white/5 pb-6 mb-6">
          <div>
            <span className="text-[10px] font-bold text-[#94a288] uppercase tracking-[0.25em] flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              Simulador de Faturamento Mensal D•B
            </span>
            <h3 className="text-2xl font-serif italic text-white mt-1">
              Projeção de Receita Recorrente &amp; Lucratividade
            </h3>
            <p className="text-xs text-stone-300 mt-0.5 opacity-80">
              Ajuste o número de assinantes e clientes avulsos para ver o impacto financeiro da barbearia.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#0a0a0a] px-4 py-2 rounded border border-[#94a288]/30 text-xs">
            <span className="text-stone-400 uppercase tracking-widest text-[10px]">Capacidade da Equipe:</span>
            <strong className="text-[#94a288] font-bold">{numBarbers} Barbeiros</strong>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#0a0a0a] p-4 rounded border border-white/5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-2">
              Assinantes Ativos: <span className="text-[#94a288] font-bold">{activeSubscribersCount}</span>
            </label>
            <input
              type="range"
              min={10}
              max={150}
              value={activeSubscribersCount}
              onChange={(e) => setActiveSubscribersCount(Number(e.target.value))}
              className="w-full accent-[#94a288] cursor-pointer"
            />
            <span className="text-[10px] text-stone-400 mt-1 block uppercase tracking-wider">
              Ticket Médio do Plano: R$ {avgPlanPrice}
            </span>
          </div>

          <div className="bg-[#0a0a0a] p-4 rounded border border-white/5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-2">
              Cortes Avulsos / Mês: <span className="text-[#94a288] font-bold">{avulsoCutsPerMonth}</span>
            </label>
            <input
              type="range"
              min={10}
              max={200}
              value={avulsoCutsPerMonth}
              onChange={(e) => setAvulsoCutsPerMonth(Number(e.target.value))}
              className="w-full accent-[#94a288] cursor-pointer"
            />
            <span className="text-[10px] text-stone-400 mt-1 block uppercase tracking-wider">
              Ticket Médio Avulso: R$ {avgAvulsoPrice}
            </span>
          </div>

          <div className="bg-[#0a0a0a] p-4 rounded border border-white/5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-2">
              Equipe de Barbeiros: <span className="text-[#94a288] font-bold">{numBarbers}</span>
            </label>
            <input
              type="range"
              min={1}
              max={8}
              value={numBarbers}
              onChange={(e) => setNumBarbers(Number(e.target.value))}
              className="w-full accent-[#94a288] cursor-pointer"
            />
            <span className="text-[10px] text-stone-400 mt-1 block uppercase tracking-wider">
              Capacidade Max: {maxBarberCapacity} cortes
            </span>
          </div>

          <div className="bg-[#0a0a0a] p-4 rounded border border-white/5 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-300">Taxa de Ocupação Estimada</span>
            <div className="my-2">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-stone-300">{totalCutsExecuted} Atendimentos</span>
                <span className="text-[#94a288]">{occupancyRate}%</span>
              </div>
              <div className="w-full h-2.5 bg-[#151515] rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full bg-[#94a288] transition-all duration-500"
                  style={{ width: `${occupancyRate}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-stone-400 uppercase tracking-wider">
              {occupancyRate >= 80 ? '🔥 Ocupação excelente!' : '💡 Margem para novos assinantes'}
            </span>
          </div>
        </div>

        {/* Projected Outputs */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-white/5">
          <div className="bg-[#0a0a0a] p-5 rounded border border-white/5 text-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block">Faturamento Bruto Mensal</span>
            <span className="text-2xl sm:text-3xl font-serif text-white mt-1 block font-bold">
              R$ {totalGrossRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-[#94a288] mt-1 block uppercase tracking-widest font-bold">
              R$ {monthlySubscriptionRevenue.toFixed(2)} em assinaturas recorrentes
            </span>
          </div>

          <div className="bg-[#0a0a0a] p-5 rounded border border-white/5 text-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block">Comissão dos Barbeiros (~55%)</span>
            <span className="text-2xl sm:text-3xl font-serif text-yellow-500 mt-1 block font-bold">
              R$ {estimatedBarberTotalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-stone-400 mt-1 block uppercase tracking-widest">
              Garante bônus e fidelização da equipe
            </span>
          </div>

          <div className="bg-[#94a288]/10 p-5 rounded border border-[#94a288]/30 text-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#94a288] block">Lucro Líquido Barbearia (~45%)</span>
            <span className="text-2xl sm:text-3xl font-serif italic font-bold text-white mt-1 block">
              R$ {estimatedHouseNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-[#94a288] mt-1 block uppercase tracking-widest font-bold">
              Margem limpa para a casa
            </span>
          </div>
        </div>
      </section>

      {/* Detailed Service Split Table */}
      <section className="bg-[#1b5f5d] rounded border border-[#94a288]/20 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-serif italic text-white">
              Tabela de Repasse &amp; Margem por Plano e Serviço
            </h3>
            <p className="text-xs text-stone-400 mt-0.5 opacity-80">
              Consulte a matemática exata de custo, valor por atendimento, comissão do barbeiro e lucro da casa.
            </p>
          </div>

          <select
            value={selectedServiceFilter}
            onChange={(e) => setSelectedServiceFilter(e.target.value)}
            className="bg-[#0a0a0a] text-stone-200 text-xs font-bold rounded px-3 py-2 border border-[#94a288]/30 focus:outline-none focus:border-[#94a288]"
          >
            <option value="all">Filtrar por Serviço: Todos</option>
            {SERVICES_LIST.map((srv) => (
              <option key={srv.id} value={srv.id}>
                {srv.name}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0a0a0a] text-stone-400 border-b border-white/10 uppercase font-bold text-[10px] tracking-widest">
                <th className="p-3.5">Plano / Tier</th>
                <th className="p-3.5">Serviço Exigido</th>
                <th className="p-3.5 text-center">Atendimentos</th>
                <th className="p-3.5 text-right">Valor Total</th>
                <th className="p-3.5 text-right">Preço / ATD</th>
                <th className="p-3.5 text-center">Divisão (%)</th>
                <th className="p-3.5 text-right text-yellow-500">Comissão Barbeiro</th>
                <th className="p-3.5 text-right text-[#86d3a7]">Lucro Barbearia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-stone-200 font-medium">
              {filteredPlansTable.map((plan) => {
                const avulso = SERVICES_LIST.find((s) => s.id === plan.serviceId)?.avulsoPrice || 0;
                const barberPct = plan.tier === 'basic' ? '55%' : plan.tier === 'plus' ? '57,5%' : '60%';
                const housePct = plan.tier === 'basic' ? '45%' : plan.tier === 'plus' ? '42,5%' : '40%';

                return (
                  <tr key={plan.id} className="hover:bg-[#202020] transition">
                    <td className="p-3.5">
                      <span className="font-bold text-white uppercase tracking-wider block">{plan.tierLabel}</span>
                      {plan.badgeTag && (
                        <span className="text-[9px] text-stone-400 uppercase tracking-widest">{plan.badgeTag}</span>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span className="text-[#b7db98] font-bold uppercase tracking-wider">{plan.serviceName}</span>
                      <span className="text-[10px] text-stone-400 block">Avulso: R$ {avulso.toFixed(2)}</span>
                    </td>

                    <td className="p-3.5 text-center font-bold text-white font-mono">
                      {plan.numAtendimentos} ATD
                    </td>

                    <td className="p-3.5 text-right font-serif font-bold text-white">
                      R$ {plan.totalPrice.toFixed(2)}
                    </td>

                    <td className="p-3.5 text-right font-bold text-stone-300">
                      R$ {plan.pricePerAtd.toFixed(2)}
                    </td>

                    <td className="p-3.5 text-center font-mono text-[11px]">
                      <span className="text-yellow-400 font-bold">{barberPct}</span>
                      <span className="text-stone-500 mx-1">/</span>
                      <span className="text-[#a8d383] font-bold">{housePct}</span>
                    </td>

                    <td className="p-3.5 text-right font-bold text-yellow-400 bg-yellow-950/10 font-mono">
                      R$ {plan.totalBarberCommission.toFixed(2)}
                    </td>

                    <td className="p-3.5 text-right font-serif font-bold text-[#a5d27e] bg-[#94a288]/10 font-mono">
                      R$ {plan.totalHouseMargin.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Rules Breakdown Note */}
      <div className="bg-[#151515] p-5 rounded border border-[#94a288]/20 text-xs text-stone-300 space-y-2">
        <div className="flex items-center gap-2 font-bold text-white text-sm uppercase tracking-wider">
          <HelpCircle className="w-4 h-4 text-[#9ecb78]" />
          Avisos Importantes de Fechamento Financeiro:
        </div>
        <ul className="list-disc list-inside space-y-1 text-stone-400 leading-relaxed">
          <li>Atendimentos não utilizados pelo cliente ao fim de 30 dias NÃO geram comissão para o barbeiro.</li>
          <li>Os saldos de atendimentos expirados são revertidos para cobrir custos fixos e margem de segurança da barbearia.</li>
          <li>O repasse de comissão é realizado no dia do fechamento contratual do assinante.</li>
        </ul>
      </div>
    </div>
  );
};
