/**
 * Apuração do repasse semanal por barbeiro.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { groupAttendancesByBarber, sumPayouts } from '../utils/attendance';
import { BarberPayouts } from '../components/BarberPayouts';
import { AttendanceRecord } from '../types';

vi.mock('../lib/firebase', () => ({ auth: { currentUser: null } }));

const att = (over: Partial<AttendanceRecord> = {}): AttendanceRecord => ({
  id: Math.random().toString(36).slice(2),
  barberId: 'barber-02', barberName: 'Ismael',
  subscriberId: 'sub-1', clientName: 'Cliente A', cardCode: 'DB-1111', userUid: 'uid-1',
  date: '2026-09-16', time: '10:00', createdAt: '2026-09-16T13:00:00.000Z',
  planName: 'BASIC 3 (3 ATD)', serviceName: 'Corte Simples',
  attendanceValue: 17.5, barberCommission: 9.63, commissionPercentage: 55,
  registeredBy: 'uid-admin', derivedValues: false,
  ...over,
});

describe('groupAttendancesByBarber', () => {
  it('soma os atendimentos de cada barbeiro separadamente', () => {
    const grupos = groupAttendancesByBarber([
      att({ barberId: 'b1', barberName: 'Ismael', barberCommission: 9.63, attendanceValue: 17.5 }),
      att({ barberId: 'b1', barberName: 'Ismael', barberCommission: 9.63, attendanceValue: 17.5 }),
      att({ barberId: 'b2', barberName: 'Ricardo', barberCommission: 21.66, attendanceValue: 39.37 }),
    ]);

    expect(grupos).toHaveLength(2);
    const ismael = grupos.find((g) => g.barberId === 'b1')!;
    expect(ismael.totalAttendances).toBe(2);
    expect(ismael.totalCommission).toBe(19.26);
    expect(ismael.totalRevenue).toBe(35);
  });

  it('ordena por maior repasse — quem tem mais a receber aparece primeiro', () => {
    const grupos = groupAttendancesByBarber([
      att({ barberId: 'b1', barberName: 'Pouco', barberCommission: 5 }),
      att({ barberId: 'b2', barberName: 'Muito', barberCommission: 50 }),
    ]);
    expect(grupos[0].barberName).toBe('Muito');
  });

  it('lista os atendimentos do barbeiro do mais recente para o mais antigo', () => {
    const grupos = groupAttendancesByBarber([
      att({ date: '2026-09-14', time: '09:00' }),
      att({ date: '2026-09-16', time: '15:00' }),
      att({ date: '2026-09-16', time: '08:00' }),
    ]);
    expect(grupos[0].attendances.map((a) => `${a.date} ${a.time}`)).toEqual([
      '2026-09-16 15:00',
      '2026-09-16 08:00',
      '2026-09-14 09:00',
    ]);
  });

  it('não acumula centavos errados ao somar muitos atendimentos', () => {
    const muitos = Array.from({ length: 10 }, () => att({ barberCommission: 8.63, attendanceValue: 15 }));
    const [grupo] = groupAttendancesByBarber(muitos);
    expect(grupo.totalCommission).toBe(86.3);
    expect(grupo.totalRevenue).toBe(150);
  });

  it('devolve lista vazia sem atendimentos', () => {
    expect(groupAttendancesByBarber([])).toEqual([]);
  });
});

describe('sumPayouts', () => {
  it('totaliza o repasse de todos os barbeiros', () => {
    const grupos = groupAttendancesByBarber([
      att({ barberId: 'b1', barberCommission: 9.63, attendanceValue: 17.5 }),
      att({ barberId: 'b2', barberCommission: 21.66, attendanceValue: 39.37 }),
    ]);
    const totais = sumPayouts(grupos);
    expect(totais.totalCommission).toBe(31.29);
    expect(totais.totalRevenue).toBe(56.87);
    expect(totais.totalAttendances).toBe(2);
  });

  it('zera com lista vazia', () => {
    expect(sumPayouts([])).toEqual({ totalCommission: 0, totalRevenue: 0, totalAttendances: 0 });
  });
});

describe('Tela de repasses', () => {
  // A tela abre na semana corrente; as datas abaixo usam a semana do "hoje" do teste
  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  it('mostra o barbeiro e o total a repassar', () => {
    const html = renderToStaticMarkup(
      <BarberPayouts attendances={[att({ date: hojeISO, barberName: 'Ismael', barberCommission: 9.63 })]} />,
    );
    expect(html).toContain('Ismael');
    expect(html).toContain('Total a Repassar');
    expect(html).toContain('Cliente A');
  });

  it('exibe estado vazio quando não há atendimento no período', () => {
    const html = renderToStaticMarkup(<BarberPayouts attendances={[]} />);
    expect(html).toContain('Nenhum atendimento no período');
  });

  it('sinaliza quando há valores derivados no período', () => {
    const html = renderToStaticMarkup(
      <BarberPayouts attendances={[att({ date: hojeISO, derivedValues: true })]} />,
    );
    expect(html).toContain('derivado');
  });

  it('não sinaliza derivados quando todos os valores vieram da tabela', () => {
    const html = renderToStaticMarkup(<BarberPayouts attendances={[att({ date: hojeISO })]} />);
    expect(html).not.toContain('derivado');
  });
});
