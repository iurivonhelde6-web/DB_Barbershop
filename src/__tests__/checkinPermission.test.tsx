/**
 * Baixa de atendimento (usedSessions) é ato do balcão: só o admin dá check-in.
 *
 * O botão "Registrar Atendimento (-1 ATD)" era renderizado para qualquer usuário,
 * então o cliente conseguia debitar o próprio saldo de cortes. A trava real está
 * na regra do Firestore (subscribers só aceita escrita de admin); este teste cobre
 * a camada visual, para o cliente não reencontrar um botão que não deveria existir.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ControlCardValidation } from '../components/ControlCardValidation';
import { SubscriberCard, UserAccount } from '../types';

// O componente arrasta o PaymentModal, que importa o SDK do Firebase — irrelevante
// para o que está sendo verificado aqui.
vi.mock('../lib/firebase', () => ({ auth: { currentUser: null } }));

const subscriber: SubscriberCard = {
  id: 'stripe_1', cardCode: 'DB-5566', clientName: 'David Rodrigues', cpf: '10009090770',
  phone: '21966126195', planName: 'FAMILY 4 (4 ATD)', serviceName: 'Disfarce Máquina e Tesoura',
  totalSessions: 4, usedSessions: 2, startDate: '2026-09-16', expirationDate: '2036-10-16',
  status: 'ACTIVE', qrCodeValue: '', paymentStatus: 'PAID', userUid: 'uid-david',
};

const admin: UserAccount = { id: 'a1', name: 'Admin', email: 'admin@db.com', role: 'admin' };
const client: UserAccount = { id: 'uid-david', name: 'David Rodrigues', email: 'd@e.com', role: 'client' };

const render = (currentUser: UserAccount) =>
  renderToStaticMarkup(
    <ControlCardValidation
      subscribers={[subscriber]}
      onUpdateSubscriber={() => {}}
      onAddNewSubscriberClick={() => {}}
      currentUser={currentUser}
    />,
  );

describe('ControlCardValidation — quem pode dar baixa em atendimento', () => {
  it('não oferece o botão de registrar atendimento ao cliente', () => {
    expect(render(client)).not.toContain('Registrar Atendimento');
  });

  it('mantém o botão para o admin', () => {
    expect(render(admin)).toContain('Registrar Atendimento');
  });

  it('cliente continua vendo o saldo em modo leitura', () => {
    const html = render(client);
    expect(html).toContain('Sessões Utilizadas');
    expect(html).toContain('2 / 4');
  });
});
