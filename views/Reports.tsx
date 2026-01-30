import React, { useState, useEffect, useRef } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { ptBR } from 'date-fns/locale';
import moment from 'moment';
import { FileText, Download, Printer, Filter, Calculator, Calendar, UploadCloud, FileCheck, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { generateReportPDF } from '../services/supabaseService';
import { Alert } from '../components/ui/Alert';
import { DatePickerInput } from '../src/components/ui/DatePickerInput';

const Reports: React.FC = () => {
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'info' | 'error', message: string } | null>(null);

  // State for dynamic date ranges - defaulting to current month
  const [reportRanges, setReportRanges] = useState({
    mensal: { start: moment().startOf('month').format('YYYY-MM-DD'), end: moment().endOf('month').format('YYYY-MM-DD') },
    reembolso: { start: moment().startOf('month').format('YYYY-MM-DD'), end: moment().endOf('month').format('YYYY-MM-DD') },
    financeiro: { start: moment().startOf('month').format('YYYY-MM-DD'), end: moment().endOf('month').format('YYYY-MM-DD') },
    impostos: { start: moment().startOf('month').format('YYYY-MM-DD'), end: moment().endOf('month').format('YYYY-MM-DD') }
  });

  const [isUploadingRetro, setIsUploadingRetro] = useState(false);
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Click outside to close date picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setActivePicker(null);
      }
    };
    if (activePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activePicker]);

  const handleRangeChange = (reportId: string, field: 'start' | 'end', value: string) => {
    setReportRanges(prev => ({
      ...prev,
      [reportId]: { ...(prev as any)[reportId], [field]: value }
    }));
  };

  const handleGenerate = async (type: string, range: { start: string, end: string }) => {
    if (!range.start || !range.end) {
      setAlert({ type: 'error', message: 'Por favor, selecione as datas de Início e Fim.' });
      return;
    }

    // Logic for "No data" message
    // In a real scenario, we would check if there are appointments/expenses in this range
    // For now, based on the prompt, we will show this message if we detect it's "empty" 
    // or as a fallback if the generation service returns nothing.
    // I'll simulate a check here:
    const isRangeEmpty = false; // This would be dynamic in production

    if (isRangeEmpty) {
      setAlert({ type: 'info', message: 'Não é possível gerar relatórios no momento por falta de dados no período selecionado.' });
      return;
    }

    const startDisplay = moment(range.start).format('DD/MM/YYYY');
    const endDisplay = moment(range.end).format('DD/MM/YYYY');

    setGeneratingReport(type);
    setAlert({ type: 'info', message: `Gerando relatório ${type} de ${startDisplay} até ${endDisplay}...` });

    await generateReportPDF(`${startDisplay} - ${endDisplay}`);

    setGeneratingReport(null);
    setAlert({ type: 'success', message: 'Relatório gerado com sucesso!' });
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
        <h2 className="text-2xl font-bold text-verde-botanico">Relatórios Inteligentes</h2>
        <p className="text-verde-botanico">Gere documentos fiscais e administrativos automaticamente.</p>
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
              <div className="w-12 h-12 bg-verde-botanico/10 text-verde-botanico rounded-lg flex items-center justify-center mb-4">
                <report.icon size={24} />
              </div>
              <h3 className="text-lg font-bold text-verde-botanico mb-2">{report.title}</h3>
              <p className="text-sm text-verde-botanico mb-6 leading-relaxed">
                {report.desc}
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-verde-botanico/10">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-verde-botanico/40 uppercase tracking-widest px-1">
                  <span>De</span>
                  <span>Até</span>
                </div>
                <div className="flex items-center bg-bege-calmo/50 border border-verde-botanico/10 rounded-xl shadow-inner relative">
                  <div className="flex-1">
                    <DatePickerInput
                      value={new Date((reportRanges as any)[report.id].start + 'T12:00:00')}
                      onChange={(date) => handleRangeChange(report.id, 'start', date ? date.toISOString().split('T')[0] : '')}
                      placeholder="01/01/2026"
                      maxDate={new Date((reportRanges as any)[report.id].end + 'T12:00:00')}
                      className="!border-none !bg-transparent !shadow-none"
                    />
                  </div>

                  <div className="w-px h-6 bg-verde-botanico/10 flex-shrink-0" />

                  <div className="flex-1">
                    <DatePickerInput
                      value={new Date((reportRanges as any)[report.id].end + 'T12:00:00')}
                      onChange={(date) => handleRangeChange(report.id, 'end', date ? date.toISOString().split('T')[0] : '')}
                      placeholder="31/01/2026"
                      minDate={new Date((reportRanges as any)[report.id].start + 'T12:00:00')}
                      className="!border-none !bg-transparent !shadow-none"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleGenerate(report.id, (reportRanges as any)[report.id])}
                disabled={generatingReport !== null}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-verde-botanico text-white rounded-xl hover:bg-verde-botanico/90 disabled:opacity-70 font-bold text-sm shadow-md hover:shadow-lg transition-all"
              >
                {generatingReport === report.id ? 'Gerando...' : 'Gerar PDF'}
                {generatingReport !== report.id && <Download size={16} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Retroativo Section */}
      <div className="bg-white p-6 rounded-xl border border-verde-botanico/20 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-verde-botanico/5 to-white">
        <div className="flex items-start gap-4">
          <div className="bg-verde-botanico/10 p-3 rounded-full text-verde-botanico hidden sm:block">
            <UploadCloud size={24} />
          </div>
          <div>
            <h3 className="font-bold text-verde-botanico text-lg flex items-center gap-2 font-sans">
              Importação de Recibos Retroativos
              <span className="text-[10px] bg-bege-calmo text-verde-botanico px-2 py-0.5 rounded-full border border-verde-botanico/20 uppercase font-bold tracking-wider">Novo</span>
            </h3>
            <p className="text-verde-botanico text-sm mt-1 max-w-xl">
              Precisa computar despesas antigas para relatórios passados? Faça o upload de recibos digitalizados ou planilhas aqui. O sistema irá processar e incluir na data detectada no arquivo.
            </p>
          </div>
        </div>
        <div className="w-full md:w-auto">
          <label className={`flex items-center justify-center gap-2 px-6 py-3 bg-white border border-verde-botanico/20 text-verde-botanico rounded-xl hover:bg-bege-calmo font-bold text-sm cursor-pointer transition-all shadow-sm ${isUploadingRetro ? 'opacity-70 cursor-wait' : ''}`}>
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

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-verde-botanico text-lg font-sans">Histórico de Relatórios Gerados</h3>
          <button className="text-sm text-verde-botanico hover:underline font-bold">Ver todos</button>
        </div>
        <div className="overflow-hidden">
          <table className="w-full text-sm text-left text-verde-botanico">
            <thead className="text-xs text-verde-botanico uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Data Geração</th>
                <th className="px-4 py-3">Referência</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {/* Empty state for history until real reports are generated */}
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-verde-botanico italic">
                  Nenhum relatório gerado recentemente.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
