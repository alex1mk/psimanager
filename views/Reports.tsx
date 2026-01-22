import React, { useState } from 'react';
import { FileText, Download, Printer, Filter, Calculator, Calendar, UploadCloud, FileCheck, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { generateReportPDF } from '../services/mockService';
import { Alert } from '../components/ui/Alert';

const Reports: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [alert, setAlert] = useState<{type: 'success' | 'info' | 'error', message: string} | null>(null);
  
  // State for dynamic dates - defaulting to current date (YYYY-MM-DD)
  const [dates, setDates] = useState({
    mensal: new Date().toISOString().split('T')[0],
    reembolso: new Date().toISOString().split('T')[0],
    financeiro: new Date().toISOString().split('T')[0],
    impostos: new Date().toISOString().split('T')[0]
  });

  const [isUploadingRetro, setIsUploadingRetro] = useState(false);

  const handleDateChange = (id: string, value: string) => {
    setDates(prev => ({ ...prev, [id]: value }));
  };

  const navigateMonth = (id: string, delta: number) => {
    const currentStr = (dates as any)[id];
    if (!currentStr) return;
    
    const [year, month, day] = currentStr.split('-').map(Number);
    // Cria data segura evitando problemas de fuso horário (Ano, Mês Indexado 0, Dia)
    // Somamos o delta diretamente ao mês para navegação rápida
    const dateObj = new Date(year, month - 1 + delta, day);
    
    const newYear = dateObj.getFullYear();
    const newMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
    const newDay = String(dateObj.getDate()).padStart(2, '0');
    
    setDates(prev => ({ ...prev, [id]: `${newYear}-${newMonth}-${newDay}` }));
  };

  const handleGenerate = async (type: string, dateValue: string) => {
    if (!dateValue) {
        setAlert({ type: 'error', message: 'Por favor, selecione uma data.' });
        return;
    }
    
    // Format YYYY-MM-DD to localized string for display
    const [year, month, day] = dateValue.split('-');
    const displayDate = `${day}/${month}/${year}`;

    setIsGenerating(true);
    setAlert({ type: 'info', message: `Gerando relatório ${type} de ${displayDate}... Por favor aguarde.` });
    
    await generateReportPDF(displayDate);
    
    setIsGenerating(false);
    setAlert({ type: 'success', message: 'Relatório gerado com sucesso! O download iniciará em breve.' });
  };

  const handleRetroUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setIsUploadingRetro(true);
        setTimeout(() => {
            setIsUploadingRetro(false);
            setAlert({ type: 'success', message: `Arquivo "${file.name}" processado e incluído no histórico financeiro.` });
            e.target.value = '';
        }, 2000);
    }
  };

  const reportTypes = [
    { 
      id: 'mensal', 
      title: 'Relatório Mensal de Pacientes', 
      desc: 'Resumo de sessões, valores e presenças por paciente para envio.',
      icon: FileText 
    },
    { 
      id: 'reembolso', 
      title: 'Declaração para Reembolso', 
      desc: 'Documento formatado para convênios e planos de saúde.',
      icon: Download 
    },
    { 
      id: 'financeiro', 
      title: 'Fechamento Financeiro', 
      desc: 'Balanço de receitas (PF/PJ) e despesas dedutíveis.',
      icon: Printer 
    },
    { 
      id: 'impostos', 
      title: 'Relatório de Impostos (Carnê-Leão)', 
      desc: 'Consolidação de despesas PF/PJ e receitas para obrigações fiscais.',
      icon: Calculator 
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Relatórios Inteligentes</h2>
        <p className="text-slate-500">Gere documentos fiscais e administrativos automaticamente.</p>
      </div>

      {alert && (
        <Alert 
          type={alert.type as any} 
          message={alert.message} 
          onClose={() => setAlert(null)} 
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {reportTypes.map((report) => (
          <div key={report.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full">
            <div>
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center mb-4">
                <report.icon size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">{report.title}</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                {report.desc}
              </p>
            </div>
            
            <div className="space-y-3 pt-4 border-t border-gray-50">
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden relative group">
                    <button 
                      onClick={() => navigateMonth(report.id, -1)}
                      className="p-2.5 text-slate-500 hover:bg-gray-200 hover:text-slate-700 transition-colors border-r border-gray-200 z-10 bg-gray-50"
                      title="Mês Anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    <div className="relative flex-1 h-full">
                        {/* 
                           Input Style Tricks:
                           1. appearance-none / webkit-calendar-picker-indicator opacity-0: Hides native icon
                           2. w-full h-full: Ensures clickability area covers the text
                           3. cursor-pointer: Visual feedback
                           4. bg-transparent: Shows the container color
                        */}
                        <input 
                            type="date"
                            value={(dates as any)[report.id]}
                            onChange={(e) => handleDateChange(report.id, e.target.value)}
                            className="bg-transparent text-slate-700 text-sm font-medium block w-full h-full p-2.5 text-center focus:outline-none focus:ring-0 border-none cursor-pointer relative z-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        />
                        {/* Custom Calendar Icon Positioned to the Right of Year */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-0 pointer-events-none text-slate-400 group-hover:text-teal-500 transition-colors">
                            <Calendar size={16} />
                        </div>
                    </div>

                    <button 
                      onClick={() => navigateMonth(report.id, 1)}
                      className="p-2.5 text-slate-500 hover:bg-gray-200 hover:text-slate-700 transition-colors border-l border-gray-200 z-10 bg-gray-50"
                      title="Próximo Mês"
                    >
                      <ChevronRight size={16} />
                    </button>
                </div>
                
                <button 
                  onClick={() => handleGenerate(report.title, (dates as any)[report.id])}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-70 font-medium"
                >
                  {isGenerating ? 'Gerando...' : 'Gerar PDF'}
                  {!isGenerating && <Download size={16} />}
                </button>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Retroativo Section */}
      <div className="bg-white p-6 rounded-xl border border-teal-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-teal-50/50 to-white">
        <div className="flex items-start gap-4">
            <div className="bg-teal-100 p-3 rounded-full text-teal-700 hidden sm:block">
                <UploadCloud size={24} />
            </div>
            <div>
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                   Importação de Recibos Retroativos
                   <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200">Novo</span>
                </h3>
                <p className="text-slate-500 text-sm mt-1 max-w-xl">
                    Precisa computar despesas antigas para relatórios passados? Faça o upload de recibos digitalizados ou planilhas aqui. O sistema irá processar e incluir na data detectada no arquivo.
                </p>
            </div>
        </div>
        <div className="w-full md:w-auto">
            <label className={`flex items-center justify-center gap-2 px-6 py-3 bg-white border border-teal-200 text-teal-700 rounded-lg hover:bg-teal-50 font-medium cursor-pointer transition-all shadow-sm ${isUploadingRetro ? 'opacity-70 cursor-wait' : ''}`}>
                {isUploadingRetro ? 'Processando...' : 'Upload de Arquivo Antigo'}
                <UploadCloud size={18} />
                <input 
                    type="file" 
                    className="hidden" 
                    onChange={handleRetroUpload}
                    disabled={isUploadingRetro}
                    accept=".pdf,.jpg,.png,.xlsx"
                />
            </label>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-800 text-lg">Histórico de Relatórios Gerados</h3>
          <button className="text-sm text-teal-600 hover:text-teal-700 font-medium">Ver todos</button>
        </div>
        <div className="overflow-hidden">
            <table className="w-full text-sm text-left text-slate-600">
                <thead className="text-xs text-slate-500 uppercase bg-gray-50">
                    <tr>
                        <th className="px-4 py-3">Documento</th>
                        <th className="px-4 py-3">Data Geração</th>
                        <th className="px-4 py-3">Referência</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-slate-900">Relatório Mensal - Ana Silva</td>
                        <td className="px-4 py-3">01/10/2023</td>
                        <td className="px-4 py-3">Set/2023</td>
                        <td className="px-4 py-3 text-right"><a href="#" className="text-teal-600 hover:underline">Download</a></td>
                    </tr>
                    <tr className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-slate-900">Fechamento Fiscal</td>
                        <td className="px-4 py-3">01/10/2023</td>
                        <td className="px-4 py-3">Set/2023</td>
                        <td className="px-4 py-3 text-right"><a href="#" className="text-teal-600 hover:underline">Download</a></td>
                    </tr>
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;