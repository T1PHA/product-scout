import AnalysisView from "@/components/AnalysisView";

export default async function Page({ params }: PageProps<"/analyse/[id]">) {
  const { id } = await params;
  return <AnalysisView id={id} />;
}
