import React, { useState } from 'react';
import { AttendanceRecord } from '../types';
import { groupAttendancesByBarber, sumPayouts } from '../utils/attendance';
import {
  DATE_PRESETS,
  DatePreset,
  describeDateRange,
  isDateInRange,
  resolveDateRange,
} from '../utils/dateRange';
import {
  Scissors,
  Wallet,
  CalendarRange,
  AlertTriangle,
  Users,
  TrendingUp,
  Info,
} from 'lucide-react';

interface BarberPayoutsProps {
  attendances: AttendanceRecord[];
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

export const BarberPayouts: React.FC<BarberPayoutsProps> = ({ attendances }) => {
  // O repasse é semanal, então a semana corrente é o recorte padrão.
  const [datePreset, setDatePreset] = useState<DatePreset>('THIS_WEEK');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const dateRange = resolveDateRange(datePreset, customStartDate, customEndDate);
  const periodLabel = describeDateRange(datePreset, dateRange, customStartDate, customEndDate);

  const noPeriodo = attendances.filter((a) => isDateInRange(a.date, dateRange));
  const payouts = groupAttendancesByBarber(noPeriodo);
  const totais = sumPayouts(payouts);
  const temValorDerivado = noPeriodo.some((a) => a.derivedValues);

  return (
    <div className="bg-[#0c0c0c] min-h-screen text-[#e0e0e0] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-16">
      {/* Cabeçalho */}
      <div className="border-b border-[#94a288]/30 pb-6">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#94a288]/20 text-[#94a288] text-[10px] font-bold uppercase tracking-[0.3em] mb-2 border border-[#94a288]/40">
          <Wallet className="w-3.5 h-3.5" />
          Fechamento Semanal
        </span>
        <h2 className="text-3xl font-serif italic text-white">
          Repasse <span className="text-[#94a288]">por Barbeiro</span>
        </h2>
        <p className="text-xs sm:text-sm text-stone-400 mt-1 opacity-80">
          Comissões dos atendimentos efetivamente realizados (check-in confirmado no balcão).
          Agendamentos futuros não entram neste cálculo.
        </p>
      </div>

      {/* Filtro de período */}
      <div className="bg-[#151515] border border-[#94a288]/30 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-[#94a288]" />
          <span className="text-[10px] uppercase tracking-widest text-[#94a288] font-bold">
            Período do Repasse
          </span>
          {periodLabel && (
            <span className="text-[10px] text-stone-400 font-mono ml-auto">{periodLabel}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setDatePreset(preset.id)}
              className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition whitespace-nowrap border ${
                datePreset === preset.id
                  ? 'bg-[#94a288] text-black border-[#94a288] shadow'
                  : 'bg-[#0a0a0a] text-stone-400 border-white/5 hover:text-white hover:border-[#94a288]/40'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {datePreset === 'CUSTOM' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block mb-1">
                Início
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full bg-[#0a0a0a] text-stone-100 text-xs rounded px-3 py-2 border border-[#94a288]/30 focus:outline-none focus:border-[#94a288]"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block mb-1">
                Fim
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full bg-[#0a0a0a] text-stone-100 text-xs rounded px-3 py-2 border border-[#94a288]/30 focus:outline-none focus:border-[#94a288]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0a0a0a] border border-[#94a288]/50 p-5 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-1">
            Total a Repassar
          </span>
          <div className="text-3xl font-mono font-bold text-[#94a288]">
            {brl(totais.totalCommission)}
          </div>
          <span className="text-[10px] text-stone-500 block mt-1">
            Somando todos os barbeiros no período
          </span>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 p-5 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-1">
            Atendimentos Realizados
          </span>
          <div className="text-3xl font-mono font-bold text-white flex items-center gap-2">
            <Scissors className="w-6 h-6 text-stone-500" />
            {totais.totalAttendances}
          </div>
          <span className="text-[10px] text-stone-500 block mt-1">
            Faturamento gerado: {brl(totais.totalRevenue)}
          </span>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 p-5 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-1">
            Barbeiros com Repasse
          </span>
          <div className="text-3xl font-mono font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-stone-500" />
            {payouts.length}
          </div>
          <span className="text-[10px] text-stone-500 block mt-1">
            Margem da barbearia: {brl(Math.max(0, totais.totalRevenue - totais.totalCommission))}
          </span>
        </div>
      </div>

      {temValorDerivado && (
        <div className="bg-amber-950/40 border border-amber-500/40 p-3.5 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Alguns atendimentos deste período têm valores <strong>derivados</strong>: o plano do
            cliente não estava na tabela no momento do check-in, e a comissão foi rateada a partir
            do valor pago. Estão marcados na lista.
          </span>
        </div>
      )}

      {/* Repasse por barbeiro */}
      {payouts.length === 0 ? (
        <div className="bg-[#151515] border border-white/10 rounded-xl p-10 text-center space-y-2">
          <Info className="w-8 h-8 text-stone-600 mx-auto" />
          <h3 className="text-sm font-bold text-stone-300">Nenhum atendimento no período</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
            Os repasses aparecem aqui conforme os atendimentos forem registrados no check-in,
            com o barbeiro responsável selecionado.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {payouts.map((payout) => (
            <div
              key={payout.barberId}
              className="bg-[#151515] border border-[#94a288]/25 rounded-xl overflow-hidden"
            >
              {/* Cabeçalho do barbeiro */}
              <div className="bg-[#0f0f0f] px-5 py-4 border-b border-[#94a288]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#94a288]/15 border border-[#94a288]/40 flex items-center justify-center text-[#94a288]">
                    <Scissors className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                      {payout.barberName}
                    </h3>
                    <span className="text-[11px] text-stone-400">
                      {payout.totalAttendances}{' '}
                      {payout.totalAttendances === 1 ? 'atendimento' : 'atendimentos'} &bull; gerou{' '}
                      {brl(payout.totalRevenue)}
                    </span>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold block">
                    A Repassar
                  </span>
                  <span className="text-2xl font-mono font-bold text-[#94a288]">
                    {brl(payout.totalCommission)}
                  </span>
                </div>
              </div>

              {/* Atendimentos do barbeiro */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#0a0a0a] text-stone-400 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3 text-left font-bold">Data / Hora</th>
                      <th className="p-3 text-left font-bold">Cliente</th>
                      <th className="p-3 text-left font-bold">Serviço</th>
                      <th className="p-3 text-right font-bold">Valor</th>
                      <th className="p-3 text-right font-bold text-[#94a288]">Comissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {payout.attendances.map((att) => (
                      <tr key={att.id} className="hover:bg-[#1a1a1a] transition">
                        <td className="p-3 font-mono text-stone-300 whitespace-nowrap">
                          {formatDate(att.date)}
                          <span className="text-stone-500"> {att.time}</span>
                        </td>
                        <td className="p-3">
                          <span className="text-stone-100 font-bold block">{att.clientName}</span>
                          {att.cardCode && (
                            <span className="text-[10px] text-stone-500 font-mono">{att.cardCode}</span>
                          )}
                        </td>
                        <td className="p-3 text-stone-300">
                          <span className="block">{att.serviceName}</span>
                          <span className="text-[10px] text-stone-500 uppercase tracking-wider">
                            {att.planName}
                            {att.derivedValues && (
                              <span className="ml-1.5 text-amber-400 font-bold">• derivado</span>
                            )}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-stone-200">
                          {brl(att.attendanceValue)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[#94a288] whitespace-nowrap">
                          {brl(att.barberCommission)}
                          <span className="block text-[9px] text-stone-500 font-sans">
                            {att.commissionPercentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#0a0a0a] border-t border-[#94a288]/30">
                    <tr>
                      <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-[10px] font-bold text-stone-400">
                        Total de {payout.barberName}
                      </td>
                      <td className="p-3 text-right font-mono text-stone-300">
                        {brl(payout.totalRevenue)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-[#94a288]">
                        {brl(payout.totalCommission)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 text-[10px] text-stone-500 leading-relaxed pt-2">
        <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Os valores são os que estavam vigentes no momento de cada check-in — alterações
          posteriores na tabela de planos não reescrevem repasses já realizados.
        </span>
      </div>
    </div>
  );
};
