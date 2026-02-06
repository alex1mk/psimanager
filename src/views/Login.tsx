import React, { useState } from "react";
import {
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { signIn } from "../services/supabaseService";

interface LoginProps {
  onLogin: (user: { name: string; email: string }) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState("carmem@clareser.com.br");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const user = await signIn(email, password);

      if (user) {
        onLogin({
          name: user.user_metadata?.name || email.split("@")[0],
          email: user.email || email,
        });
      }
    } catch (err: any) {
      console.error("Login error:", err);

      // Translate common Supabase errors to Portuguese
      if (err.message?.includes("Invalid login credentials")) {
        setError("E-mail ou senha incorretos. Tente novamente.");
      } else if (err.message?.includes("Email not confirmed")) {
        setError("E-mail não confirmado. Verifique sua caixa de entrada.");
      } else {
        setError(err.message || "Erro ao fazer login. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!email) {
      setError("Por favor, digite seu e-mail para recuperar a senha.");
      return;
    }

    // TODO: Implement password recovery with Supabase
    setSuccessMessage(
      `Enviamos as instruções de recuperação para ${email}. Verifique sua caixa de entrada.`,
    );
  };

  return (
    <div className="min-h-screen bg-bege-calmo flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <style>{`
        /* Hack to remove browser autofill background color */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 30px white inset !important;
            -webkit-text-fill-color: #334155 !important;
            transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-verde-botanico rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6">
            <span className="text-bege-calmo font-handwriting text-3xl">P</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-4xl font-display text-verde-botanico tracking-tight">
          PsiManager
        </h2>
        <p className="mt-2 text-center text-lg text-verde-botanico/80 font-handwriting">
          Gestão Clínica Inteligente & Humanizada
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-verde-botanico"
              >
                E-mail Profissional
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-verde-botanico" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-[#5B6D5B] focus:border-[#5B6D5B] block w-full pl-10 sm:text-sm border-gray-300 rounded-lg p-3 border bg-white text-verde-botanico"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-verde-botanico"
              >
                Senha
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-verde-botanico" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-[#5B6D5B] focus:border-[#5B6D5B] block w-full pl-10 sm:text-sm border-gray-300 rounded-lg p-3 border bg-white text-verde-botanico"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4 animate-fade-in border border-red-100">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle
                      className="h-5 w-5 text-red-400"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {error}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="rounded-md bg-green-50 p-4 animate-fade-in border border-green-100">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      {successMessage}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-[#5B6D5B] focus:ring-[#5B6D5B] border-gray-300 rounded bg-white shadow-none accent-[#5B6D5B]"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-verde-botanico"
                >
                  Lembrar-me
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-medium text-[#5B6D5B] hover:text-[#5B6D5B] border-0 bg-transparent p-0"
                >
                  Esqueceu a senha?
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-full shadow-sm text-sm font-bold text-white bg-[#5B6D5B] hover:bg-[#5B6D5B] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5B6D5B] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Acessar Plataforma
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-verde-botanico">
                  Acesso seguro & Criptografado
                </span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-3">
              <div className="flex items-center justify-center gap-2 text-xs text-verde-botanico">
                <CheckCircle size={12} className="text-[#5B6D5B]" />
                LGPD Compliance
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
