import { ProductDetailClient } from "./client-page";

export async function generateStaticParams() {
  return [
    { name: "default" }, // Generate at least one static page to satisfy output: export requirements
  ];
}

export default function Page({ params }: { params: { name: string } }) {
  // We can pass params if needed, but the client component currently handles it differently or ignores it.
  return <ProductDetailClient />;
}
