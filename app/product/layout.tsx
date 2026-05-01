import { ProductLayoutClient } from "@/components/ProductLayoutClient";
import { ReactNode } from "react";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return <ProductLayoutClient>{children}</ProductLayoutClient>;
}
