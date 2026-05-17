import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export default function AccessDenied({ title = "Acces refuse", message }) {
  return (
    <Card className="notice-panel">
      <CardHeader>
        <span className="panel-eyebrow">Restriction d'acces</span>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{message || "Votre role ne vous donne pas acces a cet espace."}</p>
      </CardContent>
    </Card>
  );
}
