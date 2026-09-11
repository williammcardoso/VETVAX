import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { usernameToEmail } from "@/lib/username";
import VetVaxMark from "@/components/branding/VetVaxMark";

const schema = z.object({
  username: z.string().min(3, "Informe o usuário"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type Values = z.infer<typeof schema>;

export default function Login() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    const from = (location.state as any)?.from as string | undefined;
    nav(from ?? "/dashboard", { replace: true });
  }, [loading, user, location.state, nav]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const signIn = useMutation({
    mutationFn: async (values: Values) => {
      const email = usernameToEmail(values.username);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: values.password,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Bem-vindo(a)" });
    },
    onError: (e: any) => {
      toast({
        title: "Falha no login",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="grid min-h-[100svh] bg-vetvax-bg lg:grid-cols-[minmax(0,1.15fr)_minmax(0,520px)]">
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1220] via-[#0f172a] to-[#0d4f4a]" />
        <div className="pointer-events-none absolute -left-24 top-1/4 h-[420px] w-[420px] rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-blue-500/15 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-3">
            <VetVaxMark className="h-12 w-12 rounded-[14px] ring-1 ring-white/20" />
            <div className="h-px flex-1 max-w-[120px] bg-gradient-to-r from-white/35 to-transparent" />
          </div>
          <div className="space-y-4 pb-4">
            <div className="h-2 w-2 rounded-full bg-teal-300/90" />
            <div className="flex gap-2 opacity-80">
              <span className="h-1.5 w-10 rounded-pill bg-white/25" />
              <span className="h-1.5 w-6 rounded-pill bg-white/15" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-4 sm:p-8">
        <Card className="vetvax-card-polish w-full max-w-md border-vetvax-border-soft bg-white/95 shadow-vetvax-card ring-1 ring-black/[0.03] backdrop-blur-sm">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <VetVaxMark className="h-10 w-10 drop-shadow-[0_10px_20px_rgba(16,185,129,0.26)]" />
              <div>
                <div className="text-xs font-semibold tracking-widest text-vetvax-text-tertiary">VETVAX</div>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-vetvax-text-main">Acesso ao sistema</h1>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={form.handleSubmit((v) => signIn.mutate(v))}>
              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <Input id="username" placeholder="ex: william" {...form.register("username")} />
                {form.formState.errors.username && (
                  <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" {...form.register("password")} />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="h-11 w-full" disabled={signIn.isPending}>
                {signIn.isPending ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
