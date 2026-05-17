import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../state/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@company.com");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login({ email, password });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <form onSubmit={handleSubmit} className="auth-form">
        <Card className="auth-card">
          <CardHeader className="auth-form-head">
            <span className="brand-kicker" style={{ color: "var(--accent-strong)" }}>
              Workflow Sphere
            </span>
            <span className="form-kicker">Connexion securisee</span>
            <CardTitle>Accedez a votre espace de travail</CardTitle>
            <CardDescription>Entrez vos identifiants pour continuer.</CardDescription>
          </CardHeader>

          <CardContent className="auth-fields">
            <div>
              <Label htmlFor="login-email">Email professionnel</Label>
              <Input
                id="login-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="login-password">Mot de passe</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
          </CardContent>

          <CardContent className="auth-actions">
            {error ? <p className="error-text">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connexion..." : "Entrer dans la plateforme"}
            </Button>

            <div className="auth-default-card">
              <span>Compte de demonstration</span>
              <strong>admin@company.com</strong>
              <small>Mot de passe: Admin123!</small>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
