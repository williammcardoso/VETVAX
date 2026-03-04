import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  store_name: z.string().min(2, "Informe o nome da loja"),
  branch_name: z.string().optional(),
  display_name: z.string().optional(),
  store_phone: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export default function Onboarding() {
  const { refreshProfile } = useAuth();
  const nav = useNavigate();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      store_name: "VetVAX",
      branch_name: "",
      display_name: "",
      store_phone: "",
    },
  });

  const createOrg = useMutation({
    mutationFn: async (values: Values) => {
      const { data, error } = await supabase.rpc("onboard_create_org", {
        payload: {
          store_name: values.store_name,
          branch_name: values.branch_name,
          display_name: values.display_name,
          store_phone: values.store_phone,
          timezone: "America/Sao_Paulo",
          branding: { brand: "vetvax" },
        },
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await refreshProfile();
      toast({ title: "Organização criada", description: "Catálogo e templates seedados." });
      nav("/dashboard", { replace: true });
    },
    onError: (e: any) => {
      toast({
        title: "Falha no onboarding",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-[100svh] bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-xl rounded-[10px] border-[1.5px] border-border p-6 shadow-[0_6px_16px_rgba(0,0,0,0.08)] sm:p-8">
        <div className="text-xs font-medium tracking-widest text-muted-foreground">ONBOARDING</div>
        <h1 className="mt-2 text-2xl font-semibold">Crie sua organização</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Isso habilita o modo multi-tenant, RLS e seeds iniciais (catálogo + template Whats).
        </p>

        <form className="mt-6 grid gap-4" onSubmit={form.handleSubmit((v) => createOrg.mutate(v))}>
          <div className="grid gap-2">
            <Label>Nome da loja</Label>
            <Input className="h-10 rounded-[10px] border-[1.5px]" placeholder="Ex: Vet Center" {...form.register("store_name")} />
            {form.formState.errors.store_name && (
              <p className="text-xs text-destructive">{form.formState.errors.store_name.message}</p>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Filial (opcional)</Label>
              <Input className="h-10 rounded-[10px] border-[1.5px]" placeholder="Ex: Matriz" {...form.register("branch_name")} />
            </div>
            <div className="grid gap-2">
              <Label>Seu nome (opcional)</Label>
              <Input className="h-10 rounded-[10px] border-[1.5px]" placeholder="Ex: Ana" {...form.register("display_name")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Telefone da loja (opcional)</Label>
            <Input className="h-10 rounded-[10px] border-[1.5px]" placeholder="Ex: (11) 99999-9999" {...form.register("store_phone")} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="submit" className="h-10 rounded-[10px]" disabled={createOrg.isPending}>
              {createOrg.isPending ? "Criando…" : "Criar e começar"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}