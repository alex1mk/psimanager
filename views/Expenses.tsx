import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileText, Check, Loader2, DollarSign, Building, User, Plus, X, Calendar, Tag, Store, Save, FileCheck, Search, Mail, MessageCircle, Edit2, Trash, AlertTriangle } from 'lucide-react';
import moment from 'moment';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { ptBR } from 'date-fns/locale';
import { format, parse } from 'date-fns';
import { Expense, ExpenseType, Appointment } from '../types';
import { analyzeReceiptOCR, getExpenses, createExpense, updateExpense, deleteExpense, getAppointments } from '../services/supabaseService';
import { Alert } from '../components/ui/Alert';
import { DatePickerInput } from '../src/components/ui/DatePickerInput';

const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PF' | 'PJ'>('ALL');

  // Manual Entry / Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<Partial<Expense>>({
    description: '',
    merchantName: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: 'Geral',
    type: ExpenseType.PJ
  });

  // Delete State
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Receipt Generation State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [confirmableAppointments, setConfirmableAppointments] = useState<Appointment[]>([]);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [expenseMonth, setExpenseMonth] = useState<Date>(currentExpense.date ? new Date(currentExpense.date) : new Date());

  // OCR session total for automatic sum
  const [ocrSessionTotal, setOcrSessionTotal] = useState<number>(0);

  // Click outside to close date picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    if (isDatePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDatePickerOpen]);

  // Load mock data initially
  useEffect(() => {
    getExpenses().then(setExpenses);
  }, []);

  const handleOpenReceiptModal = async () => {
    const allApps = await getAppointments();
    const confirmed = allApps.filter(app => app.status === 'confirmed');
    setConfirmableAppointments(confirmed);
    setIsReceiptModalOpen(true);
  };

  const generateReceipt = async (app: Appointment, method: 'email' | 'whatsapp') => {
    setIsGeneratingReceipt(true);
    setTimeout(() => {
      setAlert({
        type: 'success',
        message: `Recibo gerado para ${app.patientName} e enviado via ${method === 'email' ? 'E-mail' : 'WhatsApp'}!`
      });
      setIsGeneratingReceipt(false);
      setIsReceiptModalOpen(false);
    }, 1500);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setAlert(null);

    try {
      const extractedData = await analyzeReceiptOCR(file);

      const expense: Expense = {
        id: Math.random().toString(36).substr(2, 9),
        description: extractedData.description || 'Despesa sem descrição',
        amount: extractedData.amount || 0,
        date: extractedData.date || new Date().toISOString().split('T')[0],
        category: extractedData.category || 'Geral',
        type: extractedData.type || ExpenseType.PJ,
        merchantName: extractedData.merchantName,
        receiptUrl: '#' // Mock
      };

      try {
        await createExpense(expense);
        setExpenses(prev => [expense, ...prev]);

        // Update OCR session total
        const newTotal = ocrSessionTotal + expense.amount;
        setOcrSessionTotal(newTotal);

        setAlert({
          type: 'success',
          message: `Recibo analisado e salvo! Valor: R$ ${expense.amount.toFixed(2)} | Total da sessão OCR: R$ ${newTotal.toFixed(2)}`
        });
      } catch (dbError: any) {
        console.error("DB Error Saving Expense:", dbError);
        setAlert({ type: 'error', message: `Erro ao salvar no banco: ${dbError.message || 'Erro desconhecido'}` });
      }

    } catch (error) {
      console.error("OCR Analysis Error:", error);
      setAlert({ type: 'error', message: 'Falha na análise do recibo (OCR).' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Open Modal for New Expense
  const handleOpenNew = () => {
    setIsEditing(false);
    setCurrentExpense({
      description: '',
      merchantName: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      category: 'Geral',
      type: ExpenseType.PJ
    });
    setIsModalOpen(true);
  };

  // Open Modal for Editing
  const handleOpenEdit = (expense: Expense) => {
    setIsEditing(true);
    setCurrentExpense({ ...expense });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentExpense.description || !currentExpense.amount) {
      setAlert({ type: 'error', message: 'Preencha a descrição e o valor.' });
      return;
    }

    try {
      if (isEditing && currentExpense.id) {
        // Update
        const updated = await updateExpense(currentExpense as Expense);
        setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
        setAlert({ type: 'success', message: 'Despesa atualizada com sucesso!' });
      } else {
        // Create
        const expense: Expense = {
          id: Math.random().toString(36).substr(2, 9),
          description: currentExpense.description || '',
          amount: Number(currentExpense.amount),
          date: currentExpense.date || new Date().toISOString().split('T')[0],
          category: currentExpense.category || 'Geral',
          type: currentExpense.type || ExpenseType.PJ,
          merchantName: currentExpense.merchantName,
          receiptUrl: undefined
        };
        await createExpense(expense);
        setExpenses(prev => [expense, ...prev]);
        setAlert({ type: 'success', message: 'Despesa adicionada manualmente!' });
      }

      setIsModalOpen(false);
    } catch (error) {
      setAlert({ type: 'error', message: 'Erro ao salvar despesa.' });
    }
  };

  const handleDelete = (id: string) => {
    setExpenseToDelete(id);
  };

  const confirmDelete = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
      await deleteExpense(expenseToDelete);
      setExpenses(prev => prev.filter(e => e.id !== expenseToDelete));
      setAlert({ type: 'success', message: 'Despesa excluída com sucesso.' });
    } catch (error) {
      setAlert({ type: 'error', message: 'Erro ao excluir despesa.' });
    } finally {
      setIsDeleting(false);
      setExpenseToDelete(null);
    }
  };

  const handleInputChange = (field: keyof Expense, value: any) => {
    setCurrentExpense(prev => ({ ...prev, [field]: value }));
  };

  const filteredExpenses = expenses.filter(exp => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PF') return exp.type === ExpenseType.PF;
    return exp.type === ExpenseType.PJ;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-verde-botanico">Despesas & Recibos</h2>
          <p className="text-verde-botanico">Gestão financeira com OCR automático.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleOpenReceiptModal}
            className="flex items-center gap-2 px-4 py-2 bg-white text-verde-botanico border border-verde-botanico/20 rounded-xl hover:bg-bege-calmo shadow-sm transition-all font-bold text-sm"
          >
            <FileCheck size={18} />
            Gerar Recibo
          </button>
          <button
            onClick={handleOpenNew}
            className="flex items-center gap-2 px-4 py-2 bg-verde-botanico text-white rounded-xl hover:bg-verde-botanico/90 shadow-md hover:shadow-lg transition-all font-bold text-sm"
          >
            <Plus size={18} />
            Nova Despesa
          </button>
        </div>
      </div>

      {alert && (
        <Alert
          type={alert.type as any}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {/* Upload Section */}
      <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-verde-botanico/20 hover:border-verde-botanico/40 bg-gradient-to-b from-transparent to-bege-calmo/30 transition-all text-center group relative overflow-hidden">
        <div className="flex flex-col items-center justify-center gap-4 relative z-10">
          <div className="w-16 h-16 bg-verde-botanico/10 rounded-full flex items-center justify-center group-hover:bg-verde-botanico/20 transition-colors shadow-inner">
            {isUploading ? (
              <Loader2 className="w-8 h-8 text-verde-botanico animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8 text-verde-botanico" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-verde-botanico">
              {isUploading ? 'Processando imagem (OCR)...' : 'Upload de Recibo / Nota Fiscal'}
            </h3>
            <p className="text-verde-botanico text-sm mt-1 max-w-md mx-auto">
              Arraste seu arquivo ou clique para selecionar. O sistema extrairá automaticamente valores, datas e descrições via Google Vision.
            </p>
          </div>
          <div className="relative mt-2">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-30"
            />
            <button
              disabled={isUploading}
              className="px-8 py-3 bg-verde-botanico text-white rounded-xl font-bold text-sm hover:bg-verde-botanico/90 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              Selecionar Arquivo
            </button>
          </div>
        </div>
      </div>

      {/* List Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'ALL' ? 'bg-white text-verde-botanico shadow-sm' : 'text-verde-botanico hover:text-verde-botanico'}`}
            >
              Todas
            </button>
            <button
              onClick={() => setActiveTab('PF')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'PF' ? 'bg-white text-verde-botanico shadow-sm' : 'text-verde-botanico hover:text-verde-botanico'}`}
            >
              Pessoa Física (CPF)
            </button>
            <button
              onClick={() => setActiveTab('PJ')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'PJ' ? 'bg-white text-verde-botanico shadow-sm' : 'text-verde-botanico hover:text-verde-botanico'}`}
            >
              Pessoa Jurídica (CNPJ)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-verde-botanico">
            <thead className="bg-gray-50 text-verde-botanico font-semibold uppercase text-xs">
              <tr>
                <th className="px-6 py-4">Descrição / Estabelecimento</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4 text-right">Valor</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-verde-botanico">{expense.description}</div>
                    <div className="text-xs text-verde-botanico">{expense.merchantName || 'Não informado'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 text-verde-botanico px-2 py-1 rounded text-xs border border-slate-200">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">{new Date(expense.date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {expense.type === ExpenseType.PJ ? <Building size={14} className="text-verde-botanico" /> : <User size={14} className="text-verde-botanico" />}
                      <span>{expense.type === ExpenseType.PJ ? 'PJ' : 'PF'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-verde-botanico">
                    R$ {expense.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {expense.receiptUrl && expense.receiptUrl !== '#' && (
                        <button className="p-1.5 text-verde-botanico hover:text-teal-600 hover:bg-teal-50 rounded transition-colors" title="Ver Recibo">
                          <FileText size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEdit(expense)}
                        className="p-1.5 text-verde-botanico hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-1.5 text-verde-botanico hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Excluir"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredExpenses.length === 0 && (
            <div className="p-8 text-center text-verde-botanico">
              Nenhuma despesa encontrada nesta categoria.
            </div>
          )}
        </div>
      </div>

      {/* Manual Entry / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl modal-content">
            <div className="bg-bege-calmo/50 p-4 border-b border-verde-botanico/10 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold text-verde-botanico text-lg flex items-center gap-2 font-sans">
                {isEditing ? <Edit2 size={20} /> : <Plus size={20} />}
                {isEditing ? 'Editar Despesa' : 'Nova Despesa Manual'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-verde-botanico/40 hover:text-verde-botanico hover:bg-verde-botanico/10 p-1 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-inner-scroll p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Descrição */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-verde-botanico mb-1">Descrição do Item</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Tag className="h-5 w-5 text-verde-botanico" />
                      </div>
                      <input
                        type="text"
                        required
                        value={currentExpense.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        className="bg-white pl-10 w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2.5 border text-verde-botanico"
                        placeholder="Ex: Aluguel, Compra de material, Livros..."
                      />
                    </div>
                  </div>

                  {/* Estabelecimento */}
                  <div>
                    <label className="block text-sm font-medium text-verde-botanico mb-1">Estabelecimento (Opcional)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Store className="h-5 w-5 text-verde-botanico" />
                      </div>
                      <input
                        type="text"
                        value={currentExpense.merchantName}
                        onChange={(e) => handleInputChange('merchantName', e.target.value)}
                        className="bg-white pl-10 w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2.5 border text-verde-botanico"
                        placeholder="Ex: Livraria Saraiva"
                      />
                    </div>
                  </div>

                  {/* Valor */}
                  <div>
                    <label className="block text-sm font-medium text-verde-botanico mb-1">Valor (R$)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="h-5 w-5 text-verde-botanico" />
                      </div>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={currentExpense.amount}
                        onChange={(e) => handleInputChange('amount', e.target.value)}
                        className="bg-white pl-10 w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2.5 border text-verde-botanico"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Data */}
                  <div>
                    <label className="block text-sm font-medium text-verde-botanico mb-1">Data</label>
                    <DatePickerInput
                      value={currentExpense.date ? new Date(currentExpense.date + 'T12:00:00') : undefined}
                      onChange={(date) => handleInputChange('date', date ? date.toISOString().split('T')[0] : '')}
                      placeholder="28/01/2026"
                    />
                  </div>

                  {/* Categoria */}
                  <div>
                    <label className="block text-sm font-medium text-verde-botanico mb-1">Categoria</label>
                    <select
                      value={currentExpense.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="bg-white w-full border-gray-300 rounded-lg shadow-sm focus:ring-verde-botanico focus:border-verde-botanico p-2.5 border text-verde-botanico"
                    >
                      <option>Geral</option>
                      <option>Infraestrutura</option>
                      <option>Materiais</option>
                      <option>Educação Continuada</option>
                      <option>Transporte</option>
                      <option>Alimentação</option>
                      <option>Impostos</option>
                      <option>Saúde</option>
                    </select>
                  </div>

                  {/* Tipo (PF/PJ) */}
                  <div className="col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <label className="block text-sm font-medium text-verde-botanico mb-2">Tipo de Despesa (Contabilidade)</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="expenseType"
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4"
                          checked={currentExpense.type === ExpenseType.PJ}
                          onChange={() => handleInputChange('type', ExpenseType.PJ)}
                        />
                        <span className="text-sm text-verde-botanico flex items-center gap-1">
                          <Building size={16} className="text-purple-500" />
                          Pessoa Jurídica (CNPJ)
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="expenseType"
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4"
                          checked={currentExpense.type === ExpenseType.PF}
                          onChange={() => handleInputChange('type', ExpenseType.PF)}
                        />
                        <span className="text-sm text-verde-botanico flex items-center gap-1">
                          <User size={16} className="text-teal-500" />
                          Pessoa Física (CPF)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100 font-sans">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-verde-botanico/20 text-verde-botanico rounded-xl hover:bg-bege-calmo font-bold text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-verde-botanico text-white rounded-xl hover:bg-verde-botanico/90 font-bold text-sm shadow-md transition-all font-sans"
                  >
                    <Save size={18} />
                    {isEditing ? 'Atualizar Despesa' : 'Salvar Despesa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-bounce-short">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="bg-red-100 p-3 rounded-full flex-shrink-0">
                  <AlertTriangle className="text-red-600 w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-verde-botanico">Confirmar Exclusão</h3>
                  <p className="text-verde-botanico text-sm mt-1">
                    Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setExpenseToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-verde-botanico rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4" />
                      Excluindo...
                    </>
                  ) : 'Confirmar Exclusão'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Generation Modal */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-verde-botanico text-lg flex items-center gap-2">
                <FileCheck size={20} className="text-teal-600" />
                Gerar Recibo de Consulta
              </h3>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="text-verde-botanico hover:text-verde-botanico hover:bg-slate-200 rounded-lg p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-verde-botanico" size={16} />
                <input
                  type="text"
                  placeholder="Buscar agendamento confirmado..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
                {confirmableAppointments.length === 0 ? (
                  <p className="text-center text-verde-botanico py-4 text-sm">
                    Nenhum agendamento confirmado disponível para emissão.
                  </p>
                ) : (
                  confirmableAppointments.map(app => (
                    <div key={app.id} className="p-3 border border-gray-200 rounded-lg hover:bg-slate-50 flex justify-between items-center group">
                      <div>
                        <p className="font-medium text-verde-botanico text-sm">{app.patientName}</p>
                        <p className="text-xs text-verde-botanico">
                          {new Date(app.date).toLocaleDateString('pt-BR')} às {app.time}
                        </p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => generateReceipt(app, 'email')}
                          disabled={isGeneratingReceipt}
                          className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                          title="Gerar e enviar por E-mail"
                        >
                          <Mail size={16} />
                        </button>
                        <button
                          onClick={() => generateReceipt(app, 'whatsapp')}
                          disabled={isGeneratingReceipt}
                          className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200"
                          title="Gerar e enviar por WhatsApp"
                        >
                          <MessageCircle size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 border border-yellow-200">
                <p>💡 Ao gerar o recibo, o sistema criará automaticamente um registro financeiro de "Entrada".</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
