import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { DemoBadge } from "@/app/AppShell";
import { BrandMark } from "@/components/BrandMark";
import { HeroArt } from "@/components/HeroArt";
import { Button, Field, Input, Notice } from "@/components/ui";
import { db } from "@/services/data";
import { errorMessage } from "@/lib/useAsync";

const email = z.string().trim().min(1, "Escribe tu correo.").email("Revisa el formato del correo.");
const password = z.string().min(8, "Usa al menos 8 caracteres.").max(72, "Máximo 72 caracteres.")
  .regex(/[A-Za-z]/, "Incluye al menos una letra.").regex(/\d/, "Incluye al menos un número.");

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hero-surface relative m-4 hidden overflow-hidden rounded-[2.25rem] shadow-card lg:flex lg:flex-col lg:justify-between lg:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Entrena a tu manera</p>
        <HeroArt className="mx-auto w-full max-w-md" />
        <div>
          <p className="font-display text-4xl font-semibold leading-tight">Fuerza, constancia y <em className="[font-style:var(--display-em-style)]">bienestar</em> con un plan hecho para ti.</p>
          <p className="mt-3 max-w-md text-white/80">Entrenamientos según tu equipo y tu nivel, nutrición flexible y un coach que conoce tu progreso.</p>
        </div>
      </div>
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md rounded-card border border-border/60 bg-surface/80 p-6 shadow-card backdrop-blur-xl sm:p-8">
          <BrandMark />
          <h1 className="display-hero mt-8 text-4xl">{title}</h1>
          <p className="mt-2 text-muted">{subtitle}</p>
          {db.mode === "local" && <div className="mt-4"><DemoBadge /></div>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

const loginSchema = z.object({ email, password: z.string().min(1, "Escribe tu contraseña.") });

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await db.auth.signIn(v.email, v.password);
      navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  return (
    <AuthLayout title="Hola de nuevo" subtitle="Inicia sesión para continuar con tu plan.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Correo" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field label="Contraseña" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" invalid={!!errors.password} {...register("password")} />
        </Field>
        <div className="text-right text-sm"><Link to="/forgot-password" className="font-medium text-primary-strong hover:underline">¿Olvidaste tu contraseña?</Link></div>
        <Button type="submit" block size="lg" loading={isSubmitting}>Iniciar sesión</Button>
        <p className="text-center text-sm text-muted">¿Aún no tienes cuenta? <Link to="/signup" className="font-semibold text-primary-strong hover:underline">Crear cuenta</Link></p>
      </form>
    </AuthLayout>
  );
}

const signupSchema = z.object({
  name: z.string().trim().min(1, "¿Cómo quieres que te llamemos?").max(50),
  email,
  password,
  confirm: z.string(),
  terms: z.literal(true, { errorMap: () => ({ message: "Debes aceptar el aviso de privacidad para continuar." }) }),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden." });

export function SignupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [verify, setVerify] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof signupSchema>>({ resolver: zodResolver(signupSchema) });
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const r = await db.auth.signUp(v.email, v.password, v.name);
      if (r.needsEmailVerification) setVerify(v.email);
      else navigate("/onboarding", { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  if (verify) {
    return (
      <AuthLayout title="Revisa tu correo" subtitle={`Te enviamos un enlace de verificación a ${verify}.`}>
        <Notice title="Último paso">Abre el enlace del correo para activar tu cuenta y vuelve para iniciar sesión.</Notice>
        <Link to="/login" className="mt-6 block"><Button block variant="outline">Ir a iniciar sesión</Button></Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Crea tu cuenta" subtitle="En unos minutos tendrás un plan de entrenamiento y nutrición a tu medida.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Nombre o cómo prefieres que te llamemos" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="given-name" invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field label="Correo" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field label="Contraseña" htmlFor="password" error={errors.password?.message} hint="Mínimo 8 caracteres, con letras y números.">
          <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password} {...register("password")} />
        </Field>
        <Field label="Confirma la contraseña" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register("confirm")} />
        </Field>
        <div>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--primary-strong))]" {...register("terms")} />
            <span>
              Entiendo que mis datos de salud, medidas, fotos y conversaciones son privados, que solo yo puedo verlos y que puedo
              exportarlos o borrarlos cuando quiera. Esta app no sustituye el consejo médico.
            </span>
          </label>
          {errors.terms && <p role="alert" className="mt-1 text-xs font-medium text-danger">{errors.terms.message}</p>}
        </div>
        <Button type="submit" block size="lg" loading={isSubmitting}>Crear cuenta</Button>
        <p className="text-center text-sm text-muted">¿Ya tienes cuenta? <Link to="/login" className="font-semibold text-primary-strong hover:underline">Inicia sesión</Link></p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const schema = z.object({ email });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      setMessage(await db.auth.requestPasswordReset(v.email));
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  return (
    <AuthLayout title="Recupera tu contraseña" subtitle="Te ayudamos a volver a entrar.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        {message && <Notice>{message}</Notice>}
        <Field label="Correo" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register("email")} />
        </Field>
        <Button type="submit" block size="lg" loading={isSubmitting}>Enviar instrucciones</Button>
        {message && db.mode === "local" && <Link to="/reset-password" className="block"><Button block variant="outline">Elegir contraseña nueva</Button></Link>}
        <p className="text-center text-sm"><Link to="/login" className="font-semibold text-primary-strong hover:underline">Volver a iniciar sesión</Link></p>
      </form>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const schema = z.object({ password, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden." });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await db.auth.updatePassword(v.password);
      navigate("/", { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  return (
    <AuthLayout title="Nueva contraseña" subtitle="Elige una contraseña segura que no uses en otros sitios.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Contraseña nueva" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password} {...register("password")} />
        </Field>
        <Field label="Confírmala" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register("confirm")} />
        </Field>
        <Button type="submit" block size="lg" loading={isSubmitting}>Guardar contraseña</Button>
      </form>
    </AuthLayout>
  );
}
