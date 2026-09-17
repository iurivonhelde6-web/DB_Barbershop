/**
 * Monta o registro de um atendimento realizado, com o valor e a comissão já
 * calculados no momento do check-in.
 *
 * Congelar os valores é proposital: o repasse tem de refletir o que valia quando
 * o corte aconteceu, e não o que a tabela de preços passou a dizer depois.
 */

import { AttendanceRecord, Barber, PlanOption, SubscriberCard } from '../types';
import {
  getAttendanceValue,
  getBarberCommissionPerAttendance,
  getBarberPercentage,
} from './commission';

/**
 * Localiza o plano do assinante exigindo plano E serviço.
 *
 * `tierLabel` sozinho não identifica um plano: "BASIC 3 (3 ATD)" existe para
 * corte, barba, tesoura e disfarce, com valores diferentes. Casar só pelo rótulo
 * pegaria o primeiro da lista e pagaria a comissão do serviço errado.
 */
export function findSubscriberPlan(
  plans: PlanOption[],
  planName: string,
  serviceName: string,
): PlanOption | undefined {
  return (
    plans.find((p) => p.tierLabel === planName && p.serviceName === serviceName) ??
    plans.find((p) => p.id === planName)
  );
}

/** Divisão usada quando o plano do assinante não existe mais na tabela. */
const FALLBACK_BARBER_RATIO = 0.55;

export interface BuildAttendanceInput {
  subscriber: SubscriberCard;
  barber: Pick<Barber, 'id' | 'name'>;
  plans: PlanOption[];
  registeredBy: string;
  now?: Date;
}

export function buildAttendanceRecord({
  subscriber,
  barber,
  plans,
  registeredBy,
  now = new Date(),
}: BuildAttendanceInput): Omit<AttendanceRecord, 'id'> {
  const plan = findSubscriberPlan(plans, subscriber.planName, subscriber.serviceName);

  let attendanceValue: number;
  let barberCommission: number;
  let commissionPercentage: number;
  let derivedValues = false;

  if (plan) {
    attendanceValue = getAttendanceValue(plan);
    barberCommission = getBarberCommissionPerAttendance(plan);
    commissionPercentage = getBarberPercentage(plan);
  } else {
    // Plano fora da tabela (renomeado ou descontinuado): rateia o que o cliente
    // pagou pelo número de atendimentos do ciclo, para o barbeiro não ficar sem
    // repasse por causa de uma mudança de catálogo.
    derivedValues = true;
    const paid = subscriber.paidAmount || subscriber.expectedAmount || 0;
    const sessions = subscriber.totalSessions > 0 ? subscriber.totalSessions : 1;
    attendanceValue = round2(paid / sessions);
    barberCommission = round2(attendanceValue * FALLBACK_BARBER_RATIO);
    commissionPercentage = FALLBACK_BARBER_RATIO * 100;
  }

  return {
    barberId: barber.id,
    barberName: barber.name,
    subscriberId: subscriber.id,
    clientName: subscriber.clientName,
    cardCode: subscriber.cardCode || '',
    userUid: subscriber.userUid || '',
    date: toLocalDate(now),
    time: toLocalTime(now),
    createdAt: now.toISOString(),
    planName: subscriber.planName,
    serviceName: subscriber.serviceName,
    attendanceValue,
    barberCommission,
    commissionPercentage,
    registeredBy,
    derivedValues,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Data local (não UTC): o repasse é fechado pelo dia do balcão. */
function toLocalDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function toLocalTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
