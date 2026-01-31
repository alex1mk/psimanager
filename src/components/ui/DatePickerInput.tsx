import React, { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-day-picker/dist/style.css";
import "../../styles/daypicker.css";

interface DatePickerInputProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  className = "",
  disabled = false,
  minDate,
  maxDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({
    vert: "open-down",
    horiz: "open-right",
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fechar calendário ao clicar fora ou ESC
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      updatePosition();
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  // Lógica de posicionamento inteligente
  const updatePosition = () => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Se houver menos de 300px abaixo, abre para cima
    const vert = viewportHeight - rect.bottom < 300 ? "open-up" : "open-down";

    // Se estiver muito à direita, abre para a esquerda
    const horiz = viewportWidth - rect.left < 280 ? "open-left" : "open-right";

    setPopoverPos({ vert, horiz });
  };

  const toggleCalendar = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const [currentMonth, setCurrentMonth] = useState<Date>(value || new Date());

  // Sincronizar o mês exibido quando o valor externo muda (ex: reset de formulário)
  useEffect(() => {
    if (value) {
      const targetMonth = new Date(value.getFullYear(), value.getMonth(), 1);
      const currentMonthStart = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1,
      );

      if (targetMonth.getTime() !== currentMonthStart.getTime()) {
        console.log(
          "[DatePickerInput] Sincronizando mês com valor selecionado",
        );
        setCurrentMonth(targetMonth);
      }
    }
  }, [value]);

  const handleMonthChange = (newMonth: Date) => {
    console.log(
      "[DatePickerInput] Navegação:",
      format(newMonth, "MMMM yyyy", { locale: ptBR }),
    );
    setCurrentMonth(newMonth);
    // Garantir que a posição do popover seja reavaliada se o tamanho mudar
    setTimeout(updatePosition, 0);
  };

  const handleSelect = (date: Date | undefined) => {
    onChange(date);
    if (date) {
      const newMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      setCurrentMonth(newMonth);
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`day-picker-container ${className}`}>
      <div className="relative">
        <input
          type="text"
          readOnly
          value={value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : ""}
          onClick={toggleCalendar}
          placeholder={placeholder}
          disabled={disabled}
          className={`
                        w-full px-4 py-2 border border-gray-300 rounded-lg 
                        cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-500
                        ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white hover:border-gray-400"}
                        transition-colors duration-200
                        text-verde-botanico font-medium
                    `}
        />

        <svg
          className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          className={`day-picker-popover ${popoverPos.vert} ${popoverPos.horiz}`}
          style={{ zIndex: 9999 }}
        >
          <DayPicker
            mode="single"
            selected={value}
            onSelect={handleSelect}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            locale={ptBR}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            formatters={{
              formatWeekdayName: (date) =>
                format(date, "ccccc", { locale: ptBR }),
            }}
          />
        </div>
      )}
    </div>
  );
};
