import { MedicalAdviceDisclaimer } from "@/app/components/MedicalAdviceDisclaimer";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col px-6 py-10">
      <p className="font-heading text-heading text-ink">Mend</p>
      <MedicalAdviceDisclaimer className="mt-auto" />
    </main>
  );
}
