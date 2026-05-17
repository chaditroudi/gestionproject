import { Card, CardContent } from "./ui/card";

export default function StatCard({ label, value, tone = "default", helper }) {
  const toneMap = {
    default: "text-foreground",
    amber: "text-amber-700",
    green: "text-emerald-700",
    red: "text-rose-700"
  };

  return (
    <Card className="stat-card">
      <CardContent className="p-4">
        <span className="stat-label">{label}</span>
        <strong className={`stat-value ${toneMap[tone] || toneMap.default}`}>{value}</strong>
        {helper ? <small className="stat-helper">{helper}</small> : null}
      </CardContent>
    </Card>
  );
}
