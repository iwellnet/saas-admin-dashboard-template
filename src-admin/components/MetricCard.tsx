import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
};

export function MetricCard({ title, value, hint, icon, trend }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {hint && (
          <p
            className={cn(
              "text-xs mt-1",
              trend === "up" && "text-success",
              trend === "down" && "text-destructive",
              (!trend || trend === "neutral") && "text-muted-foreground"
            )}
          >
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
