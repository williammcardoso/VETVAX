import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  email: z.string().email("Informe um email válido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type Values = z.infer<typeof schema>;

function BrandPanel() {
  return (
    <div className="hidden lg:block relative overflow-hidden rounded-3xl border bg-card">
      <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--brand))]/20 blur-2xl" />
      <div className="absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-[hsl(var(--brand-2))]/18 blur-2xl" />
      <div className="relative p-10">
        <div className="text-xs font-medium tracking-widest text-muted-foreground">VETVAX</div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight">
          Agenda + vacinação com lembretes fortes, do jeito certo.
        </h1>
        <p className="mt-4 text-sm text-muted-foreground max-w-[48ch]">
          Multi-tenant por organização, RBAC e trilha de auditoria — pronto para crescer.
        </p>
        <div className="mt-8 rounded-2xl border bg-background/70 p-4">
          <div className="text-xs text-muted-foreground">Dica rápida</div>
          <div className="mt-1 text-sm">
            Use <span className="font-semibold">Cmd + K</span> para busca global (tutores e ações).
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const signIn = useMutation({
    mutationFn: async (values: Values) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
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

  const signUp = useMutation({
    mutationFn: async (values: Values) => {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Conta criada",
        description: "Agora você já pode entrar com seu email e senha.",
      });
    },
    onError: (e: any) => {
      toast({
        title: "Falha ao criar conta",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-[100svh] bg-background">
      <div className="mx-auto grid min-h-[100svh] max-w-6xl grid-cols-1 gap-6 p-4 lg:grid-cols-2 lg:items-stretch lg:p-8">
        <BrandPanel />

        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md rounded-3xl border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium tracking-widest text-muted-foreground">ACESSO</div>
                  <h2 className="mt-2 text-2xl font-semibold">Entrar no VetVAX</h2>
                </div>
              </div>

              <Tabs defaultValue="login" className="mt-6">
                <TabsList className="grid w-full grid-cols-2 rounded-2xl">
                  <TabsTrigger value="login" className="rounded-2xl">
                    Login
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-2xl">
                    Criar conta
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-6">
                  <form
                    className="space-y-4"
                    onSubmit={form.handleSubmit((v) => signIn.mutate(v))}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" placeholder="voce@empresa.com" {...form.register("email")} />
                      {form.formState.errors.email && (
                        <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <Input id="password" type="password" {...form.register("password")} />
                      {form.formState.errors.password && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full rounded-2xl"
                      disabled={signIn.isPending}
                    >
                      {signIn.isPending ? "Entrando…" : "Entrar"}
                    </Button>

                    <p className="text-xs text-muted-foreground">
                      Ao entrar, você concorda em usar este sistema apenas com consentimento do tutor.
                    </p>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <form
                    className="space-y-4"
                    onSubmit={form.handleSubmit((v) => signUp.mutate(v))}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="email2">Email</Label>
                      <Input id="email2" placeholder="voce@empresa.com" {...form.register("email")} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password2">Senha</Label>
                      <Input id="password2" type="password" {...form.register("password")} />
                    </div>

                    <Button
                      type="submit"
                      className="w-full rounded-2xl"
                      variant="secondary"
                      disabled={signUp.isPending}
                    >
                      {signUp.isPending ? "Criando…" : "Criar conta"}
                    </Button>

                    <p className="text-xs text-muted-foreground">
                      Se sua organização usa convites, um admin poderá ajustar seu acesso depois.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}