// ─── PÁGINA PÚBLICA DE CONFIRMAÇÃO DE AGENDAMENTO ───────────────────────────
// Created: 2026-02-06
// Purpose: Allows patients to confirm their appointments via link
// ────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, AlertCircle, CheckCircle } from 'lucide-react';
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
        if (!selectedDate || !selectedTime) {
            setError('Por favor, preencha data e horário');
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
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
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
                        Agendamento Confirmado!
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
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                    Confirmar Agendamento
                </h1>

                {appointmentData && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-700">
                            <User className="w-5 h-5" />
                            <span className="font-medium">{appointmentData.patient_name}</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    {/* Data */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar className="w-4 h-4 inline mr-2" />
                            Data
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={format(new Date(), 'yyyy-MM-dd')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>

                    {/* Horário */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Clock className="w-4 h-4 inline mr-2" />
                            Horário
                        </label>
                        <input
                            type="time"
                            value={selectedTime}
                            onChange={(e) => setSelectedTime(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>

                    {/* Recorrência */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Recorrência
                        </label>
                        <select
                            value={recurrence}
                            onChange={(e) => setRecurrence(e.target.value as any)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                            <option value="single">Sessão única</option>
                            <option value="weekly">Semanal</option>
                            <option value="biweekly">Quinzenal</option>
                            <option value="monthly">Mensal</option>
                        </select>
                    </div>

                    {/* Botão Confirmar */}
                    <button
                        onClick={handleConfirm}
                        disabled={loading || !selectedDate || !selectedTime}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Confirmando...' : 'Confirmar Agendamento'}
                    </button>
                </div>
            </div>
        </div>
    );
}
