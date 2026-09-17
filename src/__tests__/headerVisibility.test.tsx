/**
 * Garante que o contador "Assinantes Ativos" do cabeçalho é exclusivo do admin.
 *
 * Para o cliente esse número é, além de informação de negócio que não lhe diz
 * respeito, um dado enganoso: o listener do Firestore filtra os assinantes por
 * `userUid`, então o cliente veria a contagem da própria carteirinha rotulada
 * como o total de membros do clube.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Header } from '../components/Header';
import { UserAccount } from '../types';

const baseProps = {
  activeTab: 'plans' as const,
  setActiveTab: () => {},
  activeSubscribersCount: 7,
  onOpenLogin: () => {},
  onOpenBooking: () => {},
  onOpenWhatsApp: () => {},
};

const admin: UserAccount = { id: 'u1', name: 'iuri von helde', email: 'admin@dedblack.com', role: 'admin' };
const client: UserAccount = { id: 'u2', name: 'David Rodrigues', email: 'david@exemplo.com', role: 'client' };

const render = (currentUser: UserAccount | null) =>
  renderToStaticMarkup(<Header {...baseProps} currentUser={currentUser} />);

describe('Header — contador de assinantes ativos', () => {
  it('exibe a contagem para o admin', () => {
    const html = render(admin);
    expect(html).toContain('Assinantes Ativos');
    expect(html).toContain('7 Membros');
  });

  it('oculta a contagem para o cliente', () => {
    const html = render(client);
    expect(html).not.toContain('Assinantes Ativos');
    expect(html).not.toContain('7 Membros');
  });

  it('oculta a contagem quando não há usuário logado', () => {
    const html = render(null);
    expect(html).not.toContain('Assinantes Ativos');
  });

  it('mantém os demais itens do cabeçalho na visão do cliente', () => {
    const html = render(client);
    expect(html).toContain('WhatsApp');
    expect(html).toContain('Agendar Horário');
    expect(html).toContain('Meu Cartão Digital');
    expect(html).toContain('David Rodrigues');
  });
});
