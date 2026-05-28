import "../../../styles/admin.css";
import LoginForm from "./LoginForm";

type SearchParams = Promise<{ next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/admin";
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Sign in</h1>
        <p className="muted" style={{ marginBottom: "var(--s-16)" }}>
          Shared password. Ask Jamie if you forgot it.
        </p>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
