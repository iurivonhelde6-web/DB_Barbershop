/**
 * Testes de validação da lógica de disponibilidade dinâmica.
 *
 * Como as funções do firebase.ts dependem do SDK do Firebase (conexão real),
 * testamos aqui a lógica pura: formatação do docId, validação de slots,
 * e o comportamento esperado das funções de agendamento no modal do cliente.
 */

import { describe, it, expect } from 'vitest';

// ─── Lógica de Document ID ────────────────────────────────────────────────────

describe('availability — formato do document ID', () => {
  /** Replica a lógica de `getBarberAvailability` e `setBarberAvailability`. */
  function buildDocId(barberId: string, date: string): string {
    return `${barberId}_${date}`;
  }

  it('gera docId correto para barber-01 na data 2026-09-10', () => {
    expect(buildDocId('barber-01', '2026-09-10')).toBe('barber-01_2026-09-10');
  });

  it('gera docId correto para barber-06 na data 2026-12-31', () => {
    expect(buildDocId('barber-06', '2026-12-31')).toBe('barber-06_2026-12-31');
  });

  it('docIds diferentes para barbeiros diferentes na mesma data', () => {
    const doc1 = buildDocId('barber-01', '2026-09-10');
    const doc2 = buildDocId('barber-02', '2026-09-10');
    expect(doc1).not.toBe(doc2);
  });

  it('docIds diferentes para o mesmo barbeiro em datas diferentes', () => {
    const doc1 = buildDocId('barber-01', '2026-09-10');
    const doc2 = buildDocId('barber-01', '2026-09-11');
    expect(doc1).not.toBe(doc2);
  });
});

// ─── Lógica de slots disponíveis ─────────────────────────────────────────────

describe('availability — filtragem de slots no modal do cliente', () => {
  /**
   * Replica a lógica do ScheduleBookingModal:
   * - `availableSlots` vem do Firestore (horários liberados pelo admin)
   * - `takenSlots` vem dos agendamentos existentes no mesmo dia/barbeiro
   * - Slot visível se está em `availableSlots`
   * - Slot desabilitado se está em `takenSlots`
   */
  function getDisplaySlots(
    availableSlots: string[],
    takenSlots: string[],
  ): { time: string; disabled: boolean }[] {
    return availableSlots.map((time) => ({
      time,
      disabled: takenSlots.includes(time),
    }));
  }

  const ADMIN_SLOTS = ['09:00', '10:00', '11:00', '14:30', '15:30'];

  it('exibe apenas os slots liberados pelo admin', () => {
    const display = getDisplaySlots(ADMIN_SLOTS, []);
    expect(display.map((s) => s.time)).toEqual(ADMIN_SLOTS);
  });

  it('slots ocupados ficam desabilitados (não removidos)', () => {
    const display = getDisplaySlots(ADMIN_SLOTS, ['09:00', '14:30']);
    const disabled = display.filter((s) => s.disabled).map((s) => s.time);
    const enabled = display.filter((s) => !s.disabled).map((s) => s.time);

    expect(disabled).toEqual(['09:00', '14:30']);
    expect(enabled).toEqual(['10:00', '11:00', '15:30']);
    // Todos os slots ainda aparecem (não são removidos)
    expect(display).toHaveLength(5);
  });

  it('retorna lista vazia quando admin não liberou horários', () => {
    const display = getDisplaySlots([], []);
    expect(display).toHaveLength(0);
  });

  it('slot liberado mas não ocupado fica habilitado', () => {
    const display = getDisplaySlots(['09:00'], []);
    expect(display[0].disabled).toBe(false);
  });

  it('todos os slots ocupados: todos desabilitados, nenhum removido', () => {
    const display = getDisplaySlots(ADMIN_SLOTS, ADMIN_SLOTS);
    expect(display.every((s) => s.disabled)).toBe(true);
    expect(display).toHaveLength(ADMIN_SLOTS.length);
  });

  it('slot tomado não aparece se não foi liberado pelo admin', () => {
    // '13:30' está em takenSlots mas não em availableSlots — não deve aparecer
    const display = getDisplaySlots(['09:00', '10:00'], ['13:30']);
    expect(display.map((s) => s.time)).not.toContain('13:30');
    expect(display).toHaveLength(2);
  });
});

// ─── Lógica de seleção automática de slot ────────────────────────────────────

describe('availability — seleção automática ao trocar barbeiro/data', () => {
  /**
   * Replica o comportamento do useEffect do ScheduleBookingModal:
   * "se o slot selecionado não está na nova lista, seleciona o primeiro disponível"
   */
  function resolveSelectedTime(
    currentSelected: string,
    newSlots: string[],
  ): string {
    if (newSlots.length === 0) return currentSelected; // mantém (mas botão fica desabilitado)
    if (!newSlots.includes(currentSelected)) return newSlots[0];
    return currentSelected;
  }

  it('mantém slot selecionado se ele ainda está disponível', () => {
    expect(resolveSelectedTime('09:00', ['09:00', '10:00', '14:30'])).toBe('09:00');
  });

  it('troca para o primeiro slot quando o selecionado sumiu', () => {
    expect(resolveSelectedTime('13:30', ['09:00', '10:00'])).toBe('09:00');
  });

  it('mantém seleção atual se slots estão vazios (barbeiro sem expediente)', () => {
    expect(resolveSelectedTime('14:30', [])).toBe('14:30');
  });

  it('seleciona o primeiro slot quando nenhum foi selecionado antes', () => {
    expect(resolveSelectedTime('', ['10:00', '15:30'])).toBe('10:00');
  });
});

// ─── Lógica do AvailabilityManager — isDirty ────────────────────────────────

describe('AvailabilityManager — detecção de alterações não salvas (isDirty)', () => {
  /** Replica a lógica de `isDirty` do AvailabilityManager. */
  function isDirty(draft: string[], saved: string[]): boolean {
    if (draft.length !== saved.length) return true;
    return draft.some((h) => !saved.includes(h));
  }

  it('não está dirty quando draft === saved', () => {
    expect(isDirty(['09:00', '14:30'], ['09:00', '14:30'])).toBe(false);
  });

  it('está dirty quando um slot foi adicionado', () => {
    expect(isDirty(['09:00', '14:30', '15:30'], ['09:00', '14:30'])).toBe(true);
  });

  it('está dirty quando um slot foi removido', () => {
    expect(isDirty(['09:00'], ['09:00', '14:30'])).toBe(true);
  });

  it('está dirty quando um slot diferente está no draft', () => {
    expect(isDirty(['09:00', '15:30'], ['09:00', '14:30'])).toBe(true);
  });

  it('não está dirty com listas vazias', () => {
    expect(isDirty([], [])).toBe(false);
  });

  it('está dirty quando saved tem slots mas draft está vazio', () => {
    expect(isDirty([], ['09:00'])).toBe(true);
  });

  it('está dirty quando draft tem slots mas saved está vazio', () => {
    expect(isDirty(['09:00'], [])).toBe(true);
  });

  it('ordem dos slots não afeta o resultado (sorted externamente)', () => {
    // isDirty compara com `.some()` e `.includes()`, não por posição
    expect(isDirty(['14:30', '09:00'], ['09:00', '14:30'])).toBe(false);
  });
});
