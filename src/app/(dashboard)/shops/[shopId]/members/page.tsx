import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ShopMembersPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  const supabase = await createClient();

  // Look up the shop's village and redirect to village members page
  const { data: shop } = await supabase
    .from("shops")
    .select("village_id")
    .eq("id", shopId)
    .single();

  if (shop?.village_id) {
    redirect(`/villages/${shop.village_id}/members`);
  }

  redirect(`/shops/${shopId}`);
}
