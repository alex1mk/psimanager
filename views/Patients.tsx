import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash,
  X,
  Save,
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  CreditCard,
  Loader2,
  AlertTriangle,
  MessageCircle,
  CheckCircle,
  FileSpreadsheet,
  Upload,
  CalendarClock,
} from "lucide-react";
import { Patient, PaymentType, Appointment } from "../types";
import {
  createAppointment,
  sendNotification,
} from "../services/supabaseService";
import { patientService } from "../services/features/patients/patient.service";
import { Alert } from "../components/ui/Alert";
import { DatePickerInput } from "../src/components/ui/DatePickerInput";
import { useClickOutside } from "../src/hooks/useClickOutside";
import ExcelJS from "exceljs";
import { supabase } from "../src/lib/supabase";
import { AppointmentEngine } from "../services/features/appointments/appointment-engine.service";
import PreScheduleModal from "../src/components/appointments/PreScheduleModal";

// Mapeamento de valores Excel → Banco (PT-BR)
const PAYMENT_TYPE_MAP: Record<string, string> = {
  sessao: "Sessão",
  sessão: "Sessão",
  "por sessao": "Sessão",
  "por sessão": "Sessão",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  mensalidade: "Mensal",
  mes: "Mensal",
  mês: "Mensal",
};

// Função de sanitização antes de inserir
function sanitizePatientData(excelRow: any) {
  const rawPaymentType = String(excelRow.payment_type || "")
    .trim()
    .toLowerCase();
  const mappedPaymentType = PAYMENT_TYPE_MAP[rawPaymentType] || "Sessão";

  if (!mappedPaymentType) {
    throw new Error(
      `Tipo de pagamento inválido: "${rawPaymentType}". ` +
      `Valores aceitos: Sessão, Quinzenal, Mensal`,
    );
  }

  return {
    name: excelRow.name?.trim(),
    email: excelRow.email?.trim().toLowerCase(),
    phone: excelRow.phone?.toString().replace(/\D/g, ""),
    payment_type: mappedPaymentType,
    fixed_day: excelRow.fixed_day?.trim() || "Segunda-feira",
    fixed_time: excelRow.fixed_time || "08:00",
    status: "active",
  };
}

const Patients: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreScheduleModalOpen, setIsPreScheduleModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Modal State
  const [patientToDelete, setPatientToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formDate, setFormDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Click outside to close date picker
  useClickOutside(datePickerRef, () => setIsDatePickerOpen(false), isDatePickerOpen);

  const [currentPatient, setCurrentPatient] = useState<Partial<Patient>>({
    name: "",
    email: "",
    phone: "",
    paymentType: PaymentType.SESSION,
    fixedDay: "Segunda-feira",
    fixedTime: "10:00",
    status: "active",
  });

  const [isEditing, setIsEditing] = useState(false);

  const fetchPatients = async () => {
    const data = await patientService.getAll();
    setPatients(data);
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getCleanPhone = (phone: string) => phone.replace(/\D/g, "");

  const getDayNameFromDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const days = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];
    return days[date.getDay()];
  };

  const handleOpenModal = (patient?: Patient) => {
    if (patient) {
      setCurrentPatient(patient);
      setFormDate(new Date().toISOString().split("T")[0]);
      setIsEditing(true);
    } else {
      setCurrentPatient({
        name: "",
        email: "",
        phone: "",
        paymentType: PaymentType.SESSION,
        fixedDay: "",
        fixedTime: "08:00",
        status: "active",
      });
      setFormDate(new Date().toISOString().split("T")[0]);
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleOpenDeleteModal = (id: string) => {
    setPatientToDelete(id);
  };

  const confirmDelete = async () => {
    if (!patientToDelete) return;
    setIsDeleting(true);
    try {
      await patientService.delete(patientToDelete);
      setPatients((prev) => prev.filter((p) => p.id !== patientToDelete));
      setAlert({ type: "success", message: "Paciente removido com sucesso." });
    } catch (error) {
      setAlert({ type: "error", message: "Erro ao excluir paciente." });
    } finally {
      setIsDeleting(false);
      setPatientToDelete(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPatient.name || !currentPatient.email) {
      setAlert({ type: "error", message: "Nome e E-mail são obrigatórios." });
      return;
    }
    setIsLoading(true);

    try {
      const calculatedFixedDay = getDayNameFromDate(formDate);
      const patientData = {
        ...currentPatient,
        fixedDay: calculatedFixedDay,
      } as Patient;

      if (isEditing && currentPatient.id) {
        const updated = await patientService.update(patientData);
        setPatients((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
        setAlert({
          type: "success",
          message: "Dados do paciente atualizados com sucesso!",
        });
      } else {
        let createdPatient: Patient | null = null;
        try {
          // Normalizar e enviar dados
          const { id, ...createData } = patientData;
          createdPatient = await patientService.create(createData as Patient);

          // Agora usamos o AppointmentEngine para criar o primeiro agendamento
          // e enviar as notificações (que agora devem vir dele ou da Edge Function trigger)
          try {
            console.log(`[Patients] Inicializando motor para ${createdPatient.name}`);

            // Passo 1: Criar agendamento inicial via engine
            // O engine já cuida da validação e conflitos
            const appResult = await AppointmentEngine.createAppointment({
              patient_id: createdPatient.id,
              scheduled_date: formDate,
              scheduled_time: createdPatient.fixedTime,
              recurrence_type: 'weekly' // Padrão para novos pacientes
            }, 'pending_confirmation');

            if (!appResult.success) throw new Error(appResult.error);

            setPatients((prev) => [...prev, createdPatient!]);
            setAlert({
              type: "success",
              message: "Paciente salvo e agendado com sucesso!",
            });
          } catch (appErr: any) {
            console.error("Error creating initial appointment with engine:", appErr);
            setPatients((prev) => [...prev, createdPatient!]);
            setAlert({
              type: "success",
              message:
                "Paciente salvo, mas houve um erro ao criar o agendamento automático. Por favor, agende manualmente.",
            });
          }
        } catch (err: any) {
          console.error("Error saving patient:", err);
          setAlert({
            type: "error",
            message: `Erro ao salvar paciente: ${err.message || "Verifique sua conexão."}`,
          });
          throw err;
        }
      }
      setIsModalOpen(false);
    } catch (outerError) {
      // Outer error handled by toast/alert state
    } finally {
      setIsLoading(false);
    }
  };

  // Excel Import Logic
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setAlert(null);

    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error("Planilha vazia");

      // Get headers from first row
      const headers: string[] = [];
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || "")
          .toLowerCase()
          .trim();
      });

      const excelRows: any[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const rowData: Record<string, any> = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber];
          if (header) rowData[header] = cell.value;
        });

        // Smart Map to internal keys
        const findVal = (keys: string[]) => {
          for (const k of keys) {
            if (rowData[k] !== undefined) return rowData[k];
          }
          return null;
        };

        const name = findVal(["nome", "name", "paciente"]);
        const email = findVal(["email", "e-mail", "mail"]);
        const phone = findVal(["telefone", "phone", "celular", "whatsapp"]);
        const payment = findVal([
          "pagamento",
          "tipo",
          "payment",
          "payment_type",
        ]);
        const fixedDay = findVal(["dia", "dia fixo", "fixed_day"]);
        const fixedTime = findVal(["horario", "hora", "time", "fixed_time"]);

        if (name && email) {
          excelRows.push({
            name,
            email,
            phone,
            payment_type: payment,
            fixed_day: fixedDay,
            fixed_time: fixedTime,
          });
        }
      });

      const results = {
        success: [] as string[],
        ignored: 0,
        failed: [] as { name: string; reason: string }[],
      };

      // 1. Sanitize and prepare all rows
      const sanitizedRows = excelRows
        .map((row) => {
          try {
            return sanitizePatientData(row);
          } catch (e) {
            results.failed.push({
              name: row.name || "Inválido",
              reason: "Erro na sanitização",
            });
            return null;
          }
        })
        .filter(Boolean) as any[];

      if (sanitizedRows.length === 0 && results.failed.length === 0) {
        throw new Error("Nenhum dado válido encontrado na planilha.");
      }

      // 2. Check for duplicates in DB
      const emailsToCheck = sanitizedRows.map((r) => r.email);
      const { data: existingPatients, error: checkError } = await supabase
        .from("patients")
        .select("email")
        .in("email", emailsToCheck);

      if (checkError) throw checkError;

      const existingEmails = new Set(
        existingPatients?.map((p) => p.email) || [],
      );
      const newPatients = sanitizedRows.filter(
        (r) => !existingEmails.has(r.email),
      );
      results.ignored = sanitizedRows.length - newPatients.length;

      // 3. Insert New Patients individually with individual Error Handling for total resilience
      if (newPatients.length > 0) {
        console.log(
          `[Import] Processando ${newPatients.length} pacientes novos individualmente para maior resiliência...`,
        );

        for (const p of newPatients) {
          try {
            const { error: insertError } = await supabase
              .from("patients")
              .upsert(p, { onConflict: "email" });

            if (insertError) {
              const isDuplicate =
                insertError.code === "23505" ||
                insertError.message.toLowerCase().includes("duplicate");
              if (isDuplicate) {
                console.warn(
                  `[Import] Paciente ${p.name} ignorado: E-mail já existe (Database level check).`,
                );
                results.ignored++;
              } else {
                throw insertError;
              }
            } else {
              results.success.push(p.name);
            }
          } catch (err: any) {
            console.error(`[Import] Erro crítico ao importar ${p.name}:`, err);
            results.failed.push({
              name: p.name,
              reason: err.message || "Erro de conexão/banco",
            });
          }
        }
      }

      const message = `Importação concluída: ${results.success.length} novos pacientes cadastrados. ${results.ignored} ignorados por já existirem.`;

      setAlert({
        type: results.failed.length > 0 ? "error" : "success",
        message:
          results.failed.length > 0
            ? `${message} (${results.failed.length} falhas críticas detectadas)`
            : message,
      });

      if (results.failed.length > 0) {
        console.table(results.failed);
      }

      if (results.success.length > 0 || results.ignored > 0) {
        fetchPatients();
      }
    } catch (error) {
      console.error(error);
      setAlert({
        type: "error",
        message: "Erro crítico ao processar planilha.",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleChange = (field: keyof Patient, value: any) => {
    setCurrentPatient((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-verde-botanico">Pacientes</h2>
          <p className="text-verde-botanico">
            Gestão de cadastro e pagamentos.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls"
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 bg-white text-verde-botanico border border-verde-botanico/20 rounded-xl hover:bg-bege-calmo shadow-sm transition-all font-bold text-sm"
          >
            {isImporting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={18} />
            )}
            Importar Excel
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-verde-botanico text-white rounded-xl hover:bg-verde-botanico/90 shadow-md hover:shadow-lg transition-all font-sans font-bold text-sm"
          >
            <Plus size={18} />
            Novo Paciente
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

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-verde-botanico"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400 text-verde-botanico"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-verde-botanico">
            <thead className="bg-gray-50 text-verde-botanico font-semibold uppercase text-xs">
              <tr>
                <th className="px-6 py-4">Nome / Contato</th>
                <th className="px-6 py-4">Pagamento</th>
                <th className="px-6 py-4">Horário Fixo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPatients.map((patient) => (
                <tr
                  key={patient.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-verde-botanico">
                      {patient.name}
                    </div>
                    <div className="text-xs text-verde-botanico mb-1">
                      {patient.email}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <a
                        href={`https://wa.me/55${getCleanPhone(patient.phone)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 transition-colors"
                      >
                        <MessageCircle size={12} />
                        WhatsApp
                      </a>
                      <a
                        href={`tel:${getCleanPhone(patient.phone)}`}
                        className="flex items-center gap-1 text-xs text-verde-botanico hover:text-verde-botanico bg-slate-100 px-2 py-0.5 rounded border border-slate-200 transition-colors"
                      >
                        <Phone size={12} />
                        Ligar
                      </a>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-verde-botanico/10 text-verde-botanico px-2 py-1 rounded-md text-xs font-bold border border-verde-botanico/20">
                      {patient.paymentType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-verde-botanico">
                      {patient.fixedDay}
                    </div>
                    <div className="text-xs text-verde-botanico">
                      {patient.fixedTime}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${patient.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-verde-botanico"}`}
                    >
                      {patient.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedPatientId(patient.id);
                          setIsPreScheduleModalOpen(true);
                        }}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-xl transition-all border border-transparent hover:border-green-100 shadow-sm"
                        title="Iniciar Pré-Agendamento"
                      >
                        <CalendarClock size={16} />
                      </button>
                      <button
                        onClick={() => handleOpenModal(patient)}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100 shadow-sm"
                        title="Editar Ficha"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleOpenDeleteModal(patient.id)}
                        className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 shadow-sm"
                        title="Excluir Paciente"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPatients.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-verde-botanico"
                  >
                    Nenhum paciente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl modal-content">
            <div className="bg-bege-calmo/50 p-4 border-b border-verde-botanico/10 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold text-verde-botanico text-lg flex items-center gap-2 font-sans">
                {isEditing ? <Edit2 size={20} /> : <Plus size={20} />}
                {isEditing ? "Editar Paciente" : "Novo Paciente"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-verde-botanico/40 hover:text-verde-botanico hover:bg-verde-botanico/10 p-1 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-inner-scroll p-6">
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Nome */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-verde-botanico mb-1">
                      Nome Completo
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-verde-botanico" />
                      </div>
                      <input
                        type="text"
                        required
                        value={currentPatient.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        className="bg-white pl-10 w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2.5 border text-verde-botanico"
                        placeholder="Ex: João da Silva"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-verde-botanico mb-1">
                      E-mail
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-verde-botanico" />
                      </div>
                      <input
                        type="email"
                        required
                        value={currentPatient.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        className="bg-white pl-10 w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2.5 border text-verde-botanico"
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>

                  {/* Telefone */}
                  <div>
                    <label className="block text-sm font-medium text-verde-botanico mb-1">
                      Telefone
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-verde-botanico" />
                      </div>
                      <input
                        type="tel"
                        value={currentPatient.phone}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, "");
                          if (val.length > 11) val = val.slice(0, 11);
                          let formatted = val;
                          if (val.length > 2)
                            formatted = `(${val.slice(0, 2)}) ${val.slice(2)}`;
                          if (val.length > 7)
                            formatted = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
                          handleChange("phone", formatted);
                        }}
                        className="bg-white pl-10 w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2.5 border text-verde-botanico"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  {/* Tipo de Pagamento */}
                  <div>
                    <label className="block text-sm font-medium text-verde-botanico mb-1">
                      Tipo de Pagamento
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <CreditCard className="h-5 w-5 text-verde-botanico" />
                      </div>
                      <select
                        value={currentPatient.paymentType}
                        onChange={(e) =>
                          handleChange("paymentType", e.target.value)
                        }
                        className="bg-white pl-10 w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2.5 border text-verde-botanico"
                      >
                        <option value={PaymentType.SESSION}>Por Sessão</option>
                        <option value={PaymentType.BIWEEKLY}>Quinzenal</option>
                        <option value={PaymentType.MONTHLY}>Mensal</option>
                      </select>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-verde-botanico mb-1">
                      Status
                    </label>
                    <select
                      value={currentPatient.status}
                      onChange={(e) => handleChange("status", e.target.value)}
                      className="bg-white w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2.5 border text-verde-botanico"
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div className="col-span-2 text-sm font-semibold text-verde-botanico mb-[-10px] flex items-center gap-2">
                      <Calendar size={16} className="text-teal-600" />
                      Agendamento Inicial / Fixo
                    </div>
                    {/* Dia Fixo / Data Inicial */}
                    <div>
                      <label className="block text-sm font-medium text-verde-botanico mb-1">
                        Data da Primeira Consulta
                      </label>
                      <DatePickerInput
                        value={
                          formDate
                            ? new Date(formDate + "T12:00:00")
                            : undefined
                        }
                        onChange={(date) =>
                          setFormDate(
                            date ? date.toISOString().split("T")[0] : "",
                          )
                        }
                        placeholder="28/01/2026"
                      />
                    </div>

                    {/* Horário Fixo */}
                    <div>
                      <label className="block text-sm font-medium text-verde-botanico mb-1">
                        Horário
                      </label>
                      <div className="relative">
                        <input
                          type="time"
                          value={currentPatient.fixedTime}
                          onChange={(e) =>
                            handleChange("fixedTime", e.target.value)
                          }
                          className="bg-white w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2.5 border text-verde-botanico pr-10 appearance-none relative z-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        />
                        <div className="absolute top-1/2 right-3 -translate-y-1/2 pointer-events-none z-20 text-verde-botanico">
                          <Clock size={20} />
                        </div>
                      </div>
                    </div>

                    {!isEditing && (
                      <div className="col-span-2 text-xs text-verde-botanico bg-blue-50 p-2 rounded border border-blue-100 flex items-center gap-2">
                        <CheckCircle size={14} className="text-blue-600" />
                        <span>
                          Ao salvar, um agendamento será criado automaticamente
                          na agenda e as notificações (Email/Whatsapp) serão
                          enviadas obrigatoriamente.
                        </span>
                      </div>
                    )}
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
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-verde-botanico text-white rounded-xl hover:bg-verde-botanico/90 font-bold text-sm shadow-md transition-all disabled:opacity-70"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        {isEditing ? "Atualizar Dados" : "Salvar e Agendar"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {patientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-bounce-short">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="bg-red-100 p-3 rounded-full flex-shrink-0">
                  <AlertTriangle className="text-red-600 w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-verde-botanico">
                    Confirmar Exclusão
                  </h3>
                  <p className="text-verde-botanico text-sm mt-1">
                    Tem certeza que deseja excluir este paciente? Esta ação não
                    pode ser desfeita.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setPatientToDelete(null)}
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
                  ) : (
                    "Confirmar Exclusão"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Pre-Schedule Modal */}
      <PreScheduleModal
        isOpen={isPreScheduleModalOpen}
        onClose={() => {
          setIsPreScheduleModalOpen(false);
          setSelectedPatientId(undefined);
        }}
        onSuccess={() => {
          setAlert({
            type: "success",
            message: "Pré-agendamento realizado com sucesso!",
          });
          fetchPatients();
        }}
        patients={patients}
        initialPatientId={selectedPatientId}
      />
    </div>
  );
};

export default Patients;
