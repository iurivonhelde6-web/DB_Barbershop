import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Save, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { BARBERS_LIST } from '../data/barberData';
import { setBarberAvailability, subscribeToAvailabilityForDate } from '../lib/firebase';
import { auth } from '../lib/firebase';

const ALL_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', '13:30',
  '14:30', '15:30', '16:30', '17:30', '18:30', '19:30',
];

export const AvailabilityManager: React.FC = () => {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Mapa barberId → horários selecionados (estado de edição local)
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  // Mapa barberId → horários já salvos no Firestore (vem do listener)
  const [saved, setSaved] = useState<Record<string, string[]>>({});

  const [isSaving, setIsSaving] = useState<string | null>(null); // barberId em salvamento
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setError] = useState<string | null>(null);

  // Listener em tempo real: atualiza `saved` e `draft` quando o admin carrega nova data
  useEffect(() => {
    const unsubscribe = subscribeToAvailabilityForDate(selectedDate, (data) => {
      setSaved(data);
      // Inicializa o rascunho com o que veio do Firestore (para cada barbeiro)
      setDraft(prev => {
        const next: Record<string, string[]> = {};
        BARBERS_LIST.forEach(b => {
          // Se já há edição local não salva, mantém ela; caso contrário usa o valor do Firestore
          next[b.id] = prev[b.id] !== undefined ? prev[b.id] : (data[b.id] ?? []);
        });
        return next;
      });
    });
    // Ao trocar de data, zera o draft para que o listener preencha com os dados da nova data
    setDraft({});
    return unsubscribe;
  }, [selectedDate]);

  const toggleSlot = useCallback((barberId: string, slot: string) => {
    setDraft(prev => {
      const current = prev[barberId] ?? [];
      const updated = current.includes(slot)
        ? current.filter(s => s !== slot)
        : [...current, slot].sort();
      return { ...prev, [barberId]: updated };
    });
  }, []);

  const selectAll = useCallback((barberId: string) => {
    setDraft(prev => ({ ...prev, [barberId]: [...ALL_SLOTS] }));
  }, []);

  const clearAll = useCallback((barberId: string) => {
    setDraft(prev => ({ ...prev, [barberId]: [] }));
  }, []);

  const handleSave = async (barberId: string) => {
    const adminUid = auth.currentUser?.uid;
    if (!adminUid) return;
    setIsSaving(barberId);
    setSaveSuccess(null);
    setError(null);
    try {
      const horarios = draft[barberId] ?? [];
      await setBarberAvailability(barberId, selectedDate, horarios, adminUid);
      setSaveSuccess(barberId);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar.');
    } finally {
      setIsSaving(null);
    }
  };

  const isDirty = (barberId: string) => {
    const d = draft[barberId] ?? [];
    const s = saved[barberId] ?? [];
    if (d.length !== s.length) return true;
    return d.some(h => !s.includes(h));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#94a288]" />
            Gestão de Agenda por Barbeiro
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Defina quais horários cada barbeiro atende por dia. Sem horários cadastrados = sem expediente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#94a288]"
          />
        </div>
      </div>

      {saveError && (
        <div className="p-3 bg-red-950/60 border border-red-500/40 text-red-300 rounded-lg text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {saveError}
        </div>
      )}

      {/* Barbeiro Cards */}
      <div className="space-y-4">
        {BARBERS_LIST.map((barber) => {
          const selectedSlots = draft[barber.id] ?? [];
          const dirty = isDirty(barber.id);
          const saving = isSaving === barber.id;
          const success = saveSuccess === barber.id;

          return (
            <div
              key={barber.id}
              className="bg-[#0d0d0d] border border-white/10 rounded-xl p-4 space-y-3"
            >
              {/* Barber header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#1c1c1c] border border-white/10 flex items-center justify-center text-lg shrink-0">
                    {barber.avatar}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white">{barber.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {selectedSlots.length > 0 ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 border border-emerald-500/30 text-emerald-400 font-mono font-bold">
                          {selectedSlots.length} horário{selectedSlots.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 border border-white/10 text-stone-500 font-mono">
                          Sem expediente
                        </span>
                      )}
                      {dirty && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 border border-amber-500/30 text-amber-400 font-mono">
                          Alterado
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectAll(barber.id)}
                    className="text-[10px] px-2 py-1 rounded bg-[#1a1a1a] border border-white/10 text-stone-400 hover:text-white hover:border-white/30 transition font-bold uppercase tracking-wider"
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => clearAll(barber.id)}
                    className="text-[10px] px-2 py-1 rounded bg-[#1a1a1a] border border-white/10 text-stone-400 hover:text-red-400 hover:border-red-500/30 transition font-bold uppercase tracking-wider"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(barber.id)}
                    disabled={saving || !dirty}
                    className={`text-[10px] px-3 py-1.5 rounded font-bold uppercase tracking-wider flex items-center gap-1.5 transition border ${
                      success
                        ? 'bg-emerald-900/50 border-emerald-500/40 text-emerald-400'
                        : dirty
                        ? 'bg-[#94a288] border-[#94a288] text-black hover:bg-[#69843a]'
                        : 'bg-[#1a1a1a] border-white/10 text-stone-600 cursor-not-allowed'
                    }`}
                  >
                    {saving ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : success ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    {saving ? 'Salvando...' : success ? 'Salvo!' : 'Salvar'}
                  </button>
                </div>
              </div>

              {/* Time Slots Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-1.5">
                {ALL_SLOTS.map((slot) => {
                  const active = selectedSlots.includes(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => toggleSlot(barber.id, slot)}
                      className={`py-1.5 rounded text-[11px] font-mono font-bold text-center transition border ${
                        active
                          ? 'bg-[#94a288] border-[#94a288] text-black'
                          : 'bg-[#141414] border-white/5 text-stone-500 hover:border-white/20 hover:text-stone-300'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-stone-600 text-center">
        As alterações só são efetivadas ao clicar em "Salvar" em cada barbeiro. O cliente só vê os horários salvos.
      </p>
    </div>
  );
};
