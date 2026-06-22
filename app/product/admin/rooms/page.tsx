import { redirect } from "next/navigation";

export default async function AdminRoomsRedirectPage({
  params,
}: {
  params?: Promise<{ hackathonSlug?: string }>;
}) {
  const resolvedParams = params ? await params : {};
  redirect(
    resolvedParams.hackathonSlug
      ? `/product/h/${resolvedParams.hackathonSlug}/admin/ideas`
      : "/product/admin/ideas",
  );
}
