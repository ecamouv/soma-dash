import { createClient } from "@/lib/supabase/client";
import type { ClientPayment } from "@/lib/types";

export async function fetchClientPayments(clientId: string): Promise<ClientPayment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("client_payments")
    .select("*")
    .eq("client_id", clientId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data as ClientPayment[];
}

export async function createClientPayment(input: {
  clientId: string;
  dueDate: string;
  label?: string | null;
  amount?: number | null;
}): Promise<ClientPayment> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("client_payments")
    .insert({
      client_id: input.clientId,
      due_date: input.dueDate,
      label: input.label || null,
      amount: input.amount ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ClientPayment;
}

export async function deleteClientPayment(paymentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("client_payments").delete().eq("id", paymentId);
  if (error) throw error;
}
