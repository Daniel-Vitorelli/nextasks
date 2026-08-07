import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(), // you need to pass the headers object.
  });

  if (!session) {
    redirect("/");
  } else {
    console.log(session);
  }

  return <div>Olá {session.user.name}</div>;
}

export default DashboardPage;
