
import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ReconfirmAppointment() {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

    useEffect(() => {
        // Simulating confirmation logic (logging presence)
        // In a real scenario, this would call an API
        const timer = setTimeout(() => {
            setStatus('success');
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
                <div className="animate-pulse text-green-800 font-medium">Confirmando sua presença...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                </div>

                <h1 className="text-3xl font-bold text-gray-800 mb-2 font-handwriting">
                    Presença Confirmada!
                </h1>

                <p className="text-gray-600 mb-8">
                    Obrigado por confirmar. Sua psicóloga já foi avisada.
                </p>

                <div className="bg-green-50 rounded-xl p-6 text-left space-y-4">
                    <div className="flex items-center gap-3 text-green-800">
                        <Clock className="w-5 h-5" />
                        <span className="font-medium">Sua consulta começa em breve</span>
                    </div>
                </div>

                <p className="mt-8 text-sm text-gray-400">
                    PsiManager - Agendamento Seguro
                </p>
            </div>
        </div>
    );
}
