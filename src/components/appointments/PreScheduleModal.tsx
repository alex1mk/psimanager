import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Copy, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { AppointmentEngine } from '../../services/features/appointments/appointment-engine.service';

interface Patient {
    id: string;
    name: string;
    email: string;
    phone: string;
}

interface PreScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    patients: Patient[];
    initialPatientId?: string;
}

type RecurrenceType = 'single' | 'weekly' | 'biweekly' | 'monthly';
type PaymentMethod = 'card' | 'pix' | 'cash';
type PaymentDueDay = '0' | '5' | '20';

interface FormData {
    patient_id: string;
    scheduled_date: string;
    scheduled_time: string;
    recurrence_type: RecurrenceType;
    recurrence_end_date: string;
    payment_method: PaymentMethod;
    payment_due_day: PaymentDueDay;
    notes: string;
}

interface ValidationError {
    field: string;
    message: string;
}

export default function PreScheduleModal({
    isOpen,
    onClose,
    onSuccess,
    patients,
    initialPatientId
}: PreScheduleModalProps) {

    const [formData, setFormData] = useState<FormData>({
        patient_id: '',
        scheduled_date: '',
        scheduled_time: '',
        recurrence_type: 'single',
        recurrence_end_date: '',
        payment_method: 'pix',
        payment_due_day: '0',
        notes: '',
    });

    const [errors, setErrors] = useState<ValidationError[]>([]);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [confirmationLink, setConfirmationLink] = useState('');
    const [linkCopied, setLinkCopied] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            resetForm();
        }
    }, [isOpen]);

    const resetForm = () => {
        setFormData({
            patient_id: initialPatientId || '',
            scheduled_date: '',
            scheduled_time: '',
            recurrence_type: 'single',
            recurrence_end_date: '',
            payment_method: 'pix',
            payment_due_day: '0',
            notes: '',
        });
        setErrors([]);
        setStep('form');
        setConfirmationLink('');
        setLinkCopied(false);
    };

    const validateForm = (): boolean => {
        const newErrors: ValidationError[] = [];

        if (!formData.patient_id) {
            newErrors.push({ field: 'patient_id', message: 'Selecione um paciente' });
        }

        if (!formData.scheduled_date) {
            newErrors.push({ field: 'scheduled_date', message: 'Selecione uma data' });
        }

        if (!formData.scheduled_time) {
            newErrors.push({ field: 'scheduled_time', message: 'Selecione um horário' });
        }

        // Validar data não pode ser no passado
        if (formData.scheduled_date) {
            const selectedDate = new Date(formData.scheduled_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedDate < today) {
                newErrors.push({ field: 'scheduled_date', message: 'Data não pode ser no passado' });
            }
        }

        // Validar data final de recorrência
        if (formData.recurrence_type !== 'single' && formData.recurrence_end_date) {
            const endDate = new Date(formData.recurrence_end_date);
            const startDate = new Date(formData.scheduled_date);

            if (endDate <= startDate) {
                newErrors.push({
                    field: 'recurrence_end_date',
                    message: 'Data final deve ser posterior à data inicial'
                });
            }
        }

        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const getFieldError = (field: string): string | undefined => {
        return errors.find(e => e.field === field)?.message;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setErrors([]);

        try {
            // 1. Atualizar dados financeiros do paciente
            if (formData.patient_id) {
                const { error: updateError } = await supabase
                    .from('patients')
                    .update({
                        payment_method: formData.payment_method,
                        payment_due_day: parseInt(formData.payment_due_day)
                    })
                    .eq('id', formData.patient_id);

                if (updateError) {
                    console.warn('[PreScheduleModal] Erro ao atualizar paciente:', updateError);
                }
            }

            // 2. Criar agendamento via Engine (já cria com status pending_confirmation)
            const createResult = await AppointmentEngine.createAppointment(
                {
                    patient_id: formData.patient_id,
                    scheduled_date: formData.scheduled_date,
                    scheduled_time: formData.scheduled_time,
                    recurrence_type: formData.recurrence_type,
                    recurrence_end_date: formData.recurrence_end_date || undefined,
                    notes: formData.notes,
                },
                'pending_confirmation'
            );

            if (!createResult.success) {
                throw new Error(createResult.error || 'Erro ao criar agendamento');
            }

            const appointmentId = createResult.appointment.id;

            // 3. Gerar token de confirmação
            const tokenResult = await AppointmentEngine.generateConfirmationToken(appointmentId);

            if (!tokenResult.success) {
                throw new Error(tokenResult.error || 'Erro ao gerar link de confirmação');
            }

            const link = tokenResult.tokenData!.link;

            // 4. Enviar e-mail automático via Edge Function CORRETA
            await sendConfirmationEmail(appointmentId, link);

            // 5. Exibir sucesso com o link gerado pelo Engine
            setConfirmationLink(link);
            setStep('success');

        } catch (error) {
            console.error('[PreScheduleModal] Erro:', error);
            setErrors([{
                field: 'general',
                message: error instanceof Error ? error.message : 'Erro ao criar agendamento'
            }]);
        } finally {
            setLoading(false);
        }
    };

    const sendConfirmationEmail = async (appointmentId: string, confirmationLink: string) => {
        try {
            console.log(`[PreScheduleModal] Enviando e-mail para appointment ${appointmentId}`);

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-confirmation-email`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY!,
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY!}`
                    },
                    body: JSON.stringify({
                        appointment_id: appointmentId,
                        confirmation_link: confirmationLink
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao enviar e-mail');
            }

            console.log('[PreScheduleModal] E-mail enviado com sucesso via Edge Function');
        } catch (error) {
            console.error('[PreScheduleModal] Erro ao enviar e-mail:', error);
            // Backup: WhatsApp
            setErrors(prev => [...prev, {
                field: 'general',
                message: 'Agendamento criado, mas houve falha no envio do e-mail. Use o WhatsApp.'
            }]);
        }
    };

    const copyLinkToClipboard = () => {
        navigator.clipboard.writeText(confirmationLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 3000);
    };

    const getWhatsAppMessage = () => {
        const patient = patients.find(p => p.id === formData.patient_id);
        const formattedDate = format(new Date(formData.scheduled_date), "dd 'de' MMMM", { locale: ptBR });

        return `Olá ${patient?.name}! 😊

Gostaria de confirmar seu agendamento:
📅 ${formattedDate} às ${formData.scheduled_time}

Por favor, confirme sua presença clicando no link abaixo:
${confirmationLink}

Aguardo sua confirmação! 💚`;
    };

    const copyWhatsAppMessage = () => {
        navigator.clipboard.writeText(getWhatsAppMessage());
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 3000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 font-sans">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto font-sans">

                {step === 'form' ? (
                    <>
                        {/* Header */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between font-sans">
                            <h2 className="text-xl font-bold text-gray-800 font-sans">
                                Novo Pré-Agendamento
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">

                            {/* Erro Geral */}
                            {errors.find(e => e.field === 'general') && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-red-800">
                                            {getFieldError('general')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Paciente */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 font-sans">
                                    <User className="w-4 h-4 inline mr-2" />
                                    Paciente *
                                </label>
                                <select
                                    value={formData.patient_id}
                                    onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${getFieldError('patient_id') ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                        }`}
                                >
                                    <option value="">Selecione um paciente</option>
                                    {patients.map(patient => (
                                        <option key={patient.id} value={patient.id}>
                                            {patient.name}
                                        </option>
                                    ))}
                                </select>
                                {getFieldError('patient_id') && (
                                    <p className="mt-1 text-sm text-red-600">{getFieldError('patient_id')}</p>
                                )}
                            </div>

                            {/* Data e Horário */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Calendar className="w-4 h-4 inline mr-2" />
                                        Data *
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.scheduled_date}
                                        onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                                        min={format(new Date(), 'yyyy-MM-dd')}
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${getFieldError('scheduled_date') ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                            }`}
                                    />
                                    {getFieldError('scheduled_date') && (
                                        <p className="mt-1 text-sm text-red-600">{getFieldError('scheduled_date')}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Clock className="w-4 h-4 inline mr-2" />
                                        Horário *
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.scheduled_time}
                                        onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${getFieldError('scheduled_time') ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                            }`}
                                    />
                                    {getFieldError('scheduled_time') && (
                                        <p className="mt-1 text-sm text-red-600">{getFieldError('scheduled_time')}</p>
                                    )}
                                </div>
                            </div>

                            {/* Recorrência */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Recorrência
                                </label>
                                <select
                                    value={formData.recurrence_type}
                                    onChange={(e) => setFormData({ ...formData, recurrence_type: e.target.value as RecurrenceType })}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                >
                                    <option value="single">Sessão única</option>
                                    <option value="weekly">Semanal</option>
                                    <option value="biweekly">Quinzenal</option>
                                    <option value="monthly">Mensal</option>
                                </select>
                            </div>

                            {/* Data Final (se recorrente) */}
                            {formData.recurrence_type !== 'single' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Data Final (opcional)
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.recurrence_end_date}
                                        onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                                        min={formData.scheduled_date}
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${getFieldError('recurrence_end_date') ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                            }`}
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Deixe em branco para recorrência contínua
                                    </p>
                                    {getFieldError('recurrence_end_date') && (
                                        <p className="mt-1 text-sm text-red-600">{getFieldError('recurrence_end_date')}</p>
                                    )}
                                </div>
                            )}

                            {/* Pagamento (Novo Bloco) */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Forma de Pagamento
                                    </label>
                                    <select
                                        value={formData.payment_method}
                                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as PaymentMethod })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    >
                                        <option value="pix">PIX</option>
                                        <option value="card">Cartão</option>
                                        <option value="cash">Dinheiro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Vencimento
                                    </label>
                                    <select
                                        value={formData.payment_due_day}
                                        onChange={(e) => setFormData({ ...formData, payment_due_day: e.target.value as PaymentDueDay })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    >
                                        <option value="0">Na Consulta</option>
                                        <option value="5">Dia 05</option>
                                        <option value="20">Dia 20</option>
                                    </select>
                                </div>
                            </div>

                            {/* Observações */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Observações
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                    placeholder="Informações adicionais sobre o agendamento..."
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                                />
                            </div>

                            {/* Botões */}
                            <div className="flex gap-3 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Criando...' : 'Criar Pré-Agendamento'}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <>
                        {/* Success Screen */}
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                        <CheckCircle className="w-7 h-7 text-green-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-800 font-sans">
                                            Pré-Agendamento Criado!
                                        </h2>
                                        <p className="text-sm text-gray-600 font-sans">
                                            E-mail de confirmação enviado
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        onSuccess();
                                        onClose();
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            {/* Link de Confirmação */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                <p className="text-sm font-medium text-blue-900 mb-2">
                                    Link de Confirmação
                                </p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={confirmationLink}
                                        readOnly
                                        className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm text-gray-700 font-mono"
                                    />
                                    <button
                                        onClick={copyLinkToClipboard}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                                    >
                                        {linkCopied ? (
                                            <>
                                                <CheckCircle className="w-4 h-4" />
                                                Copiado!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                Copiar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Mensagem WhatsApp */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                                <p className="text-sm font-medium text-green-900 mb-2 flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    Mensagem para WhatsApp
                                </p>
                                <textarea
                                    value={getWhatsAppMessage()}
                                    readOnly
                                    rows={8}
                                    className="w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-sm text-gray-700 resize-none mb-3"
                                />
                                <button
                                    onClick={copyWhatsAppMessage}
                                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    {linkCopied ? (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Mensagem Copiada!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4" />
                                            Copiar Mensagem Completa
                                        </>
                                    )}
                                </button>
                                <p className="mt-2 text-xs text-gray-600 text-center">
                                    Cole essa mensagem diretamente no WhatsApp do paciente
                                </p>
                            </div>

                            {/* Instruções */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <p className="text-sm font-medium text-gray-800 mb-2">
                                    📝 Próximos Passos:
                                </p>
                                <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                                    <li>Copie a mensagem acima</li>
                                    <li>Abra o WhatsApp e encontre o paciente</li>
                                    <li>Cole e envie a mensagem</li>
                                    <li>Aguarde a confirmação do paciente</li>
                                </ol>
                            </div>

                            {/* Botão Fechar */}
                            <button
                                onClick={() => {
                                    onSuccess();
                                    onClose();
                                }}
                                className="w-full mt-6 px-4 py-3 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-900 transition-colors"
                            >
                                Concluir
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
