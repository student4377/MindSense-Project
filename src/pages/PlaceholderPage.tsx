import DashboardLayout from "@/components/DashboardLayout";
import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
}

const PlaceholderPage = ({ title, description, icon: Icon }: Props) => (
  <DashboardLayout>
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <span className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center text-primary">
          <Icon className="h-6 w-6" />
        </span>
        {title}
      </h1>
      <p className="mt-3 text-muted-foreground">{description}</p>
    </div>
    <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
      <div className="text-5xl">✨</div>
      <h2 className="mt-4 font-bold text-xl">Coming soon</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        This section is being prepared and will be available shortly with full AI-powered features.
      </p>
    </div>
  </DashboardLayout>
);

export default PlaceholderPage;
