// ─── PÁGINA PÚBLICA DE CONFIRMAÇÃO DE AGENDAMENTO ───────────────────────────
// Created: 2026-02-06
// Purpose: Allows patients to confirm their appointments via link
// ────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, AlertCircle, CheckCircle, CreditCard, Mail, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AppointmentData {
    patient_name: string;
    suggested_date?: string;
    suggested_time?: string;
}

export default function PublicConfirmation() {
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const [appointmentData, setAppointmentData] = useState<AppointmentData | null>(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [recurrence, setRecurrence] = useState<'single' | 'weekly' | 'biweekly' | 'monthly'>('single');

    // New Fields
    const [paymentMethod, setPaymentMethod] = useState('');
    const [paymentDueDay, setPaymentDueDay] = useState('');
    const [additionalEmail, setAdditionalEmail] = useState('');
    const [additionalPhone, setAdditionalPhone] = useState('');

    useEffect(() => {
        // Pegar token da URL
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        const patientId = params.get('patient_id');

        if (!urlToken) {
            setError('Link inválido');
            setLoading(false);
            return;
        }

        setToken(urlToken);
        loadAppointmentData(urlToken, patientId);
    }, []);

    const loadAppointmentData = async (token: string, patient_id?: string | null) => {
        try {
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-appointment-by-token`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, patient_id }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao carregar dados');
            }

            setAppointmentData(data.appointment);

            // Preencher campos se vier pré-agendado
            if (data.appointment.suggested_date) {
                setSelectedDate(data.appointment.suggested_date);
            }
            if (data.appointment.suggested_time) {
                setSelectedTime(data.appointment.suggested_time);
            }

            setLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!selectedDate || !selectedTime || !paymentMethod || !paymentDueDay) {
            setError('Por favor, preencha todos os campos obrigatórios (Data, Horário e Pagamento)');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-appointment`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token,
                        patient_id: new URLSearchParams(window.location.search).get('patient_id'),
                        date: selectedDate,
                        time: selectedTime,
                        recurrence,
                        payment_method: paymentMethod,
                        payment_due_day: parseInt(paymentDueDay),
                        additional_email: additionalEmail || null,
                        additional_phone: additionalPhone || null
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 409) {
                    throw new Error('Este horário já está ocupado. Por favor, escolha outra data ou horário.');
                }
                throw new Error(data.error || 'Erro ao confirmar');
            }

            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao confirmar agendamento');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Carregando...</p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">
                        Muito obrigado por confirmar sua presença!
                    </h1>
                    <p className="text-gray-600 mb-4">
                        Você receberá um e-mail de confirmação em breve.
                    </p>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
                        <p className="text-sm text-gray-700">
                            <strong>📅 Data:</strong> {format(new Date(selectedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                        <p className="text-sm text-gray-700 mt-2">
                            <strong>🕐 Horário:</strong> {selectedTime}
                        </p>
                        <p className="text-sm text-gray-700 mt-2">
                            <strong>💳 Pagamento:</strong> {paymentMethod === 'card' ? 'Cartão' : paymentMethod === 'pix' ? 'PIX' : 'Dinheiro'} (Dia {paymentDueDay})
                        </p>
                        {recurrence !== 'single' && (
                            <p className="text-sm text-gray-700 mt-2">
                                <strong>🔄 Recorrência:</strong>{' '}
                                {recurrence === 'weekly' && 'Semanal'}
                                {recurrence === 'biweekly' && 'Quinzenal'}
                                {recurrence === 'monthly' && 'Mensal'}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (error && !appointmentData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-10 h-10 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">
                        Link Inválido
                    </h1>
                    <p className="text-gray-600">
                        {error}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full font-handwriting">
                <h1 className="text-3xl font-bold text-verde-botanico mb-4 font-sans">
                    Confirmar Agendamento
                </h1>

                {appointmentData && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2 text-gray-700">
                            <User className="w-5 h-5 text-blue-500" />
                            <span className="font-medium text-lg text-blue-900">{appointmentData.patient_name}</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    {/* Section: Data e Horário */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-green-600" />
                            Quando?
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Data
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    min={format(new Date(), 'yyyy-MM-dd')}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Horário
                                </label>
                                <input
                                    type="time"
                                    value={selectedTime}
                                    onChange={(e) => setSelectedTime(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Frequência
                            </label>
                            <select
                                value={recurrence}
                                onChange={(e) => setRecurrence(e.target.value as any)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                            >
                                <option value="single">Sessão única (Apenas uma vez)</option>
                                <option value="weekly">Semanal (Toda semana)</option>
                                <option value="biweekly">Quinzenal (A cada 15 dias)</option>
                                <option value="monthly">Mensal (Uma vez por mês)</option>
                            </select>
                        </div>
                    </div>

                    {/* Section: Pagamento */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-green-600" />
                            Pagamento
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Forma de Pagamento *
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="card">Cartão</option>
                                    <option value="pix">PIX</option>
                                    <option value="cash">Dinheiro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Data de Vencimento *
                                </label>
                                <select
                                    value={paymentDueDay}
                                    onChange={(e) => setPaymentDueDay(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="0">No dia da consulta</option>
                                    <option value="5">Todo dia 05</option>
                                    <option value="20">Todo dia 20</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section: Contatos Adicionais */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-green-600" />
                            Contatos Extras (Opcional)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Email Adicional
                                </label>
                                <input
                                    type="email"
                                    value={additionalEmail}
                                    onChange={(e) => setAdditionalEmail(e.target.value)}
                                    placeholder="ex: marido@email.com"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    WhatsApp Adicional
                                </label>
                                <input
                                    type="tel"
                                    value={additionalPhone}
                                    onChange={(e) => setAdditionalPhone(e.target.value)}
                                    placeholder="(11) 99999-9999"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            * Enviaremos lembretes também para esses contatos.
                        </p>
                    </div>

                    {/* Botão Confirmar */}
                    <button
                        onClick={handleConfirm}
                        disabled={loading || !selectedDate || !selectedTime || !paymentMethod || !paymentDueDay}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-1"
                    >
                        {loading ? 'Confirmando...' : 'Confirmar Agendamento'}
                    </button>

                    <p className="text-center text-xs text-gray-400 mt-4">
                        Seus dados estão protegidos.
                    </p>
                </div>
            </div>
        </div>
    );
}
