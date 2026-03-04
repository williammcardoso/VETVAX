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
    <div className="min-h-[100svh] bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-[10px] border-[1.5px] border-border bg-card shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-primary text-primary-foreground font-semibold">
              V
            </div>
            <div>
              <div className="text-xs font-medium tracking-widest text-muted-foreground">VETVAX</div>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">Acesso ao sistema</h1>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit((v) => signIn.mutate(v))}>
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input id="username" className="h-10 rounded-[10px] border-[1.5px]" placeholder="ex: william" {...form.register("username")} />
              {form.formState.errors.username && (
                <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" className="h-10 rounded-[10px] border-[1.5px]" type="password" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="h-10 w-full rounded-[10px]" disabled={signIn.isPending}>
              {signIn.isPending ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
