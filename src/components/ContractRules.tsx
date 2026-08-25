import React, { useState } from 'react';
import { CONTRACT_RULES } from '../data/barberData';
import {
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  Printer,
  ShieldCheck,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export const ContractRules: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isPrintContractOpen, setIsPrintContractOpen] = useState<boolean>(false);
  const [clientPrintName, setClientPrintName] = useState<string>('Carlos Eduardo Silva');
  const [clientPrintCpf, setClientPrintCpf] = useState<string>('123.456.789-00');

  const filteredRules = CONTRACT_RULES.filter(
    (rule) =>
      rule.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.number.includes(searchTerm)
  );

  const todayDateStr = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="bg-[#0c0c0c] min-h-screen text-[#e0e0e0] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#556b2f]/30 pb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#556b2f]/20 text-[#556b2f] text-[10px] font-bold uppercase tracking-[0.3em] mb-2 border border-[#556b2f]/40">
            <FileText className="w-3.5 h-3.5 text-[#556b2f]" />
            Termo de Adesão &amp; Regulamento Oficial
          </span>
          <h2 className="text-3xl font-serif italic text-white">
            Regras do Contrato D•B Barbershop
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-1 opacity-80">
            Consulte as 14 cláusulas oficiais que regem os Planos de Assinatura, tolerâncias e condições de uso.
          </p>
        </div>

        <button
          onClick={() => setIsPrintContractOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded bg-[#556b2f] hover:bg-[#6b863a] text-black text-[10px] font-bold uppercase tracking-widest transition shadow-lg"
        >
          <Printer className="w-4 h-4 text-black" />
          Gerar Contrato Completo p/ Impressão
        </button>
      </div>

      {/* Allowed vs Forbidden Swap Highlight Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#556b2f]/10 border border-[#556b2f]/30 p-5 rounded space-y-3">
          <div className="flex items-center gap-2 text-[#556b2f] font-bold text-xs uppercase tracking-widest">
            <CheckCircle2 className="w-5 h-5 text-[#556b2f]" />
            ✅ Permissões e Trocas de Serviço
          </div>
          <p className="text-xs text-stone-300 leading-relaxed opacity-80">
            Assinantes do plano <strong>Disfarçado Tesoura + Máquina</strong> possuem flexibilidade para realizar um <strong>Corte Simples</strong> ou uma <strong>Barba</strong> na visita, caso prefiram!
          </p>
        </div>

        <div className="bg-red-950/20 border border-red-500/30 p-5 rounded space-y-3">
          <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-widest">
            <XCircle className="w-5 h-5 text-red-400" />
            ❌ Vedações e Proibições
          </div>
          <ul className="text-xs text-stone-300 space-y-1.5 list-disc list-inside opacity-80">
            <li>Assinantes do plano Corte Simples NÃO podem trocar por Disfarçado Tesoura.</li>
            <li>NÃO é permitido somar 2 atendimentos para cobrir um serviço de valor superior.</li>
            <li>Serviços não acumulativos para o mês seguinte.</li>
          </ul>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          placeholder="Filtrar cláusula por palavra-chave ou número..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#151515] text-stone-100 text-xs rounded pl-10 pr-4 py-3 border border-[#556b2f]/30 focus:outline-none focus:border-[#556b2f]"
        />
      </div>

      {/* Accordion List of 14 Clauses */}
      <div className="space-y-4">
        {filteredRules.map((rule) => (
          <div
            key={rule.id}
            className="bg-[#151515] rounded border border-white/5 p-5 hover:border-[#556b2f]/40 transition space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded bg-[#0a0a0a] text-[#556b2f] font-mono text-xs font-bold flex items-center justify-center border border-[#556b2f]/30">
                  {rule.number}
                </span>
                <h3 className="text-base font-serif italic text-white">
                  {rule.title}
                </h3>
              </div>

              {rule.badge && (
                <span className="px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-[#0a0a0a] text-[#556b2f] border border-[#556b2f]/30">
                  {rule.badge}
                </span>
              )}
            </div>

            <p className="text-xs text-stone-300 leading-relaxed whitespace-pre-line pl-11 opacity-80">
              {rule.content}
            </p>
          </div>
        ))}
      </div>

      {/* Printable Official Contract Modal */}
      {isPrintContractOpen && (
        <div className="fixed inset-0 z-50 bg-[#0c0c0c]/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151515] border border-[#556b2f]/40 rounded max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-lg font-serif italic text-white">
                Termo Contratual p/ Assinatura Impressa
              </h3>
              <button
                onClick={() => setIsPrintContractOpen(false)}
                className="text-stone-400 hover:text-white text-xs font-bold uppercase tracking-widest"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-stone-300 font-bold block mb-1 uppercase tracking-wider text-[10px]">Nome do Cliente:</label>
                <input
                  type="text"
                  value={clientPrintName}
                  onChange={(e) => setClientPrintName(e.target.value)}
                  className="w-full bg-[#0a0a0a] text-stone-100 px-3 py-2 rounded border border-[#556b2f]/30"
                />
              </div>

              <div>
                <label className="text-stone-300 font-bold block mb-1 uppercase tracking-wider text-[10px]">CPF do Cliente:</label>
                <input
                  type="text"
                  value={clientPrintCpf}
                  onChange={(e) => setClientPrintCpf(e.target.value)}
                  className="w-full bg-[#0a0a0a] text-stone-100 px-3 py-2 rounded border border-[#556b2f]/30"
                />
              </div>
            </div>

            {/* Contract Sheet Preview */}
            <div className="bg-white text-stone-900 p-8 rounded shadow-inner text-xs font-sans space-y-4 leading-relaxed border">
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-bold font-serif tracking-widest uppercase">CONTRATO OFICIAL DE ASSINATURA</h2>
                <h3 className="text-sm font-bold text-stone-700">BARBEARIA DED BLACK (D•B BARBERSHOP)</h3>
              </div>

              <div>
                <strong>CONTRATANTE:</strong> {clientPrintName} (CPF: {clientPrintCpf})
                <br />
                <strong>CONTRATADA:</strong> BARBEARIA DED BLACK (D•B BARBERSHOP)
              </div>

              <div className="space-y-2 text-[11px] text-stone-800">
                <p><strong>1. OBJETO:</strong> O presente instrumento regula a adesão ao Clube de Assinaturas da D•B BARBERSHOP no ciclo de 30 dias.</p>
                <p><strong>2. USO E CARTÃO:</strong> O cliente declara ciência da obrigatoriedade de apresentar documento oficial e Cartão de Controle (físico/digital) em cada visita.</p>
                <p><strong>3. NÃO ACÚMULO:</strong> Atendimentos não utilizados no mês vencem em 30 dias e não acumulam.</p>
                <p><strong>4. TOLERÂNCIA:</strong> Tolerância máxima de 10 minutos de atraso.</p>
              </div>

              <div className="pt-8 grid grid-cols-2 gap-8 text-center border-t text-[11px] font-medium">
                <div>
                  <div className="border-t border-stone-800 pt-1 mt-6">
                    Assinatura do Cliente
                  </div>
                  <span>{clientPrintName}</span>
                </div>

                <div>
                  <div className="border-t border-stone-800 pt-1 mt-6">
                    Assinatura da Barbearia
                  </div>
                  <span>DED BLACK BARBERSHOP</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-stone-500 pt-2 font-mono">
                Data do Contrato: {todayDateStr}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded bg-[#556b2f] hover:bg-[#6b863a] text-black text-[10px] font-bold uppercase tracking-widest shadow-md flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimir Documento Oficial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
